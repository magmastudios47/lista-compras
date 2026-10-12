// Supabase Edge Function: create-checkout
// Exige autenticación y calcula el monto estrictamente en el servidor desde la base de datos
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar autenticación de usuario
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado. Se requiere token de sesión.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida o expirada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Extraer parámetros del body
    const body = await req.json();
    const { household_id, plan_id, return_url } = body;

    if (!household_id || !plan_id) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos (household_id, plan_id).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Verificar que el usuario pertenece al hogar
    const { data: membership, error: memberErr } = await supabaseAdmin
      .from('household_members')
      .select('role')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      return new Response(JSON.stringify({ error: 'Acceso denegado: no sos integrante de este hogar.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Obtener planes y calcular monto estrictamente en el SERVIDOR
    const { data: plans, error: plansErr } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('is_active', true);

    if (plansErr || !plans) {
      return new Response(JSON.stringify({ error: 'Error al consultar la tabla de planes.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let amountUsd = 0;
    let effectivePlanId = plan_id;
    let planTitle = '';

    if (plan_id.startsWith('pack_')) {
      const { data: pack, error: packErr } = await supabaseAdmin
        .from('credit_recharge_packages')
        .select('*')
        .eq('id', plan_id)
        .eq('is_active', true)
        .maybeSingle();

      if (packErr || !pack) {
        return new Response(JSON.stringify({ error: 'El paquete de recarga seleccionado no es válido.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      amountUsd = Number(pack.price_usd);
      effectivePlanId = pack.id;
      planTitle = `Lista Compars - ${pack.name}`;
    } else {
      const targetPlan = plans.find((p) => p.id === (plan_id === 'upgrade' ? 'premium' : plan_id));
      if (!targetPlan || targetPlan.id === 'free') {
        return new Response(JSON.stringify({ error: 'El plan seleccionado no es válido para pago.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Consultar licencia actual para calcular posibles upgrades
      const { data: currentLicense } = await supabaseAdmin
        .from('licenses')
        .select('plan_id, status')
        .eq('household_id', household_id)
        .maybeSingle();

      amountUsd = Number(targetPlan.price_usd);
      effectivePlanId = targetPlan.id;
      planTitle = `Lista Compars - ${targetPlan.name}`;

      if (plan_id === 'upgrade') {
        if (currentLicense?.plan_id === 'base') {
          const basePlan = plans.find((p) => p.id === 'base');
          const basePrice = basePlan ? Number(basePlan.price_usd) : 10.0;
          amountUsd = Math.max(0, amountUsd - basePrice); // Diferencia: 20 - 10 = 10 USD
          effectivePlanId = 'premium';
          planTitle = 'Lista Compars - Upgrade a Plan Premium';
        } else {
          return new Response(JSON.stringify({ error: 'Solo se puede hacer upgrade si el hogar tiene Plan Base.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // 5. Obtener tipo de cambio oficial con control de sanidad
    const { data: rateData } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate')
      .eq('currency_from', 'USD')
      .eq('currency_to', 'ARS')
      .single();

    let rate = rateData ? Number(rateData.rate) : 1350.0;
    // Control de sanidad: tipo de cambio debe estar entre 500 y 10000
    if (rate < 500 || rate > 10000) {
      rate = 1350.0; // Fallback seguro
    }

    const amountArs = Math.round(amountUsd * rate);

    // 6. Generar external_reference único e irrepetible
    const attemptId = crypto.randomUUID();
    const externalReference = `${household_id}__${effectivePlanId}__${attemptId}`;

    // 7. Registrar pago en estado 'pending' en la base de datos (con service role)
    const { data: paymentRecord, error: insertPayErr } = await supabaseAdmin
      .from('payments')
      .insert({
        household_id,
        user_id: user.id,
        plan_id: effectivePlanId,
        amount_usd: amountUsd,
        amount_ars: amountArs,
        exchange_rate: rate,
        currency: 'ARS',
        status: 'pending',
        external_reference: externalReference,
      })
      .select()
      .single();

    if (insertPayErr) {
      return new Response(JSON.stringify({ error: `Error registrando intento de pago: ${insertPayErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 8. Crear Preferencia en Mercado Pago
    const clientReturnUrl = return_url || 'http://localhost:3000';

    if (!mpAccessToken || mpAccessToken.includes('tu-access-token')) {
      // Si no hay token de MP configurado, retornar datos para sandbox con advertencia
      return new Response(
        JSON.stringify({
          preference_id: `pref_sandbox_${attemptId}`,
          init_point: `${clientReturnUrl}/checkout/pending?ref=${externalReference}`,
          sandbox_init_point: `${clientReturnUrl}/checkout/pending?ref=${externalReference}`,
          external_reference: externalReference,
          amount_ars: amountArs,
          amount_usd: amountUsd,
          exchange_rate: rate,
          plan_name: targetPlan.name,
          notice: 'Credenciales de Mercado Pago no configuradas en servidor. Modo sandbox.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mpPrefResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            id: effectivePlanId,
            title: `Lista Compars - ${targetPlan.name} (Pago Único)`,
            description: `Licencia de por vida para el hogar (${targetPlan.monthly_chef_queries} consultas/mes de Chef IA)`,
            quantity: 1,
            currency_id: 'ARS',
            unit_price: amountArs,
          },
        ],
        payer: {
          email: user.email || 'comprador@listacompars.ar',
        },
        external_reference: externalReference,
        back_urls: {
          success: `${clientReturnUrl}/checkout/success?ref=${externalReference}`,
          failure: `${clientReturnUrl}/checkout/failure?ref=${externalReference}`,
          pending: `${clientReturnUrl}/checkout/pending?ref=${externalReference}`,
        },
        auto_return: 'approved',
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      }),
    });

    const mpPrefData = await mpPrefResponse.json();

    if (!mpPrefResponse.ok) {
      return new Response(JSON.stringify({ error: mpPrefData.message || 'Error al crear preferencia en Mercado Pago' }), {
        status: mpPrefResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Actualizar registro con la preferencia generada
    await supabaseAdmin
      .from('payments')
      .update({ mercadopago_preference_id: mpPrefData.id })
      .eq('id', paymentRecord.id);

    return new Response(
      JSON.stringify({
        preference_id: mpPrefData.id,
        init_point: mpPrefData.init_point,
        sandbox_init_point: mpPrefData.sandbox_init_point,
        external_reference: externalReference,
        amount_ars: amountArs,
        amount_usd: amountUsd,
        exchange_rate: rate,
        plan_name: targetPlan.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error interno en checkout.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
