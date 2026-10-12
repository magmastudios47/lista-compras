import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Household, HouseholdMember } from '../types';
import { useAuth } from './AuthContext';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { STORAGE_KEYS, ACCESS_MODE, TRIAL_CREDITS } from '../lib/constants';

export type PlanType = 'free' | 'base' | 'premium' | 'tester';

export interface LicenseInfo {
  plan_id: PlanType;
  status: 'active' | 'expired' | 'canceled';
  activated_at?: string;
}

export interface HouseholdContextType {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  remainingQueries: number;
  creditBalance: number;
  currentPlan: PlanType;
  hasActiveLicense: boolean;
  isOwner: boolean;
  isPremium: boolean;
  createHousehold: (name: string, city?: string) => Promise<Household>;
  joinHouseholdByCode: (code: string) => Promise<{ success: boolean; message: string }>;
  getWhatsAppInviteUrl: () => string;
  createInviteLink: (options?: { maxUses?: number; expiresDays?: number; requiresApproval?: boolean }) => Promise<{ success: boolean; inviteUrl?: string; error?: string }>;
  previewInvite: (rawToken: string) => Promise<{ valid: boolean; householdId?: string; householdName?: string; householdCity?: string; requiresApproval?: boolean; error?: string }>;
  joinByInvite: (rawToken: string) => Promise<{ success: boolean; householdId?: string; householdName?: string; alreadyMember?: boolean; pendingApproval?: boolean; error?: string }>;
  removeMember: (memberUserId: string) => Promise<{ success: boolean; error?: string }>;
  redeemAccessCode: (code: string, householdName?: string, city?: string) => Promise<{ success: boolean; householdId?: string; planId?: PlanType; error?: string }>;
  incrementChefUsage: (amount?: number) => void;
  refreshCredits: () => Promise<void>;
  refreshLicense: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  updateHouseholdSettings: (settings: Partial<Household>) => Promise<Household>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

// Helper para hashing SHA-256 en cliente
async function sha256Hex(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('free');
  const [chefUsedThisMonth, setChefUsedThisMonth] = useState(0);
  const [rawCredits, setRawCredits] = useState<number | null>(null);

  // Consulta el balance de créditos del ledger
  const fetchCredits = useCallback(async (householdId: string) => {
    if (!isConfigured || isDemoMode) return;
    try {
      const { data, error } = await supabase.rpc('get_household_credit_balance', {
        p_household_id: householdId,
      });
      if (!error && typeof data === 'number') {
        setRawCredits(data);
      }
    } catch (err) {
      console.warn('Error consultando credit_ledger:', err);
    }
  }, [isDemoMode]);

  // Consulta la licencia activa exclusivamente desde la base de datos
  const fetchLicense = useCallback(async (householdId: string) => {
    if (!isConfigured || isDemoMode) {
      // En modo demo o sin Supabase configurado, respetar ACCESS_MODE
      setCurrentPlan(ACCESS_MODE === 'open' ? 'base' : 'free');
      return;
    }

    try {
      const { data: licenseData, error } = await supabase
        .from('licenses')
        .select('plan_id, status, valid_until')
        .eq('household_id', householdId)
        .eq('status', 'active')
        .maybeSingle();

      if (!error && licenseData) {
        const isNotExpired = !licenseData.valid_until || new Date(licenseData.valid_until) > new Date();
        if (isNotExpired) {
          setCurrentPlan(licenseData.plan_id as PlanType);
          return;
        }
      }
      setCurrentPlan('free');
    } catch (err) {
      console.warn('Error consultando licencia:', err);
      setCurrentPlan('free');
    }
  }, [isDemoMode]);

  // Consulta integrantes del hogar
  const fetchMembers = useCallback(async (householdId: string) => {
    if (!isConfigured || isDemoMode) return;
    try {
      const { data: allMembers, error } = await supabase
        .from('household_members')
        .select('*')
        .eq('household_id', householdId);
      if (!error && allMembers) {
        setMembers(allMembers as HouseholdMember[]);
      }
    } catch (err) {
      console.warn('Error cargando integrantes:', err);
    }
  }, [isDemoMode]);

  // Carga de hogar del usuario actual
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
                role: 'owner',
                display_name: user.displayName || 'Propietario',
                joined_at: parsed.created_at || new Date().toISOString(),
              },
            ]);
            setCurrentPlan(ACCESS_MODE === 'open' ? 'base' : 'free');
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

          await fetchMembers(current.id);
          await fetchLicense(current.id);
          await fetchCredits(current.id);
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
  }, [user, isDemoMode, fetchLicense, fetchMembers, fetchCredits]);

  // Suscripción Realtime a cambios en credit_ledger
  useEffect(() => {
    if (!household?.id || isDemoMode || !isConfigured) return;

    const creditChannel = supabase
      .channel(`credit_ledger_${household.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'credit_ledger',
          filter: `household_id=eq.${household.id}`,
        },
        async () => {
          await fetchCredits(household.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(creditChannel);
    };
  }, [household?.id, isDemoMode, fetchCredits]);

  // Suscripción Realtime a cambios en la tabla licenses para actualizar el plan instantáneamente al confirmarse el webhook
  useEffect(() => {
    if (!household?.id || isDemoMode || !isConfigured) return;

    const licenseChannel = supabase
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
          await fetchCredits(household.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(licenseChannel);
    };
  }, [household?.id, isDemoMode, fetchLicense, fetchCredits]);

  // Suscripción Realtime a cambios en el hogar
  useEffect(() => {
    if (!household?.id || isDemoMode || !isConfigured) return;

    const hhChannel = supabase
      .channel(`household_updates_${household.id}`)
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
      setCurrentPlan(ACCESS_MODE === 'open' ? 'base' : 'free');
      localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(newHh));
      if (user) {
        setMembers([
          {
            id: `m_${Date.now()}`,
            household_id: newHh.id,
            user_id: user.id,
            role: 'owner',
            display_name: user.displayName || 'Propietario',
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
            role: 'owner',
            display_name: user.displayName || 'Propietario',
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
        await fetchMembers(data.id);
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
        await fetchMembers(targetHh.id);
        await fetchLicense(targetHh.id);
        return { success: true, message: `¡Te uniste a ${targetHh.name} con éxito!` };
      }
    } catch (e: any) {
      console.warn('Error buscando hogar en Supabase:', e);
    }

    return { success: false, message: 'Código de invitación no encontrado o inválido' };
  };

  // Creación de link de invitación criptográfico (solo dueño, 128-bit hash)
  const createInviteLink = async (options?: { maxUses?: number; expiresDays?: number; requiresApproval?: boolean }): Promise<{ success: boolean; inviteUrl?: string; error?: string }> => {
    if (!household) return { success: false, error: 'No hay hogar activo' };

    try {
      // 128 bits de entropía criptográfica (16 bytes = 32 caracteres hex)
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const rawToken = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      const tokenHash = await sha256Hex(rawToken.toLowerCase());

      if (!isConfigured || isDemoMode) {
        const inviteUrl = `${window.location.origin}?invite=${rawToken}`;
        return { success: true, inviteUrl };
      }

      const { data, error } = await supabase.rpc('create_household_invitation', {
        p_household_id: household.id,
        p_token_hash: tokenHash,
        p_expires_days: options?.expiresDays || 7,
        p_max_uses: options?.maxUses || 1,
        p_requires_approval: options?.requiresApproval || false,
      });

      if (error) return { success: false, error: error.message };
      const inviteUrl = `${window.location.origin}?invite=${rawToken}`;
      return { success: true, inviteUrl };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al generar link de invitación' };
    }
  };

  // Previsualización de invitación
  const previewInvite = async (rawToken: string): Promise<{ valid: boolean; householdId?: string; householdName?: string; householdCity?: string; requiresApproval?: boolean; error?: string }> => {
    try {
      const cleanToken = rawToken.trim().toLowerCase();
      const tokenHash = await sha256Hex(cleanToken);

      if (!isConfigured || isDemoMode) {
        return { valid: true, householdName: 'Hogar Compartido', requiresApproval: false };
      }

      const { data, error } = await supabase.rpc('preview_household_invitation', {
        p_token_hash: tokenHash,
      });

      if (error) return { valid: false, error: error.message };
      if (!data || !data.valid) return { valid: false, error: data?.error || 'Invitación no válida' };
      return {
        valid: true,
        householdId: data.household_id,
        householdName: data.household_name,
        householdCity: data.household_city,
        requiresApproval: data.requires_approval,
      };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Error validando invitación' };
    }
  };

  // Confirmar y unirse mediante token de invitación
  const joinByInvite = async (rawToken: string): Promise<{ success: boolean; householdId?: string; householdName?: string; alreadyMember?: boolean; pendingApproval?: boolean; error?: string }> => {
    try {
      const cleanToken = rawToken.trim().toLowerCase();
      const tokenHash = await sha256Hex(cleanToken);

      if (!isConfigured || isDemoMode) {
        return { success: true, householdName: 'Hogar Compartido' };
      }

      const { data, error } = await supabase.rpc('join_household_via_invitation', {
        p_token_hash: tokenHash,
      });

      if (error) return { success: false, error: error.message };
      if (!data || !data.success) return { success: false, error: data?.error || 'No fue posible unirse al hogar' };

      if (data.household_id) {
        const { data: hhData } = await supabase
          .from('households')
          .select('*')
          .eq('id', data.household_id)
          .single();
        if (hhData) {
          setHousehold(hhData);
          localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(hhData));
          await fetchLicense(hhData.id);
          await fetchMembers(hhData.id);
        }
      }

      return {
        success: true,
        householdId: data.household_id,
        householdName: data.household_name,
        alreadyMember: data.already_member,
        pendingApproval: data.pending_approval,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al procesar unión al hogar' };
    }
  };

  // Remover integrante del hogar (solo dueño)
  const removeMember = async (memberUserId: string): Promise<{ success: boolean; error?: string }> => {
    if (!household) return { success: false, error: 'No hay hogar activo' };
    if (!isConfigured || isDemoMode) {
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
      return { success: true };
    }
    try {
      const { data, error } = await supabase.rpc('remove_household_member', {
        p_household_id: household.id,
        p_target_user_id: memberUserId,
      });
      if (error) return { success: false, error: error.message };
      if (data && !data.success) return { success: false, error: data.error };
      await fetchMembers(household.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al remover integrante' };
    }
  };

  // Canjear código de acceso para crear hogar con licencia
  const redeemAccessCode = async (code: string, householdName: string = 'Mi Hogar', city?: string): Promise<{ success: boolean; householdId?: string; planId?: PlanType; error?: string }> => {
    try {
      const cleanCode = code.trim().toUpperCase();
      const codeHash = await sha256Hex(cleanCode);

      if (!isConfigured || isDemoMode) {
        const mockHh: Household = {
          id: `hh_code_${Date.now()}`,
          name: householdName,
          invite_code: 'CODEOK',
          currency: 'ARS',
          monthly_chef_limit: 40,
          chef_queries_used_month: 0,
          created_at: new Date().toISOString(),
        };
        setHousehold(mockHh);
        setCurrentPlan('base');
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(mockHh));
        return { success: true, householdId: mockHh.id, planId: 'base' };
      }

      const { data, error } = await supabase.rpc('redeem_access_code', {
        p_code_hash: codeHash,
        p_household_name: householdName,
        p_city: city || null,
      });

      if (error) return { success: false, error: error.message };
      if (!data || !data.success) return { success: false, error: data?.error || 'Código inválido o ya utilizado' };

      if (data.household_id) {
        const { data: hhData } = await supabase
          .from('households')
          .select('*')
          .eq('id', data.household_id)
          .single();
        if (hhData) {
          setHousehold(hhData);
          localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(hhData));
          await fetchLicense(hhData.id);
          await fetchMembers(hhData.id);
        }
      }

      return { success: true, householdId: data.household_id, planId: data.plan_id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al canjear código' };
    }
  };

  const getWhatsAppInviteUrl = (): string => {
    if (!household) return '';
    const origin = window.location.origin;
    const inviteLink = `${origin}?join=${household.invite_code}`;
    const message = `¡Hola! Sumate a nuestra lista de compras compartida en *Lista Compars* para el hogar "${household.name}". Tocá acá para entrar directo:\n${inviteLink}\n(Código: ${household.invite_code})`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const incrementChefUsage = useCallback((amount: number = 1) => {
    setChefUsedThisMonth((prev) => {
      const next = prev + amount;
      if (household) {
        const updated = { ...household, chef_queries_used_month: next };
        localStorage.setItem(STORAGE_KEYS.CURRENT_HOUSEHOLD, JSON.stringify(updated));
      }
      return next;
    });
    setRawCredits((prev) => (prev !== null ? Math.max(0, prev - amount) : null));
  }, [household]);

  const refreshCredits = useCallback(async () => {
    if (household) {
      await fetchCredits(household.id);
    }
  }, [household, fetchCredits]);

  const refreshLicense = useCallback(async () => {
    if (household) {
      await fetchLicense(household.id);
      await fetchCredits(household.id);
    }
  }, [household, fetchLicense, fetchCredits]);

  const refreshMembers = useCallback(async () => {
    if (household) {
      await fetchMembers(household.id);
    }
  }, [household, fetchMembers]);

  const planLimits: Record<PlanType, number> = {
    free: TRIAL_CREDITS > 0 ? TRIAL_CREDITS : 0,
    base: 40,
    premium: 150,
    tester: 9999,
  };

  const effectiveLimit = planLimits[currentPlan] ?? 0;
  const fallbackRemaining = Math.max(0, effectiveLimit - chefUsedThisMonth);
  const creditBalance = rawCredits !== null ? rawCredits : fallbackRemaining;
  const remainingQueries = creditBalance;
  const isPremium = currentPlan === 'premium' || currentPlan === 'tester';
  const hasActiveLicense = ACCESS_MODE === 'open' || ['base', 'premium', 'tester'].includes(currentPlan);
  const isOwner = Boolean(
    (user?.id && members.some((m) => m.user_id === user.id && m.role === 'owner')) ||
    (user?.id && household?.created_by === user.id) ||
    (isDemoMode && Boolean(household))
  );

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
        creditBalance,
        currentPlan,
        hasActiveLicense,
        isOwner,
        isPremium,
        createHousehold,
        joinHouseholdByCode,
        getWhatsAppInviteUrl,
        createInviteLink,
        previewInvite,
        joinByInvite,
        removeMember,
        redeemAccessCode,
        incrementChefUsage,
        refreshCredits,
        refreshLicense,
        refreshMembers,
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
