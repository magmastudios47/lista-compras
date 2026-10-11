import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Household, HouseholdMember } from '../types';
import { useAuth } from './AuthContext';
import { isConfigured, MOCK_HOUSEHOLD, MOCK_USER, supabase } from '../lib/supabaseClient';
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
  createHousehold: (name: string) => Promise<Household>;
  joinHouseholdByCode: (code: string) => Promise<{ success: boolean; message: string }>;
  getWhatsAppInviteUrl: () => string;
  incrementChefUsage: () => void;
  refreshLicense: () => Promise<void>;
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
      // En modo sin configurar, el plan es estrictamente 'free'
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

  // Carga inicial de hogar
  useEffect(() => {
    const activeUser = user || { id: MOCK_USER.id, email: '', displayName: 'Miembro de la Familia' };

    if (isDemoMode) {
      const savedHh = localStorage.getItem(STORAGE_KEYS.CURRENT_HOUSEHOLD);
      if (savedHh) {
        try {
          const parsed = JSON.parse(savedHh);
          setHousehold(parsed);
          setChefUsedThisMonth(parsed.chef_queries_used_month || 0);
        } catch {
          setHousehold(MOCK_HOUSEHOLD);
          setChefUsedThisMonth(MOCK_HOUSEHOLD.chef_queries_used_month);
        }
      } else {
        setHousehold(MOCK_HOUSEHOLD);
        setChefUsedThisMonth(MOCK_HOUSEHOLD.chef_queries_used_month);
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(MOCK_HOUSEHOLD));
      }

      setMembers([
        {
          id: 'm1',
          household_id: MOCK_HOUSEHOLD.id,
          user_id: activeUser.id,
          role: 'admin',
          display_name: activeUser.displayName || 'Facundo',
          joined_at: new Date().toISOString(),
        },
        {
          id: 'm2',
          household_id: MOCK_HOUSEHOLD.id,
          user_id: 'usr_patagonia_02',
          role: 'member',
          display_name: 'Lucía',
          joined_at: new Date().toISOString(),
        },
      ]);
      setCurrentPlan('free');
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
          .eq('user_id', activeUser.id)
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

          // Cargar licencia desde el servidor
          await fetchLicense(current.id);
        } else {
          // Si no tiene hogar aún en Supabase, auto-crear uno o usar el guardado local
          const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          const savedHh = localStorage.getItem(STORAGE_KEYS.CURRENT_HOUSEHOLD);
          let candidateHh: Household = {
            id: `hh_${activeUser.id}`,
            name: `Hogar de ${activeUser.displayName || 'la Familia'}`,
            invite_code: newCode,
            currency: 'ARS',
            monthly_chef_limit: 40,
            chef_queries_used_month: 0,
            created_at: new Date().toISOString(),
          };
          if (savedHh) {
            try {
              const parsed = JSON.parse(savedHh);
              if (parsed && parsed.id) candidateHh = parsed;
            } catch {}
          }

          // Intentar guardar en Supabase si auth.uid() está activo
          try {
            const { data: newHh, error: createErr } = await supabase
              .from('households')
              .insert({
                name: candidateHh.name,
                invite_code: candidateHh.invite_code,
              })
              .select()
              .single();

            if (!createErr && newHh) {
              candidateHh = newHh;
              await fetchLicense(newHh.id);
            }
          } catch (insertErr) {
            console.warn('Usando hogar local offline:', insertErr);
          }

          setHousehold(candidateHh);
          setChefUsedThisMonth(candidateHh.chef_queries_used_month || 0);
          localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(candidateHh));
        }
      } catch (e) {
        console.warn('Error cargando hogar desde Supabase, asegurando hogar local:', e);
        const savedHh = localStorage.getItem(STORAGE_KEYS.CURRENT_HOUSEHOLD);
        if (savedHh) {
          try {
            setHousehold(JSON.parse(savedHh));
          } catch {
            setHousehold(MOCK_HOUSEHOLD);
          }
        } else {
          setHousehold(MOCK_HOUSEHOLD);
          localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(MOCK_HOUSEHOLD));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchHousehold();
  }, [user, isDemoMode, fetchLicense]);

  // Suscripción Realtime a cambios en la tabla licenses para actualizar el plan instantáneamente al confirmarse el webhook
  useEffect(() => {
    if (!household || !isConfigured || isDemoMode) return;

    const licenseChannel = supabase
      .channel(`license_changes_${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'licenses', filter: `household_id=eq.${household.id}` },
        (payload) => {
          if (payload.new && (payload.new as any).status === 'active') {
            const updatedPlan = (payload.new as any).plan_id as PlanType;
            setCurrentPlan(updatedPlan);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(licenseChannel);
    };
  }, [household?.id, isDemoMode]);

  // Verificar código de invitación en la URL (?join=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && user) {
      joinHouseholdByCode(joinCode).then((res) => {
        if (res.success) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }
  }, [user]);

  const createHousehold = async (name: string): Promise<Household> => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (isDemoMode || !isConfigured) {
      const newHh: Household = {
        id: `hh_${Date.now()}`,
        name,
        invite_code: newCode,
        currency: 'ARS',
        monthly_chef_limit: 5, // Plan free: 5 consultas por mes
        chef_queries_used_month: 0,
        created_at: new Date().toISOString(),
      };
      setHousehold(newHh);
      setCurrentPlan('free');
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(newHh));
      return newHh;
    }

    try {
      const { data, error } = await supabase
        .from('households')
        .insert({
          name,
          invite_code: newCode,
          created_by: user?.id,
        })
        .select()
        .single();

      if (!error && data) {
        setHousehold(data);
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(data));
        await fetchLicense(data.id);
        return data;
      }
    } catch (err) {
      console.warn('Error creando hogar en Supabase, guardando local:', err);
    }

    const fallbackHh: Household = {
      id: `hh_${Date.now()}`,
      name,
      invite_code: newCode,
      currency: 'ARS',
      monthly_chef_limit: 40,
      chef_queries_used_month: 0,
      created_at: new Date().toISOString(),
    };
    setHousehold(fallbackHh);
    localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(fallbackHh));
    return fallbackHh;
  };

  const joinHouseholdByCode = async (code: string): Promise<{ success: boolean; message: string }> => {
    const cleanCode = code.trim().toLowerCase();

    if (isDemoMode || !isConfigured) {
      const joinedHh: Household = {
        ...MOCK_HOUSEHOLD,
        name: `Hogar compartido (${cleanCode})`,
        invite_code: cleanCode,
      };
      setHousehold(joinedHh);
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(joinedHh));
      return { success: true, message: `¡Te uniste a ${joinedHh.name} con éxito!` };
    }

    try {
      const { data: targetHh, error: findErr } = await supabase
        .from('households')
        .select('*')
        .ilike('invite_code', cleanCode)
        .maybeSingle();

      if (!findErr && targetHh) {
        try {
          await supabase
            .from('household_members')
            .upsert({
              household_id: targetHh.id,
              user_id: user?.id,
              role: 'member',
              display_name: user?.displayName || 'Miembro',
            });
        } catch {}

        setHousehold(targetHh);
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(targetHh));
        await fetchLicense(targetHh.id);
        return { success: true, message: `¡Te uniste a ${targetHh.name}!` };
      }
    } catch (e: any) {
      console.warn('Error buscando hogar en Supabase:', e);
    }

    // Fallback local si el código es local o fuera de línea
    const joinedLocal: Household = {
      ...MOCK_HOUSEHOLD,
      name: `Hogar compartido (${cleanCode})`,
      invite_code: cleanCode,
    };
    setHousehold(joinedLocal);
    localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(joinedLocal));
    return { success: true, message: `¡Te uniste a ${joinedLocal.name}!` };
  };

  const getWhatsAppInviteUrl = (): string => {
    if (!household) return '';
    const origin = window.location.origin;
    const inviteLink = `${origin}?join=${household.invite_code}`;
    const message = `¡Hola! Sumate a nuestra lista de compras compartida en *Lista Compars* para el hogar "${household.name}". Tocá acá para entrar directo en menos de 30 segundos:\n${inviteLink}\n(Código: ${household.invite_code})`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const incrementChefUsage = () => {
    setChefUsedThisMonth((prev) => {
      const next = prev + 1;
      if (household) {
        const updated = { ...household, chef_queries_used_month: next };
        setHousehold(updated);
        if (isDemoMode) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(updated));
        }
      }
      return next;
    });
  };

  const refreshLicense = async () => {
    if (household) {
      await fetchLicense(household.id);
    }
  };

  // Límites centralizados por plan: Free 5, Base 40, Premium 150
  const planLimits: Record<PlanType, number> = {
    free: 5,
    base: 40,
    premium: 150,
  };

  const effectiveLimit = planLimits[currentPlan] || 5;
  const remainingQueries = Math.max(0, effectiveLimit - chefUsedThisMonth);
  const isPremium = currentPlan === 'premium';

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
