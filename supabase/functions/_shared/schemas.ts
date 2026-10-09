import { z } from 'zod';

export const CategoryEnum = z.enum([
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
]);

export const UnitEnum = z.enum([
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
]);

export const ChefIngredientSchema = z.object({
  nombre: z.string().min(1),
  cantidad: z.number().positive(),
  unidad: UnitEnum,
  categoria: CategoryEnum,
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
      pasos: z.array(z.string()).min(1).max(10),
    })
    .nullable()
    .optional(),
  analisis_plato: z.array(z.string()).default([]),
  ingredientes: z.array(ChefIngredientSchema).default([]),
  advertencias: z.array(z.string()).default([]),
});

export const SuggestRecipeSchema = z.object({
  nombre: z.string(),
  porciones: z.number(),
  tiempo_minutos: z.number().optional(),
  dificultad: z.enum(['facil', 'media', 'dificil']),
  por_que_conviene: z.string(),
  analisis_plato: z.array(z.string()).default([]),
  ingredientes: z.array(ChefIngredientSchema),
});

export const SuggestResponseSchema = z.object({
  modo: z.literal('sugerir'),
  fuera_de_tema: z.boolean(),
  mensaje: z.string().nullable(),
  aclaracion: z.string().nullable(),
  recetas: z.array(SuggestRecipeSchema).default([]),
  advertencias: z.array(z.string()).default([]),
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
  unidad: UnitEnum.nullable().default(null),
  categoria: CategoryEnum.default('otros'),
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
  porciones: z.number().default(2),
  tiempo_minutos: z.number().optional(),
  por_que_encaja: z.string().optional(),
  analisis_plato: z.array(z.string()).default([]),
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
  dias: z.array(MenuDaySchema).default([]),
  advertencias: z.array(z.string()).default([]),
});

export type CookResponse = z.infer<typeof CookResponseSchema>;
export type SuggestResponse = z.infer<typeof SuggestResponseSchema>;
export type InterpretPantryResponse = z.infer<typeof InterpretPantryResponseSchema>;
export type InterpretItemsResponse = z.infer<typeof InterpretItemsResponseSchema>;
export type MenuResponse = z.infer<typeof MenuResponseSchema>;
export type MenuItemMeal = z.infer<typeof MenuItemMealSchema>;
export type MenuDay = z.infer<typeof MenuDaySchema>;

