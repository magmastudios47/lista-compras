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
import { CookResponseSchema, PlanificarSemanaResponseSchema } from '../supabase/functions/_shared/schemas.ts';

async function main() {
  console.log('--- DIAGNÓSTICO CON API REAL ---');
  console.log('GEMINI_API_KEY configurada:', process.env.GEMINI_API_KEY ? 'SÍ (' + process.env.GEMINI_API_KEY.slice(0, 8) + '...)' : 'NO');
  console.log('Modelo:', process.env.GEMINI_MODEL_CHEF || 'gemini-2.5-flash');

  const client = new GeminiClient(process.env.GEMINI_API_KEY);

  // 1. Caso A: "tortilla de papas con acelga para 2"
  console.log('\n--- CASO A: "tortilla de papas con acelga para 2" ---');
  try {
    const resA = await client.generateChefResponse(
      {
        userData: {
          modo: 'cocinar',
          pedido: 'tortilla de papas con acelga para 2',
          personas: 2,
          restricciones: [],
          despensa: [],
        },
      },
      CookResponseSchema.parse
    );

    console.log('Respuesta del Modelo Crudo (Caso A):');
    console.log('Receta Nombre:', resA.data.receta?.nombre);
    console.log('Porciones:', resA.data.receta?.porciones);
    console.log('Pasos:', resA.data.receta?.pasos?.slice(0, 3));
    console.log('Ingredientes devueltos por el modelo:');
    for (const ing of resA.data.ingredientes) {
      console.log(` - ${ing.nombre}: ${ing.cantidad} ${ing.unidad} (${ing.categoria})`);
    }
  } catch (err: any) {
    console.error('Error en Caso A con API real:', err.message);
  }

  // Pausa para cuidar rate limit
  await new Promise((r) => setTimeout(r, 2000));

  // 2. Caso B: Menú semanal 7 días (almuerzo y cena)
  console.log('\n--- CASO B: Menú semanal 7 días almuerzo y cena ---');
  try {
    const daysConfig = [
      { dia: 'lunes', comidas: ['almuerzo', 'cena'] },
      { dia: 'martes', comidas: ['almuerzo', 'cena'] },
      { dia: 'miércoles', comidas: ['almuerzo', 'cena'] },
      { dia: 'jueves', comidas: ['almuerzo', 'cena'] },
      { dia: 'viernes', comidas: ['almuerzo', 'cena'] },
      { dia: 'sábado', comidas: ['almuerzo', 'cena'] },
      { dia: 'domingo', comidas: ['almuerzo', 'cena'] },
    ];

    const clientB = new GeminiClient(process.env.GEMINI_API_KEY, 'gemini-3.5-flash-lite');
    const resB = await clientB.generateChefResponse(
      {
        userData: {
          modo: 'planificar_semana',
          personas: 4,
          restricciones: [],
          dias_config: daysConfig,
          objetivo_perfil: 'Deportista',
        },
      },
      PlanificarSemanaResponseSchema.parse
    );

    console.log('Respuesta del Modelo Crudo (Caso B - Paso A):');
    console.log(`Total comidas: ${resB.data.comidas.length}`);
    for (const c of resB.data.comidas) {
      console.log(`[${c.dia} - ${c.tipo}]: ${c.plato} | Por qué encaja: "${c.por_que_encaja}"`);
    }
  } catch (err: any) {
    console.error('Error en Caso B con API real:', err.message);
  }
}

main().catch(console.error);
