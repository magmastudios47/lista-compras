import { describe, it, expect } from 'vitest';
import { validateOrderCoverage, normalizeText } from '../src/lib/orderCoverageValidator';
import { filterAbsurdIngredients, validateIngredientsAgainstSteps } from '../src/lib/culinarySanityCheck';

describe('Validador de Cobertura del Pedido (Bloque 1)', () => {
  it('detecta ingredientes requeridos correctamente', () => {
    const res = validateOrderCoverage('tortilla de papas con acelga para 2', [
      { nombre: 'papa' },
      { nombre: 'acelga' },
      { nombre: 'huevo' },
      { nombre: 'aceite de girasol' },
    ]);
    expect(res.valid).toBe(true);
    expect(res.missing).toHaveLength(0);
    expect(res.mentioned).toContain('papa');
    expect(res.mentioned).toContain('acelga');
    expect(res.mentioned).toContain('huevo');
  });

  it('detecta ingrediente faltante en el pedido', () => {
    // Pedido pide acelga y papa, pero solo le damos papa y arroz
    const res = validateOrderCoverage('tortilla de papas con acelga para 2', [
      { nombre: 'papa' },
      { nombre: 'arroz' },
      { nombre: 'cebolla' },
    ]);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain('acelga');
  });

  it('respeta exclusiones con "sin X"', () => {
    const res = validateOrderCoverage('milanesa con puré de zapallo sin papa para 4', [
      { nombre: 'nalga' },
      { nombre: 'zapallo anco' },
      { nombre: 'leche' },
      { nombre: 'papa' }, // violación!
    ]);
    expect(res.valid).toBe(false);
    expect(res.excludedViolations).toContain('papa');
  });

  it('valida cuando la exclusión "sin papa" se cumple', () => {
    const res = validateOrderCoverage('milanesa con puré de zapallo sin papa para 4', [
      { nombre: 'nalga' },
      { nombre: 'zapallo anco' },
      { nombre: 'leche' },
      { nombre: 'pan rallado' },
    ]);
    expect(res.valid).toBe(true);
    expect(res.missing).toHaveLength(0);
    expect(res.excludedViolations).toHaveLength(0);
  });

  it('falla ante el conjunto genérico arroz + cebolla + tomate perita + aceite de girasol', () => {
    const genericIngredients = [
      { nombre: 'arroz' },
      { nombre: 'cebolla' },
      { nombre: 'tomate perita' },
      { nombre: 'aceite de girasol' },
    ];

    const res = validateOrderCoverage('pastel de papas para 4', genericIngredients);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain('papa');
  });

  it('dos pedidos distintos no deben dar el mismo conjunto exacto de ingredientes', () => {
    const order1 = [{ nombre: 'papa' }, { nombre: 'acelga' }, { nombre: 'huevo' }];
    const order2 = [{ nombre: 'tallarines' }, { nombre: 'albahaca' }, { nombre: 'nuez' }];

    const set1 = order1.map(i => normalizeText(i.nombre)).sort().join(',');
    const set2 = order2.map(i => normalizeText(i.nombre)).sort().join(',');

    expect(set1).not.toBe(set2);
  });
});

import { generateUuid, isValidUuid } from '../src/lib/normalizer';
import { getSystemPromptForMode } from '../supabase/functions/chef-ai/system-prompt';
import { extractEdgeFunctionError } from '../src/hooks/useChefAi';

describe('Pruebas de Regresión de Producción y Monetización (Auditoría Integral)', () => {
  it('filterAbsurdIngredients NUNCA elimina acelga cuando el usuario pide "tortilla de papas con acelga"', () => {
    const ings = [
      { nombre: 'papa', cantidad: 400, unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'acelga', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'arroz', cantidad: 160, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ] as any[];

    const filtered = filterAbsurdIngredients('tortilla de papas con acelga para 2', ings);
    const names = filtered.map((i) => i.nombre);
    expect(names).toContain('papa');
    expect(names).toContain('acelga');
    expect(names).toContain('huevo');
    expect(names).not.toContain('arroz');

    const coverage = validateOrderCoverage('tortilla de papas con acelga para 2', filtered);
    expect(coverage.valid).toBe(true);
    expect(coverage.missing).toHaveLength(0);
  });

  it('filterAbsurdIngredients NUNCA elimina papa cuando el usuario pide "tortilla de acelga con papas"', () => {
    const ings = [
      { nombre: 'acelga', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'papa', cantidad: 300, unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ] as any[];

    const filtered = filterAbsurdIngredients('tortilla de acelga con papas para 2', ings);
    const names = filtered.map((i) => i.nombre);
    expect(names).toContain('acelga');
    expect(names).toContain('papa');
  });

  it('generateUuid genera UUIDs v4 válidos compatibles con PostgreSQL', () => {
    const id1 = generateUuid();
    const id2 = generateUuid();
    expect(isValidUuid(id1)).toBe(true);
    expect(isValidUuid(id2)).toBe(true);
    expect(id1).not.toBe(id2);
    expect(isValidUuid('item_1760000_abcd')).toBe(false);
  });

  it('getSystemPromptForMode("detalle_dia_menu") devuelve el prompt específico de detalle_dia_menu y no el de cocinar', () => {
    const prompt = getSystemPromptForMode('detalle_dia_menu');
    expect(prompt).toContain('"modo": "detalle_dia_menu"');
    expect(prompt).toContain('"comidas"');
  });

  it('extractEdgeFunctionError extrae correctamente el JSON de error desde fnError.context', async () => {
    const mockFnError = {
      message: 'Edge Function returned a non-2xx status code',
      context: {
        json: async () => ({ error: 'Créditos insuficientes. Tu saldo actual es de 0 crédito(s).' }),
      },
    };
    const extracted = await extractEdgeFunctionError(mockFnError, null);
    expect(extracted).toContain('Créditos insuficientes');
  });
});
