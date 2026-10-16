import { z } from 'zod';

export const CategoryValues = [
  'verduleria',
  'carniceria',
  'almacen',
  'lacteos',
  'fiambreria',
  'panaderia',
  'bebidas',
  'congelados',
  'limpieza',
  'otros',
] as const;

export const CategoryEnum = z.enum(CategoryValues);

export const UnitValues = [
  'g',
  'kg',
  'ml',
  'l',
  'unidad',
  'cucharada',
  'cucharadita',
  'taza',
  'diente',
  'atado',
  'lata',
  'paquete',
  'pizca',
] as const;

export const UnitEnum = z.enum(UnitValues);

export function sanitizeCategory(val: unknown): string {
  if (typeof val !== 'string') return 'otros';
  const norm = val.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if ((CategoryValues as readonly string[]).includes(norm)) return norm;
  if (norm.includes('chacinad') || norm.includes('embutid') || norm.includes('pescad') || norm.includes('pollo')) return 'carniceria';
  if (norm.includes('queso') || norm.includes('yogur') || norm.includes('leche')) return 'lacteos';
  if (norm.includes('especia') || norm.includes('condiment') || norm.includes('grano')) return 'almacen';
  if (norm.includes('verdura') || norm.includes('fruta')) return 'verduleria';
  if (norm.includes('pan') || norm.includes('harina')) return 'panaderia';
  if (norm.includes('fiambre')) return 'fiambreria';
  return 'otros';
}

export function sanitizeUnit(val: unknown): string {
  if (typeof val !== 'string') return 'unidad';
  const norm = val.toLowerCase().trim();
  if ((UnitValues as readonly string[]).includes(norm)) return norm;
  if (norm === 'unidades' || norm === 'u' || norm === 'un') return 'unidad';
  if (norm === 'gramos' || norm === 'gr' || norm === 'grs') return 'g';
  if (norm === 'kilos' || norm === 'kilo' || norm === 'kgs') return 'kg';
  if (norm === 'litro' || norm === 'litros' || norm === 'lt') return 'l';
  if (norm === 'mililitros' || norm === 'cc') return 'ml';
  if (norm === 'cuchara' || norm === 'cucharadas') return 'cucharada';
  if (norm === 'cucharaditas') return 'cucharadita';
  if (norm === 'dientes') return 'diente';
  if (norm === 'atados') return 'atado';
  if (norm === 'latas') return 'lata';
  if (norm === 'paquetes') return 'paquete';
  return 'unidad';
}

export const ChefIngredientSchema = z.object({
  nombre: z.string().min(1),
  cantidad: z.number().positive(),
  unidad: z.preprocess(sanitizeUnit, UnitEnum),
  categoria: z.preprocess(sanitizeCategory, CategoryEnum),
  es_basico: z.boolean().default(false),
  opcional: z.boolean().default(false),
  item_despensa_coincidente: z.string().nullable().default(null),
});

export const CookResponseSchema = z.object({
  modo: z.literal('cocinar'),
  fuera_de_tema: z.boolean(),
  mensaje: z.string().nullable(),
  aclaracion: z.string().nullable(),
  receta: z
    .object({
      nombre: z.string(),
      porciones: z.number(),
      tiempo_minutos: z.number().optional(),
      dificultad: z.enum(['facil', 'media', 'dificil']),
      pasos: z.array(z.string()).min(1).max(15),
    })
    .nullable()
    .optional(),
  ingredientes: z.array(ChefIngredientSchema).default([]),
  analisis_plato: z.array(z.string()).optional().default([]),
  advertencias: z.array(z.string()).default([]),
  origen: z.enum(['ia', 'cache', 'demo']).optional().default('ia'),
});

export const SuggestRecipeSchema = z.object({
  nombre: z.string(),
  porciones: z.number(),
  tiempo_minutos: z.number().optional(),
  dificultad: z.enum(['facil', 'media', 'dificil']),
  por_que_conviene: z.string(),
  pasos: z.array(z.string()).optional(),
  receta: z
    .object({
      nombre: z.string().optional(),
      porciones: z.number().optional(),
      tiempo_minutos: z.number().optional(),
      dificultad: z.enum(['facil', 'media', 'dificil']).optional(),
      pasos: z.array(z.string()),
    })
    .optional(),
  ingredientes: z.array(ChefIngredientSchema),
  analisis_plato: z.array(z.string()).optional().default([]),
});

export const SuggestResponseSchema = z.object({
  modo: z.literal('sugerir'),
  fuera_de_tema: z.boolean(),
  mensaje: z.string().nullable(),
  aclaracion: z.string().nullable(),
  recetas: z.array(SuggestRecipeSchema).default([]),
  advertencias: z.array(z.string()).default([]),
  origen: z.enum(['ia', 'cache', 'demo']).optional().default('ia'),
});

export const InterpretPantryItemSchema = z.object({
  nombre: z.string().min(1),
  cantidad: z.number().nullable().default(null),
  unidad: UnitEnum.nullable().default(null),
  categoria: CategoryEnum.default('almacen'),
});

export const InterpretPantryResponseSchema = z.object({
  modo: z.literal('interpretar_despensa'),
  fuera_de_tema: z.boolean(),
  mensaje: z.string().nullable(),
  items: z.array(InterpretPantryItemSchema).default([]),
});

export const InterpretItemSchema = z.object({
  texto_original: z.string(),
  nombre: z.string().min(1),
  cantidad: z.number().nullable().default(null),
  unidad: z.preprocess((val) => (val === null || val === undefined ? null : sanitizeUnit(val)), UnitEnum.nullable()).default(null),
  categoria: z.preprocess(sanitizeCategory, CategoryEnum).default('otros'),
  corregido: z.boolean().default(false),
  confianza: z.enum(['alta', 'media', 'baja']).default('alta'),
});

export const InterpretItemsResponseSchema = z.object({
  modo: z.literal('interpretar_items'),
  fuera_de_tema: z.boolean(),
  mensaje: z.string().nullable(),
  items: z.array(InterpretItemSchema).default([]),
});

export const MealTypeEnum = z.enum(['desayuno', 'almuerzo', 'merienda', 'cena']);

export const MenuItemMealSchema = z.object({
  tipo: MealTypeEnum,
  nombre: z.string(),
  bebida: z.string().nullable().optional(),
  porciones: z.number().default(2),
  tiempo_minutos: z.number().optional(),
  por_que_encaja: z.string().optional(),
  pasos: z.array(z.string()).optional().default([]),
  analisis_plato: z.array(z.string()).optional().default([]),
  ingredientes: z.array(ChefIngredientSchema).default([]),
});

export const MenuDaySchema = z.object({
  dia: z.string(),
  comidas: z.array(MenuItemMealSchema).default([]),
});

export const MenuResponseSchema = z.object({
  modo: z.literal('menu'),
  fuera_de_tema: z.boolean().default(false),
  mensaje: z.string().nullable().default(null),
  aclaracion: z.string().nullable().default(null),
  origen: z.enum(['ia', 'cache', 'demo']).optional().default('ia'),
  dias: z.array(MenuDaySchema).default([]),
  advertencias: z.array(z.string()).default([]),
});

export const PlanificarSemanaMealSchema = z.object({
  dia: z.string(),
  tipo: MealTypeEnum,
  plato: z.string(),
  bebida: z.string().nullable().optional(),
  por_que_encaja: z.string(),
});

export const PlanificarSemanaResponseSchema = z.object({
  modo: z.literal('planificar_semana'),
  fuera_de_tema: z.boolean().default(false),
  mensaje: z.string().nullable().default(null),
  aclaracion: z.string().nullable().default(null),
  origen: z.enum(['ia', 'cache', 'demo']).optional().default('ia'),
  comidas: z.array(PlanificarSemanaMealSchema).default([]),
  advertencias: z.array(z.string()).default([]),
});

export const DayMealDetailSchema = z.object({
  tipo: MealTypeEnum,
  plato: z.string(),
  bebida: z.string().nullable().optional(),
  pasos: z.array(z.string()).default([]),
  ingredientes: z.array(ChefIngredientSchema).default([]),
});

export const DetalleDiaMenuResponseSchema = z.object({
  modo: z.literal('detalle_dia_menu'),
  dia: z.string(),
  comidas: z.array(DayMealDetailSchema).default([]),
  advertencias: z.array(z.string()).default([]),
});

export const RegenerarPlatoResponseSchema = z.object({
  modo: z.literal('regenerar_plato'),
  fuera_de_tema: z.boolean().default(false),
  mensaje: z.string().nullable().default(null),
  comida: z.object({
    tipo: MealTypeEnum,
    plato: z.string(),
    bebida: z.string().nullable().optional(),
    por_que_encaja: z.string(),
    pasos: z.array(z.string()).default([]),
    ingredientes: z.array(ChefIngredientSchema).default([]),
  }),
  advertencias: z.array(z.string()).default([]),
  origen: z.enum(['ia', 'cache', 'demo']).optional().default('ia'),
});

export type CookResponse = z.infer<typeof CookResponseSchema>;
export type SuggestResponse = z.infer<typeof SuggestResponseSchema>;
export type InterpretPantryResponse = z.infer<typeof InterpretPantryResponseSchema>;
export type InterpretItemsResponse = z.infer<typeof InterpretItemsResponseSchema>;
export type MenuResponse = z.infer<typeof MenuResponseSchema>;
export type MenuItemMeal = z.infer<typeof MenuItemMealSchema>;
export type MenuDay = z.infer<typeof MenuDaySchema>;
export type PlanificarSemanaResponse = z.infer<typeof PlanificarSemanaResponseSchema>;
export type PlanificarSemanaMeal = z.infer<typeof PlanificarSemanaMealSchema>;
export type RegenerarPlatoResponse = z.infer<typeof RegenerarPlatoResponseSchema>;


export type ChefIngredient = z.infer<typeof ChefIngredientSchema>;
