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
  RegenerarPlatoResponseSchema,
} from '../_shared/schemas.ts';
import {
  filterAbsurdIngredients,
  validateIngredientsAgainstSteps,
} from '../_shared/culinarySanity.ts';
import { validateWeeklyPlanVariety } from '../_shared/weeklyMenuValidator.ts';
import { validateOrderCoverage, normalizeText } from '../_shared/orderCoverageValidator.ts';

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
    const {
      modo,
      pedido,
      personas,
      restricciones,
      despensa,
      texto_despensa,
      household_id,
      dias_config,
      objetivo_perfil,
      objetivo_detalle,
      platos_obligatorios,
      platos_ya_elegidos,
      platos_recientes_evitar,
      semilla,
      dia,
      tipo,
    } = body;

    const allowedModes = ['cocinar', 'sugerir', 'interpretar_items', 'interpretar_despensa', 'menu', 'planificar_semana', 'detalle_dia_menu', 'regenerar_plato'];
    if (!modo || !allowedModes.includes(modo)) {
      return new Response(
        JSON.stringify({ error: 'Modo inválido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Control de Acceso: ACCESS_MODE y Licencia Activa del Hogar (Ronda 5)
    const ACCESS_MODE = Deno.env.get('ACCESS_MODE') ?? 'closed';
    const TRIAL_CREDITS = parseInt(Deno.env.get('TRIAL_CREDITS') ?? '0', 10);

    let activeLicense: any = null;
    if (household_id) {
      const { data: licenseData } = await supabaseClient
        .from('licenses')
        .select('plan_id, status, valid_until')
        .eq('household_id', household_id)
        .eq('status', 'active')
        .maybeSingle();
      activeLicense = licenseData;
    }

    const hasValidLicense = activeLicense &&
      ['base', 'premium', 'tester'].includes(activeLicense.plan_id) &&
      (!activeLicense.valid_until || new Date(activeLicense.valid_until) > new Date());

    if (ACCESS_MODE === 'closed') {
      if (!household_id || (!hasValidLicense && TRIAL_CREDITS <= 0)) {
        return new Response(
          JSON.stringify({
            error: 'Acceso restringido: este hogar no cuenta con una licencia activa de Lista Compars.',
            code: 'LICENSE_REQUIRED',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let householdData: any = null;
    const isInterpretationMode = modo === 'interpretar_items' || modo === 'interpretar_despensa';
    const isMenuMode = modo === 'menu' || modo === 'planificar_semana' || modo === 'detalle_dia_menu' || modo === 'regenerar_plato';
    
    // Pesos medidos en créditos: 1 crédito = 1 receta, 8 créditos = menú semanal completo, 0 = interpretar y detalle
    const creditCost = modo === 'detalle_dia_menu' ? 0 : (isInterpretationMode ? 0 : (modo === 'regenerar_plato' ? 1 : (isMenuMode ? 8 : 1)));

    // Protección de Presupuesto Global Mensual de IA (AI_MONTHLY_BUDGET_USD)
    const AI_MONTHLY_BUDGET_USD = parseFloat(Deno.env.get('AI_MONTHLY_BUDGET_USD') || '50.0');
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usageRows } = await supabaseClient
      .from('ai_usage_log')
      .select('cost_usd')
      .gte('created_at', startOfMonth.toISOString());

    const totalSpentUsd = (usageRows || []).reduce((acc: number, row: any) => acc + Number(row.cost_usd || 0), 0);

    if (totalSpentUsd >= AI_MONTHLY_BUDGET_USD && activeLicense?.plan_id !== 'tester') {
      return new Response(
        JSON.stringify({
          error: 'El servicio del Chef IA ha alcanzado su límite mensual de seguridad. El servicio se reanudará el próximo mes.',
          budget_exceeded: true,
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (totalSpentUsd >= AI_MONTHLY_BUDGET_USD * 0.8) {
      console.warn(`[PRESUPUESTO IA] Alerta: Se ha alcanzado el 80% del presupuesto mensual (${totalSpentUsd.toFixed(2)} / ${AI_MONTHLY_BUDGET_USD} USD).`);
    }

    if (household_id) {
      // Si es modo menu / planificar_semana, verificar plan Premium o Tester
      if (isMenuMode) {
        if (!activeLicense || (activeLicense.plan_id !== 'premium' && activeLicense.plan_id !== 'tester')) {
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
      } else if (creditCost > 0) {
        // Verificar Tope Diario por Hogar (por defecto 15 créditos / día)
        const { data: canSpendDaily } = await supabaseClient.rpc('check_daily_credit_limit', {
          p_household_id: household_id,
          p_amount: creditCost,
          p_daily_limit: 15,
        });

        if (canSpendDaily === false && activeLicense?.plan_id !== 'tester') {
          return new Response(
            JSON.stringify({
              error: 'Has alcanzado el tope diario de consumo de IA para tu hogar (15 créditos por día). Probá de nuevo mañana.',
              daily_limit_exceeded: true,
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verificar Saldo Disponible en credit_ledger
        const { data: balanceData } = await supabaseClient.rpc('get_household_credit_balance', {
          p_household_id: household_id,
        });

        const availableCredits = Number(balanceData || 0);
        if (availableCredits < creditCost && activeLicense?.plan_id !== 'tester') {
          return new Response(
            JSON.stringify({
              error: `Créditos insuficientes. Esta acción requiere ${creditCost} crédito(s) y tu saldo actual es de ${availableCredits} crédito(s).`,
              credits_insufficient: true,
              required: creditCost,
              balance: availableCredits,
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 3. Caché de consultas idénticas (para ahorrar tokens y dar respuesta instantánea)
    // Para planificar_semana, los modos de planificación NO usan caché fija simple (incluyen timestamp/semilla)
    const PROMPT_VERSION = 'v1.5.0';
    const normalizedOrder = normalizeText(pedido || texto_despensa || JSON.stringify(dias_config || ''));
    const sortedRestrictions = (restricciones || []).map((r: string) => normalizeText(r)).sort().join(',');
    const normalizedKey = modo === 'planificar_semana'
      ? `${PROMPT_VERSION}_${modo}_${normalizedOrder}_${Date.now()}_${Math.random()}`
      : `${PROMPT_VERSION}_${modo}_${normalizedOrder}_${personas || 4}_${sortedRestrictions}_${normalizeText(objetivo_perfil || '')}`;
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
      const cachedResponse = {
        ...cached.response_json,
        origen: 'cache',
      };

      if (household_id) {
        await supabaseClient.from('ai_usage_log').insert({
          household_id,
          user_id: userId === 'anonymous' ? null : userId,
          mode: modo,
          is_cached: true,
          origin: 'cache',
          status: 'success',
        });
      }

      return new Response(JSON.stringify(cachedResponse), {
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
    if (modo === 'regenerar_plato') validator = RegenerarPlatoResponseSchema.parse;

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
          platos_recientes_evitar,
          semilla,
          dia,
          tipo,
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

      // Validador de cobertura del pedido: cada ingrediente pedido debe figurar en la lista
      const coverage = validateOrderCoverage(pedido || outputData.receta.nombre, outputData.ingredientes);
      if (!coverage.valid && coverage.missing.length > 0) {
        try {
          const retryResult = await gemini.generateChefResponse(
            {
              userData: {
                modo,
                pedido: `${pedido || ''} (incluir indispensablemente: ${coverage.missing.join(', ')})`,
                ingredientes_obligatorios: coverage.missing,
                personas: personas ? Number(personas) : 4,
                restricciones: Array.isArray(restricciones) ? restricciones : [],
                despensa: Array.isArray(despensa) ? despensa : [],
              },
            },
            validator
          );

          if (retryResult?.data?.receta) {
            let retryData = retryResult.data;
            retryData.ingredientes = filterAbsurdIngredients(pedido || retryData.receta.nombre, retryData.ingredientes || []);
            retryData.ingredientes = validateIngredientsAgainstSteps(retryData.receta.pasos, retryData.ingredientes);
            const retryCoverage = validateOrderCoverage(pedido || retryData.receta.nombre, retryData.ingredientes);
            if (retryCoverage.valid) {
              outputData = retryData;
            } else {
              return new Response(
                JSON.stringify({
                  error: `El Chef no pudo incluir todos los ingredientes solicitados (${retryCoverage.missing.join(', ')}). No se descontaron créditos.`,
                }),
                { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        } catch {
          return new Response(
            JSON.stringify({
              error: `El Chef no pudo incluir todos los ingredientes solicitados (${coverage.missing.join(', ')}). No se descontaron créditos.`,
            }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
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
    } else if (modo === 'regenerar_plato' && outputData.comida) {
      const filtered = filterAbsurdIngredients(outputData.comida.plato, outputData.comida.ingredientes || []);
      const validated = validateIngredientsAgainstSteps(outputData.comida.pasos || [], filtered);
      outputData.comida.ingredientes = validated;
    }

    // Establecer origen de la respuesta
    outputData.origen = 'ia';

    // 5. Guardar en ai_cache
    await supabaseClient.from('ai_cache').insert({
      cache_key: cacheKey,
      response_json: outputData,
    });

    // 6. Registrar en ai_usage_log e incrementar cuota mensual si no es modo interpretación
    // 6. Registrar en ai_usage_log y debitar créditos del ledger de forma idempotente
    if (household_id) {
      // Calcular costo en USD según modelo y tarifas vigentes a la fecha
      const { data: costCalc } = await supabaseClient.rpc('calculate_ai_cost', {
        p_model: geminiResult.modelUsed || 'gemini-3.5-flash',
        p_prompt_tokens: geminiResult.promptTokens,
        p_completion_tokens: geminiResult.completionTokens,
        p_date: new Date().toISOString(),
      });
      const costUsd = Number(costCalc || 0);

      await supabaseClient.from('ai_usage_log').insert({
        household_id,
        user_id: userId === 'anonymous' ? null : userId,
        mode: modo,
        model: geminiResult.modelUsed,
        prompt_tokens: geminiResult.promptTokens,
        completion_tokens: geminiResult.completionTokens,
        reasoning_tokens: geminiResult.reasoningTokens || 0,
        cost_usd: costUsd,
        total_tokens: geminiResult.totalTokens,
        is_cached: false,
        origin: 'ia',
        status: 'success',
      });

      // Débito en libro mayor (credit_ledger)
      if (creditCost > 0) {
        const queryReferenceId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await supabaseClient.rpc('deduct_household_credits', {
          p_household_id: household_id,
          p_amount: creditCost,
          p_reason: `chef_${modo}`,
          p_reference_id: queryReferenceId,
        });
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
