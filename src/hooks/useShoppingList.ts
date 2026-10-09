import { useEffect, useState, useCallback } from 'react';
import { Category, ShoppingItem, Unit } from '../types';
import { useHousehold } from '../context/HouseholdContext';
import { useAuth } from '../context/AuthContext';
import { isConfigured, INITIAL_SHOPPING_SEED, supabase } from '../lib/supabaseClient';
import { offlineStorage } from '../lib/offlineStorage';
import { normalizeString, singularizeIngredient } from '../lib/normalizer';
import confetti from 'canvas-confetti';

export function useShoppingList() {
  const { household } = useHousehold();
  const { user, isDemoMode } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial y almacenamiento offline
  useEffect(() => {
    if (!household) {
      setItems([]);
      setLoading(false);
      return;
    }

    // 1. Cargar desde offlineStorage de inmediato (optimistic / offline)
    const localItems = offlineStorage.getShoppingItems();
    if (localItems.length > 0) {
      setItems(localItems.filter((i) => i.household_id === household.id));
    } else if (isDemoMode) {
      setItems(INITIAL_SHOPPING_SEED);
      offlineStorage.saveShoppingItems(INITIAL_SHOPPING_SEED);
    }

    if (isDemoMode || !isConfigured) {
      setLoading(false);
      return;
    }

    // 2. Cargar desde Supabase
    const fetchItems = async () => {
      try {
        const { data, error } = await supabase
          .from('shopping_items')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setItems(data as ShoppingItem[]);
          offlineStorage.saveShoppingItems(data as ShoppingItem[]);
        }
      } catch (err) {
        console.warn('Error cargando shopping items desde Supabase (usando offline):', err);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();

    // 3. Suscripción a Realtime
    const channel = supabase
      .channel(`shopping:${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${household.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as ShoppingItem;
            setItems((prev) => {
              if (prev.some((x) => x.id === newItem.id)) return prev;
              const next = [newItem, ...prev];
              offlineStorage.saveShoppingItems(next);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as ShoppingItem;
            setItems((prev) => {
              const next = prev.map((x) => (x.id === updatedItem.id ? updatedItem : x));
              offlineStorage.saveShoppingItems(next);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id;
            setItems((prev) => {
              const next = prev.filter((x) => x.id !== deletedId);
              offlineStorage.saveShoppingItems(next);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household?.id, isDemoMode]);

  // Agregar nuevo ítem o sumar a existente
  const addItem = useCallback(
    async (
      name: string,
      quantity: number = 1,
      unit: Unit = 'unidad',
      category: Category = 'otros',
      estimatedPrice?: number
    ): Promise<ShoppingItem> => {
      if (!household) throw new Error('No hay hogar activo seleccionado');

      const norm = singularizeIngredient(name);
      const existing = items.find((i) => !i.is_bought && i.normalized_name === norm && i.unit === unit);

      let finalItem: ShoppingItem;

      if (existing) {
        // Sumar cantidad si ya existe
        const updatedQty = Math.round((existing.quantity + quantity) * 100) / 100;
        finalItem = {
          ...existing,
          quantity: updatedQty,
          updated_at: new Date().toISOString(),
        };

        setItems((prev) => {
          const next = prev.map((it) => (it.id === existing.id ? finalItem : it));
          offlineStorage.saveShoppingItems(next);
          return next;
        });

        if (!isDemoMode && isConfigured) {
          await supabase
            .from('shopping_items')
            .update({ quantity: updatedQty, updated_at: finalItem.updated_at })
            .eq('id', existing.id);
        } else {
          offlineStorage.enqueueMutation({
            table: 'shopping_items',
            action: 'update',
            payload: { id: existing.id, quantity: updatedQty },
          });
        }
      } else {
        // Crear nuevo
        finalItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          household_id: household.id,
          name: name.trim(),
          normalized_name: norm,
          quantity,
          unit,
          category,
          is_bought: false,
          estimated_price: estimatedPrice || null,
          created_by: user?.id || null,
          created_by_name: user?.displayName || 'Alguien',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setItems((prev) => {
          const next = [finalItem, ...prev];
          offlineStorage.saveShoppingItems(next);
          return next;
        });

        if (!isDemoMode && isConfigured) {
          const { data, error } = await supabase.from('shopping_items').insert(finalItem).select().single();
          if (!error && data) {
            finalItem = data as ShoppingItem;
          }
        } else {
          offlineStorage.enqueueMutation({
            table: 'shopping_items',
            action: 'insert',
            payload: finalItem,
          });
        }
      }

      return finalItem;
    },
    [household, items, user, isDemoMode]
  );

  // Marcar como comprado / restaurar
  const toggleBought = useCallback(
    async (id: string): Promise<boolean> => {
      const target = items.find((i) => i.id === id);
      if (!target) return false;

      const nextBoughtState = !target.is_bought;
      const updated: ShoppingItem = {
        ...target,
        is_bought: nextBoughtState,
        bought_at: nextBoughtState ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      setItems((prev) => {
        const next = prev.map((it) => (it.id === id ? updated : it));
        offlineStorage.saveShoppingItems(next);

        // Si todos los ítems pendientes fueron comprados, tirar confeti
        const pendingLeft = next.filter((i) => !i.is_bought).length;
        if (nextBoughtState && pendingLeft === 0) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 },
          });
        }

        return next;
      });

      if (!isDemoMode && isConfigured) {
        await supabase
          .from('shopping_items')
          .update({
            is_bought: updated.is_bought,
            bought_at: updated.bought_at,
            updated_at: updated.updated_at,
          })
          .eq('id', id);
      } else {
        offlineStorage.enqueueMutation({
          table: 'shopping_items',
          action: 'update',
          payload: { id, is_bought: updated.is_bought, bought_at: updated.bought_at },
        });
      }

      return nextBoughtState;
    },
    [items, isDemoMode]
  );

  // Editar ítem
  const updateItem = useCallback(
    async (id: string, updates: Partial<ShoppingItem>): Promise<void> => {
      setItems((prev) => {
        const next = prev.map((it) =>
          it.id === id ? { ...it, ...updates, updated_at: new Date().toISOString() } : it
        );
        offlineStorage.saveShoppingItems(next);
        return next;
      });

      if (!isDemoMode && isConfigured) {
        await supabase.from('shopping_items').update(updates).eq('id', id);
      } else {
        offlineStorage.enqueueMutation({
          table: 'shopping_items',
          action: 'update',
          payload: { id, ...updates },
        });
      }
    },
    [isDemoMode]
  );

  // Eliminar ítem
  const deleteItem = useCallback(
    async (id: string): Promise<void> => {
      setItems((prev) => {
        const next = prev.filter((it) => it.id !== id);
        offlineStorage.saveShoppingItems(next);
        return next;
      });

      if (!isDemoMode && isConfigured) {
        await supabase.from('shopping_items').delete().eq('id', id);
      } else {
        offlineStorage.enqueueMutation({
          table: 'shopping_items',
          action: 'delete',
          payload: { id },
        });
      }
    },
    [isDemoMode]
  );

  // Limpiar todos los comprados
  const clearBoughtItems = useCallback(async (): Promise<void> => {
    const boughtIds = items.filter((i) => i.is_bought).map((i) => i.id);
    setItems((prev) => {
      const next = prev.filter((it) => !it.is_bought);
      offlineStorage.saveShoppingItems(next);
      return next;
    });

    if (!isDemoMode && isConfigured && boughtIds.length > 0) {
      await supabase.from('shopping_items').delete().in('id', boughtIds);
    } else {
      boughtIds.forEach((id) => {
        offlineStorage.enqueueMutation({
          table: 'shopping_items',
          action: 'delete',
          payload: { id },
        });
      });
    }
  }, [items, isDemoMode]);

  const pendingItems = items.filter((i) => !i.is_bought);
  const boughtItems = items.filter((i) => i.is_bought);

  return {
    items,
    pendingItems,
    boughtItems,
    loading,
    addItem,
    toggleBought,
    updateItem,
    deleteItem,
    clearBoughtItems,
  };
}
