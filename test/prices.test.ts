import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveHouseholdPrice,
  getHouseholdPrice,
  getAllHouseholdPrices,
  clearPriceMemory,
  calculateRecipeEstimatedCost,
} from '../src/lib/priceMemory';
import { ChefIngredient } from '../src/types';

describe('Bloque 7: Precios Recordados por Hogar y Estimación de Recetas', () => {
  beforeEach(() => {
    clearPriceMemory();
  });

  it('1. Guarda y recupera el precio recordado por nombre normalizado', () => {
    saveHouseholdPrice('Leche entera', 1450, 'hogar-1');

    // Mismo nombre exacto
    expect(getHouseholdPrice('Leche entera', 'hogar-1')).toBe(1450);

    // En minúsculas y plural
    expect(getHouseholdPrice('leches enteras', 'hogar-1')).toBe(1450);
  });

  it('2. Aísla los precios entre diferentes hogares', () => {
    saveHouseholdPrice('Pan francés', 2200, 'hogar-alfa');
    saveHouseholdPrice('Pan francés', 2600, 'hogar-beta');

    expect(getHouseholdPrice('pan frances', 'hogar-alfa')).toBe(2200);
    expect(getHouseholdPrice('pan frances', 'hogar-beta')).toBe(2600);
    expect(getHouseholdPrice('pan frances', 'hogar-gamma')).toBeNull();
  });

  it('3. Calcula el costo aproximado si todos los ingredientes tienen precio recordado', () => {
    saveHouseholdPrice('nalga', 7000, 'hogar-1');
    saveHouseholdPrice('pan rallado', 1200, 'hogar-1');
    saveHouseholdPrice('huevo', 300, 'hogar-1');
    saveHouseholdPrice('zapallo anco', 1500, 'hogar-1');

    const ingredients: ChefIngredient[] = [
      { nombre: 'nalga', cantidad: 1, unidad: 'kg', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'pan rallado', cantidad: 250, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'huevo', cantidad: 2, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'zapallo anco', cantidad: 1, unidad: 'kg', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
    ];

    const estimate = calculateRecipeEstimatedCost(ingredients, 'hogar-1');

    expect(estimate.isFullyPriced).toBe(true);
    expect(estimate.coveredCount).toBe(4);
    expect(estimate.missingCount).toBe(0);
    expect(estimate.totalEstimated).toBe(10000);
    expect(estimate.formattedEstimate).toContain('aprox.');
    expect(estimate.formattedEstimate).toContain('10.000');
  });

  it('4. Si faltan ingredientes con precio, indica exactamente cuántos faltan', () => {
    saveHouseholdPrice('fideos', 1200, 'hogar-1');
    // salsa de tomate y queso rallado NO tienen precio

    const ingredients: ChefIngredient[] = [
      { nombre: 'fideos', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'salsa de tomate', cantidad: 1, unidad: 'paquete', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'queso rallado', cantidad: 100, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'oregano', cantidad: 1, unidad: 'pizca', categoria: 'almacen', es_basico: true, opcional: true, item_despensa_coincidente: null }, // Opcional, no cuenta
    ];

    const estimate = calculateRecipeEstimatedCost(ingredients, 'hogar-1');

    expect(estimate.isFullyPriced).toBe(false);
    expect(estimate.coveredCount).toBe(1);
    expect(estimate.missingCount).toBe(2);
    expect(estimate.formattedEstimate).toBe('Faltan precios de 2 ingredientes');
  });

  it('5. Actualiza precios existentes y los recupera con getAllHouseholdPrices', () => {
    saveHouseholdPrice('yerba mate', 3500, 'hogar-1');
    saveHouseholdPrice('yerba mate', 3900, 'hogar-1'); // Ajuste por inflación

    expect(getHouseholdPrice('yerba mate', 'hogar-1')).toBe(3900);

    const all = getAllHouseholdPrices('hogar-1');
    expect(all['yerba mate']).toBe(3900);
  });
});
