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
