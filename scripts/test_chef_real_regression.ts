import fs from 'fs';
import path from 'path';

// Cargar .env manualmente
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

import { GeminiClient } from '../supabase/functions/_shared/gemini.ts';
import { CookResponseSchema } from '../supabase/functions/_shared/schemas.ts';
import { validateOrderCoverage, normalizeText } from '../supabase/functions/_shared/orderCoverageValidator.ts';
import { filterAbsurdIngredients, validateIngredientsAgainstSteps } from '../supabase/functions/_shared/culinarySanity.ts';

interface TestCase {
  id: number;
  pedido: string;
  personas: number;
  debeIncluir: string[];
  noDebeIncluir: string[];
}

const TEST_CASES: TestCase[] = [
  // 8 pedidos solicitados expresamente en el enunciado:
  { id: 1, pedido: 'tortilla de papas con acelga para 2', personas: 2, debeIncluir: ['papa', 'acelga', 'huevo'], noDebeIncluir: ['arroz'] },
  { id: 2, pedido: 'tarta de acelga para 4', personas: 4, debeIncluir: ['acelga', 'huevo'], noDebeIncluir: ['arroz'] },
  { id: 3, pedido: 'ensalada de remolacha y huevo para 2', personas: 2, debeIncluir: ['remolacha', 'huevo'], noDebeIncluir: ['fideos', 'arroz'] },
  { id: 4, pedido: 'tallarines con pesto para 3', personas: 3, debeIncluir: ['fideos', 'pesto'], noDebeIncluir: ['arroz'] },
  { id: 5, pedido: 'revuelto de zapallitos para 2', personas: 2, debeIncluir: ['zapallito', 'huevo'], noDebeIncluir: ['arroz'] },
  { id: 6, pedido: 'pastel de papas para 4', personas: 4, debeIncluir: ['papa', 'carne'], noDebeIncluir: ['arroz'] },
  { id: 7, pedido: 'milanesa con puré de zapallo para 4', personas: 4, debeIncluir: ['milanesa', 'zapallo'], noDebeIncluir: ['papa'] },
  { id: 8, pedido: 'pollo al horno con batata para 4', personas: 4, debeIncluir: ['pollo', 'batata'], noDebeIncluir: ['papa'] },
  // 12 pedidos adicionales variados (platos patagónicos, clásicos, platos no catalogados):
  { id: 9, pedido: 'guiso de lentejas con chorizo para 4', personas: 4, debeIncluir: ['lenteja'], noDebeIncluir: ['fideos'] },
  { id: 10, pedido: 'risotto de hongos de pino para 2', personas: 2, debeIncluir: ['arroz'], noDebeIncluir: ['papa'] },
  { id: 11, pedido: 'locro criollo tradicional para 6', personas: 6, debeIncluir: ['maiz', 'poroto'], noDebeIncluir: ['arroz'] },
  { id: 12, pedido: 'trucha a la manteca con almendras para 2', personas: 2, debeIncluir: ['pescado', 'trucha'], noDebeIncluir: ['pollo'] },
  { id: 13, pedido: 'berenjenas a la parmesana para 3', personas: 3, debeIncluir: ['berenjena', 'queso'], noDebeIncluir: ['arroz'] },
  { id: 14, pedido: 'canelones de verdura y ricota para 4', personas: 4, debeIncluir: ['queso', 'ricota'], noDebeIncluir: ['papa'] },
  { id: 15, pedido: 'empanadas salteñas de carne para 4', personas: 4, debeIncluir: ['carne', 'cebolla'], noDebeIncluir: ['arroz'] },
  { id: 16, pedido: 'humita en olla con queso para 4', personas: 4, debeIncluir: ['choclo', 'queso'], noDebeIncluir: ['arroz'] },
  { id: 17, pedido: 'costillitas de cerdo a la riojana para 2', personas: 2, debeIncluir: ['cerdo'], noDebeIncluir: ['pescado'] },
  { id: 18, pedido: 'wok de vegetales con fideos para 2', personas: 2, debeIncluir: ['fideo'], noDebeIncluir: ['carne'] },
  { id: 19, pedido: 'carbonada patagónica en zapallo para 4', personas: 4, debeIncluir: ['zapallo', 'carne'], noDebeIncluir: ['pescado'] },
  { id: 20, pedido: 'matambre a la pizza para 4', personas: 4, debeIncluir: ['carne', 'queso'], noDebeIncluir: ['arroz'] },
];

async function runRegressionSuite() {
  console.log('=== SUITE DE REGRESIÓN DEL CHEF CON API REAL GEMINI ===');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no encontrada en .env');
  }

  const modelChef = process.env.GEMINI_MODEL_CHEF || 'gemini-3.5-flash-lite';
  console.log(`Usando modelo: ${modelChef}`);
  const client = new GeminiClient(apiKey, modelChef, 'gemini-3.5-flash-lite');
  const results: any[] = [];
  const ingredientSignatures = new Map<string, string>(); // signature -> dish name

  let passedCount = 0;
  let failedCount = 0;

  for (const tc of TEST_CASES) {
    console.log(`\n[${tc.id}/${TEST_CASES.length}] Probando: "${tc.pedido}"`);
    try {
      let response = await client.generateChefResponse(
        {
          userData: {
            modo: 'cocinar',
            pedido: tc.pedido,
            personas: tc.personas,
            restricciones: [],
            despensa: [],
          },
        },
        CookResponseSchema.parse
      );

      let rawIngs = response.data.ingredientes || [];
      let filtered = filterAbsurdIngredients(tc.pedido, rawIngs);
      let validated = validateIngredientsAgainstSteps(response.data.receta?.pasos || [], filtered);
      let coverage = validateOrderCoverage(tc.pedido, validated);

      // Reintento automático en servidor si falta cobertura (Regla Bloque 1.3)
      if (!coverage.valid && coverage.missing.length > 0) {
        console.log(`   [Reintento] Faltaron ingredientes (${coverage.missing.join(', ')}). Reintentando con corrección...`);
        const retryRes = await client.generateChefResponse(
          {
            userData: {
              modo: 'cocinar',
              pedido: `${tc.pedido} (incluir indispensablemente: ${coverage.missing.join(', ')})`,
              ingredientes_obligatorios: coverage.missing,
              personas: tc.personas,
              restricciones: [],
              despensa: [],
            },
          },
          CookResponseSchema.parse
        );
        rawIngs = retryRes.data.ingredientes || [];
        filtered = filterAbsurdIngredients(tc.pedido, rawIngs);
        validated = validateIngredientsAgainstSteps(retryRes.data.receta?.pasos || [], filtered);
        coverage = validateOrderCoverage(tc.pedido, validated);
        response = retryRes;
      }

      const ingNames = validated.map((i: any) => normalizeText(i.nombre));
      console.log(`   Receta: "${response.data.receta?.nombre}"`);
      console.log(`   Ingredientes (${validated.length}): ${ingNames.join(', ')}`);

      // Verificar que no sea el fallback genérico
      const isGenericRiceTomato =
        ingNames.includes('arroz') &&
        ingNames.includes('tomate perita') &&
        ingNames.includes('cebolla') &&
        ingNames.includes('aceite de girasol') &&
        validated.length === 4;

      if (isGenericRiceTomato) {
        throw new Error('ERROR CRÍTICO: Se devolvió el conjunto genérico arroz + tomate perita!');
      }

      // Verificar que no haya dos platos con la misma firma de ingredientes
      const signature = [...ingNames].sort().join('|');
      if (ingredientSignatures.has(signature)) {
        throw new Error(`ERROR: Firma de ingredientes duplicada idéntica a "${ingredientSignatures.get(signature)}"`);
      }
      ingredientSignatures.set(signature, tc.pedido);

      // Verificar cobertura del pedido según reglas culinarias
      if (!coverage.valid) {
        throw new Error(`Falta cobertura de ingredientes pedidos: ${coverage.missing.join(', ')}`);
      }

      // Verificar "noDebeIncluir"
      for (const forbidden of tc.noDebeIncluir) {
        const found = ingNames.some((n: string) => n.includes(forbidden));
        if (found) {
          throw new Error(`Ingrediente prohibido presente: "${forbidden}" en ${ingNames.join(', ')}`);
        }
      }

      console.log(`   -> APROBADO ✓ (cobertura: OK)`);
      passedCount++;
      results.push({
        id: tc.id,
        pedido: tc.pedido,
        receta: response.data.receta?.nombre,
        ingredientes: ingNames,
        tokens: response.totalTokens,
        status: 'APROBADO',
      });
    } catch (err: any) {
      console.error(`   -> FALLÓ ✗: ${err.message}`);
      failedCount++;
      results.push({
        id: tc.id,
        pedido: tc.pedido,
        error: err.message,
        status: 'FALLIDO',
      });
    }

    // Pausa de 2.5s para no saturar rate limit
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log('\n======================================================');
  console.log(`TOTAL: ${TEST_CASES.length} | APROBADOS: ${passedCount} | FALLADOS: ${failedCount}`);
  console.log('======================================================');

  // Guardar log para el informe
  fs.writeFileSync(
    path.resolve(process.cwd(), 'docs/chef-quality-report-r5.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fallo en la suite de regresión:', err);
  process.exit(1);
});
