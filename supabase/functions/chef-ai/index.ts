// Supabase Edge Function: chef-ai
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { GeminiClient } from '../_shared/gemini.ts';
import {
  CookResponseSchema,
  SuggestResponseSchema,
  InterpretPantryResponseSchema,
  InterpretItemsResponseSchema,
  MenuResponseSchema,
  PlanificarSemanaResponseSchema,
  DetalleDiaMenuResponseSchema,
} from '../_shared/schemas.ts';
import {
  filterAbsurdIngredients,
  validateIngredientsAgainstSteps,
} from '../_shared/culinarySanity.ts';
import { validateWeeklyPlanVariety } from '../_shared/weeklyMenuValidator.ts';

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
    const { modo, pedido, personas, restricciones, despensa, texto_despensa, household_id, dias_config, objetivo_perfil, objetivo_detalle, platos_obligatorios, platos_ya_elegidos } = body;

    const allowedModes = ['cocinar', 'sugerir', 'interpretar_items', 'interpretar_despensa', 'menu', 'planificar_semana', 'detalle_dia_menu'];
    if (!modo || !allowedModes.includes(modo)) {
      return new Response(
        JSON.stringify({ error: 'Modo inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Control de Acceso por Plan y Cuota Mensual
    let householdData: any = null;
    const isInterpretationMode = modo === 'interpretar_items' || modo === 'interpretar_despensa';
    const isMenuMode = modo === 'menu' || modo === 'planificar_semana' || modo === 'detalle_dia_menu';
    // El detalle por día no descuenta consultas extra porque ya se cobró el menú
    const queryCost = modo === 'detalle_dia_menu' ? 0 : (isMenuMode ? 3 : 1);

    if (household_id) {
      // Si es modo menu / planificar_semana, verificar plan Premium
      if (isMenuMode) {
        const { data: license } = await supabaseClient
          .from('licenses')
          .select('plan_id, status')
          .eq('household_id', household_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!license || license.plan_id !== 'premium') {
          return new Response(
            JSON.stringify({
              error: 'La planificación del Menú Semanal requiere el plan Premium.',
              requires_premium: true,
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

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
        // Cuota general del Chef mensual (1 consulta normal, 3 para menú)
        const { data: hh } = await supabaseClient
          .from('households')
          .select('monthly_chef_limit, chef_queries_used_month')
          .eq('id', household_id)
          .maybeSingle();

        if (hh) {
          householdData = hh;
          if (hh.chef_queries_used_month + queryCost > hh.monthly_chef_limit) {
            return new Response(
              JSON.stringify({
                error: `Has alcanzado el límite mensual de consultas del Chef IA (${queryCost} necesarias).`,
                quota_exceeded: true,
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    // 3. Caché de consultas idénticas (para ahorrar tokens y dar respuesta instantánea)
    // Para planificar_semana, los modos de planificación NO usan caché fija simple (incluyen timestamp/semilla)
    const normalizedKey = modo === 'planificar_semana'
      ? `${modo}_${(pedido || '').trim().toLowerCase()}_${Date.now()}`
      : `${modo}_${(pedido || texto_despensa || JSON.stringify(dias_config || '')).trim().toLowerCase()}_${personas || 4}_${(restricciones || []).sort().join(',')}_${objetivo_perfil || ''}`;
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
    if (modo === 'menu') validator = MenuResponseSchema.parse;
    if (modo === 'planificar_semana') validator = PlanificarSemanaResponseSchema.parse;
    if (modo === 'detalle_dia_menu') validator = DetalleDiaMenuResponseSchema.parse;

    const geminiResult = await gemini.generateChefResponse(
      {
        userData: {
          modo,
          pedido,
          personas: personas ? Number(personas) : 4,
          restricciones: Array.isArray(restricciones) ? restricciones : [],
          despensa: Array.isArray(despensa) ? despensa : [],
          texto_despensa,
          dias_config,
          objetivo_perfil,
          objetivo_detalle,
          platos_obligatorios,
          platos_ya_elegidos,
          dia: body.dia,
          comidas: body.comidas,
        },
      },
      validator
    );

    let outputData: any = geminiResult.data;

    // Validación silenciosa del servidor: eliminar absurdos y marcar opcionales si no están en pasos
    if (modo === 'cocinar' && outputData.receta) {
      outputData.ingredientes = filterAbsurdIngredients(pedido || outputData.receta.nombre, outputData.ingredientes || []);
      outputData.ingredientes = validateIngredientsAgainstSteps(outputData.receta.pasos, outputData.ingredientes);
    } else if (modo === 'sugerir' && Array.isArray(outputData.recetas)) {
      outputData.recetas = outputData.recetas.map((r: any) => {
        const filtered = filterAbsurdIngredients(r.nombre, r.ingredientes || []);
        const validated = validateIngredientsAgainstSteps(r.pasos || r.receta?.pasos, filtered);
        return { ...r, ingredientes: validated };
      });
    } else if (modo === 'planificar_semana' && outputData.comidas) {
      // Validador de variedad en servidor con reintento único
      const mandatoryArr = platos_obligatorios ? [platos_obligatorios] : [];
      const varietyResult = validateWeeklyPlanVariety(outputData.comidas, mandatoryArr);
      if (!varietyResult.valid) {
        try {
          const retryResult = await gemini.generateChefResponse(
            {
              userData: {
                modo,
                pedido: `${pedido || ''} - IMPORTANTE: El plan anterior violó las siguientes reglas de variedad: ${varietyResult.errors.join('; ')}. Por favor regenerá el plan asegurando variedad total sin repetir platos ni proteínas consecutivas.`,
                personas: personas ? Number(personas) : 4,
                restricciones: Array.isArray(restricciones) ? restricciones : [],
                dias_config,
                objetivo_perfil,
                objetivo_detalle,
                platos_obligatorios,
              },
            },
            validator
          );
          if (retryResult?.data) {
            outputData = retryResult.data;
            const recheck = validateWeeklyPlanVariety(outputData.comidas, mandatoryArr);
            if (!recheck.valid) {
              outputData.advertencias = outputData.advertencias || [];
              outputData.advertencias.push('Nota: El menú tiene algunas repeticiones leves para ajustarse a los parámetros solicitados.');
            }
          }
        } catch {
          outputData.advertencias = outputData.advertencias || [];
          outputData.advertencias.push('Nota: El menú tiene algunas repeticiones leves para ajustarse a los parámetros solicitados.');
        }
      }
    } else if (modo === 'detalle_dia_menu' && Array.isArray(outputData.comidas)) {
      outputData.comidas = outputData.comidas.map((c: any) => {
        const filtered = filterAbsurdIngredients(c.plato, c.ingredientes || []);
        const validated = validateIngredientsAgainstSteps(c.pasos || [], filtered);
        return { ...c, ingredientes: validated };
      });
    }

    // 5. Guardar en ai_cache
    await supabaseClient.from('ai_cache').insert({
      cache_key: cacheKey,
      response_json: outputData,
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

      if (!isInterpretationMode && householdData && queryCost > 0) {
        await supabaseClient
          .from('households')
          .update({
            chef_queries_used_month: householdData.chef_queries_used_month + queryCost,
          })
          .eq('id', household_id);
      }
    }

    return new Response(JSON.stringify(outputData), {
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
