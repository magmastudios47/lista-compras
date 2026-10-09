import { PantryItem, ShoppingItem } from '../types';
import { STORAGE_KEYS } from './constants';

export interface QueuedMutation {
  id: string;
  table: 'shopping_items' | 'pantry_items';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

export const offlineStorage = {
  // Shopping Items
  getShoppingItems(): ShoppingItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_ITEMS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveShoppingItems(items: ShoppingItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_ITEMS, JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando shopping items en storage:', e);
    }
  },

  // Pantry Items
  getPantryItems(): PantryItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LOCAL_PANTRY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePantryItems(items: PantryItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCAL_PANTRY, JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando despensa en storage:', e);
    }
  },

  // Mutation Queue para sincronización offline
  getMutationQueue(): QueuedMutation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MUTATION_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'timestamp'>): void {
    const queue = this.getMutationQueue();
    const newEntry: QueuedMutation = {
      ...mutation,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: Date.now(),
    };
    queue.push(newEntry);
    try {
      localStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error('Error encolando mutación:', e);
    }
  },

  clearMutation(mutationId: string): void {
    const queue = this.getMutationQueue().filter((m) => m.id !== mutationId);
    try {
      localStorage.setItem(STORAGE_KEYS.MUTATION_QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.error('Error limpiando mutación:', e);
    }
  },

  clearAllMutations(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.MUTATION_QUEUE);
    } catch (e) {
      console.error('Error vaciando cola de mutaciones:', e);
    }
  },
};
