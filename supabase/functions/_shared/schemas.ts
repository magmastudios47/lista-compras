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

export type CookResponse = z.infer<typeof CookResponseSchema>;
export type SuggestResponse = z.infer<typeof SuggestResponseSchema>;
export type InterpretPantryResponse = z.infer<typeof InterpretPantryResponseSchema>;
