import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseCsv,
  parsePresentation,
  mapSepaProductToCatalog,
  calculateMedianDiscardingOutliers,
  processSepaDataset,
} from '../scripts/importSepaPrices';
import {
  getEffectiveItemPrice,
  calculateCartBudget,
  calculateRecipeCost,
  convertQuantityToRefUnit,
  SEPA_ATTRIBUTION,
  setLoadedSepaPrices,
  SepaReferencePrice,
} from '../src/lib/priceEngine';
import { saveHouseholdPrice, clearPriceMemory } from '../src/lib/priceMemory';
import { ChefIngredient, ShoppingItem } from '../src/types';

describe('Bloque 4: Precios Automáticos (SEPA / Precios Claros)', () => {
  const testHouseholdId = 'hh_sepa_test';

  beforeEach(() => {
    clearPriceMemory(testHouseholdId);
  });

  describe('1. Parsing de CSV y Presentación de Unidades', () => {
    it('Parsea CSV correctamente con encabezados y valores', () => {
      const csv = `id,nombre,precio\n1,leche,1000\n2,arroz,2000`;
      const rows = parseCsv(csv);
      expect(rows).toHaveLength(2);
      expect(rows[0].nombre).toBe('leche');
      expect(rows[1].precio).toBe('2000');
    });

    it('Normaliza presentaciones a unidades estándar y factores de conversión', () => {
      expect(parsePresentation('500 g')).toEqual({ targetUnit: 'kg', factor: 0.5 });
      expect(parsePresentation('900 ml')).toEqual({ targetUnit: 'l', factor: 0.9 });
      expect(parsePresentation('1 l')).toEqual({ targetUnit: 'l', factor: 1.0 });
      expect(parsePresentation('1 kg')).toEqual({ targetUnit: 'kg', factor: 1.0 });
      expect(parsePresentation('6 un')).toEqual({ targetUnit: 'unidad', factor: 6 });
      expect(parsePresentation('200 g')).toEqual({ targetUnit: 'kg', factor: 0.2 });
    });

    it('Mapea descripciones de SEPA a conceptos normalizados de catálogo', () => {
      expect(mapSepaProductToCatalog('Leche entera ultra clasica sachet 1 l', 'lacteos')).toBe('leche');
      expect(mapSepaProductToCatalog('Arroz largo fino oro 1 kg', 'almacen')).toBe('arroz');
      expect(mapSepaProductToCatalog('Fideos secos tallarines 500 g', 'almacen')).toBe('fideos');
      expect(mapSepaProductToCatalog('Aceite de girasol 900 ml', 'almacen')).toBe('aceite');
      expect(mapSepaProductToCatalog('Harina de trigo 000 1 kg', 'almacen')).toBe('harina');
      expect(mapSepaProductToCatalog('Yerba mate suave con palo 1 kg', 'almacen')).toBe('yerba');
      expect(mapSepaProductToCatalog('Producto desconocido xyz', 'otros')).toBeNull();
    });
  });

  describe('2. Cálculo de Mediana y Descarte de Valores Atípicos (Outliers)', () => {
    it('Calcula la mediana de una lista normal', () => {
      const samples = [1000, 1200, 1400];
      const result = calculateMedianDiscardingOutliers(samples);
      expect(result.median).toBe(1200);
      expect(result.validCount).toBe(3);
    });

    it('Descarta outliers groseros (error de tipeo $999.999) y calcula la mediana de las muestras válidas', () => {
      // 3 muestras normales de fideos ($1.100, $1.120, $1.350) + 1 outlier aberrante ($999.999)
      const samples = [1100, 1120, 1350, 999999];
      const result = calculateMedianDiscardingOutliers(samples);

      // Outlier 999999 descartado
      expect(result.validCount).toBe(3);
      expect(result.median).toBe(1120);
    });

    it('Maneja listas vacías y unitarias sin errores', () => {
      expect(calculateMedianDiscardingOutliers([])).toEqual({ median: 0, validCount: 0 });
      expect(calculateMedianDiscardingOutliers([1500])).toEqual({ median: 1500, validCount: 1 });
    });
  });

  describe('3. Procesamiento del Dataset de Muestra (Junín y San Martín de los Andes)', () => {
    it('Ejecuta processSepaDataset con archivos de muestra y filtra por sucursales cordilleranas', () => {
      const records = processSepaDataset();
      expect(records.length).toBeGreaterThanOrEqual(10);

      // Verificar que leche está presente con alta confianza
      const leche = records.find((r) => r.normalized_name === 'leche');
      expect(leche).toBeDefined();
      expect(leche?.unit).toBe('l');
      expect(leche?.confidence).toBe('alta');
      expect(leche?.sample_count).toBeGreaterThanOrEqual(3);

      // Verificar que carnes o verduras tienen confianza baja por variabilidad
      const carne = records.find((r) => r.normalized_name === 'carne picada');
      expect(carne).toBeDefined();
      expect(carne?.confidence).toBe('baja');

      // Verificar que los fideos descartaron el precio de $999.999 y tienen un precio por kg razonable (~$2.200)
      const fideos = records.find((r) => r.normalized_name === 'fideos');
      expect(fideos).toBeDefined();
      expect(fideos!.price_per_unit).toBeLessThan(5000);
      expect(fideos!.price_per_unit).toBeGreaterThan(1500);
    });
  });

  describe('4. Orden de Precedencia: (1) Hogar > (2) SEPA > (3) Sin Precio', () => {
    const mockSepa: SepaReferencePrice[] = [
      {
        normalized_name: 'arroz',
        zone: 'Junín de los Andes',
        price_per_unit: 2100,
        unit: 'kg',
        date: '2026-10-11',
        source: 'SEPA',
        sample_count: 3,
        confidence: 'alta',
      },
      {
        normalized_name: 'leche',
        zone: 'Junín de los Andes',
        price_per_unit: 1450,
        unit: 'l',
        date: '2026-10-11',
        source: 'SEPA',
        sample_count: 5,
        confidence: 'alta',
      },
    ];

    beforeEach(() => {
      setLoadedSepaPrices(mockSepa);
    });

    it('Nivel 2: Si el hogar no cargó precio, usa el precio de referencia SEPA', () => {
      const res = getEffectiveItemPrice('arroz', 1, 'kg', testHouseholdId);
      expect(res.source).toBe('sepa');
      expect(res.price).toBe(2100);
      expect(res.confidence).toBe('alta');
    });

    it('Nivel 1: Si el hogar cargó su propio precio, este prevalece sobre SEPA', () => {
      saveHouseholdPrice('arroz', 1800, testHouseholdId);
      const res = getEffectiveItemPrice('arroz', 1, 'kg', testHouseholdId);
      expect(res.source).toBe('household');
      expect(res.price).toBe(1800);
    });

    it('Nivel 3: Si no hay precio en el hogar ni en SEPA, devuelve null sin inventar precios', () => {
      const res = getEffectiveItemPrice('producto_raro_sin_precio', 1, 'kg', testHouseholdId);
      expect(res.source).toBe('none');
      expect(res.price).toBeNull();
    });

    it('Convierte unidades correctamente (ej. 500 g de arroz a precio por kg)', () => {
      // 500 g de arroz a $2.100 el kg = $1.050
      const res = getEffectiveItemPrice('arroz', 500, 'g', testHouseholdId);
      expect(res.source).toBe('sepa');
      expect(res.price).toBe(1050);
    });
  });

  describe('5. Presupuesto del Carrito y Atribución Obligatoria', () => {
    const mockItems: ShoppingItem[] = [
      {
        id: '1',
        household_id: testHouseholdId,
        name: 'arroz largo fino',
        normalized_name: 'arroz',
        quantity: 1,
        unit: 'kg',
        category: 'almacen',
        is_bought: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        household_id: testHouseholdId,
        name: 'leche entera',
        normalized_name: 'leche',
        quantity: 2,
        unit: 'l',
        category: 'lacteos',
        is_bought: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '3',
        household_id: testHouseholdId,
        name: 'ingrediente exotico sin precio',
        normalized_name: 'ingrediente exotico',
        quantity: 1,
        unit: 'unidad',
        category: 'otros',
        is_bought: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('Calcula total aprox., cuenta ítems sin precio e incluye atribución oficial', () => {
      const budget = calculateCartBudget(mockItems, testHouseholdId);
      // Arroz $2100 + 2L Leche $2900 (2 x 1450) = $5000
      expect(budget.totalEstimated).toBe(5000);
      expect(budget.pricedCount).toBe(2);
      expect(budget.unpricedCount).toBe(1);
      expect(budget.formattedTotal).toContain('aprox.');
      expect(budget.attribution).toBe(SEPA_ATTRIBUTION);
      expect(budget.attribution).toContain('Secretaría de Comercio');
    });
  });

  describe('6. Costo Estimado de Receta con Precios SEPA', () => {
    const ingredients: ChefIngredient[] = [
      {
        nombre: 'arroz',
        cantidad: 1,
        unidad: 'kg',
        categoria: 'almacen',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: null,
      },
      {
        nombre: 'leche',
        cantidad: 1,
        unidad: 'l',
        categoria: 'lacteos',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: null,
      },
      {
        nombre: 'azafran',
        cantidad: 1,
        unidad: 'pizca',
        categoria: 'almacen',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: null,
      },
      {
        nombre: 'sal',
        cantidad: 1,
        unidad: 'pizca',
        categoria: 'almacen',
        es_basico: true,
        opcional: true, // Opcional no cuenta como faltante obligatorio
        item_despensa_coincidente: null,
      },
    ];

    it('Calcula costo de receta, ignora opcionales e informa faltantes sin dato', () => {
      const cost = calculateRecipeCost(ingredients, testHouseholdId);
      // Arroz ($2100) + Leche ($1450) = $3550
      expect(cost.totalEstimated).toBe(3550);
      expect(cost.coveredCount).toBe(2);
      expect(cost.missingCount).toBe(1); // azafran sin precio
      expect(cost.formattedEstimate).toBe('Faltan precios de 1 ingrediente');
      expect(cost.attribution).toBe(SEPA_ATTRIBUTION);
    });
  });
});
