import React, { createContext, useContext, useEffect, useState } from 'react';
import { Household, HouseholdMember } from '../types';
import { useAuth } from './AuthContext';
import { isConfigured, MOCK_HOUSEHOLD, supabase } from '../lib/supabaseClient';
import { MAX_CHEF_MONTHLY_FREE, STORAGE_KEYS } from '../lib/constants';

interface HouseholdContextType {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  remainingQueries: number;
  isPremium: boolean;
  createHousehold: (name: string) => Promise<Household>;
  joinHouseholdByCode: (code: string) => Promise<{ success: boolean; message: string }>;
  getWhatsAppInviteUrl: () => string;
  incrementChefUsage: () => void;
  activatePremium: () => void;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [chefUsedThisMonth, setChefUsedThisMonth] = useState(0);

  // Carga inicial de hogar
  useEffect(() => {
    if (!user) {
      setHousehold(null);
      setLoading(false);
      return;
    }

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
          user_id: user.id,
          role: 'admin',
          display_name: user.displayName || 'Facundo',
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

        if (memberErr) throw memberErr;

        if (memberRows && memberRows.length > 0) {
          const current = (memberRows[0] as any).households as Household;
          setHousehold(current);
          setChefUsedThisMonth(current.chef_queries_used_month || 0);

          // Cargar miembros
          const { data: allMembers } = await supabase
            .from('household_members')
            .select('*')
            .eq('household_id', current.id);
          if (allMembers) setMembers(allMembers as HouseholdMember[]);

          // Cargar licencia
          const { data: licenseData } = await supabase
            .from('household_licenses')
            .select('*')
            .eq('household_id', current.id)
            .maybeSingle();

          if (licenseData?.plan_type === 'lifetime_premium') {
            setIsPremium(true);
          }
        } else {
          // Si no tiene hogar aún, auto-crear uno por defecto
          const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          const { data: newHh, error: createErr } = await supabase
            .from('households')
            .insert({
              name: `Hogar de ${user.displayName || 'la Familia'}`,
              invite_code: newCode,
              created_by: user.id,
            })
            .select()
            .single();

          if (!createErr && newHh) {
            setHousehold(newHh);
            setChefUsedThisMonth(0);
          }
        }
      } catch (e) {
        console.error('Error cargando hogar:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchHousehold();
  }, [user, isDemoMode]);

  // Verificar código de invitación en la URL (?join=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && user) {
      joinHouseholdByCode(joinCode).then((res) => {
        if (res.success) {
          // Limpiar el parámetro de la URL limpiamente sin recargar
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
        monthly_chef_limit: MAX_CHEF_MONTHLY_FREE,
        chef_queries_used_month: 0,
        created_at: new Date().toISOString(),
      };
      setHousehold(newHh);
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(newHh));
      return newHh;
    }

    const { data, error } = await supabase
      .from('households')
      .insert({
        name,
        invite_code: newCode,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) throw error;
    setHousehold(data);
    return data;
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

      if (findErr || !targetHh) {
        return { success: false, message: 'Código de invitación no encontrado.' };
      }

      const { error: joinErr } = await supabase
        .from('household_members')
        .upsert({
          household_id: targetHh.id,
          user_id: user?.id,
          role: 'member',
          display_name: user?.displayName || 'Miembro',
        });

      if (joinErr) throw joinErr;

      setHousehold(targetHh);
      return { success: true, message: `¡Te uniste a ${targetHh.name}!` };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error al unirse al hogar.' };
    }
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

  const activatePremium = () => {
    setIsPremium(true);
    if (household) {
      const updated = { ...household, monthly_chef_limit: 9999 };
      setHousehold(updated);
      if (isDemoMode) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(updated));
      }
    }
  };

  const effectiveLimit = isPremium ? 9999 : (household?.monthly_chef_limit || MAX_CHEF_MONTHLY_FREE);
  const remainingQueries = Math.max(0, effectiveLimit - chefUsedThisMonth);

  return (
    <HouseholdContext.Provider
      value={{
        household,
        members,
        loading,
        remainingQueries,
        isPremium,
        createHousehold,
        joinHouseholdByCode,
        getWhatsAppInviteUrl,
        incrementChefUsage,
        activatePremium,
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
