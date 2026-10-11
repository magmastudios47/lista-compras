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

import { calculateRecipeCost, SEPA_ATTRIBUTION } from './priceEngine';

export interface RecipeCostEstimate {
  totalEstimated: number;
  coveredCount: number;
  missingCount: number;
  isFullyPriced: boolean;
  formattedEstimate: string;
  attribution?: string;
}

/**
 * Calcula el costo estimado de una receta según precedencia: Hogar > SEPA > Sin precio
 */
export function calculateRecipeEstimatedCost(
  ingredients: ChefIngredient[],
  householdId: string = 'default'
): RecipeCostEstimate {
  return calculateRecipeCost(ingredients, householdId);
}
