import React, { createContext, useContext, useEffect, useState } from 'react';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { STORAGE_KEYS } from '../lib/constants';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithLocalName: (displayName: string, email?: string) => Promise<void>;
  setDisplayName: (displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !isConfigured;

  useEffect(() => {
    // 1. Restaurar usuario desde almacenamiento local persistente (si existe sesión previa)
    const savedUserStr = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        if (parsed && parsed.id) {
          setUser(parsed);
          setLoading(false);
          return;
        }
      } catch {}
    }

    if (isDemoMode) {
      // En modo local sin Supabase: arranca en null (sin auto-login)
      setUser(null);
      setLoading(false);
      return;
    }

    // 2. Modo producción con Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.full_name || '',
        };
        setUser(profile);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.full_name || '',
        };
        setUser(profile);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(profile));
      } else {
        setUser(null);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  const signInWithGoogle = async () => {
    if (isDemoMode) {
      const newUser: UserProfile = {
        id: `usr_google_${Date.now()}`,
        email: 'usuario@google.com',
        displayName: 'Usuario Google',
      };
      setUser(newUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string): Promise<{ error: string | null }> => {
    if (isDemoMode) {
      const newUser: UserProfile = {
        id: `usr_${Date.now()}`,
        email: email.trim(),
        displayName: '', // Dejar displayName vacío para que el nuevo usuario elija su nombre
      };
      setUser(newUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    return { error: error ? error.message : null };
  };

  const signInWithLocalName = async (displayName: string, email: string = ''): Promise<void> => {
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error('El nombre para mostrar es obligatorio');

    const newUser: UserProfile = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: email.trim(),
      displayName: trimmed,
    };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(newUser));
  };

  const setDisplayName = async (displayName: string): Promise<void> => {
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error('El nombre para mostrar es obligatorio');

    if (!user) return;

    const updatedUser: UserProfile = {
      ...user,
      displayName: trimmed,
    };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));

    if (!isDemoMode && isConfigured) {
      try {
        await supabase.auth.updateUser({
          data: { full_name: trimmed },
        });
      } catch (err) {
        console.warn('Error actualizando full_name en Supabase:', err);
      }
    }
  };

  const signOut = async () => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_HOUSEHOLD);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.LOCAL_PANTRY);
    localStorage.removeItem(STORAGE_KEYS.WEEKLY_MENU);
    localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
    localStorage.removeItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS);
    setUser(null);

    if (!isDemoMode && isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {}
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithMagicLink,
        signInWithLocalName,
        setDisplayName,
        signOut,
        isDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return context;
};
