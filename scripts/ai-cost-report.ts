import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Cargar .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const monthlyBudgetUsd = parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '50.0');

async function main() {
  console.log('\n========================================================================');
  console.log('         REPORTE DE COSTOS Y CONSUMO DE IA - LISTA COMPARS              ');
  console.log('========================================================================');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('[AVISO] No se detectó SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    console.log(`Presupuesto Mensual Configurado: US$ ${monthlyBudgetUsd.toFixed(2)}`);
    console.log('Para generar este reporte en vivo conéctate a Supabase con tu service_role key.');
    console.log('========================================================================\n');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Consultar ai_usage_log del mes en curso
  const { data: logs, error } = await supabase
    .from('ai_usage_log')
    .select('household_id, mode, model, prompt_tokens, completion_tokens, reasoning_tokens, cost_usd, origin, is_cached, created_at')
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    console.error('Error consultando ai_usage_log:', error.message);
    process.exit(1);
  }

  const totalCalls = (logs || []).length;
  const totalCostUsd = (logs || []).reduce((acc, row) => acc + Number(row.cost_usd || 0), 0);
  const totalPromptTokens = (logs || []).reduce((acc, row) => acc + Number(row.prompt_tokens || 0), 0);
  const totalCompletionTokens = (logs || []).reduce((acc, row) => acc + Number(row.completion_tokens || 0), 0);
  const totalReasoningTokens = (logs || []).reduce((acc, row) => acc + Number(row.reasoning_tokens || 0), 0);

  const budgetUsedPct = (totalCostUsd / monthlyBudgetUsd) * 100;

  console.log(`Período:                    Desde ${startOfMonth.toISOString().split('T')[0]} hasta hoy`);
  console.log(`Total de Consultas IA:      ${totalCalls}`);
  console.log(`Tokens de Entrada:          ${totalPromptTokens.toLocaleString('es-AR')}`);
  console.log(`Tokens de Salida:           ${totalCompletionTokens.toLocaleString('es-AR')}`);
  console.log(`Tokens de Razonamiento:     ${totalReasoningTokens.toLocaleString('es-AR')}`);
  console.log(`Gasto Total Acumulado:      US$ ${totalCostUsd.toFixed(4)}`);
  console.log(`Presupuesto Mensual:        US$ ${monthlyBudgetUsd.toFixed(2)}`);
  console.log(`Porcentaje Consumido:       ${budgetUsedPct.toFixed(1)}%`);

  if (budgetUsedPct >= 100) {
    console.log('⚠️  ALERTA CRÍTICA: ¡El presupuesto mensual ha sido 100% agotado!');
  } else if (budgetUsedPct >= 80) {
    console.log('⚠️  ADVERTENCIA: Se ha alcanzado el 80% del presupuesto mensual de IA.');
  } else {
    console.log('✅  Estado de Presupuesto: Saludable dentro de los márgenes previstos.');
  }

  // Agrupación por modo
  const byMode: Record<string, { calls: number; cost: number; promptTokens: number; completionTokens: number }> = {};
  for (const log of (logs || [])) {
    const m = log.mode || 'desconocido';
    if (!byMode[m]) byMode[m] = { calls: 0, cost: 0, promptTokens: 0, completionTokens: 0 };
    byMode[m].calls += 1;
    byMode[m].cost += Number(log.cost_usd || 0);
    byMode[m].promptTokens += Number(log.prompt_tokens || 0);
    byMode[m].completionTokens += Number(log.completion_tokens || 0);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('DESGLOSE POR MODO:');
  console.log('Modo                  | Llamadas | Tokens Prom. | Costo USD  ');
  console.log('----------------------|----------|--------------|------------');
  for (const [mode, stat] of Object.entries(byMode)) {
    const avgTok = stat.calls > 0 ? Math.round((stat.promptTokens + stat.completionTokens) / stat.calls) : 0;
    console.log(`${mode.padEnd(21)} | ${String(stat.calls).padStart(8)} | ${String(avgTok).padStart(12)} | US$ ${stat.cost.toFixed(4)}`);
  }

  // Agrupación por hogar
  const byHh: Record<string, { calls: number; cost: number }> = {};
  for (const log of (logs || [])) {
    const hh = log.household_id || 'sin_hogar';
    if (!byHh[hh]) byHh[hh] = { calls: 0, cost: 0 };
    byHh[hh].calls += 1;
    byHh[hh].cost += Number(log.cost_usd || 0);
  }

  const topHh = Object.entries(byHh).sort((a, b) => b[1].cost - a[1].cost).slice(0, 5);

  console.log('\n------------------------------------------------------------------------');
  console.log('MAYORES CONSUMIDORES (Top Hogares):');
  for (const [hhId, stat] of topHh) {
    console.log(`- Hogar ${hhId}: ${stat.calls} consultas | US$ ${stat.cost.toFixed(4)}`);
  }

  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Error fatal:', err);
  process.exit(1);
});
