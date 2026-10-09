import { ChefIngredient } from '../types';
import { singularizeIngredient } from './normalizer';

const PRICE_STORAGE_PREFIX = 'compars_price_memory_';
const inMemoryPriceStorage = new Map<string, Record<string, number>>();

function getStorageKey(householdId: string = 'default'): string {
  return `${PRICE_STORAGE_PREFIX}${householdId}`;
}

/**
 * Obtiene todos los precios recordados para un hogar
 */
export function getAllHouseholdPrices(householdId: string = 'default'): Record<string, number> {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(getStorageKey(householdId));
      if (data) return JSON.parse(data);
    }
  } catch {}

  return inMemoryPriceStorage.get(householdId) || {};
}

/**
 * Guarda o actualiza el precio recordado de un producto para el hogar
 */
export function saveHouseholdPrice(
  itemName: string,
  price: number,
  householdId: string = 'default'
): void {
  if (!itemName || isNaN(price) || price <= 0) return;

  const normalized = singularizeIngredient(itemName).toLowerCase().trim();
  const currentPrices = getAllHouseholdPrices(householdId);
  currentPrices[normalized] = Math.round(price * 100) / 100;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getStorageKey(householdId), JSON.stringify(currentPrices));
    }
  } catch {}

  inMemoryPriceStorage.set(householdId, currentPrices);
}

/**
 * Obtiene el precio recordado para un producto específico en el hogar
 */
export function getHouseholdPrice(
  itemName: string,
  householdId: string = 'default'
): number | null {
  if (!itemName) return null;
  const normalized = singularizeIngredient(itemName).toLowerCase().trim();
  const prices = getAllHouseholdPrices(householdId);
  return prices[normalized] ?? null;
}

/**
 * Limpia la memoria de precios (útil para pruebas)
 */
export function clearPriceMemory(householdId?: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (householdId) {
        localStorage.removeItem(getStorageKey(householdId));
      } else {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith(PRICE_STORAGE_PREFIX)) localStorage.removeItem(k);
        });
      }
    }
  } catch {}

  if (householdId) {
    inMemoryPriceStorage.delete(householdId);
  } else {
    inMemoryPriceStorage.clear();
  }
}

export interface RecipeCostEstimate {
  totalEstimated: number;
  coveredCount: number;
  missingCount: number;
  isFullyPriced: boolean;
  formattedEstimate: string;
}

/**
 * Calcula el costo estimado de una receta según los precios recordados por el hogar
 */
export function calculateRecipeEstimatedCost(
  ingredients: ChefIngredient[],
  householdId: string = 'default'
): RecipeCostEstimate {
  if (!ingredients || ingredients.length === 0) {
    return {
      totalEstimated: 0,
      coveredCount: 0,
      missingCount: 0,
      isFullyPriced: false,
      formattedEstimate: 'Sin ingredientes',
    };
  }

  let total = 0;
  let covered = 0;
  let missing = 0;

  ingredients.forEach((ing) => {
    // Si es opcional, no cuenta para el cálculo obligatorio
    if (ing.opcional) return;

    const price = getHouseholdPrice(ing.nombre, householdId);
    if (price !== null && price > 0) {
      total += price;
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
  };
}
