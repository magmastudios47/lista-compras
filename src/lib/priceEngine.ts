import { ChefIngredient, ShoppingItem, Unit } from '../types';
import { singularizeIngredient } from './normalizer';
import { getHouseholdPrice } from './priceMemory';
import { isConfigured, supabase } from './supabaseClient';
import defaultSepaPrices from '../../data/reference_prices.json';

export interface SepaReferencePrice {
  normalized_name: string;
  zone: string;
  price_per_unit: number;
  unit: string;
  date: string;
  source: string;
  sample_count: number;
  confidence: 'alta' | 'media' | 'baja';
}

export const SEPA_ATTRIBUTION = 'Fuente: SEPA / Precios Claros (Secretaría de Comercio)';

// Memoria local de precios de referencia SEPA
let cachedSepaPrices: SepaReferencePrice[] = defaultSepaPrices as SepaReferencePrice[];

/**
 * Obtiene todos los precios de referencia SEPA cargados en memoria
 */
export function getLoadedSepaPrices(): SepaReferencePrice[] {
  return cachedSepaPrices;
}

/**
 * Actualiza los precios de referencia en memoria (por ejemplo desde Supabase o tests)
 */
export function setLoadedSepaPrices(prices: SepaReferencePrice[]): void {
  cachedSepaPrices = prices;
}

/**
 * Consulta precios de referencia en Supabase si está disponible
 */
export async function syncSepaPricesFromSupabase(zone: string = 'Junín de los Andes y alrededores'): Promise<void> {
  if (!isConfigured) return;

  try {
    const { data, error } = await supabase
      .from('price_reference')
      .select('*')
      .eq('zone', zone);

    if (!error && data && data.length > 0) {
      cachedSepaPrices = data as SepaReferencePrice[];
    }
  } catch (e) {
    console.warn('Error sincronizando price_reference de Supabase:', e);
  }
}

/**
 * Normaliza la cantidad para que coincida con la unidad del precio de referencia
 * (ej. si el precio es por kg y la compra es 500 g -> 0.5 kg)
 */
export function convertQuantityToRefUnit(quantity: number, itemUnit: Unit, refUnit: string): number {
  const iUnit = (itemUnit || 'unidad').toLowerCase();
  const rUnit = (refUnit || 'unidad').toLowerCase();

  if (iUnit === rUnit) return quantity;

  // Gramos a Kilos
  if (iUnit === 'g' && rUnit === 'kg') return quantity / 1000;
  if (iUnit === 'kg' && rUnit === 'g') return quantity * 1000;

  // Mililitros a Litros
  if (iUnit === 'ml' && rUnit === 'l') return quantity / 1000;
  if (iUnit === 'l' && rUnit === 'ml') return quantity * 1000;

  return quantity;
}

export interface EffectivePriceResult {
  price: number | null;
  source: 'household' | 'sepa' | 'none';
  unitPrice?: number;
  confidence?: 'alta' | 'media' | 'baja';
  date?: string;
}

/**
 * Resuelve el precio efectivo de un ítem según el orden estricto de precedencia:
 * 1. Precio cargado por el hogar (priceMemory)
 * 2. Precio de referencia SEPA de la zona
 * 3. Sin precio (null)
 */
export function getEffectiveItemPrice(
  itemName: string,
  quantity: number = 1,
  unit: Unit = 'unidad',
  householdId: string = 'default'
): EffectivePriceResult {
  if (!itemName) return { price: null, source: 'none' };

  // Nivel 1: Precio recordado del hogar
  const hhPrice = getHouseholdPrice(itemName, householdId);
  if (hhPrice !== null && hhPrice > 0) {
    return {
      price: Math.round(hhPrice * 100) / 100,
      source: 'household',
    };
  }

  // Nivel 2: Precio de referencia SEPA de la zona
  const norm = singularizeIngredient(itemName).toLowerCase().trim();
  const sepaRef = cachedSepaPrices.find((p) => {
    const pNorm = singularizeIngredient(p.normalized_name).toLowerCase().trim();
    return norm.includes(pNorm) || pNorm.includes(norm);
  });

  if (sepaRef && sepaRef.price_per_unit > 0) {
    const convertedQty = convertQuantityToRefUnit(quantity > 0 ? quantity : 1, unit, sepaRef.unit);
    const calculatedPrice = sepaRef.price_per_unit * convertedQty;
    return {
      price: Math.round(calculatedPrice * 100) / 100,
      unitPrice: sepaRef.price_per_unit,
      source: 'sepa',
      confidence: sepaRef.confidence,
      date: sepaRef.date,
    };
  }

  // Nivel 3: Sin precio
  return { price: null, source: 'none' };
}

export interface CartBudgetSummary {
  totalEstimated: number;
  pricedCount: number;
  unpricedCount: number;
  lastUpdatedDate?: string;
  attribution: string;
  hasPrices: boolean;
  formattedTotal: string;
}

/**
 * Calcula el total del carrito con desglose de ítems sin precio y atribución oficial
 */
export function calculateCartBudget(
  items: ShoppingItem[],
  householdId: string = 'default'
): CartBudgetSummary {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  let latestDate: string | undefined;

  items.forEach((item) => {
    // Si el usuario fijó manualmente un estimated_price en el ítem, se respeta
    if (item.estimated_price !== undefined && item.estimated_price !== null && item.estimated_price > 0) {
      total += item.estimated_price;
      priced++;
      return;
    }

    const eff = getEffectiveItemPrice(item.name, item.quantity, item.unit, householdId);
    if (eff.price !== null && eff.price > 0) {
      total += eff.price;
      priced++;
      if (eff.date && (!latestDate || eff.date > latestDate)) {
        latestDate = eff.date;
      }
    } else {
      unpriced++;
    }
  });

  const rounded = Math.round(total);

  return {
    totalEstimated: rounded,
    pricedCount: priced,
    unpricedCount: unpriced,
    lastUpdatedDate: latestDate || '2026-10-11',
    attribution: SEPA_ATTRIBUTION,
    hasPrices: priced > 0,
    formattedTotal: `$${rounded.toLocaleString('es-AR')} aprox.`,
  };
}

export interface RecipeCostSummary {
  totalEstimated: number;
  coveredCount: number;
  missingCount: number;
  isFullyPriced: boolean;
  formattedEstimate: string;
  attribution: string;
}

/**
 * Calcula el costo estimado de una receta respetando precedencia: Hogar > SEPA > Sin precio
 */
export function calculateRecipeCost(
  ingredients: ChefIngredient[],
  householdId: string = 'default'
): RecipeCostSummary {
  if (!ingredients || ingredients.length === 0) {
    return {
      totalEstimated: 0,
      coveredCount: 0,
      missingCount: 0,
      isFullyPriced: false,
      formattedEstimate: 'Sin ingredientes',
      attribution: SEPA_ATTRIBUTION,
    };
  }

  let total = 0;
  let covered = 0;
  let missing = 0;

  ingredients.forEach((ing) => {
    if (ing.opcional) return;

    const eff = getEffectiveItemPrice(ing.nombre, ing.cantidad, ing.unidad, householdId);
    if (eff.price !== null && eff.price > 0) {
      total += eff.price;
      covered++;
    } else {
      missing++;
    }
  });

  const isFullyPriced = missing === 0 && covered > 0;
  let formattedEstimate: string;

  if (isFullyPriced) {
    formattedEstimate = `$${Math.round(total).toLocaleString('es-AR')} aprox.`;
  } else if (covered > 0) {
    formattedEstimate = `Faltan precios de ${missing} ${missing === 1 ? 'ingrediente' : 'ingredientes'}`;
  } else {
    formattedEstimate = `Sin precios cargados (${missing} faltantes)`;
  }

  return {
    totalEstimated: Math.round(total * 100) / 100,
    coveredCount: covered,
    missingCount: missing,
    isFullyPriced,
    formattedEstimate,
    attribution: SEPA_ATTRIBUTION,
  };
}
