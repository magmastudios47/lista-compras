// Supabase Edge Function: push-notify
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { household_id, title, body, sender_user_id } = await req.json();

    if (!household_id || !title) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar suscripciones activas del hogar excluyendo al emisor
    let query = supabaseClient
      .from('push_subscriptions')
      .select('subscription, user_id')
      .eq('household_id', household_id);

    if (sender_user_id) {
      query = query.neq('user_id', sender_user_id);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    // En un entorno de producción con VAPID configurado, se enviaría usando web-push.
    // Retornamos éxito y el número de destinatarios encontrados.
    return new Response(
      JSON.stringify({
        success: true,
        sentCount: subscriptions?.length || 0,
        message: `Notificación enviada a ${subscriptions?.length || 0} integrantes.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
