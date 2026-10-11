import { PantryItem, ShoppingItem } from '../types';
import { STORAGE_KEYS } from './constants';

export interface QueuedMutation {
  id: string;
  table: 'shopping_items' | 'pantry_items';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStorage.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
  memoryStorage.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {}
  memoryStorage.delete(key);
}

export const offlineStorage = {
  // Shopping Items
  getShoppingItems(): ShoppingItem[] {
    const data = getStorageItem(STORAGE_KEYS.LOCAL_ITEMS);
    return data ? JSON.parse(data) : [];
  },

  saveShoppingItems(items: ShoppingItem[]): void {
    setStorageItem(STORAGE_KEYS.LOCAL_ITEMS, JSON.stringify(items));
  },

  // Pantry Items
  getPantryItems(): PantryItem[] {
    const data = getStorageItem(STORAGE_KEYS.LOCAL_PANTRY);
    return data ? JSON.parse(data) : [];
  },

  savePantryItems(items: PantryItem[]): void {
    setStorageItem(STORAGE_KEYS.LOCAL_PANTRY, JSON.stringify(items));
  },

  // Pantry Origins (tracking de ítems de compra sumados a despensa)
  getPantryOrigins(): Record<string, any> {
    const data = getStorageItem(STORAGE_KEYS.PANTRY_ORIGINS);
    return data ? JSON.parse(data) : {};
  },

  savePantryOrigins(origins: Record<string, any>): void {
    setStorageItem(STORAGE_KEYS.PANTRY_ORIGINS, JSON.stringify(origins));
  },

  // Mutation Queue para sincronización offline
  getMutationQueue(): QueuedMutation[] {
    const data = getStorageItem(STORAGE_KEYS.MUTATION_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): void {
    const queue = this.getMutationQueue();
    const newEntry: QueuedMutation = {
      ...mutation,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    };
    queue.push(newEntry);
    setStorageItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
  },

  clearMutation(mutationId: string): void {
    const queue = this.getMutationQueue().filter((m) => m.id !== mutationId);
    setStorageItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
  },

  clearAllMutations(): void {
    removeStorageItem(STORAGE_KEYS.MUTATION_QUEUE);
  },

  clearAllStorage(): void {
    removeStorageItem(STORAGE_KEYS.LOCAL_ITEMS);
    removeStorageItem(STORAGE_KEYS.LOCAL_PANTRY);
    removeStorageItem(STORAGE_KEYS.MUTATION_QUEUE);
    memoryStorage.clear();
  },
};
