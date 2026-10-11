import { Category, Household, PantryItem, ShoppingItem, Unit } from '../types';
import { singularizeIngredient } from './normalizer';
import { offlineStorage } from './offlineStorage';

export interface PantrySyncRecord {
  shoppingItemId: string;
  pantryItemId: string;
  pantryItemName: string;
  normalizedName: string;
  quantityAdded: number | null;
  unit: Unit | null;
  timestamp: string;
}

/**
 * Determina si un producto debe excluirse por ser de categoría limpieza
 */
export function isCleaningCategory(category: Category): boolean {
  return category === 'limpieza';
}

/**
 * Evalúa la política del hogar para saber qué acción tomar al marcar como comprado
 */
export function evaluatePantryAddAction(
  item: ShoppingItem,
  household: Household | null | undefined
): 'auto' | 'ask' | 'skip' {
  const excludeCleaning = household?.pantry_exclude_cleaning !== false; // true por defecto
  if (excludeCleaning && isCleaningCategory(item.category)) {
    return 'skip';
  }

  const mode = household?.pantry_add_mode || 'ask'; // 'ask' por defecto
  if (mode === 'never') {
    return 'skip';
  }
  if (mode === 'auto') {
    return 'auto';
  }
  return 'ask';
}

/**
 * Reversión de una adición previa a la despensa originada por un ítem de compra.
 * Resta la cantidad sumada sin llegar a valores negativos.
 */
export function calculateRevertedPantryItem(
  existingPantryItem: PantryItem,
  record: PantrySyncRecord
): PantryItem {
  let nextQty = existingPantryItem.quantity;
  if (record.quantityAdded !== null && existingPantryItem.quantity !== null) {
    nextQty = Math.max(0, existingPantryItem.quantity - record.quantityAdded);
  } else if (record.quantityAdded !== null && existingPantryItem.quantity === null) {
    nextQty = 0;
  }

  return {
    ...existingPantryItem,
    quantity: nextQty,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Gestor de sincronización de despensa en cliente
 */
export class PantryAutoSyncManager {
  private inMemoryRecords: Map<string, PantrySyncRecord> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = offlineStorage.getPantryOrigins();
      if (stored) {
        Object.entries(stored).forEach(([k, v]) => {
          this.inMemoryRecords.set(k, v);
        });
      }
    } catch {}
  }

  private persist() {
    try {
      const obj: Record<string, PantrySyncRecord> = {};
      this.inMemoryRecords.forEach((v, k) => {
        obj[k] = v;
      });
      offlineStorage.savePantryOrigins(obj);
    } catch {}
  }

  public hasRecord(shoppingItemId: string): boolean {
    return this.inMemoryRecords.has(shoppingItemId);
  }

  public getRecord(shoppingItemId: string): PantrySyncRecord | undefined {
    return this.inMemoryRecords.get(shoppingItemId);
  }

  public recordAddition(record: PantrySyncRecord): void {
    this.inMemoryRecords.set(record.shoppingItemId, record);
    this.persist();
  }

  public removeRecord(shoppingItemId: string): PantrySyncRecord | undefined {
    const existing = this.inMemoryRecords.get(shoppingItemId);
    if (existing) {
      this.inMemoryRecords.delete(shoppingItemId);
      this.persist();
    }
    return existing;
  }

  public clearAll(): void {
    this.inMemoryRecords.clear();
    this.persist();
  }

  public getAll(): Record<string, PantrySyncRecord> {
    const obj: Record<string, PantrySyncRecord> = {};
    this.inMemoryRecords.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  }
}

export const pantrySyncManager = new PantryAutoSyncManager();
