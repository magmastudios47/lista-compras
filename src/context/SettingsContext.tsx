import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { MealType } from '../types';
import { STORAGE_KEYS } from '../lib/constants';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { useHousehold } from './HouseholdContext';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  targetProfile: string;
  profileDetail: string;
  uiPreferences?: Record<string, any>;
}

export interface HouseholdSettings {
  pantryAddMode: 'ask' | 'auto' | 'never';
  pantryExcludeCleaning: boolean;
  dietaryRestrictions: string[];
  weeklyMenuDaysConfig: Record<string, MealType[]>;
  weeklyMenuPersons: number;
  weeklyMenuMandatoryDishes: string;
  city: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved';

interface SettingsContextType {
  userPreferences: UserPreferences;
  householdSettings: HouseholdSettings;
  saveStatus: SaveStatus;
  updateUserPreferences: (updates: Partial<UserPreferences>) => void;
  updateHouseholdSettings: (updates: Partial<HouseholdSettings>) => void;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  targetProfile: 'Comer más sano',
  profileDetail: '',
  uiPreferences: {},
};

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  pantryAddMode: 'ask',
  pantryExcludeCleaning: true,
  dietaryRestrictions: [],
  weeklyMenuDaysConfig: {
    Lunes: ['almuerzo', 'cena'],
    Martes: ['almuerzo', 'cena'],
    Miércoles: ['almuerzo', 'cena'],
    Jueves: ['almuerzo', 'cena'],
    Viernes: ['almuerzo', 'cena'],
    Sábado: ['almuerzo', 'cena'],
    Domingo: ['almuerzo', 'cena'],
  },
  weeklyMenuPersons: 4,
  weeklyMenuMandatoryDishes: '',
  city: '',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { household } = useHousehold();

  // 1. Estado local inicializado desde caché local para carga instantánea
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      if (cached) return { ...DEFAULT_USER_PREFERENCES, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_USER_PREFERENCES;
  });

  const [householdSettings, setHouseholdSettings] = useState<HouseholdSettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS);
      if (cached) return { ...DEFAULT_HOUSEHOLD_SETTINGS, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_HOUSEHOLD_SETTINGS;
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Referencias para timers de debounce y status
  const userDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const hhDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const statusResetTimer = useRef<NodeJS.Timeout | null>(null);

  // Aplicar tema en el DOM
  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
      let isDark = false;
      if (theme === 'dark') {
        isDark = true;
      } else if (theme === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme(userPreferences.theme);

    if (userPreferences.theme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme('system');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [userPreferences.theme]);

  // 2. Carga remota y sincronización Realtime para user_preferences
  useEffect(() => {
    if (!user || !user.id || !isConfigured) return;

    let isMounted = true;

    const fetchUserPrefs = async () => {
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data && isMounted) {
          const remotePrefs: UserPreferences = {
            theme: data.theme || 'system',
            targetProfile: data.target_profile || 'Comer más sano',
            profileDetail: data.profile_detail || '',
            uiPreferences: data.ui_preferences || {},
          };
          setUserPreferences((prev) => ({ ...prev, ...remotePrefs }));
          localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(remotePrefs));
        }
      } catch (err) {
        console.warn('Error fetching user_preferences:', err);
      }
    };

    fetchUserPrefs();

    // Suscripción Realtime
    const channel = supabase
      .channel(`user_prefs_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new && isMounted) {
            const row = payload.new;
            const updated: UserPreferences = {
              theme: row.theme || 'system',
              targetProfile: row.target_profile || 'Comer más sano',
              profileDetail: row.profile_detail || '',
              uiPreferences: row.ui_preferences || {},
            };
            setUserPreferences(updated);
            localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // 3. Carga remota y sincronización Realtime para household_settings
  useEffect(() => {
    if (!household || !household.id || !isConfigured) return;

    let isMounted = true;

    const fetchHhSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('household_settings')
          .select('*')
          .eq('household_id', household.id)
          .maybeSingle();

        if (!error && data && isMounted) {
          const remoteHh: HouseholdSettings = {
            pantryAddMode: data.pantry_add_mode || 'ask',
            pantryExcludeCleaning: data.pantry_exclude_cleaning ?? true,
            dietaryRestrictions: data.dietary_restrictions || [],
            weeklyMenuDaysConfig: data.weekly_menu_days_config || DEFAULT_HOUSEHOLD_SETTINGS.weeklyMenuDaysConfig,
            weeklyMenuPersons: data.weekly_menu_persons || 4,
            weeklyMenuMandatoryDishes: data.weekly_menu_mandatory_dishes || '',
            city: data.city || '',
          };
          setHouseholdSettings((prev) => ({ ...prev, ...remoteHh }));
          localStorage.setItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS, JSON.stringify(remoteHh));
        }
      } catch (err) {
        console.warn('Error fetching household_settings:', err);
      }
    };

    fetchHhSettings();

    // Suscripción Realtime para sync multidispositivo
    const channel = supabase
      .channel(`hh_settings_${household.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'household_settings', filter: `household_id=eq.${household.id}` },
        (payload: any) => {
          if (payload.new && isMounted) {
            const row = payload.new;
            const updated: HouseholdSettings = {
              pantryAddMode: row.pantry_add_mode || 'ask',
              pantryExcludeCleaning: row.pantry_exclude_cleaning ?? true,
              dietaryRestrictions: row.dietary_restrictions || [],
              weeklyMenuDaysConfig: row.weekly_menu_days_config || DEFAULT_HOUSEHOLD_SETTINGS.weeklyMenuDaysConfig,
              weeklyMenuPersons: row.weekly_menu_persons || 4,
              weeklyMenuMandatoryDishes: row.weekly_menu_mandatory_dishes || '',
              city: row.city || '',
            };
            setHouseholdSettings(updated);
            localStorage.setItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS, JSON.stringify(updated));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [household?.id]);

  const triggerSavedFeedback = useCallback(() => {
    setSaveStatus('saved');
    if (statusResetTimer.current) clearTimeout(statusResetTimer.current);
    statusResetTimer.current = setTimeout(() => {
      setSaveStatus('idle');
    }, 1500);
  }, []);

  // 4. Actualización con Debounce (~500ms) de user_preferences
  const updateUserPreferences = useCallback(
    (updates: Partial<UserPreferences>) => {
      setUserPreferences((prev) => {
        const next = { ...prev, ...updates };
        localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(next));

        setSaveStatus('saving');

        if (userDebounceTimer.current) clearTimeout(userDebounceTimer.current);
        userDebounceTimer.current = setTimeout(async () => {
          if (user?.id && isConfigured) {
            try {
              await supabase.from('user_preferences').upsert({
                user_id: user.id,
                theme: next.theme,
                target_profile: next.targetProfile,
                profile_detail: next.profileDetail,
                ui_preferences: next.uiPreferences || {},
                updated_at: new Date().toISOString(),
              });
            } catch (err) {
              console.warn('Error guardando user_preferences en Supabase:', err);
            }
          }
          triggerSavedFeedback();
        }, 500);

        return next;
      });
    },
    [user?.id, triggerSavedFeedback]
  );

  // 5. Actualización con Debounce (~500ms) de household_settings
  const updateHouseholdSettings = useCallback(
    (updates: Partial<HouseholdSettings>) => {
      setHouseholdSettings((prev) => {
        const next = { ...prev, ...updates };
        localStorage.setItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS, JSON.stringify(next));

        setSaveStatus('saving');

        if (hhDebounceTimer.current) clearTimeout(hhDebounceTimer.current);
        hhDebounceTimer.current = setTimeout(async () => {
          if (household?.id && isConfigured) {
            try {
              await supabase.from('household_settings').upsert({
                household_id: household.id,
                pantry_add_mode: next.pantryAddMode,
                pantry_exclude_cleaning: next.pantryExcludeCleaning,
                dietary_restrictions: next.dietaryRestrictions,
                weekly_menu_days_config: next.weeklyMenuDaysConfig,
                weekly_menu_persons: next.weeklyMenuPersons,
                weekly_menu_mandatory_dishes: next.weeklyMenuMandatoryDishes,
                city: next.city,
                updated_at: new Date().toISOString(),
              });
            } catch (err) {
              console.warn('Error guardando household_settings en Supabase:', err);
            }
          }
          triggerSavedFeedback();
        }, 500);

        return next;
      });
    },
    [household?.id, triggerSavedFeedback]
  );

  return (
    <SettingsContext.Provider
      value={{
        userPreferences,
        householdSettings,
        saveStatus,
        updateUserPreferences,
        updateHouseholdSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings debe usarse dentro de un SettingsProvider');
  return context;
};
