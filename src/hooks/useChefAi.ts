import { useState, useCallback } from 'react';
import {
  ChefCookResponse,
  ChefSuggestResponse,
  ChefInterpretPantryResponse,
  ChefInterpretItemsResponse,
  ChefMenuResponse,
  MealType,
  MenuItemMeal,
  MenuDay,
  DiscountComparisonResult,
  PantryItem,
} from '../types';
import { useHousehold } from '../context/HouseholdContext';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { calculatePantryDiscounts, mergeDuplicateIngredients } from '../lib/discountEngine';
import { processHandwrittenText } from '../lib/textPipeline';

export function useChefAi() {
  const { household, remainingQueries, incrementChefUsage } = useHousehold();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modo Cocinar
  const askToCook = useCallback(
    async (
      mealRequest: string,
      persons: number = 4,
      dietaryRestrictions: string[] = [],
      pantry: PantryItem[] = []
    ): Promise<{
      response: ChefCookResponse;
      comparisons: DiscountComparisonResult[];
    }> => {
      setLoading(true);
      setError(null);

      try {
        let cookData: ChefCookResponse;

        if (isConfigured && household) {
          try {
            // Llamada a la Edge Function de Supabase
            const { data, error: fnError } = await supabase.functions.invoke('chef-ai', {
              body: {
                modo: 'cocinar',
                pedido: mealRequest,
                personas: persons,
                restricciones: dietaryRestrictions,
                despensa: pantry.map((p) => p.name),
                household_id: household.id,
              },
            });

            if (!fnError && data) {
              cookData = data as ChefCookResponse;
              incrementChefUsage();
            } else {
              // Edge function aún no desplegada en Supabase: usar motor local
              console.warn('Edge Function chef-ai no disponible, usando motor local:', fnError);
              await new Promise((r) => setTimeout(r, 600));
              cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
              incrementChefUsage();
            }
          } catch (fnCallErr) {
            console.warn('Fallo al invocar Edge Function, usando motor local:', fnCallErr);
            await new Promise((r) => setTimeout(r, 600));
            cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
            incrementChefUsage();
          }
        } else {
          // MOCK / DEMO Provider para desarrollo sin credenciales o fuera de línea
          await new Promise((r) => setTimeout(r, 600));
          cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
          incrementChefUsage();
        }

        // Ejecutar motor determinista de descuento de despensa en cliente
        const comparisons = calculatePantryDiscounts(cookData.ingredientes, pantry);

        return { response: cookData, comparisons };
      } catch (err: any) {
        const msg = err.message || 'Error al comunicarse con el Chef.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [household, incrementChefUsage]
  );

  // Modo Sugerir
  const askToSuggest = useCallback(
    async (
      pantry: PantryItem[],
      freeText?: string
    ): Promise<ChefSuggestResponse> => {
      setLoading(true);
      setError(null);

      try {
        let suggestData: ChefSuggestResponse;

        if (isConfigured && household) {
          try {
            const { data, error: fnError } = await supabase.functions.invoke('chef-ai', {
              body: {
                modo: 'sugerir',
                despensa: pantry.map((p) => p.name),
                texto_despensa: freeText,
                household_id: household.id,
              },
            });

            if (!fnError && data) {
              suggestData = data as ChefSuggestResponse;
              incrementChefUsage();
            } else {
              console.warn('Edge Function chef-ai no disponible, usando motor local:', fnError);
              await new Promise((r) => setTimeout(r, 600));
              suggestData = generateMockSuggestResponse(pantry, freeText);
              incrementChefUsage();
            }
          } catch (fnErr) {
            console.warn('Fallo al invocar Edge Function, usando motor local:', fnErr);
            await new Promise((r) => setTimeout(r, 600));
            suggestData = generateMockSuggestResponse(pantry, freeText);
            incrementChefUsage();
          }
        } else {
          await new Promise((r) => setTimeout(r, 600));
          suggestData = generateMockSuggestResponse(pantry, freeText);
          incrementChefUsage();
        }

        return suggestData;
      } catch (err: any) {
        const msg = err.message || 'Error al obtener recetas sugeridas.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [household, incrementChefUsage]
  );

  // Modo Interpretar Ítems (Reemplaza a interpretar_despensa)
  const interpretItems = useCallback(
    async (text: string): Promise<ChefInterpretItemsResponse> => {
      setLoading(true);
      setError(null);

      try {
        let parsedData: ChefInterpretItemsResponse;

        if (isConfigured && household) {
          try {
            const { data, error: fnError } = await supabase.functions.invoke('chef-ai', {
              body: {
                modo: 'interpretar_items',
                texto_despensa: text,
                household_id: household?.id,
              },
            });

            if (!fnError && data) {
              parsedData = data as ChefInterpretItemsResponse;
            } else {
              const localItems = processHandwrittenText(text, household?.id);
              parsedData = {
                modo: 'interpretar_items',
                fuera_de_tema: false,
                mensaje: null,
                items: localItems,
              };
            }
          } catch {
            const localItems = processHandwrittenText(text, household?.id);
            parsedData = {
              modo: 'interpretar_items',
              fuera_de_tema: false,
              mensaje: null,
              items: localItems,
            };
          }
        } else {
          // Procesamiento offline con pipeline determinista y catálogo argentino
          await new Promise((r) => setTimeout(r, 400));
          const localItems = processHandwrittenText(text, household?.id);
          parsedData = {
            modo: 'interpretar_items',
            fuera_de_tema: false,
            mensaje: null,
            items: localItems,
          };
        }

        return parsedData;
      } catch (err: any) {
        const msg = err.message || 'Error al interpretar el texto.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [household]
  );

  // Alias para retrocompatibilidad
  const interpretPantry = useCallback(
    async (text: string): Promise<ChefInterpretPantryResponse> => {
      const res = await interpretItems(text);
      return {
        modo: 'interpretar_despensa',
        fuera_de_tema: res.fuera_de_tema,
        mensaje: res.mensaje,
        items: res.items.map((i) => ({
          nombre: i.nombre,
          cantidad: i.cantidad,
          unidad: i.unidad,
          categoria: i.categoria,
        })),
      };
    },
    [interpretItems]
  );

  // Modo Menú Semanal (cuenta como 3 consultas)
  const generateWeeklyMenu = useCallback(
    async (params: {
      daysConfig: Array<{ dia: string; comidas: MealType[] }>;
      targetProfile: string;
      profileDetail?: string;
      persons?: number;
      mandatoryDishes?: string;
      pantry: PantryItem[];
    }): Promise<{
      response: ChefMenuResponse;
      comparisons: DiscountComparisonResult[];
    }> => {
      setLoading(true);
      setError(null);

      try {
        let menuData: ChefMenuResponse;
        const p = params.persons || 4;

        if (isConfigured && household) {
          try {
            const { data, error: fnError } = await supabase.functions.invoke('chef-ai', {
              body: {
                modo: 'menu',
                dias_config: params.daysConfig,
                objetivo_perfil: params.targetProfile,
                objetivo_detalle: params.profileDetail,
                personas: p,
                platos_obligatorios: params.mandatoryDishes,
                despensa: params.pantry.map((x) => x.name),
                household_id: household.id,
              },
            });

            if (!fnError && data) {
              menuData = data as ChefMenuResponse;
              // Incrementa 3 consultas
              incrementChefUsage();
              incrementChefUsage();
              incrementChefUsage();
            } else {
              console.warn('Edge Function chef-ai no disponible, usando motor local:', fnError);
              await new Promise((r) => setTimeout(r, 600));
              menuData = generateMockMenuResponse(params);
              incrementChefUsage();
            }
          } catch (fnErr) {
            console.warn('Fallo al invocar Edge Function chef-ai, usando motor local:', fnErr);
            await new Promise((r) => setTimeout(r, 600));
            menuData = generateMockMenuResponse(params);
            incrementChefUsage();
          }
        } else {
          // Fallback MOCK / Offline
          await new Promise((r) => setTimeout(r, 600));
          menuData = generateMockMenuResponse(params);
          incrementChefUsage();
        }

        // Unificar ingredientes de todas las comidas del menú y descontar contra la despensa
        const allIngredients = menuData.dias.flatMap((d) => d.comidas.flatMap((c) => c.ingredientes));
        const merged = mergeDuplicateIngredients(allIngredients);
        const comparisons = calculatePantryDiscounts(merged, params.pantry);

        return { response: menuData, comparisons };
      } catch (err: any) {
        const msg = err.message || 'Error al generar el menú semanal.';
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [household, incrementChefUsage]
  );

  return {
    loading,
    error,
    askToCook,
    askToSuggest,
    interpretItems,
    interpretPantry,
    generateWeeklyMenu,
    remainingQueries,
  };
}

// ========================================================================
// GENERADORES DEMO / OFFLINE REALISTAS PARA ARGENTINA
// ========================================================================

export function generateMockCookResponse(
  mealRequest: string,
  persons: number,
  restrictions: string[],
  pantry: PantryItem[]
): ChefCookResponse {
  const reqLower = mealRequest.toLowerCase();

  // Caso fuera de tema
  if (reqLower.includes('politica') || reqLower.includes('dolar') || reqLower.includes('computadora')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: true,
      mensaje: '¡Hola! Soy el Chef de la casa y solo sé de comidas y cocina argentina. Pedime una receta rica.',
      aclaracion: null,
      receta: null,
      analisis_plato: [],
      ingredientes: [],
      advertencias: [],
    };
  }

  // 1. Milanesa con puré de zapallo (FIDELIDAD AL PLATO: Zapallo, NUNCA papa)
  if (reqLower.includes('milanesa') && (reqLower.includes('zapallo') || reqLower.includes('calabaza'))) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Milanesas con puré de zapallo',
        porciones: persons,
        tiempo_minutos: 45,
        dificultad: 'facil',
        pasos: [
          'Pasar la nalga por huevo batido con sal, perejil y ajo.',
          'Empanar con pan rallado.',
          'Hervir o asar el zapallo anco, pisar con manteca y leche.',
          'Freír o dorar las milanesas al horno y servir con el puré de zapallo.',
        ],
      },
      analisis_plato: [
        'milanesa de nalga: nalga, huevo, pan rallado, ajo, perejil',
        'puré de zapallo: zapallo anco, manteca, leche, sal, nuez moscada',
      ],
      ingredientes: [
        { nombre: 'nalga para milanesas', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan rallado', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zapallo anco', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 15), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 50), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 2. Milanesas tradicionales (con puré de papas)
  if (reqLower.includes('milanesa')) {
    const isPantryEgg = pantry.some((p) => p.name.includes('huevo'));
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Milanesas con puré cremoso',
        porciones: persons,
        tiempo_minutos: 45,
        dificultad: 'facil',
        pasos: [
          'Pasar la nalga por huevo batido con sal, pimienta y perejil.',
          'Empanar con pan rallado presionando bien.',
          'Hervir las papas con cáscara, pelar y pisar con manteca y leche tibia.',
          'Freír las milanesas en abundante aceite caliente hasta dorar de ambos lados.',
        ],
      },
      analisis_plato: [
        'milanesa de nalga: nalga, huevo, pan rallado, ajo, perejil',
        'puré de papa: papa, manteca, leche, sal',
      ],
      ingredientes: [
        { nombre: 'nalga para milanesas', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: isPantryEgg ? 'huevos de campo' : null },
        { nombre: 'pan rallado', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 50), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 15), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de girasol', cantidad: 500, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: 'aceite de girasol' },
      ],
      advertencias: [],
    };
  }

  // 3. Ensalada de papa
  if (reqLower.includes('ensalada') && reqLower.includes('papa')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Ensalada de papa y huevo clásica',
        porciones: persons,
        tiempo_minutos: 25,
        dificultad: 'facil',
        pasos: ['Hervir las papas peladas en cubos.', 'Hervir los huevos duros.', 'Unir con mayonesa y perejil.'],
      },
      analisis_plato: ['ensalada de papa: papa, huevo, perejil, mayonesa o aceite'],
      ingredientes: [
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: persons, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'perejil', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 4. Tarta de zapallitos (FIDELIDAD AL PLATO: Zapallito, NO zapallo anco)
  if (reqLower.includes('zapallito')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tarta de zapallitos y queso',
        porciones: persons,
        tiempo_minutos: 40,
        dificultad: 'facil',
        pasos: [
          'Cortar los zapallitos en cubos y saltear con cebolla picada hasta que evapore el agua.',
          'Escurrir muy bien para que no ablande la masa.',
          'Mezclar con huevos batidos, queso cremoso en cubos y condimentos.',
          'Forrar una tartera con la masa, rellenar y hornear a 180°C por 30 minutos.',
        ],
      },
      analisis_plato: ['tarta de zapallitos: zapallito, cebolla, huevo, queso cremoso, tapa de tarta'],
      ingredientes: [
        { nombre: 'zapallito', cantidad: Math.max(3, Math.round(persons * 1.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
        { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso cremoso', cantidad: Math.round(persons * 75), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
      ],
      advertencias: [],
    };
  }

  // 5. Tortilla de verduras (FIDELIDAD AL PLATO: Verduras de hoja, NO papa)
  if (reqLower.includes('tortilla') && reqLower.includes('verdura')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tortilla de verduras y queso',
        porciones: persons,
        tiempo_minutos: 25,
        dificultad: 'facil',
        pasos: ['Lavar y blanquear acelga o espinaca.', 'Picar con cebolla salteada.', 'Mezclar con huevos y queso.', 'Cuajar la tortilla en sartén.'],
      },
      analisis_plato: ['tortilla de verduras: espinaca, cebolla, huevo, queso cremoso'],
      ingredientes: [
        { nombre: 'espinaca', cantidad: 2, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(3, persons + 1), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso cremoso', cantidad: Math.round(persons * 50), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de girasol', cantidad: 30, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 6. Fideos con salsa blanca (FIDELIDAD AL PLATO: Salsa blanca, NO salsa de tomate)
  if (reqLower.includes('fideo') && reqLower.includes('salsa blanca')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Fideos con salsa blanca y queso',
        porciones: persons,
        tiempo_minutos: 20,
        dificultad: 'facil',
        pasos: ['Hervir los fideos al dente.', 'Hacer salsa blanca con manteca, harina y leche.', 'Servir con queso rallado.'],
      },
      analisis_plato: ['fideos: fideos', 'salsa blanca: leche, manteca, harina 000, queso rallado'],
      ingredientes: [
        { nombre: 'fideos', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 150), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 20), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'harina 000', cantidad: Math.round(persons * 15), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso rallado', cantidad: Math.round(persons * 20), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 7. Ensalada de lentejas (FIDELIDAD AL PLATO: Lentejas, NO lechuga)
  if (reqLower.includes('ensalada') && reqLower.includes('lenteja')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Ensalada fresca de lentejas',
        porciones: persons,
        tiempo_minutos: 20,
        dificultad: 'facil',
        pasos: ['Hervir las lentejas o usar escurridas.', 'Mezclar con tomate y cebolla picados.', 'Agregar huevo duro y condimentar con aceite.'],
      },
      analisis_plato: ['ensalada de lentejas: lentejas, tomate perita, cebolla, huevo, aceite de oliva'],
      ingredientes: [
        { nombre: 'lentejas', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tomate perita', cantidad: persons, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: persons, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de oliva', cantidad: 40, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 8. Pollo al horno con batata (FIDELIDAD AL PLATO: Batata, NO papa)
  if (reqLower.includes('pollo') && reqLower.includes('batata')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Pollo al horno con batatas doradas',
        porciones: persons,
        tiempo_minutos: 60,
        dificultad: 'facil',
        pasos: ['Condimentar las presas de pollo.', 'Cortar las batatas en cuñas con aceite.', 'Hornear a 200°C hasta dorar.'],
      },
      analisis_plato: ['pollo al horno: pollo, condimentos', 'batatas al horno: batata, aceite de girasol'],
      ingredientes: [
        { nombre: 'pollo', cantidad: Math.round(persons * 300), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'batata', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de girasol', cantidad: 50, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 9. Sopa de calabaza (FIDELIDAD AL PLATO: Calabaza / zapallo, NO papa)
  if (reqLower.includes('sopa') && (reqLower.includes('calabaza') || reqLower.includes('zapallo'))) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Sopa crema de calabaza reconfortante',
        porciones: persons,
        tiempo_minutos: 35,
        dificultad: 'facil',
        pasos: ['Rehogar cebolla.', 'Agregar calabaza en cubos con agua o caldo.', 'Cocinar y procesar con crema.'],
      },
      analisis_plato: ['sopa de calabaza: zapallo anco, cebolla, crema de leche'],
      ingredientes: [
        { nombre: 'zapallo anco', cantidad: Math.round(persons * 300), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'crema de leche', cantidad: Math.round(persons * 40), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // Asado o genérico parrilla
  if (reqLower.includes('asado') || reqLower.includes('parrilla')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Asado argentino completo',
        porciones: persons,
        tiempo_minutos: 90,
        dificultad: 'media',
        pasos: [
          'Prender el fuego con leña o carbón.',
          'Limpiar la parrilla y colocar los cortes con brasas moderadas.',
          'Asar despacio girando solo cuando tome color.',
        ],
      },
      analisis_plato: ['asado parrillero: tira de asado, chorizo, pan, carbon'],
      ingredientes: [
        { nombre: 'tira de asado', cantidad: Math.round(persons * 400), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'chorizo', cantidad: persons, unidad: 'unidad', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan', cantidad: persons, unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'carbon', cantidad: Math.max(1, Math.round(persons / 4)), unidad: 'paquete', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // Plato default dinámico
  return {
    modo: 'cocinar',
    fuera_de_tema: false,
    mensaje: null,
    aclaracion: null,
    receta: {
      nombre: mealRequest.charAt(0).toUpperCase() + mealRequest.slice(1),
      porciones: persons,
      tiempo_minutos: 35,
      dificultad: 'facil',
      pasos: [
        'Preparar y picar los vegetales de base.',
        'Cocinar a fuego medio incorporando los ingredientes principales.',
        'Servir caliente y disfrutar en familia.',
      ],
    },
    analisis_plato: [`${mealRequest}: arroz, cebolla, tomate perita, aceite de girasol`],
    ingredientes: [
      { nombre: 'arroz', cantidad: Math.round(persons * 80), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'arroz largo fino' },
      { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
      { nombre: 'tomate perita', cantidad: Math.max(2, Math.round(persons * 1)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      { nombre: 'aceite de girasol', cantidad: 50, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: 'aceite de girasol' },
    ],
    advertencias: restrictions.length > 0 ? [`Adaptado para: ${restrictions.join(', ')}`] : [],
  };
}

export function generateMockSuggestResponse(
  pantry: PantryItem[],
  freeText?: string
): ChefSuggestResponse {
  return {
    modo: 'sugerir',
    fuera_de_tema: false,
    mensaje: null,
    aclaracion: null,
    recetas: [
      {
        nombre: 'Arroz salteado con cebolla y huevo',
        porciones: 4,
        tiempo_minutos: 20,
        dificultad: 'facil',
        por_que_conviene: 'Aprovecha el arroz, los huevos y las cebollas que ya tenés en la despensa.',
        analisis_plato: ['arroz salteado: arroz, cebolla, huevo, salsa de soja'],
        ingredientes: [
          { nombre: 'arroz', cantidad: 320, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'arroz largo fino' },
          { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
          { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
          { nombre: 'salsa de soja', cantidad: 30, unidad: 'ml', categoria: 'almacen', es_basico: false, opcional: true, item_despensa_coincidente: null },
        ],
      },
      {
        nombre: 'Tortilla de papas y cebolla clásica',
        porciones: 4,
        tiempo_minutos: 35,
        dificultad: 'facil',
        por_que_conviene: 'Tenés cebolla y huevos; solo necesitás sumar unas papas a la lista.',
        analisis_plato: ['tortilla de papas: papa, cebolla, huevo, aceite de girasol'],
        ingredientes: [
          { nombre: 'papa', cantidad: 800, unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
          { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
          { nombre: 'huevo', cantidad: 5, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
          { nombre: 'aceite de girasol', cantidad: 150, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: 'aceite de girasol' },
        ],
      },
      {
        nombre: 'Revuelto gramajo casero',
        porciones: 4,
        tiempo_minutos: 25,
        dificultad: 'facil',
        por_que_conviene: 'Un clásico porteño y patagónico rápido con huevos y cebolla.',
        analisis_plato: ['revuelto gramajo: papa, jamon cocido, huevo, arvejas'],
        ingredientes: [
          { nombre: 'papa', cantidad: 600, unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
          { nombre: 'jamon cocido', cantidad: 150, unidad: 'g', categoria: 'fiambreria', es_basico: false, opcional: false, item_despensa_coincidente: null },
          { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
          { nombre: 'arvejas', cantidad: 1, unidad: 'lata', categoria: 'almacen', es_basico: false, opcional: true, item_despensa_coincidente: null },
        ],
      },
    ],
    advertencias: [],
  };
}

function generateMockInterpretPantry(text: string): ChefInterpretPantryResponse {
  const parts = text.split(/,|\by\b|\be\b/i).map((p) => p.trim()).filter(Boolean);
  const items = parts.map((part) => {
    // Extracción regex básica
    const match = part.match(/^(\d+(?:[.,]\d+)?)\s*(kilos?|kg|g|gramos?|litros?|l|ml|unidades?|latas?|paquetes?)?\s*(?:de\s*)?(.*)$/i);

    if (match) {
      const cantidad = parseFloat(match[1].replace(',', '.'));
      let unidad: any = 'unidad';
      const uStr = (match[2] || '').toLowerCase();
      if (uStr.startsWith('k')) unidad = 'kg';
      else if (uStr.startsWith('g')) unidad = 'g';
      else if (uStr.startsWith('l') && !uStr.includes('ata')) unidad = 'l';
      else if (uStr.startsWith('m')) unidad = 'ml';
      else if (uStr.startsWith('lat')) unidad = 'lata';
      else if (uStr.startsWith('paq')) unidad = 'paquete';

      return {
        nombre: (match[3] || part).trim().toLowerCase(),
        cantidad,
        unidad,
        categoria: 'almacen' as const,
      };
    }

    return {
      nombre: part.toLowerCase(),
      cantidad: null,
      unidad: null,
      categoria: 'almacen' as const,
    };
  });

  return {
    modo: 'interpretar_despensa',
    fuera_de_tema: false,
    mensaje: null,
    items,
  };
}

export function generateMockMenuResponse(params: {
  daysConfig: Array<{ dia: string; comidas: MealType[] }>;
  targetProfile: string;
  profileDetail?: string;
  persons?: number;
  mandatoryDishes?: string;
  pantry?: PantryItem[];
}): ChefMenuResponse {
  const p = params.persons || 4;
  const profile = params.targetProfile.toLowerCase();
  const detail = (params.profileDetail || '').toLowerCase();
  const warnings: string[] = [
    'Son sugerencias generales, no reemplazan a un nutricionista o profesional de la salud.',
  ];

  if (
    detail.includes('diabet') ||
    detail.includes('celiac') ||
    detail.includes('embaraz') ||
    detail.includes('renal') ||
    profile.includes('tacc')
  ) {
    warnings.push(
      'Si tenés alguna condición médica específica, te recomendamos validar tu plan alimentario con un médico o nutricionista matriculado.'
    );
  }

  // Plantillas de comidas argentinas adaptadas
  const getMealForType = (
    tipo: MealType,
    dayName: string,
    dayIndex: number
  ): MenuItemMeal => {
    if (tipo === 'desayuno') {
      if (profile.includes('deport') || profile.includes('muscul')) {
        return {
          tipo: 'desayuno',
          nombre: 'Huevos revueltos con tostadas y palta',
          porciones: p,
          tiempo_minutos: 15,
          por_que_encaja: 'Aporte alto de proteínas y grasas saludables para arrancar el día.',
          analisis_plato: ['huevos revueltos: huevo, manteca', 'tostadas: pan, palta'],
          ingredientes: [
            { nombre: 'huevo', cantidad: p * 2, unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
            { nombre: 'pan de molde', cantidad: p * 2, unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
            { nombre: 'palta', cantidad: Math.ceil(p / 2), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
          ],
        };
      } else if (profile.includes('peso')) {
        return {
          tipo: 'desayuno',
          nombre: 'Yogur con avena y manzana rallada',
          porciones: p,
          tiempo_minutos: 10,
          por_que_encaja: 'Fibra saciante con bajo índice glucémico.',
          analisis_plato: ['tazon: yogur natural, avena, manzana'],
          ingredientes: [
            { nombre: 'yogur natural', cantidad: p, unidad: 'unidad', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
            { nombre: 'avena', cantidad: p * 30, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
            { nombre: 'manzana', cantidad: p, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
          ],
        };
      }
      return {
        tipo: 'desayuno',
        nombre: 'Tostadas con queso crema y café con leche',
        porciones: p,
        tiempo_minutos: 10,
        por_que_encaja: 'Desayuno clásico rioplatense, simple y rendidor.',
        analisis_plato: ['tostadas: pan, queso crema', 'cafe con leche: leche, cafe'],
        ingredientes: [
          { nombre: 'pan', cantidad: p * 2, unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
          { nombre: 'queso crema', cantidad: 1, unidad: 'paquete', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
          { nombre: 'leche', cantidad: 1, unidad: 'l', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        ],
      };
    }

    if (tipo === 'merienda') {
      if (profile.includes('nino') || profile.includes('niño')) {
        return {
          tipo: 'merienda',
          nombre: 'Licuado de banana con galletitas caseras',
          porciones: p,
          tiempo_minutos: 15,
          por_que_encaja: 'Energía nutritiva y atractiva para los chicos.',
          analisis_plato: ['licuado: banana, leche', 'galletitas: galletitas de avena'],
          ingredientes: [
            { nombre: 'banana', cantidad: p, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
            { nombre: 'leche', cantidad: 1, unidad: 'l', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
          ],
        };
      }
      return {
        tipo: 'merienda',
        nombre: 'Mate o infusión con tostadas integrales y queso',
        porciones: p,
        tiempo_minutos: 10,
        por_que_encaja: 'Merienda ligera que no interfiere con la cena.',
        analisis_plato: ['infusion: yerba mate', 'tostadas: pan integral, queso'],
        ingredientes: [
          { nombre: 'yerba mate', cantidad: 1, unidad: 'paquete', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
          { nombre: 'pan', cantidad: p * 2, unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
        ],
      };
    }

    if (tipo === 'almuerzo') {
      const lunchDishes = [
        {
          nombre: 'Pechuga de pollo a la plancha con arroz y ensalada',
          analisis: ['pollo: pechuga de pollo, limon', 'guarnicion: arroz, tomate, lechuga'],
          ings: [
            { nombre: 'pechuga de pollo', cantidad: p * 0.25, unidad: 'kg', categoria: 'carniceria' as const },
            { nombre: 'arroz', cantidad: p * 70, unidad: 'g', categoria: 'almacen' as const },
            { nombre: 'tomate', cantidad: p, unidad: 'unidad', categoria: 'verduleria' as const },
            { nombre: 'lechuga', cantidad: 1, unidad: 'unidad', categoria: 'verduleria' as const },
          ],
        },
        {
          nombre: 'Tarta casera de zapallitos y queso',
          analisis: ['tarta: masa de tarta, zapallito, cebolla, huevo, queso cremoso'],
          ings: [
            { nombre: 'masa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'almacen' as const },
            { nombre: 'zapallito', cantidad: p >= 4 ? 6 : 4, unidad: 'unidad', categoria: 'verduleria' as const },
            { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria' as const },
            { nombre: 'huevo', cantidad: 3, unidad: 'unidad', categoria: 'almacen' as const },
            { nombre: 'queso cremoso', cantidad: 250, unidad: 'g', categoria: 'lacteos' as const },
          ],
        },
        {
          nombre: 'Fideos con salsa de tomate y albóndigas magras',
          analisis: ['fideos: fideos secos', 'tuco: salsa de tomate, carne picada, cebolla'],
          ings: [
            { nombre: 'fideos', cantidad: p * 100, unidad: 'g', categoria: 'almacen' as const },
            { nombre: 'salsa de tomate', cantidad: 1, unidad: 'paquete', categoria: 'almacen' as const },
            { nombre: 'carne picada', cantidad: p * 120, unidad: 'g', categoria: 'carniceria' as const },
            { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria' as const },
          ],
        },
      ];

      const choice = lunchDishes[dayIndex % lunchDishes.length];
      return {
        tipo: 'almuerzo',
        nombre: choice.nombre,
        porciones: p,
        tiempo_minutos: 35,
        por_que_encaja: 'Almuerzo balanceado con proteínas y energía equilibrada.',
        analisis_plato: choice.analisis,
        ingredientes: choice.ings.map((it) => ({
          nombre: it.nombre,
          cantidad: it.cantidad,
          unidad: it.unidad as any,
          categoria: it.categoria,
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        })),
      };
    }

    // Cena
    const dinnerDishes = [
      {
        nombre: 'Milanesas al horno con puré de zapallo',
        analisis: ['milanesa: nalga, pan rallado, huevo', 'pure de zapallo: zapallo anco, manteca, leche'],
        ings: [
          { nombre: 'nalga', cantidad: p * 0.25, unidad: 'kg', categoria: 'carniceria' as const },
          { nombre: 'pan rallado', cantidad: 250, unidad: 'g', categoria: 'almacen' as const },
          { nombre: 'huevo', cantidad: 2, unidad: 'unidad', categoria: 'almacen' as const },
          { nombre: 'zapallo anco', cantidad: 1, unidad: 'kg', categoria: 'verduleria' as const },
          { nombre: 'leche', cantidad: 150, unidad: 'ml', categoria: 'lacteos' as const },
          { nombre: 'manteca', cantidad: 50, unidad: 'g', categoria: 'lacteos' as const },
        ],
      },
      {
        nombre: 'Tortilla de verduras con ensalada de tomate y zanahoria',
        analisis: ['tortilla: acelga, zanahoria, cebolla, huevo', 'ensalada: tomate, zanahoria rallada'],
        ings: [
          { nombre: 'acelga', cantidad: 1, unidad: 'atado', categoria: 'verduleria' as const },
          { nombre: 'zanahoria', cantidad: 2, unidad: 'unidad', categoria: 'verduleria' as const },
          { nombre: 'cebolla', cantidad: 1, unidad: 'unidad', categoria: 'verduleria' as const },
          { nombre: 'huevo', cantidad: 4, unidad: 'unidad', categoria: 'almacen' as const },
          { nombre: 'tomate', cantidad: 2, unidad: 'unidad', categoria: 'verduleria' as const },
        ],
      },
      {
        nombre: 'Guiso liviano de lentejas y verduras',
        analisis: ['guiso: lentejas, zanahoria, cebolla, morron, calabaza'],
        ings: [
          { nombre: 'lentejas', cantidad: 400, unidad: 'g', categoria: 'almacen' as const },
          { nombre: 'calabaza', cantidad: 500, unidad: 'g', categoria: 'verduleria' as const },
          { nombre: 'cebolla', cantidad: 2, unidad: 'unidad', categoria: 'verduleria' as const },
          { nombre: 'morron', cantidad: 1, unidad: 'unidad', categoria: 'verduleria' as const },
        ],
      },
    ];

    const choice = dinnerDishes[dayIndex % dinnerDishes.length];
    return {
      tipo: 'cena',
      nombre: choice.nombre,
      porciones: p,
      tiempo_minutos: 40,
      por_que_encaja: 'Cena digestiva, reconfortante y rendidora para la familia.',
      analisis_plato: choice.analisis,
      ingredientes: choice.ings.map((it) => ({
        nombre: it.nombre,
        cantidad: it.cantidad,
        unidad: it.unidad as any,
        categoria: it.categoria,
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: null,
      })),
    };
  };

  const days: MenuDay[] = params.daysConfig.map((dayCfg, idx) => {
    const comidas = dayCfg.comidas.map((tipo) => getMealForType(tipo, dayCfg.dia, idx));
    return {
      dia: dayCfg.dia,
      comidas,
    };
  });

  return {
    modo: 'menu',
    fuera_de_tema: false,
    mensaje: null,
    aclaracion: null,
    dias: days,
    advertencias: warnings,
  };
}
