import { describe, it, expect, beforeEach } from 'vitest';
import { ARGENTINE_CATALOG, CATALOG_VERSION } from '../src/lib/catalog';
import {
  processHandwrittenText,
  matchCatalogItem,
  segmentLongestMatch,
  extractQuantityAndUnit,
  levenshtein,
  saveHouseholdCategoryOverride,
  getHouseholdCategoryOverride,
} from '../src/lib/textPipeline';
import { calculatePantryDiscounts } from '../src/lib/discountEngine';
import { PantryItem, ChefIngredient } from '../src/types';

describe('Suite de Catálogo Local Argentino y Pipeline de Texto', () => {
  // 1. Verificación de tamaño del catálogo
  it('1. El catálogo versionado contiene al menos 600 productos de consumo masivo en Argentina', () => {
    expect(ARGENTINE_CATALOG.length).toBeGreaterThanOrEqual(600);
    expect(CATALOG_VERSION).toBeTruthy();
  });

  // 2. Corrección ortográfica: "papaa"
  it('2. Corrige error ortográfico "papaa" -> "papa" (verduleria)', () => {
    const results = processHandwrittenText('papaa');
    expect(results.length).toBe(1);
    expect(results[0].nombre).toBe('papa');
    expect(results[0].categoria).toBe('verduleria');
    expect(results[0].corregido).toBe(true);
    expect(results[0].confianza).toBe('alta');
  });

  // 3. Corrección ortográfica: "tomte"
  it('3. Corrige error ortográfico "tomte" -> "tomate" (verduleria)', () => {
    const results = processHandwrittenText('tomte');
    expect(results.length).toBe(1);
    expect(results[0].nombre).toBe('tomate');
    expect(results[0].categoria).toBe('verduleria');
    expect(results[0].corregido).toBe(true);
    expect(results[0].confianza).toBe('alta');
  });

  // 4. Normalización sin tildes: "azucar"
  it('4. Normaliza "azucar" -> categoría "almacen"', () => {
    const results = processHandwrittenText('azucar');
    expect(results.length).toBe(1);
    expect(results[0].nombre).toBe('azucar');
    expect(results[0].categoria).toBe('almacen');
  });

  // 5. Nombre con especificación: "leche entera"
  it('5. Reconoce "leche entera" y asigna categoría "lacteos"', () => {
    const results = processHandwrittenText('leche entera');
    expect(results.length).toBe(1);
    expect(results[0].nombre).toBe('leche');
    expect(results[0].categoria).toBe('lacteos');
  });

  // 6. Frase sin separadores: "papa huevo leche" -> 3 productos distintos
  it('6. Segmenta sin separadores "papa huevo leche" en 3 productos individuales', () => {
    const results = processHandwrittenText('papa huevo leche');
    expect(results.length).toBe(3);

    const nombres = results.map((r) => r.nombre);
    expect(nombres).toContain('papa');
    expect(nombres).toContain('huevo');
    expect(nombres).toContain('leche');

    expect(results.find((r) => r.nombre === 'papa')?.categoria).toBe('verduleria');
    expect(results.find((r) => r.nombre === 'huevo')?.categoria).toBe('almacen');
    expect(results.find((r) => r.nombre === 'leche')?.categoria).toBe('lacteos');
  });

  // 7. Nombre compuesto como un solo producto: "papas fritas"
  it('7. Mantiene "papas fritas" como un único producto de góndola (almacen)', () => {
    const results = processHandwrittenText('papas fritas');
    expect(results.length).toBe(1);
    expect(results[0].nombre).toBe('papas fritas');
    expect(results[0].categoria).toBe('almacen');
  });

  // 8. Cantidades, unidades y separador "y": "2 cebollas y 1 kg de papa"
  it('8. Parsea "2 cebollas y 1 kg de papa" con cantidades y unidades correctas', () => {
    const results = processHandwrittenText('2 cebollas y 1 kg de papa');
    expect(results.length).toBe(2);

    const cebolla = results.find((r) => r.nombre === 'cebolla');
    expect(cebolla).toBeDefined();
    expect(cebolla?.cantidad).toBe(2);
    expect(cebolla?.unidad).toBe('unidad');
    expect(cebolla?.categoria).toBe('verduleria');

    const papa = results.find((r) => r.nombre === 'papa');
    expect(papa).toBeDefined();
    expect(papa?.cantidad).toBe(1);
    expect(papa?.unidad).toBe('kg');
    expect(papa?.categoria).toBe('verduleria');
  });

  // 9. Nombres compuestos con coma: "dulce de leche, pan rallado"
  it('9. Parsea "dulce de leche, pan rallado" en dos productos compuestos', () => {
    const results = processHandwrittenText('dulce de leche, pan rallado');
    expect(results.length).toBe(2);

    expect(results[0].nombre).toBe('dulce de leche');
    expect(results[0].categoria).toBe('almacen');

    expect(results[1].nombre).toBe('pan rallado');
    expect(results[1].categoria).toBe('almacen');
  });

  // 10. Memoria de categorías por hogar
  it('10. Recuerda categoría personalizada para el hogar', () => {
    const hhId = 'hogar-prueba-123';
    // Por defecto el huevo está en almacen
    const defaultRes = processHandwrittenText('huevo', hhId);
    expect(defaultRes[0].categoria).toBe('almacen');

    // El usuario prefiere categorizar "huevo" como verduleria
    saveHouseholdCategoryOverride('huevo', 'verduleria', hhId);

    const customRes = processHandwrittenText('huevo', hhId);
    expect(customRes[0].categoria).toBe('verduleria');
  });

  // 11. Cruce aproximado entre Chef y Despensa
  it('11. Motor de descuento reconoce coincidencia aproximada con despensa (ej. "tomte")', () => {
    const pantry: PantryItem[] = [
      {
        id: 'p1',
        household_id: 'hh-1',
        name: 'tomte', // Escrito con error en despensa
        normalized_name: 'tomte',
        quantity: 4,
        unit: 'unidad',
        category: 'verduleria',
        created_at: '',
        updated_at: '',
      },
    ];

    const ingredients: ChefIngredient[] = [
      {
        nombre: 'tomate',
        cantidad: 2,
        unidad: 'unidad',
        categoria: 'verduleria',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: null,
      },
    ];

    const results = calculatePantryDiscounts(ingredients, pantry);
    expect(results.length).toBe(1);
    // Debe haberlo vinculado y cubierto
    expect(results[0].estado).toBe('cubierto');
    expect(results[0].despensa_item?.id).toBe('p1');
    expect(results[0].cantidad_faltante).toBe(0);
  });
});
