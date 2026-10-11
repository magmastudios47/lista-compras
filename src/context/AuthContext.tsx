import React, { createContext, useContext, useEffect, useState } from 'react';
import { isConfigured, MOCK_USER, supabase } from '../lib/supabaseClient';
import { STORAGE_KEYS } from '../lib/constants';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !isConfigured;

  useEffect(() => {
    if (isDemoMode) {
      // En modo demo o simulado, restaurar usuario guardado o usar Facundo
      const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          setUser({
            id: MOCK_USER.id,
            email: MOCK_USER.email,
            displayName: MOCK_USER.user_metadata.full_name,
          });
        }
      } else {
        const defaultUser: UserProfile = {
          id: MOCK_USER.id,
          email: MOCK_USER.email,
          displayName: MOCK_USER.user_metadata.full_name,
        };
        setUser(defaultUser);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
      }
      setLoading(false);
      return;
    }

    // Modo producción con Supabase Auth
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
        });
        setLoading(false);
      } else {
        // Intentar iniciar sesión anónima en Supabase para obtener auth.uid()
        let authed = false;
        try {
          const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
          if (!anonErr && anonData?.user) {
            setUser({
              id: anonData.user.id,
              email: '',
              displayName: 'Miembro del Hogar',
            });
            authed = true;
          }
        } catch {}

        if (!authed) {
          // Si anonymous auth está desactivado en Supabase, usar perfil local persistente
          const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch {
              const defaultUser: UserProfile = {
                id: MOCK_USER.id,
                email: MOCK_USER.email,
                displayName: MOCK_USER.user_metadata.full_name,
              };
              setUser(defaultUser);
              localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
            }
          } else {
            const defaultUser: UserProfile = {
              id: MOCK_USER.id,
              email: MOCK_USER.email,
              displayName: MOCK_USER.user_metadata.full_name,
            };
            setUser(defaultUser);
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(defaultUser));
          }
        }
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Usuario',
        });
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isDemoMode]);

  const signInWithGoogle = async () => {
    if (isDemoMode) {
      const demoUser = {
        id: 'usr_google_demo',
        email: 'usuario.google@patagonia.ar',
        displayName: 'Usuario Google (Demo)',
      };
      setUser(demoUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(demoUser));
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
      const demoUser = {
        id: `usr_${Date.now()}`,
        email,
        displayName: email.split('@')[0],
      };
      setUser(demoUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(demoUser));
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

  const signOut = async () => {
    if (isDemoMode) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithMagicLink,
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
