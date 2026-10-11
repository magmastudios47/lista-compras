import { useEffect, useState, useCallback } from 'react';
import { Category, PantryItem, Unit } from '../types';
import { useHousehold } from '../context/HouseholdContext';
import { isConfigured, INITIAL_PANTRY_SEED, MOCK_HOUSEHOLD, supabase } from '../lib/supabaseClient';
import { offlineStorage } from '../lib/offlineStorage';
import { singularizeIngredient } from '../lib/normalizer';
import { pantrySyncManager } from '../lib/pantryAutoSync';

export function usePantry() {
  const { household } = useHousehold();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const activeHousehold = household || MOCK_HOUSEHOLD;

    // 1. Cargar desde offlineStorage de inmediato
    const cached = offlineStorage.getPantryItems();
    if (cached.length > 0) {
      setPantryItems(cached.filter((p) => p.household_id === activeHousehold.id));
    } else {
      setPantryItems(INITIAL_PANTRY_SEED);
      offlineStorage.savePantryItems(INITIAL_PANTRY_SEED);
    }

    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // 2. Cargar desde Supabase
    const fetchPantry = async () => {
      try {
        const { data, error } = await supabase
          .from('pantry_items')
          .select('*')
          .eq('household_id', activeHousehold.id)
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          setPantryItems(data as PantryItem[]);
          offlineStorage.savePantryItems(data as PantryItem[]);
        }
      } catch (err) {
        console.warn('Error cargando despensa desde Supabase:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPantry();

    // 3. Suscripción a Realtime
    const channel = supabase
      .channel(`pantry:${activeHousehold.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pantry_items', filter: `household_id=eq.${activeHousehold.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as PantryItem;
            setPantryItems((prev) => {
              if (prev.some((x) => x.id === newItem.id)) return prev;
              const next = [...prev, newItem];
              offlineStorage.savePantryItems(next);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as PantryItem;
            setPantryItems((prev) => {
              const next = prev.map((x) => (x.id === updated.id ? updated : x));
              offlineStorage.savePantryItems(next);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setPantryItems((prev) => {
              const next = prev.filter((x) => x.id !== deletedId);
              offlineStorage.savePantryItems(next);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household?.id]);

  // Agregar ítem a la despensa o actualizar cantidad existente
  const addPantryItem = useCallback(
    async (
      name: string,
      quantity: number | null = null,
      unit: Unit | null = null,
      category: Category = 'almacen'
    ): Promise<PantryItem> => {
      const activeHousehold = household || MOCK_HOUSEHOLD;

      const norm = singularizeIngredient(name);
      const existing = pantryItems.find((p) => p.normalized_name === norm);

      let itemResult: PantryItem;

      if (existing) {
        let nextQty = existing.quantity;
        if (quantity !== null) {
          nextQty = (existing.quantity || 0) + quantity;
        }
        itemResult = {
          ...existing,
          quantity: nextQty,
          unit: unit || existing.unit,
          category: category || existing.category,
          updated_at: new Date().toISOString(),
        };

        setPantryItems((prev) => {
          const next = prev.map((p) => (p.id === existing.id ? itemResult : p));
          offlineStorage.savePantryItems(next);
          return next;
        });

        if (isConfigured) {
          try {
            await supabase.from('pantry_items').update(itemResult).eq('id', existing.id);
          } catch {}
        } else {
          offlineStorage.enqueueMutation({
            table: 'pantry_items',
            action: 'update',
            payload: itemResult,
          });
        }
      } else {
        itemResult = {
          id: `pantry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          household_id: activeHousehold.id,
          name: name.trim(),
          normalized_name: norm,
          quantity,
          unit,
          category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setPantryItems((prev) => {
          const next = [itemResult, ...prev];
          offlineStorage.savePantryItems(next);
          return next;
        });

        if (isConfigured) {
          try {
            await supabase.from('pantry_items').insert(itemResult);
          } catch {}
        } else {
          offlineStorage.enqueueMutation({
            table: 'pantry_items',
            action: 'insert',
            payload: itemResult,
          });
        }
      }

      return itemResult;
    },
    [household, pantryItems]
  );
  // Agregar múltiples ítems (útil para "interpretar_despensa")
  const addMultiplePantryItems = useCallback(
    async (items: Array<{ nombre: string; cantidad: number | null; unidad: Unit | null; categoria: Category }>) => {
      for (const it of items) {
        await addPantryItem(it.nombre, it.cantidad, it.unidad, it.categoria);
      }
    },
    [addPantryItem]
  );

  // Editar ítem
  const updatePantryItem = useCallback(
    async (id: string, updates: Partial<PantryItem>): Promise<void> => {
      setPantryItems((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p));
        offlineStorage.savePantryItems(next);
        return next;
      });

      if (isConfigured) {
        await supabase.from('pantry_items').update(updates).eq('id', id);
      } else {
        offlineStorage.enqueueMutation({
          table: 'pantry_items',
          action: 'update',
          payload: { id, ...updates },
        });
      }
    },
    []
  );

  // Eliminar ítem
  const deletePantryItem = useCallback(
    async (id: string): Promise<void> => {
      setPantryItems((prev) => {
        const next = prev.filter((p) => p.id !== id);
        offlineStorage.savePantryItems(next);
        return next;
      });

      if (isConfigured) {
        await supabase.from('pantry_items').delete().eq('id', id);
      } else {
        offlineStorage.enqueueMutation({
          table: 'pantry_items',
          action: 'delete',
          payload: { id },
        });
      }
    },
    []
  );

  // Estado de deshacer para vaciado de despensa
  const [undoPantryState, setUndoPantryState] = useState<{
    itemCount: number;
    secondsLeft: number;
    clearedIds: string[];
  } | null>(null);

  // Vaciar toda la despensa con borrado lógico inmediato y 10s para deshacer
  const clearAllPantry = useCallback(async (): Promise<void> => {
    const toClear = pantryItems.filter((p) => !p.deleted_at);
    if (toClear.length === 0) return;

    const ids = toClear.map((p) => p.id);
    const now = new Date().toISOString();

    // 1. Borrado lógico inmediato
    setPantryItems((prev) => {
      const next = prev.map((it) => (ids.includes(it.id) ? { ...it, deleted_at: now } : it));
      offlineStorage.savePantryItems(next);
      return next;
    });

    // 2. Sincronizar en Supabase si está online
    if (isConfigured) {
      await supabase.from('pantry_items').update({ deleted_at: now }).in('id', ids);
    }

    // 3. Iniciar cuenta regresiva de 10 segundos
    setUndoPantryState({
      itemCount: ids.length,
      secondsLeft: 10,
      clearedIds: ids,
    });
  }, [pantryItems]);

  // Deshacer el vaciado de despensa
  const undoClearPantry = useCallback(async (): Promise<void> => {
    if (!undoPantryState) return;
    const { clearedIds } = undoPantryState;

    setPantryItems((prev) => {
      const next = prev.map((it) => (clearedIds.includes(it.id) ? { ...it, deleted_at: null } : it));
      offlineStorage.savePantryItems(next);
      return next;
    });

    if (isConfigured) {
      await supabase.from('pantry_items').update({ deleted_at: null }).in('id', clearedIds);
    }

    setUndoPantryState(null);
  }, [undoPantryState]);

  // Confirmar eliminación definitiva inmediata
  const commitClearPantryNow = useCallback(async (): Promise<void> => {
    if (!undoPantryState) return;
    const { clearedIds } = undoPantryState;

    setPantryItems((prev) => {
      const next = prev.filter((it) => !clearedIds.includes(it.id));
      offlineStorage.savePantryItems(next);
      return next;
    });

    if (isConfigured) {
      await supabase.from('pantry_items').delete().in('id', clearedIds);
    } else {
      clearedIds.forEach((id) => {
        offlineStorage.enqueueMutation({
          table: 'pantry_items',
          action: 'delete',
          payload: { id },
        });
      });
    }

    setUndoPantryState(null);
  }, [undoPantryState]);

  // Manejar el temporizador de 10 segundos
  useEffect(() => {
    if (!undoPantryState) return;

    if (undoPantryState.secondsLeft <= 0) {
      commitClearPantryNow();
      return;
    }

    const timer = setTimeout(() => {
      setUndoPantryState((curr) => (curr ? { ...curr, secondsLeft: curr.secondsLeft - 1 } : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [undoPantryState, commitClearPantryNow]);

  // Revertir adición originada por ítem de compras
  const revertPantryAddition = useCallback(
    async (shoppingItemId: string): Promise<boolean> => {
      const record = pantrySyncManager.getRecord(shoppingItemId);
      if (!record) return false;

      const norm = record.normalizedName;
      const target = pantryItems.find((p) => p.id === record.pantryItemId || p.normalized_name === norm);

      if (target) {
        let newQty = target.quantity;
        if (record.quantityAdded !== null && target.quantity !== null) {
          newQty = Math.max(0, target.quantity - record.quantityAdded);
        } else if (record.quantityAdded !== null) {
          newQty = 0;
        }

        const updated: PantryItem = {
          ...target,
          quantity: newQty,
          updated_at: new Date().toISOString(),
        };

        setPantryItems((prev) => {
          const next = prev.map((p) => (p.id === target.id ? updated : p));
          offlineStorage.savePantryItems(next);
          return next;
        });

        if (isConfigured) {
          try {
            await supabase
              .from('pantry_items')
              .update({ quantity: newQty, updated_at: updated.updated_at })
              .eq('id', target.id);
          } catch {}
        } else {
          offlineStorage.enqueueMutation({
            table: 'pantry_items',
            action: 'update',
            payload: updated,
          });
        }
      }

      pantrySyncManager.removeRecord(shoppingItemId);
      return true;
    },
    [pantryItems]
  );

  // Ítems activos (sin borrado lógico)
  const activePantryItems = pantryItems.filter((p) => !p.deleted_at);

  return {
    pantryItems: activePantryItems,
    allPantryItemsWithDeleted: pantryItems,
    loading,
    undoPantryState,
    addPantryItem,
    addMultiplePantryItems,
    updatePantryItem,
    deletePantryItem,
    revertPantryAddition,
    clearAllPantry,
    undoClearPantry,
    commitClearPantryNow,
  };
}
