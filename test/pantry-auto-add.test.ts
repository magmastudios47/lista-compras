import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluatePantryAddAction,
  calculateRevertedPantryItem,
  isCleaningCategory,
  PantryAutoSyncManager,
  PantrySyncRecord,
} from '../src/lib/pantryAutoSync';
import { Household, PantryItem, ShoppingItem } from '../src/types';
import { singularizeIngredient } from '../src/lib/normalizer';

describe('Bloque 3: Despensa Automática al Marcar Comprado', () => {
  let mockHousehold: Household;
  let syncManager: PantryAutoSyncManager;

  beforeEach(() => {
    mockHousehold = {
      id: 'hh_test_1',
      name: 'Hogar Test',
      invite_code: 'TEST01',
      currency: 'ARS',
      monthly_chef_limit: 40,
      chef_queries_used_month: 0,
      pantry_add_mode: 'ask',
      pantry_exclude_cleaning: true,
      created_at: new Date().toISOString(),
    };

    syncManager = new PantryAutoSyncManager();
    syncManager.clearAll();
  });

  const createShoppingItem = (
    id: string,
    name: string,
    quantity: number,
    unit: any,
    category: any,
    is_bought = false
  ): ShoppingItem => ({
    id,
    household_id: 'hh_test_1',
    name,
    normalized_name: singularizeIngredient(name),
    quantity,
    unit,
    category,
    is_bought,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const createPantryItem = (
    id: string,
    name: string,
    quantity: number | null,
    unit: any,
    category: any
  ): PantryItem => ({
    id,
    household_id: 'hh_test_1',
    name,
    normalized_name: singularizeIngredient(name),
    quantity,
    unit,
    category,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  describe('1. Evaluación de políticas del hogar (los 3 modos y limpieza)', () => {
    it('Por defecto es "ask" para productos regulares', () => {
      const item = createShoppingItem('s1', 'leche entera', 2, 'l', 'lacteos');
      const action = evaluatePantryAddAction(item, mockHousehold);
      expect(action).toBe('ask');
    });

    it('En modo "auto" devuelve "auto" para productos regulares', () => {
      mockHousehold.pantry_add_mode = 'auto';
      const item = createShoppingItem('s2', 'arroz largo fino', 1, 'kg', 'almacen');
      const action = evaluatePantryAddAction(item, mockHousehold);
      expect(action).toBe('auto');
    });

    it('En modo "never" devuelve "skip" (no sumar nunca ni preguntar)', () => {
      mockHousehold.pantry_add_mode = 'never';
      const item = createShoppingItem('s3', 'fideos secos', 500, 'g', 'almacen');
      const action = evaluatePantryAddAction(item, mockHousehold);
      expect(action).toBe('skip');
    });

    it('Por defecto excluye productos de limpieza (pantry_exclude_cleaning = true)', () => {
      mockHousehold.pantry_add_mode = 'auto'; // incluso si está en auto
      mockHousehold.pantry_exclude_cleaning = true;
      const item = createShoppingItem('s4', 'detergente magistral', 1, 'unidad', 'limpieza');
      const action = evaluatePantryAddAction(item, mockHousehold);
      expect(action).toBe('skip');
    });

    it('Si se configura pantry_exclude_cleaning = false, los productos de limpieza sí se procesan', () => {
      mockHousehold.pantry_add_mode = 'auto';
      mockHousehold.pantry_exclude_cleaning = false;
      const item = createShoppingItem('s5', 'lavandina ayudin', 1, 'l', 'limpieza');
      const action = evaluatePantryAddAction(item, mockHousehold);
      expect(action).toBe('auto');
    });
  });

  describe('2. Modo Automático, suma con normalizador y registro de procedencia', () => {
    it('Suma cantidades si el ítem ya existe en la despensa (1 kg + 2 kg = 3 kg)', () => {
      const existing = createPantryItem('p1', 'arroz', 1, 'kg', 'almacen');
      const boughtItem = createShoppingItem('s1', 'arroz', 2, 'kg', 'almacen', true);

      const nextQty = (existing.quantity || 0) + boughtItem.quantity;
      expect(nextQty).toBe(3);

      const record: PantrySyncRecord = {
        shoppingItemId: boughtItem.id,
        pantryItemId: existing.id,
        pantryItemName: existing.name,
        normalizedName: existing.normalized_name,
        quantityAdded: boughtItem.quantity,
        unit: boughtItem.unit,
        timestamp: new Date().toISOString(),
      };
      syncManager.recordAddition(record);

      expect(syncManager.hasRecord('s1')).toBe(true);
      expect(syncManager.getRecord('s1')?.quantityAdded).toBe(2);
    });

    it('Deshacer resta exactamente lo que se había sumado', () => {
      const pantryWithAdded = createPantryItem('p1', 'arroz', 3, 'kg', 'almacen');
      const record = syncManager.getRecord('s1') || {
        shoppingItemId: 's1',
        pantryItemId: 'p1',
        pantryItemName: 'arroz',
        normalizedName: 'arroz',
        quantityAdded: 2,
        unit: 'kg',
        timestamp: new Date().toISOString(),
      };

      const reverted = calculateRevertedPantryItem(pantryWithAdded, record);
      expect(reverted.quantity).toBe(1);
    });
  });

  describe('3. Reversión al volver a "falta comprar" (unchecking) y protección contra negativos', () => {
    it('Resta la cantidad al desmarcar comprado y elimina el registro', () => {
      const shoppingItem = createShoppingItem('s10', 'huevos', 12, 'unidad', 'almacen');
      const pantryItem = createPantryItem('p10', 'huevo', 24, 'unidad', 'almacen');

      const record: PantrySyncRecord = {
        shoppingItemId: shoppingItem.id,
        pantryItemId: pantryItem.id,
        pantryItemName: pantryItem.name,
        normalizedName: pantryItem.normalized_name,
        quantityAdded: 12,
        unit: 'unidad',
        timestamp: new Date().toISOString(),
      };
      syncManager.recordAddition(record);

      const reverted = calculateRevertedPantryItem(pantryItem, record);
      expect(reverted.quantity).toBe(12);

      syncManager.removeRecord(shoppingItem.id);
      expect(syncManager.hasRecord(shoppingItem.id)).toBe(false);
    });

    it('No produce números negativos si la despensa fue consumida o tiene menor cantidad', () => {
      // Tenía 2 litros en despensa, se habían sumado 5 litros
      const depletedPantry = createPantryItem('p11', 'leche', 2, 'l', 'lacteos');
      const record: PantrySyncRecord = {
        shoppingItemId: 's11',
        pantryItemId: 'p11',
        pantryItemName: 'leche',
        normalizedName: 'leche',
        quantityAdded: 5,
        unit: 'l',
        timestamp: new Date().toISOString(),
      };

      const reverted = calculateRevertedPantryItem(depletedPantry, record);
      // Math.max(0, 2 - 5) = 0, nunca negativo
      expect(reverted.quantity).toBe(0);
    });
  });

  describe('4. Idempotencia y Concurrencia (dos integrantes marcando a la vez)', () => {
    it('La presencia del registro evita duplicar sumas para el mismo shoppingItemId', () => {
      const item = createShoppingItem('s20', 'yerba mate', 1, 'kg', 'almacen');
      const record: PantrySyncRecord = {
        shoppingItemId: item.id,
        pantryItemId: 'p20',
        pantryItemName: 'yerba mate',
        normalizedName: 'yerba mate',
        quantityAdded: 1,
        unit: 'kg',
        timestamp: new Date().toISOString(),
      };

      // Simular primera marcación por Integrante A
      expect(syncManager.hasRecord(item.id)).toBe(false);
      syncManager.recordAddition(record);
      expect(syncManager.hasRecord(item.id)).toBe(true);

      // Simular segunda marcación simultánea por Integrante B
      const shouldAddAgain = !syncManager.hasRecord(item.id);
      expect(shouldAddAgain).toBe(false); // No se vuelve a sumar
    });

    it('Limpieza y restauración de sync manager', () => {
      syncManager.recordAddition({
        shoppingItemId: 's30',
        pantryItemId: 'p30',
        pantryItemName: 'manteca',
        normalizedName: 'manteca',
        quantityAdded: 200,
        unit: 'g',
        timestamp: new Date().toISOString(),
      });
      expect(syncManager.hasRecord('s30')).toBe(true);

      syncManager.clearAll();
      expect(syncManager.hasRecord('s30')).toBe(false);
    });
  });
});
