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
import { filterAbsurdIngredients, validateIngredientsAgainstSteps } from '../lib/culinarySanityCheck';
import { normalizeString } from '../lib/normalizer';

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

        // Sanitización silenciosa de servidor y validación contra pasos de receta
        if (cookData.receta) {
          cookData.ingredientes = filterAbsurdIngredients(
            mealRequest || cookData.receta.nombre,
            cookData.ingredientes
          );
          cookData.ingredientes = validateIngredientsAgainstSteps(
            cookData.receta.pasos,
            cookData.ingredientes
          );
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

        if (suggestData && Array.isArray(suggestData.recetas)) {
          suggestData.recetas = suggestData.recetas.map((r) => {
            const filtered = filterAbsurdIngredients(r.nombre, r.ingredientes);
            const validated = validateIngredientsAgainstSteps(r.pasos || r.receta?.pasos, filtered);
            return { ...r, ingredientes: validated };
          });
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
  const reqLower = normalizeString(mealRequest);

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

  // 1. Pastel de papas con pollo
  if (reqLower.includes('pastel de papa') && reqLower.includes('pollo')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Pastel de papas con pollo casero',
        porciones: persons,
        tiempo_minutos: 55,
        dificultad: 'facil',
        pasos: [
          `1. Lavar, pelar y cortar ${Math.round(persons * 250)} g de papa en cubos parejos.`,
          `2. Hervir las papas en abundante agua con sal durante 20 minutos hasta que estén bien tiernas.`,
          `3. Pisar las papas en caliente agregando ${Math.round(persons * 12.5)} g de manteca y ${Math.round(persons * 25)} ml de leche hasta lograr un puré cremoso y condimentar con sal y nuez moscada.`,
          `4. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla y rehogar en una sartén grande con un chorrito de aceite hasta transparentar.`,
          `5. Cortar ${Math.round(persons * 200)} g de pollo en cubitos chicos o tiras, sumar a la sartén y cocinar 10 minutos dorando bien.`,
          `6. Hervir ${Math.max(2, Math.round(persons * 0.75))} huevo hasta dejarlos duros, picar y mezclar con el pollo y la cebolla.`,
          `7. Aceitar una fuente para horno, volcar todo el relleno de pollo en la base y cubrir de forma pareja con el puré de papas.`,
          `8. Llevar a horno fuerte a 200°C por 20 minutos hasta que el puré esté gratinado y servir bien caliente.`,
        ],
      },
      ingredientes: [
        { nombre: 'pollo', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 12.5), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 25), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 2. Pastel de papas tradicional (carne picada, NUNCA arroz ni fideos)
  if (reqLower.includes('pastel de papa') || reqLower.includes('pastel de papas')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Pastel de papas tradicional argentino',
        porciones: persons,
        tiempo_minutos: 60,
        dificultad: 'facil',
        pasos: [
          `1. Pelar ${Math.round(persons * 250)} g de papa y hervir en agua con sal hasta que estén tiernas.`,
          `2. Pisar las papas en caliente junto con ${Math.round(persons * 12.5)} g de manteca y ${Math.round(persons * 25)} ml de leche tibia hasta que quede un puré sedoso.`,
          `3. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla en cubitos y dorar en una sartén grande.`,
          `4. Agregar ${Math.round(persons * 200)} g de carne picada y cocinar a fuego fuerte rompiendo con cuchara de madera.`,
          `5. Hervir ${Math.max(2, Math.round(persons * 0.75))} huevo durante 10 minutos, pelar, picar e incorporar al relleno de carne picada fuera del fuego.`,
          `6. Colocar el relleno de carne en una fuente profunda para horno y alisar la superficie.`,
          `7. Tapar con el puré de papas marcando líneas con tenedor para dorar mejor.`,
          `8. Gratinar a 200°C en el horno durante 25 minutos hasta que la superficie esté dorada y crocante.`,
        ],
      },
      ingredientes: [
        { nombre: 'carne picada', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 12.5), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 25), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 3. Milanesa con puré de zapallo (FIDELIDAD AL PLATO: Zapallo, NUNCA papa)
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
          '1. Picar 2 dientes de ajo y 1 atado de perejil bien chiquito.',
          `2. Batir ${Math.max(2, Math.round(persons * 0.75))} huevo en un bol junto con el ajo, perejil, sal y pimienta.`,
          `3. Pasar ${Math.round(persons * 200)} g de nalga para milanesas por los huevos batidos impregnando bien la carne.`,
          `4. Empanar los bifes en ${Math.round(persons * 100)} g de pan rallado presionando con la palma para que quede parejo.`,
          `5. Pelar y cortar ${Math.round(persons * 250)} g de zapallo anco en cubos y hervir hasta que esté bien tierno.`,
          `6. Pisar el zapallo caliente con ${Math.round(persons * 15)} g de manteca y ${Math.round(persons * 30)} ml de leche tibia.`,
          '7. Freír las milanesas en sartén con aceite caliente hasta dorar de ambos lados.',
          '8. Servir las milanesas crocantes con el puré de zapallo suave y caliente.',
        ],
      },
      ingredientes: [
        { nombre: 'nalga para milanesas', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan rallado', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zapallo anco', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 15), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 30), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 4. Milanesa napolitana (jamón, muzzarella, salsa; NUNCA arroz)
  if (reqLower.includes('milanesa') && (reqLower.includes('napolitana') || reqLower.includes('napolitano'))) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Milanesas a la napolitana clásicas',
        porciones: persons,
        tiempo_minutos: 45,
        dificultad: 'facil',
        pasos: [
          `1. Batir ${Math.max(2, Math.round(persons * 0.75))} huevo con sal, pimienta y perejil picado.`,
          `2. Pasar ${Math.round(persons * 200)} g de nalga para milanesas por el huevo y rebozar con ${Math.round(persons * 100)} g de pan rallado.`,
          '3. Freír las milanesas en sartén con aceite hasta que apenas tomen color dorado y escurrir.',
          '4. Colocar las milanesas en una asadera amplia para horno.',
          `5. Cubrir cada milanesa con ${Math.round(persons * 50)} ml de salsa de tomate condimentada con orégano.`,
          `6. Colocar encima ${Math.round(persons * 40)} g de jamon cocido en fetas.`,
          `7. Terminar con ${Math.round(persons * 60)} g de muzzarella en rodajas gruesas.`,
          '8. Llevar a horno fuerte a 220°C por 10 minutos hasta derretir y dorar la muzzarella.',
        ],
      },
      ingredientes: [
        { nombre: 'nalga para milanesas', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan rallado', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'jamon cocido', cantidad: Math.round(persons * 40), unidad: 'g', categoria: 'fiambreria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'muzzarella', cantidad: Math.round(persons * 60), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'salsa de tomate', cantidad: Math.round(persons * 50), unidad: 'ml', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 5. Tarta de jamón y queso (NUNCA carne)
  if (reqLower.includes('tarta') && reqLower.includes('jamon') && reqLower.includes('queso')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tarta casera de jamón y queso',
        porciones: persons,
        tiempo_minutos: 40,
        dificultad: 'facil',
        pasos: [
          '1. Aceitar una tartera de 26 cm y forrar con 1 paquete de tapa de tarta.',
          `2. Cortar ${Math.round(persons * 60)} g de jamon cocido en cubitos o tiritas.`,
          `3. Cortar ${Math.round(persons * 60)} g de queso cremoso en dados medianos.`,
          `4. Batir ${Math.max(2, Math.round(persons * 0.75))} huevo en un bol con pimienta y una pizca de orégano.`,
          '5. Mezclar el jamon picado y el queso con los huevos batidos.',
          '6. Volcar todo el relleno sobre la masa en la tartera distribuyendo bien.',
          '7. Hornear a 180°C durante 30 a 35 minutos hasta que la masa esté dorada y el queso gratinado.',
        ],
      },
      ingredientes: [
        { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'jamon cocido', cantidad: Math.round(persons * 60), unidad: 'g', categoria: 'fiambreria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso cremoso', cantidad: Math.round(persons * 60), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 6. Ñoquis de papa (NUNCA arroz)
  if (reqLower.includes('noqui') || reqLower.includes('ñoqui')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Ñoquis de papa caseros de la abuela',
        porciones: persons,
        tiempo_minutos: 50,
        dificultad: 'media',
        pasos: [
          `1. Lavar ${Math.round(persons * 250)} g de papa y hervir con cáscara hasta que estén bien tiernas.`,
          '2. Pelar las papas en caliente y pisar con pisapapas sobre la mesada limpia.',
          `3. Dejar entibiar el puré, hacer una corona y agregar ${Math.max(1, Math.round(persons * 0.25))} huevo y sal.`,
          `4. Incorporar ${Math.round(persons * 75)} g de harina 0000 uniendo con las manos sin amasar de más.`,
          '5. Tomar porciones de masa, estirar cilindros finos y cortar los ñoquis de 2 cm con cuchillo.',
          '6. Pasar cada ñoqui por la ñoquera o el lomo de un tenedor enharinado.',
          '7. Hervir en abundante agua con sal y retirar con espumadera apenas suban a flote.',
        ],
      },
      ingredientes: [
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'harina 0000', cantidad: Math.round(persons * 75), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(1, Math.round(persons * 0.25)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 7. Tarta de zapallitos (NUNCA zapallo anco)
  if (reqLower.includes('zapallito')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tarta de zapallitos jugosa',
        porciones: persons,
        tiempo_minutos: 40,
        dificultad: 'facil',
        pasos: [
          `1. Lavar ${Math.max(3, Math.round(persons * 1))} zapallito y cortar en cubitos parejos.`,
          `2. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla y rehogar en sartén con aceite.`,
          '3. Sumar los zapallitos y saltear a fuego vivo 10 minutos hasta evaporar el líquido.',
          '4. Escurrir muy bien la verdura con colador fino para no humedecer la masa.',
          `5. Batir ${Math.max(2, Math.round(persons * 0.75))} huevo con sal y sumar ${Math.round(persons * 50)} g de queso cremoso en dados.`,
          '6. Forrar una tartera con 1 paquete de tapa de tarta y rellenar con la mezcla.',
          '7. Hornear a 180°C durante 30 minutos hasta dorar la masa.',
        ],
      },
      ingredientes: [
        { nombre: 'zapallito', cantidad: Math.max(3, Math.round(persons * 1)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: 'cebollas' },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: 'huevos de campo' },
        { nombre: 'queso cremoso', cantidad: Math.round(persons * 50), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 8. Pollo al horno con batata (NUNCA papa)
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
        pasos: [
          `1. Limpiar y acomodar ${Math.round(persons * 250)} g de pollo en presas en una asadera grande.`,
          '2. Condimentar el pollo con pimentón, orégano, sal y ajo picado.',
          `3. Pelar ${Math.round(persons * 250)} g de batata y cortar en cuñas medianas.`,
          `4. Acomodar las batatas alrededor del pollo en la asadera y rociar con ${Math.round(persons * 10)} ml de aceite de girasol.`,
          '5. Hornear a 200°C por 30 minutos.',
          '6. Dar vuelta las batatas para que caramelicen parejas.',
          '7. Hornear 20 minutos más hasta que el pollo esté dorado y las batatas tiernas.',
        ],
      },
      ingredientes: [
        { nombre: 'pollo', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'batata', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de girasol', cantidad: Math.round(persons * 10), unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 9. Bondiola braseada con puré de calabaza (plato no catalogado)
  if (reqLower.includes('bondiola') && (reqLower.includes('calabaza') || reqLower.includes('zapallo'))) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Bondiola braseada con puré de calabaza',
        porciones: persons,
        tiempo_minutos: 90,
        dificultad: 'media',
        pasos: [
          `1. Sellar ${Math.round(persons * 200)} g de bondiola en una cacerola con aceite caliente hasta dorar bien.`,
          `2. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla y agregar a la olla junto con la carne.`,
          '3. Cubrir con caldo o agua, tapar y brasear a fuego suave durante 1 hora y media hasta tiernizar.',
          `4. Pelar ${Math.round(persons * 250)} g de zapallo anco y hervir en agua con sal hasta que esté blando.`,
          `5. Pisar el zapallo caliente con ${Math.round(persons * 15)} g de manteca y ${Math.round(persons * 25)} ml de leche tibia.`,
          '6. Desmenuzar la bondiola con su salsa reducida y servir junto con el puré de calabaza.',
        ],
      },
      ingredientes: [
        { nombre: 'bondiola', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'zapallo anco', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 15), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 25), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 10. Tarta de choclo (plato no catalogado)
  if (reqLower.includes('tarta') && reqLower.includes('choclo')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Tarta de choclo cremosa',
        porciones: persons,
        tiempo_minutos: 45,
        dificultad: 'facil',
        pasos: [
          `1. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla y rehogar en una sartén con ${Math.round(persons * 10)} g de manteca.`,
          `2. Incorporar ${Math.round(persons * 100)} g de choclo en granos a la sartén.`,
          `3. Espolvorear ${Math.round(persons * 10)} g de harina 000 y cocinar 1 minuto.`,
          `4. Verter ${Math.round(persons * 50)} ml de leche revolviendo hasta formar una crema espesa.`,
          `5. Dejar entibiar y sumar ${Math.max(2, Math.round(persons * 0.75))} huevo batido y ${Math.round(persons * 50)} g de queso cremoso en cubitos.`,
          '6. Forrar una tartera con 1 paquete de tapa de tarta y volcar el relleno cremoso.',
          '7. Hornear a 180°C durante 30 minutos hasta que la masa esté bien dorada.',
        ],
      },
      ingredientes: [
        { nombre: 'choclo', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 10), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'harina 000', cantidad: Math.round(persons * 10), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 50), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso cremoso', cantidad: Math.round(persons * 50), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 11. Guiso de mondongo (plato no catalogado)
  if (reqLower.includes('guiso') && reqLower.includes('mondongo')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Guiso criollo de mondongo',
        porciones: persons,
        tiempo_minutos: 90,
        dificultad: 'media',
        pasos: [
          `1. Hervir ${Math.round(persons * 200)} g de mondongo limpio en agua con sal por 45 minutos y cortar en tiras finas.`,
          `2. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla y 1 morron en cubos chicos.`,
          `3. Cortar ${Math.max(1, Math.round(persons * 0.25))} chorizo colorado en rodajitas y dorar en una cacerola grande.`,
          '4. Agregar la cebolla y el morrón a la cacerola y saltear hasta que estén tiernos.',
          `5. Incorporar ${Math.round(persons * 100)} g de porotos remojados y ${Math.round(persons * 100)} g de tomate perita picado.`,
          '6. Sumar el mondongo en tiras, cubrir con caldo y cocinar a fuego suave 40 minutos hasta espesar.',
          '7. Servir bien caliente en cazuelas hondas.',
        ],
      },
      ingredientes: [
        { nombre: 'mondongo', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'morron', cantidad: 1, unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'chorizo colorado', cantidad: Math.max(1, Math.round(persons * 0.25)), unidad: 'unidad', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'porotos', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tomate perita', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 12. Milanesas tradicionales (con puré de papas)
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
          `1. Batir ${Math.max(2, Math.round(persons * 0.75))} huevo con sal, pimienta y perejil picado.`,
          `2. Pasar ${Math.round(persons * 200)} g de nalga para milanesas por el huevo batido.`,
          `3. Empanar con ${Math.round(persons * 100)} g de pan rallado presionando con la palma.`,
          `4. Pelar y hervir ${Math.round(persons * 250)} g de papa en agua con sal hasta tiernizar.`,
          `5. Pisar las papas calientes con ${Math.round(persons * 15)} g de manteca y ${Math.round(persons * 50)} ml de leche tibia.`,
          '6. Freír las milanesas en abundante aceite caliente hasta dorar de ambos lados.',
          '7. Servir las milanesas crocantes con el puré caliente.',
        ],
      },
      ingredientes: [
        { nombre: 'nalga para milanesas', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, Math.round(persons * 0.75)), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: isPantryEgg ? 'huevos de campo' : null },
        { nombre: 'pan rallado', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 50), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 15), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 13. Ensalada de papa y huevo
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
        pasos: [
          `1. Lavar, pelar y cortar ${Math.round(persons * 250)} g de papa en cubos parejos.`,
          '2. Hervir las papas en agua con sal hasta que estén tiernas y escurrir.',
          `3. Hervir ${Math.max(2, persons)} huevo durante 10 minutos para dejarlos duros.`,
          '4. Pelar los huevos en agua fría y cortar en trozos medianos.',
          '5. Picar 1 atado de perejil fresco bien chiquito.',
          '6. Unir las papas, huevos y perejil en un bol grande.',
          '7. Condimentar con sal y aceite de girasol y servir fresca.',
        ],
      },
      ingredientes: [
        { nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'perejil', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 14. Tortilla de verduras (NUNCA papa)
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
        pasos: [
          '1. Lavar 2 atados de espinaca y blanquear en agua hirviendo 2 minutos.',
          '2. Escurrir bien presionando para eliminar todo el líquido y picar fino.',
          `3. Picar ${Math.max(1, Math.round(persons * 0.25))} cebolla y rehogar en sartén con aceite.`,
          `4. Batir ${Math.max(3, persons + 1)} huevo con sal y pimienta en un bol.`,
          `5. Mezclar la espinaca, la cebolla y ${Math.round(persons * 50)} g de queso cremoso en cubos con los huevos.`,
          '6. Calentar una sartén con un hilo de aceite y volcar la mezcla.',
          '7. Cocinar 4 minutos, dar vuelta con plato y dorar 3 minutos más.',
        ],
      },
      ingredientes: [
        { nombre: 'espinaca', cantidad: 2, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.25)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(3, persons + 1), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'queso cremoso', cantidad: Math.round(persons * 50), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 15. Fideos con salsa blanca (NUNCA tomate)
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
        pasos: [
          `1. Hervir ${Math.round(persons * 100)} g de fideos en abundante agua con sal hasta que estén al dente.`,
          `2. Derretir ${Math.round(persons * 20)} g de manteca en una cacerola chica.`,
          `3. Agregar ${Math.round(persons * 15)} g de harina 000 y cocinar 1 minuto revolviendo.`,
          `4. Incorporar ${Math.round(persons * 150)} ml de leche tibia poco a poco sin dejar de batir.`,
          '5. Cocinar a fuego bajo hasta espesar la salsa blanca y condimentar con nuez moscada.',
          '6. Escurrir los fideos y mezclar en caliente con la salsa blanca.',
          `7. Espolvorear con ${Math.round(persons * 20)} g de queso rallado y servir inmediatamente.`,
        ],
      },
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

  // 16. Ensalada de lentejas (NUNCA lechuga)
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
        pasos: [
          `1. Escurrir ${Math.round(persons * 100)} g de lentejas cocidas y volcar en una ensaladera.`,
          `2. Lavar y picar ${Math.max(2, persons)} tomate perita en cubos chicos.`,
          `3. Picar ${Math.max(1, Math.round(persons * 0.25))} cebolla en brunoise fina.`,
          `4. Hervir ${Math.max(2, persons)} huevo duro durante 10 minutos y cortar en cuartos.`,
          '5. Unir las lentejas con el tomate, la cebolla y los huevos en la ensaladera.',
          `6. Condimentar con ${Math.round(persons * 10)} ml de aceite de oliva, sal y vinagre.`,
          '7. Mezclar con cuidado para no romper los huevos y servir fresca.',
        ],
      },
      ingredientes: [
        { nombre: 'lentejas', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'tomate perita', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.25)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'huevo', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'aceite de oliva', cantidad: Math.round(persons * 10), unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 17b. Sopa de calabaza (NUNCA papa)
  if (reqLower.includes('sopa') && (reqLower.includes('calabaza') || reqLower.includes('zapallo'))) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Sopa crema de calabaza casera',
        porciones: persons,
        tiempo_minutos: 35,
        dificultad: 'facil',
        pasos: [
          `1. Pelar y cortar ${Math.round(persons * 250)} g de calabaza en cubos parejos.`,
          `2. Picar ${Math.max(1, Math.round(persons * 0.5))} cebolla y dorar en cacerola con ${Math.round(persons * 10)} g de manteca.`,
          '3. Sumar la calabaza y cubrir con caldo de verduras hirviendo.',
          '4. Cocinar a fuego medio durante 20 minutos hasta que la calabaza esté muy tierna.',
          `5. Agregar ${Math.round(persons * 30)} ml de leche o crema de leche y salpimentar.`,
          '6. Procesar con mixer o licuadora hasta lograr una textura aterciopelada y cremosa.',
          '7. Servir caliente con un chorrito de aceite de oliva.',
        ],
      },
      ingredientes: [
        { nombre: 'calabaza', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'manteca', cantidad: Math.round(persons * 10), unidad: 'g', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'leche', cantidad: Math.round(persons * 30), unidad: 'ml', categoria: 'lacteos', es_basico: false, opcional: false, item_despensa_coincidente: null },
      ],
      advertencias: [],
    };
  }

  // 17. Asado
  if (reqLower.includes('asado') || reqLower.includes('parrilla')) {
    return {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      receta: {
        nombre: 'Asado tradicional argentino',
        porciones: persons,
        tiempo_minutos: 90,
        dificultad: 'media',
        pasos: [
          `1. Encender el fuego usando ${Math.max(1, Math.round(persons / 4))} paquete de carbon o leña seca hasta lograr brasas moderadas.`,
          '2. Limpiar bien la parrilla caliente.',
          `3. Colocar ${Math.round(persons * 400)} g de tira de asado y ${Math.round(persons * 200)} g de vacio con sal gruesa a fuego parejo.`,
          `4. Sumar ${Math.max(2, persons)} chorizo en la parte media de la parrilla.`,
          '5. Cocinar 50 minutos del lado del hueso sin apurar el fuego.',
          '6. Dar vuelta la carne y asar 30 minutos más hasta que esté dorada y jugosa.',
          `7. Servir los chorizos y los cortes de carne caliente acompañados de ${Math.max(2, persons)} unidad de pan fresco.`,
        ],
      },
      ingredientes: [
        { nombre: 'tira de asado', cantidad: Math.round(persons * 400), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'vacio', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'chorizo', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null },
        { nombre: 'pan', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'panaderia', es_basico: false, opcional: false, item_despensa_coincidente: null },
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
        pasos: [
          '1. Calentar una sartén o wok grande con un chorrito de aceite.',
          '2. Picar 2 cebollas bien finitas y saltear hasta transparentar.',
          '3. Incorporar 320 g de arroz cocido y saltear a fuego fuerte por 3 minutos.',
          '4. Hacer un hueco en el centro, cascar 4 huevos y revolver hasta que cuajen bien.',
          '5. Opcionalmente rociar con 30 ml de salsa de soja, mezclar todo y servir caliente.',
        ],
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
        pasos: [
          '1. Pelar 800 g de papa y cortar en rodajas finas o dados parejos.',
          '2. Picar 2 cebollas en juliana y dorar suavemente en sartén con un chorrito de aceite.',
          '3. Freír las papas en 150 ml de aceite de girasol hasta que estén tiernas y doradas.',
          '4. Batir 5 huevos en un bol grande con sal.',
          '5. Escurrir las papas y mezclar calientes con la cebolla y los huevos batidos.',
          '6. Volcar en la sartén caliente y cocinar 4 minutos por lado hasta que cuaje.',
        ],
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
        pasos: [
          '1. Pelar 600 g de papa y cortar en papas pay bien finitas.',
          '2. Freír las papas pay en aceite bien caliente hasta dejarlas crocantes y reservar.',
          '3. Cortar 150 g de jamon cocido en juliana fina y dorar un minuto en sartén.',
          '4. Batir 4 huevos con una pizca de sal y pimienta.',
          '5. Sumar las papas fritas y los huevos a la sartén revolviendo suave para que el huevo quede cremoso y babé.',
          '6. Incorporar 1 lata de arvejas escurridas y servir de inmediato.',
        ],
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
