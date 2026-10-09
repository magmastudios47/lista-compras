// Supabase Edge Function: chef-ai
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { GeminiClient } from '../_shared/gemini.ts';
import {
  CookResponseSchema,
  SuggestResponseSchema,
  InterpretPantryResponseSchema,
  InterpretItemsResponseSchema,
} from '../_shared/schemas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter en memoria por usuario (5 req/min)
const userRequestTimestamps = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (userRequestTimestamps.get(userId) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= 5) {
    return false;
  }

  timestamps.push(now);
  userRequestTimestamps.set(userId, timestamps);
  return true;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener usuario autenticado
    const authHeader = req.headers.get('Authorization');
    let userId = 'anonymous';

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      if (user) userId = user.id;
    }

    // 1. Control de Rate Limiting por usuario (máximo 5 por minuto)
    if (!checkRateLimit(userId)) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit excedido: podés hacer hasta 5 consultas por minuto.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { modo, pedido, personas, restricciones, despensa, texto_despensa, household_id } = body;

    const allowedModes = ['cocinar', 'sugerir', 'interpretar_items', 'interpretar_despensa'];
    if (!modo || !allowedModes.includes(modo)) {
      return new Response(
        JSON.stringify({ error: 'Modo inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Control de Cuota Mensual
    let householdData: any = null;
    const isInterpretationMode = modo === 'interpretar_items' || modo === 'interpretar_despensa';

    if (household_id) {
      if (isInterpretationMode) {
        // Cuota propia para interpretación de items (200 consultas por mes por hogar)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count, error: countErr } = await supabaseClient
          .from('ai_usage_log')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', household_id)
          .in('mode', ['interpretar_items', 'interpretar_despensa'])
          .gte('created_at', startOfMonth.toISOString());

        if (!countErr && (count || 0) >= 200) {
          return new Response(
            JSON.stringify({
              error: 'Has alcanzado el límite mensual de interpretación de ítems (200 por mes).',
              quota_exceeded: true,
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Cuota general del Chef mensual
        const { data: hh } = await supabaseClient
          .from('households')
          .select('monthly_chef_limit, chef_queries_used_month')
          .eq('id', household_id)
          .maybeSingle();

        if (hh) {
          householdData = hh;
          if (hh.chef_queries_used_month >= hh.monthly_chef_limit) {
            return new Response(
              JSON.stringify({
                error: 'Has alcanzado el límite mensual de consultas del Chef IA para tu hogar.',
                quota_exceeded: true,
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    // 3. Caché de consultas idénticas (para ahorrar tokens y dar respuesta instantánea)
    const normalizedKey = `${modo}_${(pedido || texto_despensa || '').trim().toLowerCase()}_${personas || 4}_${(restricciones || []).sort().join(',')}`;
    const cacheKey = await crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(normalizedKey))
      .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''));

    const { data: cached } = await supabaseClient
      .from('ai_cache')
      .select('response_json')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached) {
      // Registrar uso como cache hit
      if (household_id) {
        await supabaseClient.from('ai_usage_log').insert({
          household_id,
          user_id: userId === 'anonymous' ? null : userId,
          mode: modo,
          is_cached: true,
          status: 'success',
        });
      }

      return new Response(JSON.stringify(cached.response_json), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Invocación al modelo Gemini mediante módulo de abstracción
    const gemini = new GeminiClient();
    let validator: any = CookResponseSchema.parse;
    if (modo === 'sugerir') validator = SuggestResponseSchema.parse;
    if (modo === 'interpretar_items') validator = InterpretItemsResponseSchema.parse;
    if (modo === 'interpretar_despensa') validator = InterpretPantryResponseSchema.parse;

    const geminiResult = await gemini.generateChefResponse(
      {
        userData: {
          modo,
          pedido,
          personas: personas ? Number(personas) : 4,
          restricciones: Array.isArray(restricciones) ? restricciones : [],
          despensa: Array.isArray(despensa) ? despensa : [],
          texto_despensa,
        },
      },
      validator
    );

    // 5. Guardar en ai_cache
    await supabaseClient.from('ai_cache').insert({
      cache_key: cacheKey,
      response_json: geminiResult.data,
    });

    // 6. Registrar en ai_usage_log e incrementar cuota mensual si no es modo interpretación
    if (household_id) {
      await supabaseClient.from('ai_usage_log').insert({
        household_id,
        user_id: userId === 'anonymous' ? null : userId,
        mode: modo,
        prompt_tokens: geminiResult.promptTokens,
        completion_tokens: geminiResult.completionTokens,
        total_tokens: geminiResult.totalTokens,
        is_cached: false,
        status: 'success',
      });

      if (!isInterpretationMode && householdData) {
        await supabaseClient
          .from('households')
          .update({
            chef_queries_used_month: householdData.chef_queries_used_month + 1,
          })
          .eq('id', household_id);
      }
    }

    return new Response(JSON.stringify(geminiResult.data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Error procesando la consulta con el Chef IA.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
