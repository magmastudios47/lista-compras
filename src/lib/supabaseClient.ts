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

// Datos iniciales de demostración para Junín de los Andes / Patagonia
export const MOCK_USER = {
  id: 'usr_patagonia_01',
  email: 'facundo@patagonia.ar',
  user_metadata: {
    full_name: 'Facundo (Junín de los Andes)',
  },
};

export const MOCK_HOUSEHOLD = {
  id: 'hh_pehuenes_01',
  name: 'Cabaña Los Pehuenes',
  invite_code: 'pehuen26',
  currency: 'ARS',
  monthly_chef_limit: 40,
  chef_queries_used_month: 3,
  created_at: new Date().toISOString(),
};

export const INITIAL_PANTRY_SEED = [
  {
    id: 'p1',
    household_id: 'hh_pehuenes_01',
    name: 'arroz largo fino',
    normalized_name: 'arroz',
    quantity: 1,
    unit: 'kg' as const,
    category: 'almacen' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'p2',
    household_id: 'hh_pehuenes_01',
    name: 'cebollas',
    normalized_name: 'cebolla',
    quantity: 4,
    unit: 'unidad' as const,
    category: 'verduleria' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'p3',
    household_id: 'hh_pehuenes_01',
    name: 'huevos de campo',
    normalized_name: 'huevo',
    quantity: 6,
    unit: 'unidad' as const,
    category: 'almacen' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'p4',
    household_id: 'hh_pehuenes_01',
    name: 'aceite de girasol',
    normalized_name: 'aceite de girasol',
    quantity: null,
    unit: null,
    category: 'almacen' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'p5',
    household_id: 'hh_pehuenes_01',
    name: 'sal gruesa y fina',
    normalized_name: 'sal',
    quantity: null,
    unit: null,
    category: 'almacen' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const INITIAL_SHOPPING_SEED = [
  {
    id: 's1',
    household_id: 'hh_pehuenes_01',
    name: 'Tomates perita',
    normalized_name: 'tomate',
    quantity: 1,
    unit: 'kg' as const,
    category: 'verduleria' as const,
    is_bought: false,
    created_by_name: 'Facundo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's2',
    household_id: 'hh_pehuenes_01',
    name: 'Nalga para milanesas',
    normalized_name: 'nalga para milanesas',
    quantity: 1,
    unit: 'kg' as const,
    category: 'carniceria' as const,
    is_bought: false,
    created_by_name: 'Facundo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 's3',
    household_id: 'hh_pehuenes_01',
    name: 'Yerba mate suave',
    normalized_name: 'yerba',
    quantity: 1,
    unit: 'kg' as const,
    category: 'almacen' as const,
    is_bought: true,
    bought_at: new Date().toISOString(),
    created_by_name: 'Lucía',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
