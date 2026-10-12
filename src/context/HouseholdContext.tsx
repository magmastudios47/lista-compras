import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Household, HouseholdMember } from '../types';
import { useAuth } from './AuthContext';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { STORAGE_KEYS } from '../lib/constants';

export type PlanType = 'free' | 'base' | 'premium';

export interface LicenseInfo {
  plan_id: PlanType;
  status: 'active' | 'expired' | 'canceled';
  activated_at?: string;
}

interface HouseholdContextType {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  remainingQueries: number;
  currentPlan: PlanType;
  isPremium: boolean;
  createHousehold: (name: string, city?: string) => Promise<Household>;
  joinHouseholdByCode: (code: string) => Promise<{ success: boolean; message: string }>;
  getWhatsAppInviteUrl: () => string;
  incrementChefUsage: () => void;
  refreshLicense: () => Promise<void>;
  updateHouseholdSettings: (settings: Partial<Household>) => Promise<Household>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free');
  const [chefUsedThisMonth, setChefUsedThisMonth] = useState(0);

  // Consulta la licencia activa exclusivamente desde la base de datos
  const fetchLicense = useCallback(async (householdId: string) => {
    if (!isConfigured || isDemoMode) {
      setCurrentPlan('free');
      return;
    }

    try {
      const { data: licenseData, error } = await supabase
        .from('licenses')
        .select('plan_id, status')
        .eq('household_id', householdId)
        .eq('status', 'active')
        .maybeSingle();

      if (!error && licenseData) {
        setCurrentPlan(licenseData.plan_id as PlanType);
      } else {
        setCurrentPlan('free');
      }
    } catch (err) {
      console.warn('Error consultando licencia:', err);
      setCurrentPlan('free');
    }
  }, [isDemoMode]);

  // Carga de hogar
  useEffect(() => {
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      const savedHh = localStorage.getItem(STORAGE_KEYS.CURRENT_HOUSEHOLD);
      if (savedHh) {
        try {
          const parsed = JSON.parse(savedHh);
          if (parsed && parsed.id) {
            setHousehold(parsed);
            setChefUsedThisMonth(parsed.chef_queries_used_month || 0);
            setMembers([
              {
                id: `m_${parsed.id}`,
                household_id: parsed.id,
                user_id: user.id,
                role: 'admin',
                display_name: user.displayName || 'Administrador',
                joined_at: parsed.created_at || new Date().toISOString(),
              },
            ]);
            setCurrentPlan('free');
            setLoading(false);
            return;
          }
        } catch {}
      }

      setHousehold(null);
      setMembers([]);
      setLoading(false);
      return;
    }

    // Modo Producción con Supabase
    const fetchHousehold = async () => {
      setLoading(true);
      try {
        const { data: memberRows, error: memberErr } = await supabase
          .from('household_members')
          .select('household_id, role, display_name, joined_at, households(*)')
          .eq('user_id', user.id)
          .limit(1);

        if (!memberErr && memberRows && memberRows.length > 0) {
          const current = (memberRows[0] as any).households as Household;
          setHousehold(current);
          setChefUsedThisMonth(current.chef_queries_used_month || 0);
          localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(current));

          // Cargar miembros
          const { data: allMembers } = await supabase
            .from('household_members')
            .select('*')
            .eq('household_id', current.id);
          if (allMembers) setMembers(allMembers as HouseholdMember[]);

          await fetchLicense(current.id);
        } else {
          setHousehold(null);
          setMembers([]);
        }
      } catch (e) {
        console.warn('Error cargando hogar desde Supabase:', e);
        setHousehold(null);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHousehold();
  }, [user, isDemoMode, fetchLicense]);

  // Suscripción Realtime a cambios en la tabla licenses para actualizar el plan instantáneamente al confirmarse el webhook
  useEffect(() => {
    if (!household?.id || isDemoMode || !isConfigured) return;

    const channel = supabase
      .channel(`license_updates_${household.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'licenses',
          filter: `household_id=eq.${household.id}`,
        },
        async () => {
          await fetchLicense(household.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [household?.id, isDemoMode, fetchLicense]);

  // Suscripción Realtime a households
  useEffect(() => {
    if (!household?.id || isDemoMode || !isConfigured) return;

    const hhChannel = supabase
      .channel(`household_changes_${household.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'households',
          filter: `id=eq.${household.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setHousehold((prev) => {
              if (!prev) return payload.new as Household;
              const merged = { ...prev, ...payload.new };
              localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(merged));
              return merged;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(hhChannel);
    };
  }, [household?.id, isDemoMode]);

  // Verificar código de invitación en la URL (?join=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && user && !household) {
      joinHouseholdByCode(joinCode).then((res) => {
        if (res.success) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  }, [user, household]);

  const createHousehold = async (name: string, city: string = ''): Promise<Household> => {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('El nombre del hogar es obligatorio');

    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (isDemoMode || !isConfigured) {
      const newHh: Household = {
        id: `hh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        invite_code: newCode,
        currency: 'ARS',
        monthly_chef_limit: 5,
        chef_queries_used_month: 0,
        pantry_add_mode: 'ask',
        pantry_exclude_cleaning: true,
        created_at: new Date().toISOString(),
      };
      setHousehold(newHh);
      setCurrentPlan('free');
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(newHh));
      if (user) {
        setMembers([
          {
            id: `m_${Date.now()}`,
            household_id: newHh.id,
            user_id: user.id,
            role: 'admin',
            display_name: user.displayName || 'Administrador',
            joined_at: newHh.created_at,
          },
        ]);
      }
      return newHh;
    }

    try {
      const { data, error } = await supabase
        .from('households')
        .insert({
          name: cleanName,
          invite_code: newCode,
          created_by: user?.id,
        })
        .select()
        .single();

      if (!error && data) {
        if (user?.id) {
          await supabase.from('household_members').insert({
            household_id: data.id,
            user_id: user.id,
            role: 'admin',
            display_name: user.displayName || 'Administrador',
          });
        }

        if (city.trim()) {
          try {
            await supabase.from('household_settings').upsert({
              household_id: data.id,
              city: city.trim(),
            });
          } catch {}
        }

        setHousehold(data);
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(data));
        await fetchLicense(data.id);
        return data;
      }
      throw error || new Error('No se pudo crear el hogar');
    } catch (err: any) {
      throw new Error(err.message || 'Error al crear el hogar');
    }
  };

  const joinHouseholdByCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Ingresá un código de invitación válido' };

    if (isDemoMode || !isConfigured) {
      const joinedHh: Household = {
        id: `hh_joined_${cleanCode}`,
        name: `Hogar ${cleanCode}`,
        invite_code: cleanCode,
        currency: 'ARS',
        monthly_chef_limit: 5,
        chef_queries_used_month: 0,
        pantry_add_mode: 'ask',
        pantry_exclude_cleaning: true,
        created_at: new Date().toISOString(),
      };
      setHousehold(joinedHh);
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(joinedHh));
      if (user) {
        setMembers([
          {
            id: `m_${Date.now()}`,
            household_id: joinedHh.id,
            user_id: user.id,
            role: 'member',
            display_name: user.displayName || 'Miembro',
            joined_at: new Date().toISOString(),
          },
        ]);
      }
      return { success: true, message: `¡Te uniste a ${joinedHh.name} con éxito!` };
    }

    try {
      const { data: targetHh, error: findErr } = await supabase
        .from('households')
        .select('*')
        .ilike('invite_code', cleanCode)
        .maybeSingle();

      if (!findErr && targetHh) {
        if (user?.id) {
          try {
            await supabase
              .from('household_members')
              .upsert({
                household_id: targetHh.id,
                user_id: user.id,
                role: 'member',
                display_name: user.displayName || 'Miembro',
              });
          } catch {}
        }

        setHousehold(targetHh);
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(targetHh));
        await fetchLicense(targetHh.id);
        return { success: true, message: `¡Te uniste a ${targetHh.name} con éxito!` };
      }
    } catch (e: any) {
      console.warn('Error buscando hogar en Supabase:', e);
    }

    return { success: false, message: 'Código de invitación no encontrado o inválido' };
  };

  const getWhatsAppInviteUrl = (): string => {
    if (!household) return '';
    const origin = window.location.origin;
    const inviteLink = `${origin}?join=${household.invite_code}`;
    const message = `¡Hola! Sumate a nuestra lista de compras compartida en *Lista Compars* para el hogar "${household.name}". Tocá acá para entrar directo:\n${inviteLink}\n(Código: ${household.invite_code})`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const incrementChefUsage = useCallback(() => {
    setChefUsedThisMonth((prev) => {
      const next = prev + 1;
      if (household) {
        const updated = { ...household, chef_queries_used_month: next };
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(updated));
      }
      return next;
    });
  }, [household]);

  const refreshLicense = useCallback(async () => {
    if (household) {
      await fetchLicense(household.id);
    }
  }, [household, fetchLicense]);

  const planLimits: Record<PlanType, number> = {
    free: 5,
    base: 40,
    premium: 150,
  };

  const effectiveLimit = planLimits[currentPlan] || 5;
  const remainingQueries = Math.max(0, effectiveLimit - chefUsedThisMonth);
  const isPremium = currentPlan === 'premium';

  const updateHouseholdSettings = useCallback(
    async (settings: Partial<Household>): Promise<Household> => {
      if (!household) throw new Error('No hay hogar activo para actualizar');
      const updated: Household = {
        ...household,
        ...settings,
        updated_at: new Date().toISOString(),
      };

      setHousehold(updated);
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(updated));

      if (!isDemoMode && isConfigured) {
        try {
          const updatePayload: Record<string, any> = {
            updated_at: updated.updated_at,
          };
          if (settings.pantry_add_mode !== undefined) {
            updatePayload.pantry_add_mode = settings.pantry_add_mode;
          }
          if (settings.pantry_exclude_cleaning !== undefined) {
            updatePayload.pantry_exclude_cleaning = settings.pantry_exclude_cleaning;
          }
          if (settings.name !== undefined) {
            updatePayload.name = settings.name;
          }

          await supabase
            .from('households')
            .update(updatePayload)
            .eq('id', household.id);
        } catch (err) {
          console.warn('Error sincronizando ajustes del hogar en Supabase:', err);
        }
      }

      return updated;
    },
    [household, isDemoMode]
  );

  return (
    <HouseholdContext.Provider
      value={{
        household,
        members,
        loading,
        remainingQueries,
        currentPlan,
        isPremium,
        createHousehold,
        joinHouseholdByCode,
        getWhatsAppInviteUrl,
        incrementChefUsage,
        refreshLicense,
        updateHouseholdSettings,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (!context) throw new Error('useHousehold debe usarse dentro de un HouseholdProvider');
  return context;
};
