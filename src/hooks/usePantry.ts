import { useEffect, useState, useCallback } from 'react';
import { Category, PantryItem, Unit } from '../types';
import { useHousehold } from '../context/HouseholdContext';
import { isConfigured, INITIAL_PANTRY_SEED, supabase } from '../lib/supabaseClient';
import { offlineStorage } from '../lib/offlineStorage';
import { singularizeIngredient } from '../lib/normalizer';

export function usePantry() {
  const { household } = useHousehold();
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!household) {
      setPantryItems([]);
      setLoading(false);
      return;
    }

    // 1. Cargar desde offlineStorage de inmediato
    const cached = offlineStorage.getPantryItems();
    if (cached.length > 0) {
      setPantryItems(cached.filter((p) => p.household_id === household.id));
    } else if (!isConfigured) {
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
          .eq('household_id', household.id)
          .order('name', { ascending: true });

        if (!error && data) {
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
      .channel(`pantry:${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pantry_items', filter: `household_id=eq.${household.id}` },
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
      if (!household) throw new Error('No hay hogar activo');

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
          await supabase.from('pantry_items').update(itemResult).eq('id', existing.id);
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
          household_id: household.id,
          name: name.trim().toLowerCase(),
          normalized_name: norm,
          quantity,
          unit,
          category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setPantryItems((prev) => {
          const next = [...prev, itemResult];
          offlineStorage.savePantryItems(next);
          return next;
        });

        if (isConfigured) {
          const { data } = await supabase.from('pantry_items').insert(itemResult).select().single();
          if (data) itemResult = data as PantryItem;
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

  return {
    pantryItems,
    loading,
    addPantryItem,
    addMultiplePantryItems,
    updatePantryItem,
    deletePantryItem,
  };
}
