import { ChefIngredient, DiscountComparisonResult, PantryItem, Unit } from '../types';
import { normalizeString, singularizeIngredient } from './normalizer';

/**
 * Convierte una cantidad de una unidad a otra si son compatibles.
 * Si no son compatibles, retorna null.
 */
export function convertUnit(quantity: number, fromUnit: Unit, toUnit: Unit): number | null {
  if (fromUnit === toUnit) return quantity;

  // Masa: g y kg
  if (fromUnit === 'g' && toUnit === 'kg') return quantity / 1000;
  if (fromUnit === 'kg' && toUnit === 'g') return quantity * 1000;

  // Volumen: ml y l
  if (fromUnit === 'ml' && toUnit === 'l') return quantity / 1000;
  if (fromUnit === 'l' && toUnit === 'ml') return quantity * 1000;

  // Cucharadas / cucharaditas aproximadas si ambas son de cocina
  if (fromUnit === 'cucharadita' && toUnit === 'cucharada') return quantity / 3;
  if (fromUnit === 'cucharada' && toUnit === 'cucharadita') return quantity * 3;

  return null;
}

/**
 * Unifica ingredientes duplicados en una misma lista sumando sus cantidades si las unidades son compatibles.
 */
export function mergeDuplicateIngredients(ingredients: ChefIngredient[]): ChefIngredient[] {
  const mergedMap = new Map<string, ChefIngredient>();

  for (const item of ingredients) {
    const key = singularizeIngredient(item.nombre);
    if (!mergedMap.has(key)) {
      mergedMap.set(key, { ...item, nombre: key });
    } else {
      const existing = mergedMap.get(key)!;
      const converted = convertUnit(item.cantidad, item.unidad, existing.unidad);

      if (converted !== null) {
        existing.cantidad = Math.round((existing.cantidad + converted) * 100) / 100;
        existing.es_basico = existing.es_basico && item.es_basico;
        existing.opcional = existing.opcional && item.opcional;
      } else {
        // Si no son compatibles, mantener con clave única para no perderlo
        mergedMap.set(`${key}_${item.unidad}`, { ...item });
      }
    }
  }

  return Array.from(mergedMap.values());
}

/**
 * Realiza el cálculo determinista entre los ingredientes solicitados por el Chef IA
 * y los productos existentes en la despensa del hogar.
 */
export function calculatePantryDiscounts(
  ingredients: ChefIngredient[],
  pantryItems: PantryItem[]
): DiscountComparisonResult[] {
  const unifiedIngredients = mergeDuplicateIngredients(ingredients);
  const results: DiscountComparisonResult[] = [];

  for (const ing of unifiedIngredients) {
    const ingNormalized = singularizeIngredient(ing.nombre);

    // 1. Buscar coincidencia en despensa (prioridad: item_despensa_coincidente, luego normalización)
    let matchingPantry = pantryItems.find((p) => {
      if (ing.item_despensa_coincidente) {
        return normalizeString(p.name) === normalizeString(ing.item_despensa_coincidente);
      }
      return (
        singularizeIngredient(p.name) === ingNormalized ||
        singularizeIngredient(p.normalized_name) === ingNormalized
      );
    });

    if (!matchingPantry) {
      // 2. Coincidencia parcial por substring ("aceite de girasol" vs "aceite")
      matchingPantry = pantryItems.find((p) => {
        const pNorm = singularizeIngredient(p.name);
        return ingNormalized.includes(pNorm) || pNorm.includes(ingNormalized);
      });
    }

    if (!matchingPantry) {
      // No está en despensa: falta total
      results.push({
        ingrediente: ing,
        despensa_item: null,
        estado: 'falta_total',
        seleccionadoParaAgregar: !ing.opcional, // Opcionales vienen destildados por defecto
        cantidad_faltante: ing.cantidad,
        unidad_faltante: ing.unidad,
        detalle: 'No está en la despensa',
      });
      continue;
    }

    // Está en despensa pero sin cantidad especificada (ej. "tengo azúcar")
    if (matchingPantry.quantity === null || matchingPantry.quantity === undefined) {
      const esBasico = ing.es_basico;
      results.push({
        ingrediente: ing,
        despensa_item: matchingPantry,
        estado: esBasico ? 'basico_presente' : 'cubierto',
        seleccionadoParaAgregar: false,
        cantidad_faltante: 0,
        unidad_faltante: ing.unidad,
        detalle: `Tenés ${matchingPantry.name} en casa (sin cantidad registrada)`,
      });
      continue;
    }

    // Hay cantidad registrada: intentar convertir unidades
    const pantryUnit = matchingPantry.unit || ing.unidad;
    const availableInRecipeUnit = convertUnit(matchingPantry.quantity, pantryUnit, ing.unidad);

    if (availableInRecipeUnit === null) {
      // Unidades no convertibles directamente (ej. 2 latas vs 300 g)
      results.push({
        ingrediente: ing,
        despensa_item: matchingPantry,
        estado: 'falta_parcial',
        seleccionadoParaAgregar: true,
        cantidad_faltante: ing.cantidad,
        unidad_faltante: ing.unidad,
        detalle: `Tenés ${matchingPantry.quantity} ${pantryUnit} en casa (verificá si alcanza)`,
      });
      continue;
    }

    // Comparación matemática exacta
    if (availableInRecipeUnit >= ing.cantidad) {
      // 100% Cubierto
      results.push({
        ingrediente: ing,
        despensa_item: matchingPantry,
        estado: 'cubierto',
        seleccionadoParaAgregar: false,
        cantidad_faltante: 0,
        unidad_faltante: ing.unidad,
        detalle: `Cubierto: necesitás ${ing.cantidad} ${ing.unidad} y tenés ${availableInRecipeUnit} ${ing.unidad}`,
      });
    } else {
      // Falta parcial
      const faltante = Math.round((ing.cantidad - availableInRecipeUnit) * 100) / 100;
      results.push({
        ingrediente: ing,
        despensa_item: matchingPantry,
        estado: 'falta_parcial',
        seleccionadoParaAgregar: true,
        cantidad_faltante: faltante,
        unidad_faltante: ing.unidad,
        detalle: `Tenés ${availableInRecipeUnit} ${ing.unidad}; te faltan ${faltante} ${ing.unidad}`,
      });
    }
  }

  return results;
}
