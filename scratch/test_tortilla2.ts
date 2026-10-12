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
import { validateOrderCoverage } from '../supabase/functions/_shared/orderCoverageValidator.ts';

async function testTortilla() {
  const apiKey = process.env.GEMINI_API_KEY!;
  const client = new GeminiClient(apiKey, 'gemini-3.5-flash-lite');
  
  const res = await client.generateChefResponse({
    userData: {
      modo: 'cocinar',
      pedido: 'tortilla de papas con acelga para 2 (con acelga fresca y papas)',
      personas: 2,
      restricciones: [],
      despensa: [],
      ingredientes_obligatorios: ['acelga', 'papa'],
    }
  }, CookResponseSchema.parse);

  console.log('Receta:', res.data.receta?.nombre);
  console.log('Ingredientes:', res.data.ingredientes.map(i => i.nombre));
  const cov = validateOrderCoverage('tortilla de papas con acelga para 2', res.data.ingredientes);
  console.log('Cobertura válida:', cov.valid, 'Faltantes:', cov.missing);
}

testTortilla();
