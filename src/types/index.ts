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
  pantry_add_mode?: 'ask' | 'auto' | 'never';
  pantry_exclude_cleaning?: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  display_name: string;
  joined_at: string;
}

export interface PlanDefinition {
  id: string;
  name: string;
  price_usd: number;
  monthly_chef_queries: number;
  max_members: number;
  features: Record<string, any>;
  is_active: boolean;
}

export interface HouseholdInvitation {
  id: string;
  household_id: string;
  token_hash: string;
  expires_at: string;
  max_uses: number;
  times_used: number;
  is_revoked: boolean;
  requires_owner_approval: boolean;
  created_at: string;
  created_by?: string | null;
}

export interface HouseholdLicense {
  id: string;
  household_id: string;
  plan_type: 'free' | 'base' | 'premium' | 'tester';
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
  origen?: 'ia' | 'cache' | 'demo';
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
  pasos?: string[];
  receta?: {
    nombre?: string;
    porciones?: number;
    tiempo_minutos?: number;
    dificultad?: 'facil' | 'media' | 'dificil';
    pasos: string[];
  };
  analisis_plato?: string[];
  ingredientes: ChefIngredient[];
}

export interface ChefSuggestResponse {
  modo: 'sugerir';
  fuera_de_tema: boolean;
  mensaje: string | null;
  aclaracion: string | null;
  origen?: 'ia' | 'cache' | 'demo';
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
  desayuno?: string;
  almuerzo?: string;
  merienda?: string;
  cena?: string;
  personas: number;
}

export type MealType = 'desayuno' | 'almuerzo' | 'merienda' | 'cena';

export interface MenuItemMeal {
  tipo: MealType;
  nombre: string;
  porciones: number;
  tiempo_minutos?: number;
  por_que_encaja?: string;
  bebida?: string | null;
  pasos?: string[];
  analisis_plato?: string[];
  ingredientes: ChefIngredient[];
}

export interface MenuDay {
  dia: string;
  comidas: MenuItemMeal[];
}

export interface ChefMenuResponse {
  modo: 'menu';
  fuera_de_tema: boolean;
  mensaje: string | null;
  aclaracion: string | null;
  origen?: 'ia' | 'cache' | 'demo';
  dias: MenuDay[];
  advertencias: string[];
}

export interface PlanificarSemanaMeal {
  dia: string;
  tipo: MealType;
  plato: string;
  bebida?: string | null;
  por_que_encaja: string;
}

export interface ChefPlanificarSemanaResponse {
  modo: 'planificar_semana';
  fuera_de_tema: boolean;
  mensaje: string | null;
  aclaracion: string | null;
  origen?: 'ia' | 'cache' | 'demo';
  comidas: PlanificarSemanaMeal[];
  advertencias: string[];
}

export interface DayMealDetail {
  tipo: MealType;
  plato: string;
  bebida?: string | null;
  pasos: string[];
  ingredientes: ChefIngredient[];
}

export interface ChefDetalleDiaMenuResponse {
  modo: 'detalle_dia_menu';
  dia: string;
  comidas: DayMealDetail[];
  advertencias: string[];
}


