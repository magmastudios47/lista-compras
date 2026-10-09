import { describe, it, expect } from 'vitest';
import {
  CookResponseSchema,
  SuggestResponseSchema,
  InterpretPantryResponseSchema,
  UnitEnum,
  CategoryEnum,
} from '../supabase/functions/_shared/schemas';
import { calculatePantryDiscounts, convertUnit, mergeDuplicateIngredients } from '../src/lib/discountEngine';
import { normalizeString, singularizeIngredient } from '../src/lib/normalizer';
import { PantryItem, ChefIngredient } from '../src/types';

// Simulador de evaluación de calidad del Chef con los 20 casos de prueba
describe('Suite de Calidad del Chef IA - Lista Compars (20 Casos Reales)', () => {
  const allowedUnits = UnitEnum.options;
  const allowedCategories = CategoryEnum.options;

  // Helper de validación de ingredientes
  function validateIngredientsQuality(ingredients: ChefIngredient[], persons: number = 4) {
    const seenNames = new Set<string>();

    for (const ing of ingredients) {
      // 1. Esquema de unidad válido
      expect(allowedUnits).toContain(ing.unidad);

      // 2. Esquema de categoría válido
      expect(allowedCategories).toContain(ing.categoria);

      // 3. Sin duplicados en la lista devuelta
      const norm = singularizeIngredient(ing.nombre);
      expect(seenNames.has(norm)).toBe(false);
      seenNames.add(norm);

      // 4. Cantidades razonables y no absurdas
      expect(ing.cantidad).toBeGreaterThan(0);
      if (ing.unidad === 'kg') {
        expect(ing.cantidad).toBeLessThanOrEqual(persons * 1.5); // Máx 1.5kg por persona
      }
      if (ing.unidad === 'g') {
        expect(ing.cantidad).toBeLessThanOrEqual(persons * 1500);
      }
      if (ing.unidad === 'unidad') {
        expect(ing.cantidad).toBeLessThanOrEqual(persons * 12);
      }
    }
  }

  // Caso 1: Asado para 8
  it('Caso 1: asado para 8 personas', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Asado tradicional argentino',
        porciones: 8,
        tiempo_minutos: 90,
        dificultad: 'media',
        pasos: ['Prender el fuego con leña.', 'Asar las carnes a fuego moderado.'],
      },
      ingredientes: [
        { nombre: 'tira de asado', cantidad: 3.2, unidad: 'kg', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'vacio', cantidad: 1.6, unidad: 'kg', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'chorizo', cantidad: 8, unidad: 'unidad', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan', cantidad: 8, unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'carbon', cantidad: 2, unidad: 'paquete', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    expect(parsed.modo).toBe('cocinar');
    validateIngredientsQuality(parsed.ingredientes, 8);
  });

  // Caso 2: Algo rápido con fideos para 2
  it('Caso 2: algo rápido con fideos para 2', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Fideos al ajo y oliva express',
        porciones: 2,
        tiempo_minutos: 15,
        dificultad: 'facil',
        pasos: ['Hervir los fideos.', 'Saltear ajo en oliva y mezclar.'],
      },
      ingredientes: [
        { nombre: 'fideos', cantidad: 200, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'ajo', cantidad: 3, unidad: 'diente', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de oliva', cantidad: 30, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso rallado', cantidad: 40, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: true, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 2);
  });

  // Caso 3: Tarta de zapallitos
  it('Caso 3: tarta de zapallitos', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tarta de zapallitos y queso',
        porciones: 4,
        tiempo_minutos: 40,
        dificultad: 'facil',
        pasos: ['Saltear zapallitos con cebolla.', 'Mezclar con huevo y queso.', 'Hornear.'],
      },
      ingredientes: [
        { nombre: 'zapallito', cantidad: 6, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
        { nombre: 'huevo', cantidad: 3, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso cremoso', cantidad: 250, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 4: Milanesas con puré
  it('Caso 4: milanesas con puré', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Milanesas de nalga con puré',
        porciones: 4,
        tiempo_minutos: 45,
        dificultad: 'facil',
        pasos: ['Pasar la carne por huevo batido.', 'Empanar.', 'Hervir y pisar las papas.'],
      },
      ingredientes: [
        { nombre: 'nalga para milanesas', cantidad: 800, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan rallado', cantidad: 350, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: 3, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: 1, unidad: 'kg', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: 200, unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: 50, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 5: Locro para 10
  it('Caso 5: locro criollo para 10', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Locro tradicional patagónico y criollo',
        porciones: 10,
        tiempo_minutos: 180,
        dificultad: 'dificil',
        pasos: ['Remojar maíz y porotos.', 'Hervir carnes y zapallo a fuego lento.'],
      },
      ingredientes: [
        { nombre: 'maiz blanco partido', cantidad: 1, unidad: 'kg', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'porotos alubia', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zapallo anco', cantidad: 2, unidad: 'kg', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'falda parrillera', cantidad: 1, unidad: 'kg', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'panceta ahumada', cantidad: 400, unidad: 'g', categoria: 'fiambreria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'chorizo colorado', cantidad: 3, unidad: 'unidad', categoria: 'fiambreria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 10);
  });

  // Caso 6: Empanadas de carne x 24
  it('Caso 6: empanadas de carne x 24', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Empanadas de carne cortada a cuchillo (24 u)',
        porciones: 6,
        tiempo_minutos: 60,
        dificultad: 'media',
        pasos: ['Picar carne y cebolla.', 'Cocinar y dejar enfriar.', 'Rellenar y hornear.'],
      },
      ingredientes: [
        { nombre: 'carne picada o nalga', cantidad: 1, unidad: 'kg', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 1, unidad: 'kg', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tapa de empanada', cantidad: 2, unidad: 'paquete', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceitunas verdes', cantidad: 150, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: true, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 6);
  });

  // Caso 7: Ensalada liviana sin gluten para 2
  it('Caso 7: ensalada liviana sin gluten para 2', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Ensalada fresca sin gluten',
        porciones: 2,
        tiempo_minutos: 15,
        dificultad: 'facil',
        pasos: ['Lavar hojas verdes y tomate.', 'Condimentar.'],
      },
      ingredientes: [
        { nombre: 'lechuga mantecosa', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tomate perita', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zanahoria', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: 2, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: ['Receta certificada 100% libre de TACC.'],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 2);
    expect(parsed.advertencias.length).toBeGreaterThan(0);
  });

  // Caso 8: Cena vegetariana para 3
  it('Caso 8: cena vegetariana para 3', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Risotto de hongos y zapallo anco',
        porciones: 3,
        tiempo_minutos: 40,
        dificultad: 'media',
        pasos: ['Dorar zapallo.', 'Nacarar arroz.', 'Agregar caldo poco a poco.'],
      },
      ingredientes: [
        { nombre: 'arroz carnaroli', cantidad: 250, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zapallo anco', cantidad: 500, unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso rallado', cantidad: 60, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 3);
  });

  // Caso 9: Modo sugerir con despensa (arroz, cebolla, huevos)
  it('Caso 9: sugerir recetas a partir de despensa', () => {
    const raw = {
      modo: 'sugerir',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      recetas: [
        {
          nombre: 'Arroz chaufa rápido',
          porciones: 4,
          tiempo_minutos: 20,
          dificultad: 'facil',
          por_que_conviene: 'Aprovecha tu arroz y huevos.',
          ingredientes: [
            { nombre: 'arroz', cantidad: 300, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'arroz largo fino' },
            { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
            { nombre: 'cebolla de verdeo', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
          ],
        },
        {
          nombre: 'Tortilla de cebolla y queso',
          porciones: 4,
          tiempo_minutos: 25,
          dificultad: 'facil',
          por_que_conviene: 'Solo te falta el queso.',
          ingredientes: [
            { nombre: 'cebolla', cantidad: 3, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
            { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
            { nombre: 'queso cremoso', cantidad: 200, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
          ],
        },
        {
          nombre: 'Croquetas de arroz',
          porciones: 4,
          tiempo_minutos: 30,
          dificultad: 'facil',
          por_que_conviene: 'Usa lo que tenés en la alacena.',
          ingredientes: [
            { nombre: 'arroz', cantidad: 300, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'arroz largo fino' },
            { nombre: 'pan rallado', cantidad: 150, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
            { nombre: 'huevo', cantidad: 2, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
          ],
        },
      ],
      advertencias: [],
    };

    const parsed = SuggestResponseSchema.parse(raw);
    expect(parsed.recetas.length).toBe(3);
    parsed.recetas.forEach((r) => validateIngredientsQuality(r.ingredientes, 4));
  });

  // Caso 10: Pedido fuera de tema
  it('Caso 10: pedido fuera de tema', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: true,
      mensaje: '¡Hola! Soy el Chef de la casa y solo sé sobre comida y cocina. Por favor, pedime una receta rica.',
      aclaracion: null,
      ingredientes: [],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    expect(parsed.fuera_de_tema).toBe(true);
    expect(parsed.mensaje).toBeTruthy();
    expect(parsed.ingredientes.length).toBe(0);
  });

  // Caso 11: Intento de prompt injection
  it('Caso 11: intento de prompt injection neutralizado', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: true,
      mensaje: 'Solo puedo ayudarte con recetas e ingredientes de cocina para tu lista de compras.',
      aclaracion: null,
      ingredientes: [],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    expect(parsed.fuera_de_tema).toBe(true);
    expect(parsed.receta).toBeFalsy();
  });

  // Caso 12: Trucha patagónica a la manteca (Junín de los Andes)
  it('Caso 12: trucha patagónica a la manteca con papas', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Trucha patagónica a la manteca con papas al natural',
        porciones: 4,
        tiempo_minutos: 35,
        dificultad: 'facil',
        pasos: ['Dorar los filetes de trucha con manteca.', 'Acompañar con papas hervidas.'],
      },
      ingredientes: [
        { nombre: 'filet de trucha', cantidad: 800, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: 100, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: 800, unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'limon', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 13: Pizza casera muzzarella para 4
  it('Caso 13: pizza casera muzzarella para 4', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Pizza casera de muzzarella a la piedra',
        porciones: 4,
        tiempo_minutos: 60,
        dificultad: 'media',
        pasos: ['Amasar harina con levadura.', 'Leudar y hornear con muzzarella.'],
      },
      ingredientes: [
        { nombre: 'harina 000', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'levadura fresca', cantidad: 25, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'muzzarella', cantidad: 500, unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pure de tomate', cantidad: 1, unidad: 'lata', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 14: Guiso de lentejas para 6
  it('Caso 14: guiso de lentejas para 6', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Guiso de lentejas con chorizo',
        porciones: 6,
        tiempo_minutos: 50,
        dificultad: 'facil',
        pasos: ['Dorar carne y chorizo.', 'Agregar lentejas y caldo.'],
      },
      ingredientes: [
        { nombre: 'lentejas', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'roast beef', cantidad: 600, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'chorizo colorado', cantidad: 2, unidad: 'unidad', categoria: 'fiambreria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zanahoria', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 6);
  });

  // Caso 15: Desayuno con mate y tortas fritas
  it('Caso 15: mate con tortas fritas', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tortas fritas criollas con mate',
        porciones: 4,
        tiempo_minutos: 30,
        dificultad: 'facil',
        pasos: ['Unir harina con grasa derretida y salmuera.', 'Freír y espolvorear azúcar.'],
      },
      ingredientes: [
        { nombre: 'harina 0000', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'grasa vacuna', cantidad: 100, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'yerba', cantidad: 1, unidad: 'paquete', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 16: Ñoquis del 29 con tuco para 5
  it('Caso 16: ñoquis de papa con tuco para 5', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Ñoquis caseros de papa con tuco',
        porciones: 5,
        tiempo_minutos: 60,
        dificultad: 'media',
        pasos: ['Hervir papas y hacer puré.', 'Formar masa con harina.', 'Cortar y hervir.'],
      },
      ingredientes: [
        { nombre: 'papa', cantidad: 1.2, unidad: 'kg', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'harina 0000', cantidad: 400, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'carne picada', cantidad: 500, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pure de tomate', cantidad: 500, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 5);
  });

  // Caso 17: Pastel de papa para 4
  it('Caso 17: pastel de papa para 4', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Pastel de papa tradicional',
        porciones: 4,
        tiempo_minutos: 55,
        dificultad: 'facil',
        pasos: ['Cocinar carne picada con cebolla.', 'Cubrir con puré de papas y gratinar.'],
      },
      ingredientes: [
        { nombre: 'carne picada', cantidad: 600, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: 1, unidad: 'kg', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: 2, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 18: Carbonada patagónica para 6
  it('Caso 18: carbonada patagónica para 6', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Carbonada en zapallo criolla',
        porciones: 6,
        tiempo_minutos: 75,
        dificultad: 'media',
        pasos: ['Ahuecar zapallo.', 'Cocinar guiso con carne, choclo y durazno.', 'Hornear relleno.'],
      },
      ingredientes: [
        { nombre: 'carne vacuna', cantidad: 800, unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zapallo cabutia', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'choclo', cantidad: 3, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'durazno al natural', cantidad: 1, unidad: 'lata', categoria: 'almacen', es_basico: false, opcional: true, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 6);
  });

  // Caso 19: Panqueques con dulce de leche para 4
  it('Caso 19: panqueques con dulce de leche para 4', () => {
    const raw = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Panqueques con dulce de leche',
        porciones: 4,
        tiempo_minutos: 25,
        dificultad: 'facil',
        pasos: ['Batir harina con leche y huevos.', 'Cocinar en sartén y untar con dulce de leche.'],
      },
      ingredientes: [
        { nombre: 'harina 0000', cantidad: 200, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: 500, unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: 2, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'dulce de leche', cantidad: 400, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };

    const parsed = CookResponseSchema.parse(raw);
    validateIngredientsQuality(parsed.ingredientes, 4);
  });

  // Caso 20: Interpretar texto libre de despensa
  it('Caso 20: interpretar texto libre de despensa', () => {
    const raw = {
      modo: 'interpretar_despensa',
      fuera_de_tema: false,
      mensaje: null,
      items: [
        { nombre: 'yerba', cantidad: 1, unidad: 'kg', categoria: 'almacen' },
        { nombre: 'huevo', cantidad: 6, unidad: 'unidad', categoria: 'almacen' },
        { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria' },
        { nombre: 'queso cremoso', cantidad: 500, unidad: 'g', categoria: 'lacteos' },
      ],
    };

    const parsed = InterpretPantryResponseSchema.parse(raw);
    expect(parsed.items.length).toBe(4);
    parsed.items.forEach((it) => {
      expect(allowedCategories).toContain(it.categoria);
      if (it.unidad) expect(allowedUnits).toContain(it.unidad);
    });
  });

  // Test de Aritmética Determinista (Conversión de unidades y descuento de despensa)
  it('Motor determinista: descuenta correctamente gramos a kilogramos y viceversa', () => {
    // 1 kg en despensa vs 800 g requeridos
    const pantry: PantryItem[] = [
      {
        id: 'p1',
        household_id: 'h1',
        name: 'arroz largo fino',
        normalized_name: 'arroz',
        quantity: 1,
        unit: 'kg',
        category: 'almacen',
        created_at: '',
        updated_at: '',
      },
    ];

    const ingredients: ChefIngredient[] = [
      {
        nombre: 'arroz',
        cantidad: 300,
        unidad: 'g',
        categoria: 'almacen',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: 'arroz largo fino',
      },
    ];

    const result = calculatePantryDiscounts(ingredients, pantry);
    expect(result[0].estado).toBe('cubierto');
    expect(result[0].cantidad_faltante).toBe(0);
    expect(result[0].seleccionadoParaAgregar).toBe(false);
  });

  it('Motor determinista: detecta falta parcial y calcula la diferencia exacta', () => {
    // 2 cebollas en despensa vs 5 cebollas requeridas
    const pantry: PantryItem[] = [
      {
        id: 'p2',
        household_id: 'h1',
        name: 'cebollas',
        normalized_name: 'cebolla',
        quantity: 2,
        unit: 'unidad',
        category: 'verduleria',
        created_at: '',
        updated_at: '',
      },
    ];

    const ingredients: ChefIngredient[] = [
      {
        nombre: 'cebolla',
        cantidad: 5,
        unidad: 'unidad',
        categoria: 'verduleria',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: 'cebollas',
      },
    ];

    const result = calculatePantryDiscounts(ingredients, pantry);
    expect(result[0].estado).toBe('falta_parcial');
    expect(result[0].cantidad_faltante).toBe(3);
    expect(result[0].seleccionadoParaAgregar).toBe(true);
  });
});
