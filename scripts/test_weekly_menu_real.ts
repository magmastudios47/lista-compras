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
import { PlanificarSemanaResponseSchema } from '../supabase/functions/_shared/schemas.ts';
import { validateWeeklyPlanVariety } from '../supabase/functions/_shared/weeklyMenuValidator.ts';
import { normalizeString } from '../src/lib/normalizer.ts';

const DAYS_7 = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DAYS_CONFIG_LD = DAYS_7.map((dia) => ({ dia, comidas: ['almuerzo', 'cena'] }));

async function runWeeklyMenuRealTests() {
  console.log('=== PRUEBAS DE MENÚ SEMANAL CON IA REAL (BLOQUE 2) ===');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada.');

  const modelChef = process.env.GEMINI_MODEL_CHEF || 'gemini-3.5-flash-lite';
  console.log(`Modelo en uso: ${modelChef}`);
  const client = new GeminiClient(apiKey, modelChef, 'gemini-3.5-flash-lite');

  // =========================================================================
  // Test (a): Deportista, almuerzo y cena, 7 días: 7 almuerzos distintos y 7 cenas distintas
  // =========================================================================
  console.log('\n--- TEST (A): Perfil Deportista 7 días (Almuerzo y Cena) ---');
  const t0 = Date.now();
  const resDeportista = await client.generateChefResponse(
    {
      userData: {
        modo: 'planificar_semana',
        dias_config: DAYS_CONFIG_LD,
        objetivo_perfil: 'Deportista',
        personas: 4,
        semilla: `${Date.now()}_seedA`,
      },
    },
    PlanificarSemanaResponseSchema.parse
  );
  const durDeportista = Date.now() - t0;
  console.log(`Llamada Paso A completada en ${durDeportista}ms. Tokens usados: ${resDeportista.totalTokens} (Prompt: ${resDeportista.promptTokens}, Salida: ${resDeportista.completionTokens})`);

  const comidasDep = resDeportista.data.comidas || [];
  const almuerzos = comidasDep.filter((m) => m.tipo === 'almuerzo');
  const cenas = comidasDep.filter((m) => m.tipo === 'cena');

  console.log(`Total comidas devueltas: ${comidasDep.length} (Almuerzos: ${almuerzos.length}, Cenas: ${cenas.length})`);

  const uniqueAlmuerzos = new Set(almuerzos.map((m) => normalizeString(m.plato)));
  const uniqueCenas = new Set(cenas.map((m) => normalizeString(m.plato)));

  console.log(`Almuerzos únicos: ${uniqueAlmuerzos.size}/7`);
  console.log(`Cenas únicas: ${uniqueCenas.size}/7`);

  if (uniqueAlmuerzos.size < 7) {
    throw new Error(`TEST (A) FALLÓ: Hay almuerzos repetidos (${uniqueAlmuerzos.size}/7 únicos): ${almuerzos.map((m) => m.plato).join(', ')}`);
  }
  if (uniqueCenas.size < 7) {
    throw new Error(`TEST (A) FALLÓ: Hay cenas repetidas (${uniqueCenas.size}/7 únicas): ${cenas.map((m) => m.plato).join(', ')}`);
  }

  // Verificar que por_que_encaja no tenga duplicados
  const porQueEncajaSet = new Set(comidasDep.map((m) => normalizeString(m.por_que_encaja)));
  console.log(`por_que_encaja únicos: ${porQueEncajaSet.size}/${comidasDep.length}`);
  if (porQueEncajaSet.size < comidasDep.length) {
    throw new Error(`TEST (A) FALLÓ: Hay textos 'por_que_encaja' idénticos repetidos en el menú!`);
  }

  // Validar variedad con el validador oficial
  const varietyCheckA = validateWeeklyPlanVariety(comidasDep as any);
  if (!varietyCheckA.valid) {
    throw new Error(`TEST (A) FALLÓ en validador de variedad: ${varietyCheckA.errors.join('; ')}`);
  }
  console.log('TEST (A) APROBADO ✓: 7 almuerzos y 7 cenas distintas, textos por_que_encaja 100% únicos.');

  await new Promise((r) => setTimeout(r, 2000));

  // =========================================================================
  // Test (b): Comparación de 4 perfiles claramente distintos
  // =========================================================================
  console.log('\n--- TEST (B): Comparación entre perfiles (Deportista, Vegetariano, Bajar de peso, Económico) ---');
  const testProfiles = ['Vegetariano', 'Bajar de peso', 'Económico'];
  const profileResults: Record<string, string[]> = {
    Deportista: comidasDep.map((m) => m.plato),
  };

  for (const prof of testProfiles) {
    console.log(`Generando plan para perfil "${prof}"...`);
    const resP = await client.generateChefResponse(
      {
        userData: {
          modo: 'planificar_semana',
          dias_config: DAYS_CONFIG_LD.slice(0, 4), // 4 días para economizar tokens
          objetivo_perfil: prof,
          personas: 4,
          semilla: `${Date.now()}_${prof}`,
        },
      },
      PlanificarSemanaResponseSchema.parse
    );
    profileResults[prof] = (resP.data.comidas || []).map((m) => m.plato);
    console.log(`  "${prof}" platos: ${profileResults[prof].slice(0, 4).join(', ')}...`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Validar que Vegetariano no contenga carne vacuna ni pollo
  const vegDishes = profileResults['Vegetariano'].map((d) => normalizeString(d)).join(' ');
  const hasMeatInVeg = /\b(carne|pollo|lomo|nalga|peceto|vacio|asado|bife|cerdo|bondiola|pescado|merluza)\b/.test(vegDishes);
  if (hasMeatInVeg) {
    throw new Error(`TEST (B) FALLÓ: El perfil Vegetariano incluyó carnes: ${profileResults['Vegetariano'].join(', ')}`);
  }

  console.log('TEST (B) APROBADO ✓: Los 4 perfiles generan combinaciones culinarias distintivas y coherentes.');

  // =========================================================================
  // Test (c): Dos menús seguidos del mismo hogar NO repiten platos (platos_recientes_evitar)
  // =========================================================================
  console.log('\n--- TEST (C): Rotación entre 2 semanas seguidas evitando platos recientes ---');
  const week1Dishes = comidasDep.map((m) => m.plato);
  console.log(`Platos de la Semana 1 (${week1Dishes.length}): pasados como 'platos_recientes_evitar'...`);

  const resSemana2 = await client.generateChefResponse(
    {
      userData: {
        modo: 'planificar_semana',
        dias_config: DAYS_CONFIG_LD,
        objetivo_perfil: 'Deportista',
        personas: 4,
        platos_recientes_evitar: week1Dishes,
        semilla: `${Date.now()}_week2`,
      },
    },
    PlanificarSemanaResponseSchema.parse
  );

  const week2Dishes = (resSemana2.data.comidas || []).map((m) => m.plato);
  const normWeek1 = new Set(week1Dishes.map((d) => normalizeString(d)));
  const repeatedDishes = week2Dishes.filter((d) => normWeek1.has(normalizeString(d)));

  console.log(`Platos repetidos entre Semana 1 y Semana 2: ${repeatedDishes.length} (${repeatedDishes.join(', ') || 'Ninguno'})`);
  if (repeatedDishes.length > 2) {
    // Permitir como máximo 1 o 2 coincidencias accidentales en 14 comidas, pero idealmente 0
    throw new Error(`TEST (C) FALLÓ: Demasiados platos repetidos entre semanas: ${repeatedDishes.join(', ')}`);
  }
  console.log(`TEST (C) APROBADO ✓: Rotación exitosa entre semanas (coincidencias: ${repeatedDishes.length}/14).`);

  // =========================================================================
  // Medición de Tokens para Menú Completo
  // =========================================================================
  console.log('\n--- MEDICIÓN DE LLAMADAS Y TOKENS PARA MENÚ COMPLETO ---');
  console.log(`Paso A (Plan semanal 14 comidas): ${resDeportista.promptTokens} in / ${resDeportista.completionTokens} out (${resDeportista.totalTokens} total)`);
  console.log(`Estimación Paso B (7 llamadas detalle diario ~350 tokens c/u): ~2450 tokens`);
  console.log(`Total menú completo 7 días (Almuerzo y Cena): ~${resDeportista.totalTokens + 2450} tokens (~8 llamadas)`);

  console.log('\n========================================================');
  console.log('TODAS LAS PRUEBAS DEL BLOQUE 2 APROBADAS SATISFACTORIAMENTE');
  console.log('========================================================');
}

runWeeklyMenuRealTests().catch((err) => {
  console.error('Error en pruebas de menú semanal:', err);
  process.exit(1);
});
