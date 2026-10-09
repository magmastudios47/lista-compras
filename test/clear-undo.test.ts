import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applySoftDelete,
  restoreSoftDeleted,
  commitPermanentDelete,
  filterActiveItems,
} from '../src/lib/clearUndoManager';
import { offlineStorage } from '../src/lib/offlineStorage';
import { ShoppingItem, PantryItem } from '../src/types';

describe('Bloque 5: Lógica de Vaciar con Deshacer (10 segundos) y Soporte Offline', () => {
  const seedShoppingItems: ShoppingItem[] = [
    {
      id: 'item-1',
      household_id: 'h-test-123',
      name: 'Leche entera',
      normalized_name: 'leche entera',
      quantity: 2,
      unit: 'l',
      category: 'lacteos',
      is_bought: false,
      created_at: '2026-10-09T00:00:00.000Z',
      updated_at: '2026-10-09T00:00:00.000Z',
    },
    {
      id: 'item-2',
      household_id: 'h-test-123',
      name: 'Pan francés',
      normalized_name: 'pan frances',
      quantity: 1,
      unit: 'kg',
      category: 'panaderia',
      is_bought: true,
      bought_at: '2026-10-09T00:05:00.000Z',
      created_at: '2026-10-09T00:00:00.000Z',
      updated_at: '2026-10-09T00:05:00.000Z',
    },
    {
      id: 'item-3',
      household_id: 'h-test-123',
      name: 'Manzanas',
      normalized_name: 'manzana',
      quantity: 1,
      unit: 'kg',
      category: 'verduleria',
      is_bought: true,
      bought_at: '2026-10-09T00:06:00.000Z',
      created_at: '2026-10-09T00:00:00.000Z',
      updated_at: '2026-10-09T00:06:00.000Z',
    },
  ];

  const seedPantryItems: PantryItem[] = [
    {
      id: 'pantry-1',
      household_id: 'h-test-123',
      name: 'arroz largo fino',
      normalized_name: 'arroz largo fino',
      quantity: 1,
      unit: 'kg',
      category: 'almacen',
      created_at: '2026-10-09T00:00:00.000Z',
      updated_at: '2026-10-09T00:00:00.000Z',
    },
    {
      id: 'pantry-2',
      household_id: 'h-test-123',
      name: 'aceite de girasol',
      normalized_name: 'aceite de girasol',
      quantity: 900,
      unit: 'ml',
      category: 'almacen',
      created_at: '2026-10-09T00:00:00.000Z',
      updated_at: '2026-10-09T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    offlineStorage.clearAllStorage();
  });

  it('filterActiveItems filtra correctamente los elementos marcados con deleted_at', () => {
    const activeBefore = filterActiveItems(seedShoppingItems);
    expect(activeBefore.length).toBe(3);

    const withOneDeleted: ShoppingItem[] = [
      ...seedShoppingItems.slice(0, 2),
      { ...seedShoppingItems[2], deleted_at: new Date().toISOString() },
    ];

    const activeAfter = filterActiveItems(withOneDeleted);
    expect(activeAfter.length).toBe(2);
    expect(activeAfter.map((x) => x.id)).toEqual(['item-1', 'item-2']);
  });

  it('applySoftDelete marca instantáneamente todos los IDs solicitados con un timestamp ISO', () => {
    const allIds = seedShoppingItems.map((i) => i.id);
    const { updatedItems, clearedCount } = applySoftDelete(seedShoppingItems, allIds);

    expect(clearedCount).toBe(3);
    expect(updatedItems.length).toBe(3);
    updatedItems.forEach((item) => {
      expect(item.deleted_at).toBeDefined();
      expect(typeof item.deleted_at).toBe('string');
    });

    // Para la UI, los activos pasan inmediatamente a 0
    const active = filterActiveItems(updatedItems);
    expect(active.length).toBe(0);
  });

  it('restoreSoftDeleted revierte el borrado lógico a deleted_at null', () => {
    const allIds = seedShoppingItems.map((i) => i.id);
    const { updatedItems } = applySoftDelete(seedShoppingItems, allIds);
    expect(filterActiveItems(updatedItems).length).toBe(0);

    // Usuario toca "Deshacer"
    const restored = restoreSoftDeleted(updatedItems, allIds);
    expect(filterActiveItems(restored).length).toBe(3);
    restored.forEach((item) => {
      expect(item.deleted_at).toBeNull();
    });
  });

  it('commitPermanentDelete elimina físicamente los registros tras cumplirse el tiempo', () => {
    const allIds = seedShoppingItems.map((i) => i.id);
    const finalItems = commitPermanentDelete(seedShoppingItems, allIds);
    expect(finalItems.length).toBe(0);
  });

  it('vaciar solo comprados borra lógicamente solo los ítems marcados is_bought', () => {
    const boughtIds = seedShoppingItems.filter((i) => i.is_bought).map((i) => i.id);
    expect(boughtIds).toEqual(['item-2', 'item-3']);

    const { updatedItems } = applySoftDelete(seedShoppingItems, boughtIds);
    const active = filterActiveItems(updatedItems);

    expect(active.length).toBe(1);
    expect(active[0].id).toBe('item-1');
    expect(active[0].is_bought).toBe(false);

    // Si se deshace, vuelven todos
    const restored = restoreSoftDeleted(updatedItems, boughtIds);
    expect(filterActiveItems(restored).length).toBe(3);
  });

  it('despensa: vaciado suave, deshacer y persistencia en offlineStorage', () => {
    offlineStorage.savePantryItems(seedPantryItems);
    const cachedInitial = offlineStorage.getPantryItems();
    expect(cachedInitial.length).toBe(2);

    // Borrado lógico de despensa
    const pantryIds = seedPantryItems.map((p) => p.id);
    const { updatedItems } = applySoftDelete(seedPantryItems, pantryIds);
    offlineStorage.savePantryItems(updatedItems);

    const activeAfterClear = filterActiveItems(offlineStorage.getPantryItems());
    expect(activeAfterClear.length).toBe(0);

    // Deshacer dentro de los 10 segundos
    const restoredPantry = restoreSoftDeleted(updatedItems, pantryIds);
    offlineStorage.savePantryItems(restoredPantry);

    const activeAfterUndo = filterActiveItems(offlineStorage.getPantryItems());
    expect(activeAfterUndo.length).toBe(2);
    expect(activeAfterUndo[0].name).toBe('arroz largo fino');

    // Confirmación definitiva tras 10 segundos
    const permanentlyDeleted = commitPermanentDelete(restoredPantry, pantryIds);
    offlineStorage.savePantryItems(permanentlyDeleted);
    expect(offlineStorage.getPantryItems().length).toBe(0);
  });

  it('cola de mutaciones offline al vencer los 10 segundos', () => {
    const itemToDelete = seedShoppingItems[0];
    offlineStorage.enqueueMutation({
      table: 'shopping_items',
      action: 'delete',
      payload: { id: itemToDelete.id },
    });

    const queue = offlineStorage.getMutationQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].action).toBe('delete');
    expect(queue[0].table).toBe('shopping_items');
    expect(queue[0].payload.id).toBe(itemToDelete.id);
  });
});
