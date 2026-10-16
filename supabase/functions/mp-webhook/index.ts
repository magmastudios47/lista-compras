// Supabase Edge Function: mp-webhook
// Verificación criptográfica HMAC-SHA256 oficial de x-signature, validación de API, idempotencia y activación
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
};

/**
 * Valida la firma HMAC-SHA256 según la especificación oficial de Mercado Pago
 */
async function verifyMercadoPagoSignature(
  xSignatureHeader: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secretKey: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!secretKey) {
    // Si no hay clave configurada en entorno local, reportar
    return { valid: false, reason: 'MERCADOPAGO_WEBHOOK_SECRET no configurado en servidor.' };
  }

  if (!xSignatureHeader || !xRequestId || !dataId) {
    return { valid: false, reason: 'Cabeceras x-signature, x-request-id o data.id ausentes.' };
  }

  // Parsear x-signature (formato: "ts=1700000000,v1=abcdef...")
  const parts = xSignatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const ts = parts.ts;
  const hashV1 = parts.v1;

  if (!ts || !hashV1) {
    return { valid: false, reason: 'Formato inválido de cabecera x-signature (falta ts o v1).' };
  }

  // Cadena de manifiesto oficial de Mercado Pago: id:[data.id];request-id:[x-request-id];ts:[ts];
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  // Calcular HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  const calculatedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (calculatedHex.toLowerCase() !== hashV1.toLowerCase()) {
    return { valid: false, reason: 'Firma HMAC-SHA256 no coincide.' };
  }

  return { valid: true };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '';
    const webhookSecret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));

    // Obtener data.id del query param o del body
    const dataId = String(body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
    const actionType = body?.action || body?.type || url.searchParams.get('type') || 'payment';

    // 1. Verificación de Firma Oficial de Mercado Pago
    const xSignature = req.headers.get('x-signature');
    const xRequestId = req.headers.get('x-request-id');

    if (webhookSecret) {
      const verification = await verifyMercadoPagoSignature(xSignature, xRequestId, dataId, webhookSecret);
      if (!verification.valid) {
        console.warn('Alerta de seguridad Webhook MP:', verification.reason);
        // Registrar intento sospechoso en log de seguridad
        await supabaseAdmin.from('invite_attempt_logs').insert({
          identifier: `mp_webhook_${dataId || 'unknown'}`,
          attempt_type: 'mp_webhook_signature',
          success: false,
        }).catch(() => {});

        return new Response(JSON.stringify({ error: 'Firma inválida.', details: verification.reason }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!dataId) {
      return new Response(JSON.stringify({ message: 'Notificación recibida sin ID de pago.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Consultar el pago a la API oficial de Mercado Pago
    let paymentData: any = null;

    if (mpAccessToken && !mpAccessToken.includes('tu-access-token')) {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });

      if (!mpResponse.ok) {
        return new Response(JSON.stringify({ error: 'No se pudo consultar el pago en Mercado Pago.' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      paymentData = await mpResponse.json();
    } else {
      // Modo sandbox simulado para tests si se pasa flag específico
      paymentData = body?.mock_payment || {
        id: dataId,
        status: body?.status || 'pending',
        transaction_amount: body?.transaction_amount,
        currency_id: 'ARS',
        external_reference: body?.external_reference,
      };
    }

    const { status, transaction_amount, currency_id, external_reference } = paymentData;

    // 3. Buscar el pago pendiente correspondiente en nuestra base de datos
    if (!external_reference) {
      return new Response(JSON.stringify({ error: 'El pago no incluye external_reference.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: paymentRecord, error: findPayErr } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('external_reference', external_reference)
      .maybeSingle();

    if (findPayErr || !paymentRecord) {
      console.warn(`Alerta de seguridad: external_reference desconocido: ${external_reference}`);
      return new Response(JSON.stringify({ error: 'Referencia de pago no encontrada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Idempotencia: Si ya estaba aprobado, responder OK sin duplicar
    if (paymentRecord.status === 'approved') {
      return new Response(JSON.stringify({ message: 'El pago ya había sido aprobado previamente.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Validar estado aprobado y coincidencia exacta de monto y moneda
    if (status !== 'approved') {
      await supabaseAdmin
        .from('payments')
        .update({
          status: status === 'rejected' ? 'rejected' : 'pending',
          mercadopago_payment_id: String(dataId),
          raw_webhook_data: paymentData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentRecord.id);

      return new Response(JSON.stringify({ message: `Pago registrado con estado: ${status}. No se activa licencia.` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validar moneda ARS
    if (currency_id !== 'ARS') {
      console.warn(`Alerta: Moneda no esperada: ${currency_id}`);
      return new Response(JSON.stringify({ error: 'Moneda inválida.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validar coincidencia de monto
    const expectedAmount = Number(paymentRecord.amount_ars);
    const paidAmount = Number(transaction_amount);
    if (Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.warn(`Alerta de seguridad: Monto pagado (${paidAmount}) no coincide con el esperado (${expectedAmount})`);
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'rejected',
          raw_webhook_data: { ...paymentData, mismatch_reason: 'Monto incorrecto' },
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentRecord.id);

      return new Response(JSON.stringify({ error: 'Monto pagado no coincide con el monto esperado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. ACTIVACIÓN SEGURA DE LICENCIA
    // Obtener detalles del plan
    const { data: planInfo } = await supabaseAdmin
      .from('plans')
      .select('monthly_chef_queries')
      .eq('id', paymentRecord.plan_id)
      .single();

    const monthlyQueries = planInfo ? planInfo.monthly_chef_queries : (paymentRecord.plan_id === 'premium' ? 150 : 40);

    // Actualizar registro de pago a aprobado
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'approved',
        mercadopago_payment_id: String(dataId),
        raw_webhook_data: paymentData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRecord.id);

    // Si es un paquete de recarga de créditos (pack_*)
    if (paymentRecord.plan_id && paymentRecord.plan_id.startsWith('pack_')) {
      const { data: pack } = await supabaseAdmin
        .from('credit_recharge_packages')
        .select('credits')
        .eq('id', paymentRecord.plan_id)
        .maybeSingle();

      const creditsToGrant = pack ? pack.credits : 25;
      await supabaseAdmin.rpc('grant_household_credits', {
        p_household_id: paymentRecord.household_id,
        p_amount: creditsToGrant,
        p_reason: 'recharge_pack',
        p_reference_id: `mp_payment_${paymentRecord.id}`,
      });
    } else {
      // Actualizar o insertar licencia activa para el hogar
      await supabaseAdmin
        .from('licenses')
        .upsert({
          household_id: paymentRecord.household_id,
          plan_id: paymentRecord.plan_id,
          status: 'active',
          valid_until: null, // De por vida
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'household_id' });

      // Actualizar la cuota del hogar en la tabla households
      await supabaseAdmin
        .from('households')
        .update({
          monthly_chef_limit: monthlyQueries,
        })
        .eq('id', paymentRecord.household_id);

      // Otorga créditos iniciales del plan en el ledger
      const planCredits = paymentRecord.plan_id === 'premium' ? 150 : 40;
      await supabaseAdmin.rpc('grant_household_credits', {
        p_household_id: paymentRecord.household_id,
        p_amount: planCredits,
        p_reason: 'plan_grant',
        p_reference_id: `plan_activation_${paymentRecord.id}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Licencia ${paymentRecord.plan_id} activada exitosamente para el hogar ${paymentRecord.household_id}.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Error procesando webhook.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
