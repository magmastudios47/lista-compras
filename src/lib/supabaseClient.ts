import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificamos si las credenciales son reales y válidas
export const isConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('tu-proyecto') &&
  supabaseUrl.startsWith('http')
);

// Cliente oficial de Supabase
export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : (createClient('https://mock.supabase.co', 'mock-anon-key', {
      auth: { persistSession: false },
    }) as any);

// En Ronda 5: Arranque desde cero sin datos ni usuarios predeterminados
export const MOCK_USER = {
  id: '',
  email: '',
  user_metadata: {
    full_name: '',
  },
};

export const MOCK_HOUSEHOLD = {
  id: '',
  name: '',
  invite_code: '',
  currency: 'ARS',
  monthly_chef_limit: 40,
  chef_queries_used_month: 0,
  pantry_add_mode: 'ask' as const,
  pantry_exclude_cleaning: true,
  created_at: new Date().toISOString(),
};

export const INITIAL_PANTRY_SEED: any[] = [];
export const INITIAL_SHOPPING_SEED: any[] = [];

