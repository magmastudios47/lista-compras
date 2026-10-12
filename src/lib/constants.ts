import { Category, Unit } from '../types';

export const CATEGORIES: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'verduleria', label: 'Verdulería', icon: 'Carrot', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'carniceria', label: 'Carnicería', icon: 'Beef', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' },
  { id: 'almacen', label: 'Almacén', icon: 'Package', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'lacteos', label: 'Lácteos', icon: 'Milk', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  { id: 'fiambreria', label: 'Fiambrería', icon: 'Sandwich', color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  { id: 'panaderia', label: 'Panadería', icon: 'Croissant', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300' },
  { id: 'bebidas', label: 'Bebidas', icon: 'Wine', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' },
  { id: 'congelados', label: 'Congelados', icon: 'Snowflake', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300' },
  { id: 'limpieza', label: 'Limpieza', icon: 'Sparkles', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  { id: 'otros', label: 'Otros', icon: 'Tag', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
];

export const UNITS: { id: Unit; label: string }[] = [
  { id: 'unidad', label: 'unidad(es)' },
  { id: 'kg', label: 'kg' },
  { id: 'g', label: 'g' },
  { id: 'l', label: 'litro(s)' },
  { id: 'ml', label: 'ml' },
  { id: 'paquete', label: 'paquete(s)' },
  { id: 'lata', label: 'lata(s)' },
  { id: 'atado', label: 'atado(s)' },
  { id: 'diente', label: 'diente(s)' },
  { id: 'taza', label: 'taza(s)' },
  { id: 'cucharada', label: 'cda(s)' },
  { id: 'cucharadita', label: 'cdita(s)' },
  { id: 'pizca', label: 'pizca' },
];

export const STORAGE_KEYS = {
  CURRENT_USER: 'compars_user',
  CURRENT_HOUSEHOLD: 'compars_household',
  LOCAL_ITEMS: 'compars_shopping_items',
  LOCAL_PANTRY: 'compars_pantry_items',
  MUTATION_QUEUE: 'compars_mutation_queue',
  THEME: 'compars_theme',
  ONBOARDING_SEEN: 'compars_onboarding_seen',
  USAGE_QUOTA: 'compars_usage_quota',
  WEEKLY_MENU: 'compars_weekly_menu',
  PANTRY_ORIGINS: 'compars_pantry_origins',
  USER_PREFERENCES: 'compars_user_preferences',
  HOUSEHOLD_SETTINGS: 'compars_household_settings',
};

export const MAX_CHEF_MONTHLY_FREE = 40;
export const MAX_CHEF_RATE_PER_MIN = 5;
export const USD_LIFETIME_PRICE = 4.99;
export const ARS_EXCHANGE_RATE = 1350;

// Variables de control de acceso y licencias (Ronda 5)
export const ACCESS_MODE: 'closed' | 'open' = (import.meta.env.VITE_ACCESS_MODE || 'closed') as 'closed' | 'open';
export const TRIAL_CREDITS = parseInt(import.meta.env.VITE_TRIAL_CREDITS || '0', 10);

