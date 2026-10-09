import { describe, it, expect } from 'vitest';
import { calculatePantryDiscounts, convertUnit, mergeDuplicateIngredients } from '../src/lib/discountEngine';
import { singularizeIngredient, normalizeString } from '../src/lib/normalizer';
import { ChefIngredient, PantryItem } from '../src/types';

describe('Motor de Descuento Determinista y Normalización', () => {
  it('singulariza correctamente términos argentinos', () => {
    expect(singularizeIngredient('Tomates')).toBe('tomate');
    expect(singularizeIngredient('Cebollas')).toBe('cebolla');
    expect(singularizeIngredient('Huevos')).toBe('huevo');
    expect(singularizeIngredient('patatas')).toBe('papa');
    expect(singularizeIngredient('morrones')).toBe('morron');
    expect(singularizeIngredient('fideos')).toBe('fideos');
    expect(singularizeIngredient('zapallitos')).toBe('zapallito');
  });

  it('convierte correctamente unidades de masa y volumen compatibles', () => {
    expect(convertUnit(1, 'kg', 'g')).toBe(1000);
    expect(convertUnit(500, 'g', 'kg')).toBe(0.5);
    expect(convertUnit(1.5, 'l', 'ml')).toBe(1500);
    expect(convertUnit(250, 'ml', 'l')).toBe(0.25);
    expect(convertUnit(1, 'unidad', 'kg')).toBeNull();
  });

  it('unifica ingredientes duplicados sumando sus cantidades', () => {
    const list: ChefIngredient[] = [
      { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'cebollas', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'harina 000', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'harina 000', cantidad: 0.5, unidad: 'kg', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ];

    const merged = mergeDuplicateIngredients(list);
    expect(merged.length).toBe(2);

    const cebolla = merged.find((i) => i.nombre === 'cebolla');
    expect(cebolla?.cantidad).toBe(3);

    const harina = merged.find((i) => i.nombre.includes('harina'));
    expect(harina?.cantidad).toBe(1000); // 500g + 0.5kg (500g) = 1000g
    expect(harina?.unidad).toBe('g');
  });

  it('descuenta correctamente cuando el producto está en despensa sin cantidad registrada', () => {
    const pantry: PantryItem[] = [
      {
        id: 'p1',
        household_id: 'h1',
        name: 'aceite de girasol',
        normalized_name: 'aceite de girasol',
        quantity: null,
        unit: null,
        category: 'almacen',
        created_at: '',
        updated_at: '',
      },
    ];

    const ingredients: ChefIngredient[] = [
      {
        nombre: 'aceite de girasol',
        cantidad: 100,
        unidad: 'ml',
        categoria: 'almacen',
        es_basico: true,
        opcional: false,
        item_despensa_coincidente: 'aceite de girasol',
      },
    ];

    const result = calculatePantryDiscounts(ingredients, pantry);
    expect(result[0].estado).toBe('basico_presente');
    expect(result[0].cantidad_faltante).toBe(0);
    expect(result[0].seleccionadoParaAgregar).toBe(false);
  });
});
