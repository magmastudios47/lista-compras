// Tipos centrales para Lista Compars

export type Category =
  | 'verduleria'
  | 'carniceria'
  | 'almacen'
  | 'lacteos'
  | 'fiambreria'
  | 'panaderia'
  | 'bebidas'
  | 'congelados'
  | 'limpieza'
  | 'otros';

export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'unidad'
  | 'cucharada'
  | 'cucharadita'
  | 'taza'
  | 'diente'
  | 'atado'
  | 'lata'
  | 'paquete'
  | 'pizca';

export interface ShoppingItem {
  id: string;
  household_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  is_bought: boolean;
  bought_at?: string | null;
  estimated_price?: number | null;
  created_by?: string | null;
  created_by_name?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PantryItem {
  id: string;
  household_id: string;
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: Unit | null;
  category: Category;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  currency: string;
  monthly_chef_limit: number;
  chef_queries_used_month: number;
  chef_quota_reset_at?: string;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'admin' | 'member';
  display_name: string;
  joined_at: string;
}

export interface HouseholdLicense {
  id: string;
  household_id: string;
  plan_type: 'free' | 'lifetime_premium';
  status: 'active' | 'expired' | 'canceled';
  purchased_at?: string | null;
  amount_paid_usd?: number | null;
  amount_paid_ars?: number | null;
  exchange_rate?: number | null;
  mercadopago_payment_id?: string | null;
  max_monthly_chef_queries: number;
}

export interface ChefIngredient {
  nombre: string;
  cantidad: number;
  unidad: Unit;
  categoria: Category;
  es_basico: boolean;
  opcional: boolean;
  item_despensa_coincidente: string | null;
}

export interface ChefCookResponse {
  modo: 'cocinar';
  fuera_de_tema: boolean;
  mensaje: string | null;
  aclaracion: string | null;
  receta?: {
    nombre: string;
    porciones: number;
    tiempo_minutos?: number;
    dificultad: 'facil' | 'media' | 'dificil';
    pasos: string[];
  } | null;
  analisis_plato?: string[];
  ingredientes: ChefIngredient[];
  advertencias: string[];
}

export interface ChefSuggestRecipe {
  nombre: string;
  porciones: number;
  tiempo_minutos?: number;
  dificultad: 'facil' | 'media' | 'dificil';
  por_que_conviene: string;
  analisis_plato?: string[];
  ingredientes: ChefIngredient[];
}

export interface ChefSuggestResponse {
  modo: 'sugerir';
  fuera_de_tema: boolean;
  mensaje: string | null;
  aclaracion: string | null;
  recetas: ChefSuggestRecipe[];
  advertencias: string[];
}

export interface ChefParsedPantryItem {
  nombre: string;
  cantidad: number | null;
  unidad: Unit | null;
  categoria: Category;
}

export interface ChefInterpretPantryResponse {
  modo: 'interpretar_despensa';
  fuera_de_tema: boolean;
  mensaje: string | null;
  items: ChefParsedPantryItem[];
}

export interface ChefParsedItem {
  texto_original: string;
  nombre: string;
  cantidad: number | null;
  unidad: Unit | null;
  categoria: Category;
  corregido: boolean;
  confianza: 'alta' | 'media' | 'baja';
}

export interface ChefInterpretItemsResponse {
  modo: 'interpretar_items';
  fuera_de_tema: boolean;
  mensaje: string | null;
  items: ChefParsedItem[];
}

export interface DiscountComparisonResult {
  ingrediente: ChefIngredient;
  despensa_item: PantryItem | null;
  estado: 'falta_total' | 'falta_parcial' | 'cubierto' | 'basico_presente';
  seleccionadoParaAgregar: boolean;
  cantidad_faltante: number;
  unidad_faltante: Unit;
  detalle: string;
}

export interface WeeklyMealDay {
  dia: string;
  almuerzo?: string;
  cena?: string;
  personas: number;
}
