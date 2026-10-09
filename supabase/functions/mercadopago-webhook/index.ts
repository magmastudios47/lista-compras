// Supabase Edge Function: mercadopago-webhook
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cotización de referencia por defecto si no hay variable de entorno
const DEFAULT_ARS_USD_RATE = 1350;
const LIFETIME_PRICE_USD = 4.99;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action'); // 'create-preference' o webhook por defecto

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  const exchangeRate = Number(Deno.env.get('ARS_USD_RATE')) || DEFAULT_ARS_USD_RATE;
  const priceArs = Math.round(LIFETIME_PRICE_USD * exchangeRate);

  // 1. Endpoint: Creación de Preferencia de Pago en Mercado Pago
  if (action === 'create-preference') {
    try {
      const { household_id, user_email, return_url } = await req.json();

      if (!household_id) {
        return new Response(JSON.stringify({ error: 'Falta household_id.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Si no hay token real de MP configurado, retornar modo prueba simulado
      if (!mpAccessToken || mpAccessToken.includes('tu-access-token')) {
        return new Response(
          JSON.stringify({
            preference_id: `pref_sim_${Date.now()}`,
            init_point: `${return_url || 'http://localhost:3000'}?payment_status=approved&simulated=true`,
            sandbox_init_point: `${return_url || 'http://localhost:3000'}?payment_status=approved&simulated=true`,
            price_usd: LIFETIME_PRICE_USD,
            price_ars: priceArs,
            exchange_rate: exchangeRate,
            is_simulated: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Llamada oficial a Mercado Pago API
      const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              id: 'compars_lifetime',
              title: 'Lista Compars - Licencia de por Vida del Hogar',
              description: 'Consultas ilimitadas del Chef IA y funciones avanzadas sin vencimiento',
              quantity: 1,
              currency_id: 'ARS',
              unit_price: priceArs,
            },
          ],
          payer: {
            email: user_email || 'comprador@listacompars.ar',
          },
          external_reference: household_id,
          back_urls: {
            success: `${return_url}?payment_status=approved`,
            failure: `${return_url}?payment_status=failure`,
            pending: `${return_url}?payment_status=pending`,
          },
          auto_return: 'approved',
        }),
      });

      const mpData = await mpResponse.json();

      return new Response(
        JSON.stringify({
          preference_id: mpData.id,
          init_point: mpData.init_point,
          sandbox_init_point: mpData.sandbox_init_point,
          price_usd: LIFETIME_PRICE_USD,
          price_ars: priceArs,
          exchange_rate: exchangeRate,
          is_simulated: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (prefErr: any) {
      return new Response(JSON.stringify({ error: prefErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. Webhook / IPN de Mercado Pago para procesar aprobación de pago
  try {
    const body = await req.json().catch(() => ({}));
    const paymentId = body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    if (paymentId && mpAccessToken && !mpAccessToken.includes('tu-access-token')) {
      // Consultar estado en Mercado Pago
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });
      const payment = await paymentRes.json();

      if (payment.status === 'approved') {
        const householdId = payment.external_reference;

        if (householdId) {
          // Activar licencia Lifetime Premium para el hogar
          await supabaseClient.from('household_licenses').upsert({
            household_id: householdId,
            plan_type: 'lifetime_premium',
            status: 'active',
            purchased_at: new Date().toISOString(),
            amount_paid_usd: LIFETIME_PRICE_USD,
            amount_paid_ars: payment.transaction_amount || priceArs,
            exchange_rate: exchangeRate,
            mercadopago_payment_id: String(paymentId),
            max_monthly_chef_queries: 9999,
          });

          // Aumentar el límite mensual en la tabla del hogar
          await supabaseClient
            .from('households')
            .update({ monthly_chef_limit: 9999 })
            .eq('id', householdId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (webhookErr: any) {
    return new Response(JSON.stringify({ error: webhookErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
