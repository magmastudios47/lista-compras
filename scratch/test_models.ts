import fs from 'fs';
import path from 'path';

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

async function testCandidate(model: string) {
  console.log(`\nProbando modelo candidate: ${model}`);
  process.env.GEMINI_MODEL_CHEF = model;
  const client = new GeminiClient(process.env.GEMINI_API_KEY, model, 'gemini-3.5-flash-lite');
  const t0 = Date.now();
  try {
    const res = await client.generateChefResponse({
      userData: {
        modo: 'cocinar',
        pedido: 'tortilla de papas con acelga para 2',
        personas: 2,
        restricciones: [],
        despensa: [],
      }
    }, CookResponseSchema.parse);
    console.log(`ÉXITO con ${model} en ${Date.now() - t0}ms:`);
    console.log(`Receta: ${res.data.receta?.nombre}`);
    console.log(`Ingredientes: ${res.data.ingredientes?.map(i => i.nombre).join(', ')}`);
  } catch (err: any) {
    console.log(`FALLÓ con ${model}: ${err.message}`);
  }
}

async function run() {
  await testCandidate('gemini-2.5-flash');
  await new Promise(r => setTimeout(r, 2000));
  await testCandidate('gemini-3.5-flash');
  await new Promise(r => setTimeout(r, 2000));
  await testCandidate('gemini-3.5-flash-lite');
}

run();
