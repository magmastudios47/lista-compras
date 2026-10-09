import { ShoppingItem, PantryItem } from '../types';

export interface UndoClearSession<T> {
  actionType: 'all' | 'bought' | 'pantry';
  itemCount: number;
  secondsLeft: number;
  clearedIds: string[];
  snapshot: T[];
  timestamp: string;
}

/**
 * Filtra los elementos que no han sido borrados lógicamente
 */
export function filterActiveItems<T extends { deleted_at?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !item.deleted_at);
}

/**
 * Aplica borrado lógico inmediato (deleted_at = ISO string)
 */
export function applySoftDelete<T extends { id: string; deleted_at?: string | null }>(
  items: T[],
  idsToClear: string[]
): { updatedItems: T[]; clearedCount: number } {
  const now = new Date().toISOString();
  const idSet = new Set(idsToClear);

  const updatedItems = items.map((it) => {
    if (idSet.has(it.id)) {
      return { ...it, deleted_at: now };
    }
    return it;
  });

  return {
    updatedItems,
    clearedCount: idsToClear.length,
  };
}

/**
 * Deshace el borrado lógico restableciendo deleted_at = null
 */
export function restoreSoftDeleted<T extends { id: string; deleted_at?: string | null }>(
  items: T[],
  idsToRestore: string[]
): T[] {
  const idSet = new Set(idsToRestore);
  return items.map((it) => {
    if (idSet.has(it.id)) {
      return { ...it, deleted_at: null };
    }
    return it;
  });
}

/**
 * Aplica eliminación definitiva permanente (física)
 */
export function commitPermanentDelete<T extends { id: string }>(items: T[], idsToDelete: string[]): T[] {
  const idSet = new Set(idsToDelete);
  return items.filter((it) => !idSet.has(it.id));
}
