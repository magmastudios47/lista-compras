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
  PlanificarSemanaMeal,
  ChefPlanificarSemanaResponse,
  DayMealDetail,
  ChefDetalleDiaMenuResponse,
  ChefIngredient,
} from '../types';
import { useHousehold } from '../context/HouseholdContext';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { calculatePantryDiscounts, mergeDuplicateIngredients } from '../lib/discountEngine';
import { processHandwrittenText } from '../lib/textPipeline';
import { filterAbsurdIngredients, validateIngredientsAgainstSteps } from '../lib/culinarySanityCheck';
import { normalizeString } from '../lib/normalizer';
import { validateWeeklyPlanVariety } from '../lib/weeklyMenuValidator';

export const isAiDemoMode =
  typeof import.meta !== 'undefined' &&
  Boolean(import.meta.env?.VITE_AI_DEMO_MODE === 'true');

export function formatFriendlyAiError(err: any): string {
  if (!err) return 'Error al comunicarse con el Chef IA. No se descontaron créditos.';
  const msg = typeof err === 'string' ? err : err.message || err.error || JSON.stringify(err);
  const lower = String(msg).toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('muy ocupado')) {
    return 'El Chef está recibiendo muchas consultas en este momento. Por favor probá de nuevo en un minuto. (No se descontaron créditos)';
  }
  if (lower.includes('quota') || lower.includes('límite mensual') || lower.includes('cuota') || lower.includes('credito') || lower.includes('crédito')) {
    return 'Alcanzaste el límite de consultas de tu plan. No se descontaron créditos adicionales.';
  }
  if (lower.includes('premium')) {
    return 'Esta función requiere el plan Premium de tu hogar.';
  }
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('alta demanda')) {
    return 'El servicio de IA tiene alta demanda momentánea. Por favor reintentá en unos instantes. (Sin descuento de créditos)';
  }
  if (lower.includes('500') || lower.includes('internal server')) {
    return 'Error en el servidor del Chef IA. Por favor reintentá en unos momentos. (No se descontaron créditos)';
  }
  if (lower.includes('timeout') || lower.includes('network') || lower.includes('conexión') || lower.includes('fetch')) {
    return 'Problema de conexión con el Chef IA. Revisá tu conexión a internet o intentá nuevamente.';
  }
  return msg;
}

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
              cookData.origen = cookData.origen || 'ia';
              incrementChefUsage();
            } else {
              if (!isAiDemoMode) {
                throw new Error(formatFriendlyAiError(fnError || 'Respuesta inválida del Chef IA.'));
              }
              // Modo demo explícito: nunca descuenta créditos
              cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
              cookData.origen = 'demo';
            }
          } catch (fnCallErr) {
            if (!isAiDemoMode) {
              throw fnCallErr;
            }
            cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
            cookData.origen = 'demo';
          }
        } else {
          if (!isAiDemoMode) {
            throw new Error(
              !household
                ? 'Debés seleccionar o unirte a un hogar para consultar al Chef.'
                : 'La conexión con el Chef IA no está configurada.'
            );
          }
          cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
          cookData.origen = 'demo';
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
        const msg = formatFriendlyAiError(err);
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
              suggestData.origen = suggestData.origen || 'ia';
              incrementChefUsage();
            } else {
              if (!isAiDemoMode) {
                throw new Error(formatFriendlyAiError(fnError || 'Respuesta inválida del Chef IA.'));
              }
              suggestData = generateMockSuggestResponse(pantry, freeText);
              suggestData.origen = 'demo';
            }
          } catch (fnErr) {
            if (!isAiDemoMode) {
              throw fnErr;
            }
            suggestData = generateMockSuggestResponse(pantry, freeText);
            suggestData.origen = 'demo';
          }
        } else {
          if (!isAiDemoMode) {
            throw new Error(
              !household
                ? 'Debés seleccionar o unirte a un hogar para consultar al Chef.'
                : 'La conexión con el Chef IA no está configurada.'
            );
          }
          suggestData = generateMockSuggestResponse(pantry, freeText);
          suggestData.origen = 'demo';
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
        const msg = formatFriendlyAiError(err);
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

  // Modo Menú Semanal (Flujo en dos pasos: Paso A planificar_semana + Paso B detalle_dia_menu)
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
            // PASO A: Planificar Semana (UNA sola llamada devuelve el plan de todas las comidas sin ingredientes)
            const { data: stepAData, error: stepAError } = await supabase.functions.invoke('chef-ai', {
              body: {
                modo: 'planificar_semana',
                dias_config: params.daysConfig,
                objetivo_perfil: params.targetProfile,
                objetivo_detalle: params.profileDetail,
                personas: p,
                platos_obligatorios: params.mandatoryDishes,
                household_id: household.id,
              },
            });

            if (!stepAError && stepAData && Array.isArray(stepAData.comidas)) {
              // Descuenta 3 consultas para el menú semanal completo una sola vez
              incrementChefUsage();
              incrementChefUsage();
              incrementChefUsage();

              const planComidas: PlanificarSemanaMeal[] = stepAData.comidas;

              // PASO B: Detalle de ingredientes con UNA llamada por día (hasta 7 días activos)
              const activeDays = params.daysConfig.filter((d) => d.comidas.length > 0);
              const builtDays: MenuDay[] = [];

              for (const dayCfg of activeDays) {
                const dayMeals = planComidas.filter(
                  (m) => normalizeString(m.dia) === normalizeString(dayCfg.dia)
                );

                try {
                  const { data: dayDetailData, error: dayDetailError } = await supabase.functions.invoke('chef-ai', {
                    body: {
                      modo: 'detalle_dia_menu',
                      dia: dayCfg.dia,
                      comidas: dayMeals.map((m) => ({
                        tipo: m.tipo,
                        plato: m.plato,
                        bebida: m.bebida,
                      })),
                      personas: p,
                      household_id: household.id,
                    },
                  });

                  if (!dayDetailError && dayDetailData && Array.isArray(dayDetailData.comidas)) {
                    builtDays.push({
                      dia: dayCfg.dia,
                      comidas: dayDetailData.comidas.map((c: any) => ({
                        tipo: c.tipo,
                        nombre: c.plato,
                        bebida: c.bebida || null,
                        porciones: p,
                        por_que_encaja: dayMeals.find((m) => m.tipo === c.tipo)?.por_que_encaja,
                        pasos: c.pasos || [],
                        ingredientes: c.ingredientes || [],
                      })),
                    });
                  } else {
                    if (!isAiDemoMode) {
                      throw new Error(formatFriendlyAiError(dayDetailError || `Error al obtener detalles para ${dayCfg.dia}.`));
                    }
                    const localDay = generateMockDayMealDetail(dayCfg.dia, dayMeals, p, params.pantry);
                    localDay.comidas.forEach((c) => { (c as any).origen = 'demo'; });
                    builtDays.push(localDay);
                  }
                } catch (dayErr) {
                  if (!isAiDemoMode) {
                    throw dayErr;
                  }
                  const localDay = generateMockDayMealDetail(dayCfg.dia, dayMeals, p, params.pantry);
                  builtDays.push(localDay);
                }

                // Pausa breve de 200ms para cuidar el rate limit
                await new Promise((r) => setTimeout(r, 200));
              }

              menuData = {
                modo: 'menu',
                fuera_de_tema: false,
                mensaje: null,
                aclaracion: null,
                origen: stepAData.origen || 'ia',
                dias: builtDays,
                advertencias: stepAData.advertencias || [],
              };
            } else {
              if (!isAiDemoMode) {
                throw new Error(formatFriendlyAiError(stepAError || 'Error al planificar el menú semanal.'));
              }
              menuData = generateMockMenuResponse(params);
              menuData.origen = 'demo';
            }
          } catch (fnErr) {
            if (!isAiDemoMode) {
              throw fnErr;
            }
            menuData = generateMockMenuResponse(params);
            menuData.origen = 'demo';
          }
        } else {
          if (!isAiDemoMode) {
            throw new Error(
              !household
                ? 'Debés seleccionar o unirte a un hogar para consultar al Chef.'
                : 'La conexión con el Chef IA no está configurada.'
            );
          }
          menuData = generateMockMenuResponse(params);
          menuData.origen = 'demo';
        }

        // Eliminar duplicados del aviso fijo de salud en advertencias
        if (menuData.advertencias) {
          menuData.advertencias = menuData.advertencias.filter((adv) => {
            const norm = normalizeString(adv);
            return (
              !norm.includes('nutricionista') &&
              !norm.includes('sugerencias generales') &&
              !norm.includes('profesional de la salud')
            );
          });
        }

        // Unificar ingredientes de todas las comidas del menú y descontar contra la despensa
        const allIngredients = menuData.dias.flatMap((d) => d.comidas.flatMap((c) => c.ingredientes));
        const merged = mergeDuplicateIngredients(allIngredients);
        const comparisons = calculatePantryDiscounts(merged, params.pantry);

        return { response: menuData, comparisons };
      } catch (err: any) {
        const msg = formatFriendlyAiError(err);
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
    isAiDemoMode,
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

  // Plato dinámico coherente con el pedido (nunca arroz/tomate perita a ciegas)
  const dynamicIngredients: ChefIngredient[] = [];
  const dynamicSteps: string[] = [];

  const hasPapa = /\b(papas?|patatas?)\b/.test(reqLower);
  const hasAcelga = /\bacelgas?\b/.test(reqLower);
  const hasHuevo = /\b(huevos?|tortilla|revuelto|omelette)\b/.test(reqLower);
  const hasPollo = /\b(pollo|suprema|pechuga)\b/.test(reqLower);
  const hasCarne = /\b(carne|nalga|peceto|cuadril|milanesa)\b/.test(reqLower);
  const hasZapallo = /\b(zapallo|calabaza|anco)\b/.test(reqLower);
  const hasZapallito = /\bzapallitos?\b/.test(reqLower);
  const hasRemolacha = /\bremolachas?\b/.test(reqLower);
  const hasBatata = /\bbatatas?\b/.test(reqLower);
  const hasFideos = /\b(fideos?|tallarines|pasta)\b/.test(reqLower);
  const hasPesto = /\bpesto\b/.test(reqLower);
  const hasArroz = /\barroz\b/.test(reqLower);

  if (hasPapa) {
    dynamicIngredients.push({ nombre: 'papa', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`1. Pelar y cortar ${Math.round(persons * 250)} g de papa en cubos o rodajas finas.`);
  }
  if (hasAcelga) {
    dynamicIngredients.push({ nombre: 'acelga', cantidad: Math.max(1, Math.round(persons / 2)), unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`2. Lavar, blanquear 2 minutos y escurrir ${Math.max(1, Math.round(persons / 2))} atado de acelga picada.`);
  }
  if (hasZapallo) {
    dynamicIngredients.push({ nombre: 'zapallo anco', cantidad: Math.round(persons * 250), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Hervir ${Math.round(persons * 250)} g de zapallo anco hasta que esté tierno.`);
  }
  if (hasZapallito) {
    dynamicIngredients.push({ nombre: 'zapallito', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Cortar ${Math.max(2, persons)} zapallito en cubos medianos.`);
  }
  if (hasRemolacha) {
    dynamicIngredients.push({ nombre: 'remolacha', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Cocinar ${Math.max(2, persons)} remolacha en agua hirviendo y pelar.`);
  }
  if (hasBatata) {
    dynamicIngredients.push({ nombre: 'batata', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Cortar ${Math.round(persons * 200)} g de batata en bastones o rodajas.`);
  }
  if (hasPollo) {
    dynamicIngredients.push({ nombre: 'pechuga de pollo', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Cocinar ${Math.round(persons * 200)} g de pechuga de pollo dorando de ambos lados.`);
  }
  if (hasCarne) {
    dynamicIngredients.push({ nombre: 'carne vacuna', cantidad: Math.round(persons * 200), unidad: 'g', categoria: 'carniceria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Cocinar ${Math.round(persons * 200)} g de carne vacuna.`);
  }
  if (hasFideos) {
    dynamicIngredients.push({ nombre: 'fideos', cantidad: Math.round(persons * 100), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Hervir ${Math.round(persons * 100)} g de fideos al dente.`);
  }
  if (hasPesto) {
    dynamicIngredients.push({ nombre: 'albahaca', cantidad: 1, unidad: 'atado', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicIngredients.push({ nombre: 'nuez', cantidad: 50, unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Procesar 1 atado de albahaca fresca con 50 g de nuez, ajo y aceite.`);
  }
  if (hasArroz) {
    dynamicIngredients.push({ nombre: 'arroz', cantidad: Math.round(persons * 80), unidad: 'g', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Cocinar ${Math.round(persons * 80)} g de arroz en agua o caldo caliente.`);
  }
  if (hasHuevo || dynamicIngredients.length === 0) {
    dynamicIngredients.push({ nombre: 'huevo', cantidad: Math.max(2, persons), unidad: 'unidad', categoria: 'almacen', es_basico: false, opcional: false, item_despensa_coincidente: null });
    dynamicSteps.push(`Batir ${Math.max(2, persons)} huevo con sal y pimienta e integrar.`);
  }

  // Cebolla y aceite de base
  dynamicIngredients.push({ nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', categoria: 'verduleria', es_basico: false, opcional: false, item_despensa_coincidente: null });
  dynamicIngredients.push({ nombre: 'aceite de girasol', cantidad: 50, unidad: 'ml', categoria: 'almacen', es_basico: true, opcional: false, item_despensa_coincidente: null });
  dynamicSteps.push('Saltear 1 cebolla en 50 ml de aceite de girasol, amalgamar los ingredientes y cocinar a fuego medio hasta dorar.');

  return {
    modo: 'cocinar',
    fuera_de_tema: false,
    mensaje: null,
    aclaracion: null,
    origen: 'demo',
    receta: {
      nombre: mealRequest.charAt(0).toUpperCase() + mealRequest.slice(1),
      porciones: persons,
      tiempo_minutos: 35,
      dificultad: 'facil',
      pasos: dynamicSteps,
    },
    ingredientes: dynamicIngredients,
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

// ========================================================================
// GENERADORES DEL MENÚ SEMANAL (RONDA 4: FLUJO EN DOS PASOS)
// ========================================================================

/**
 * PASO A: Genera el plan semanal completo (solo platos y bebidas, sin ingredientes)
 */
export function generateMockPlanificarSemana(params: {
  daysConfig: Array<{ dia: string; comidas: MealType[] }>;
  targetProfile: string;
  profileDetail?: string;
  persons?: number;
  mandatoryDishes?: string;
}): ChefPlanificarSemanaResponse {
  const profile = params.targetProfile.toLowerCase();
  const detail = (params.profileDetail || '').toLowerCase();
  const warnings: string[] = [];

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

  // 7 Almuerzos distintos rotando proteínas (máx 2 días seguidos con la misma proteína)
  const weeklyLunches = [
    {
      plato: 'Pechuga de pollo grillada con arroz y ensalada de espinaca',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Proteína magra de alto valor biológico y carbohidratos complejos para recuperación muscular.'
        : 'Almuerzo liviano, saciante y nutritivo para mantener la energía de la tarde.',
    },
    {
      plato: 'Milanesas de nalga al horno con puré de zapallo anco',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Aporte potente de hierro y aminoácidos con puré liviano libre de frituras.'
        : 'Clásico familiar argentino preparado al horno para reducir grasas.',
    },
    {
      plato: 'Filet de merluza al limón con papas al vapor y perejil',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Pescado blanco de fácil digestión con carbohidratos limpios antes de la actividad.'
        : 'Aporte de fósforo y omega-3 con cocción suave y ligera.',
    },
    {
      plato: 'Guiso casero de lentejas con verduras y calabaza',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Proteínas vegetales y hierro no hemo con excelente aporte de fibra prebiótica.'
        : 'Plato de cuchara tradicional, reconfortante y económico para el hogar.',
    },
    {
      plato: 'Tarta de zapallitos jugosa y queso cremoso',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Comida vegetariana ligera que no genera pesadez digestiva en la tarde.'
        : 'Aprovecha verduras frescas de estación con masa crocante al horno.',
    },
    {
      plato: 'Fideos cinta con salsa de tomate y albóndigas magras',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Carga energética de glucógeno y proteínas sabrosas para el entrenamiento.'
        : 'Almuerzo rendidor de fin de semana que le gusta a toda la familia.',
    },
    {
      plato: 'Asado tradicional de tira y vacío con ensalada mixta',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Proteínas completas y grasas naturales en el asado de domingo.'
        : 'El almuerzo insignia de los domingos argentinos compartido en familia.',
    },
  ];

  // 7 Cenas distintas rotando proteínas
  const weeklyDinners = [
    {
      plato: 'Omelette de espinaca, cebolla y queso con ensalada de tomate',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Cena rápida alta en proteína de huevo y verduras frescas de fácil asimilación nocturna.'
        : 'Cena digestiva, liviana y lista en 15 minutos.',
    },
    {
      plato: 'Pastel de papas tradicional al horno con ensalada verde',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Reparación muscular nocturna con carne picada magra y puré casero.'
        : 'Plato reconfortante clásico argentino con carne y puré gratinado.',
    },
    {
      plato: 'Cazuela de pollo y calabaza con cebolla de verdeo',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Proteína blanca con betacarotenos de la calabaza sin grasas pesadas.'
        : 'Guisado suave y aromático para disfrutar caliente.',
    },
    {
      plato: 'Trucha patagónica a la plancha con puré de calabaza',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Ácidos grasos esenciales y proteína de alta calidad propia de la región andina.'
        : 'Pescado fresco patagónico cocinado a la plancha con guarnición suave.',
    },
    {
      plato: 'Pizza casera a la piedra de muzzarella con fainá',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Carbohidratos y proteínas lácteas de disfrute controlado el viernes a la noche.'
        : 'Cena relajada de viernes hecha en casa con masa crocante.',
    },
    {
      plato: 'Bondiola de cerdo braseada con batatas asadas',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Carne porcina sabrosa cocida a fuego lento con carbohidratos de la batata.'
        : 'Corte jugoso y tierno al horno ideal para el sábado a la noche.',
    },
    {
      plato: 'Sopa crema de calabaza con croutons y queso rallado',
      bebida: null,
      por_que_encaja: profile.includes('deport')
        ? 'Hidratación y micronutrientes para cerrar la semana sin sobrecargar el estómago.'
        : 'Cena reconfortante y depurativa para arrancar la semana livianos.',
    },
  ];

  // 7 Desayunos rotando >= 4 bases (avena, tostadas, yogur, panqueques, huevo) y con bebida
  const weeklyBreakfasts = [
    {
      plato: 'Avena cocida con banana y nueces',
      bebida: 'Café con leche',
      por_que_encaja: 'Carbohidratos de absorción lenta y algo de proteína para rendir en el entrenamiento de la mañana.',
    },
    {
      plato: 'Tostadas con palta y huevo revuelto',
      bebida: 'Jugo de naranja exprimido',
      por_que_encaja: 'Grasas saludables monoinsaturadas y proteína completa para máxima saciedad matutina.',
    },
    {
      plato: 'Yogur natural con granola y manzana rallada',
      bebida: 'Té verde con limón',
      por_que_encaja: 'Aporte de probióticos y fibra soluble que favorece la digestión antes de entrenar.',
    },
    {
      plato: 'Panqueques de avena y manzana con miel',
      bebida: 'Café con leche',
      por_que_encaja: 'Energía limpia sin harinas refinadas para afrontar la actividad del día.',
    },
    {
      plato: 'Huevos revueltos con tostadas de masa madre',
      bebida: 'Té negro con limón',
      por_que_encaja: 'Aporte proteico denso para mantener los niveles de energía estables.',
    },
    {
      plato: 'Tostadas doradas con queso crema y miel',
      bebida: 'Café cortado',
      por_que_encaja: 'Desayuno rápido y clásico de fin de semana con energía inmediata.',
    },
    {
      plato: 'Panqueques caseros con dulce de leche',
      bebida: 'Submarino caliente',
      por_que_encaja: 'Desayuno tradicional de domingo para disfrutar en familia con un toque dulce.',
    },
  ];

  // 7 Meriendas rotando bases y con bebida
  const weeklySnacks = [
    {
      plato: 'Tostadas de pan integral con queso untable',
      bebida: 'Mate cocido con leche',
      por_que_encaja: 'Merienda liviana que aporta calcio y carbohidratos complejos antes del entreno vespertino.',
    },
    {
      plato: 'Licuado de banana con avena y galletitas de agua',
      bebida: 'Licuado de banana con leche',
      por_que_encaja: 'Recuperación de glucógeno y potasio post-entrenamiento de la tarde.',
    },
    {
      plato: 'Yogur bebible con frutos secos',
      bebida: 'Yogur para tomar',
      por_que_encaja: 'Colación práctica y fresca con proteínas lácteas y grasas saludables.',
    },
    {
      plato: 'Tostadas de masa madre con queso y dulce de membrillo',
      bebida: 'Café con leche',
      por_que_encaja: 'Energía reconfortante a media tarde sin recurrir a ultraprocesados.',
    },
    {
      plato: 'Licuado de frutas de estación con galletitas de avena',
      bebida: 'Licuado de frutas',
      por_que_encaja: 'Aporte de antioxidantes y vitaminas naturales para cerrar la tarde activa.',
    },
    {
      plato: 'Mate cebado con tostadas o tortas fritas',
      bebida: 'Mate tradicional con yerba',
      por_que_encaja: 'Costumbre argentina tradicional y reconfortante para la tarde del sábado.',
    },
    {
      plato: 'Taza de chocolatada con galletitas caseras',
      bebida: 'Chocolatada caliente',
      por_que_encaja: 'Merienda clásica de domingo que le gusta a grandes y chicos.',
    },
  ];

  const daysOrder = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const allMeals: PlanificarSemanaMeal[] = [];

  params.daysConfig.forEach((dayCfg) => {
    const dayNorm = normalizeString(dayCfg.dia);
    let dayIdx = daysOrder.indexOf(dayNorm);
    if (dayIdx < 0) dayIdx = 0;

    dayCfg.comidas.forEach((tipo) => {
      let mealInfo: { plato: string; bebida: string | null; por_que_encaja: string };

      if (tipo === 'desayuno') {
        mealInfo = weeklyBreakfasts[dayIdx % weeklyBreakfasts.length];
      } else if (tipo === 'almuerzo') {
        mealInfo = weeklyLunches[dayIdx % weeklyLunches.length];
      } else if (tipo === 'merienda') {
        mealInfo = weeklySnacks[dayIdx % weeklySnacks.length];
      } else {
        mealInfo = weeklyDinners[dayIdx % weeklyDinners.length];
      }

      allMeals.push({
        dia: dayCfg.dia,
        tipo,
        plato: mealInfo.plato,
        bebida: mealInfo.bebida,
        por_que_encaja: mealInfo.por_que_encaja,
      });
    });
  });

  return {
    modo: 'planificar_semana',
    fuera_de_tema: false,
    mensaje: null,
    aclaracion: null,
    comidas: allMeals,
    advertencias: warnings,
  };
}

/**
 * PASO B: Genera el detalle de recetas resumidas (3-6 pasos) e ingredientes para un día dado
 */
export function generateMockDayMealDetail(
  dia: string,
  dayMeals: PlanificarSemanaMeal[],
  persons: number,
  pantry: PantryItem[] = []
): MenuDay {
  const p = persons || 4;

  const builtMeals: MenuItemMeal[] = dayMeals.map((meal) => {
    const platoNorm = normalizeString(meal.plato);
    const steps: string[] = [];
    const ings: Array<{ nombre: string; cantidad: number; unidad: any; categoria: any; es_basico?: boolean }> = [];

    // Desayunos
    if (meal.tipo === 'desayuno') {
      if (platoNorm.includes('avena')) {
        steps.push(
          `1. Calentar ${Math.round(p * 200)} ml de leche en una ollita chica a fuego medio.`,
          `2. Agregar ${Math.round(p * 40)} g de avena en copos y cocinar revolviendo 3 minutos hasta espesar.`,
          `3. Cortar ${p} banana en rodajas y picar ${Math.round(p * 20)} g de nueces.`,
          '4. Servir la avena en un bol decorando con la banana y las nueces.',
          '5. Preparar el café con leche caliente para acompañar.'
        );
        ings.push(
          { nombre: 'avena', cantidad: Math.round(p * 40), unidad: 'g', categoria: 'almacen' },
          { nombre: 'leche', cantidad: Math.max(1, Math.round(p * 0.25)), unidad: 'l', categoria: 'lacteos' },
          { nombre: 'banana', cantidad: p, unidad: 'unidad', categoria: 'verduleria' },
          { nombre: 'nueces', cantidad: Math.round(p * 20), unidad: 'g', categoria: 'almacen' }
        );
      } else if (platoNorm.includes('panqueque')) {
        steps.push(
          `1. Licuar ${Math.max(2, p)} huevo con ${Math.round(p * 50)} g de avena o harina y 1 manzana rallada.`,
          '2. Calentar una sartén antiadherente con una gotita de aceite.',
          '3. Volcar porciones de masa y dorar 2 minutos por lado.',
          '4. Servir los panqueques tibios rociados con miel o dulce de leche.',
          '5. Acompañar con la bebida caliente.'
        );
        ings.push(
          { nombre: 'huevo', cantidad: Math.max(2, p), unidad: 'unidad', categoria: 'almacen' },
          { nombre: 'avena', cantidad: Math.round(p * 50), unidad: 'g', categoria: 'almacen' },
          { nombre: 'manzana', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'unidad', categoria: 'verduleria' }
        );
      } else if (platoNorm.includes('yogur')) {
        steps.push(
          `1. Servir ${p} unidad de yogur natural en compoteras individuales.`,
          `2. Lavar y rallar ${p} manzana fresca.`,
          `3. Incorporar ${Math.round(p * 30)} g de granola crocante sobre el yogur.`,
          '4. Mezclar suavemente y servir fresco junto con la infusión caliente.'
        );
        ings.push(
          { nombre: 'yogur natural', cantidad: p, unidad: 'unidad', categoria: 'lacteos' },
          { nombre: 'granola', cantidad: Math.round(p * 30), unidad: 'g', categoria: 'almacen' },
          { nombre: 'manzana', cantidad: p, unidad: 'unidad', categoria: 'verduleria' }
        );
      } else {
        // Tostadas / Huevo revuelto
        steps.push(
          `1. Batir ${Math.max(2, p * 2)} huevo con una pizca de sal.`,
          '2. Cocinar los huevos en sartén a fuego bajo revolviendo hasta que queden cremosos.',
          `3. Tostar ${Math.max(2, p * 2)} rodajas de pan.`,
          `4. Pisar ${Math.max(1, Math.round(p * 0.5))} palta con gotas de limón y untar el pan tostado.`,
          '5. Colocar los huevos revueltos sobre las tostadas y servir caliente con el jugo o café.'
        );
        ings.push(
          { nombre: 'huevo', cantidad: Math.max(2, p * 2), unidad: 'unidad', categoria: 'almacen' },
          { nombre: 'pan', cantidad: Math.max(2, p * 2), unidad: 'unidad', categoria: 'panaderia' },
          { nombre: 'palta', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'unidad', categoria: 'verduleria' }
        );
      }
    } else if (meal.tipo === 'merienda') {
      if (platoNorm.includes('licuado')) {
        steps.push(
          `1. Pelar ${p} banana fresca.`,
          `2. Colocar en licuadora junto con ${Math.max(1, Math.round(p * 0.25))} l de leche y ${Math.round(p * 20)} g de avena.`,
          '3. Licuar a velocidad máxima por 1 minuto hasta lograr textura espumosa.',
          `4. Servir el licuado bien frío acompañado de ${Math.round(p * 4)} galletitas de agua.`
        );
        ings.push(
          { nombre: 'banana', cantidad: p, unidad: 'unidad', categoria: 'verduleria' },
          { nombre: 'leche', cantidad: Math.max(1, Math.round(p * 0.25)), unidad: 'l', categoria: 'lacteos' },
          { nombre: 'galletitas', cantidad: 1, unidad: 'paquete', categoria: 'almacen' }
        );
      } else {
        steps.push(
          `1. Cortar ${Math.max(2, p * 2)} rebanadas de pan integral.`,
          '2. Tostar en tostadora o plancha hasta dorar de ambos lados.',
          '3. Untar con queso untable o queso crema.',
          '4. Cebar el mate cocido o infusión caliente para disfrutar la tarde.'
        );
        ings.push(
          { nombre: 'pan', cantidad: Math.max(2, p * 2), unidad: 'unidad', categoria: 'panaderia' },
          { nombre: 'queso untable', cantidad: 1, unidad: 'paquete', categoria: 'lacteos' }
        );
      }
    } else if (meal.tipo === 'almuerzo') {
      if (platoNorm.includes('pollo')) {
        steps.push(
          `1. Limpiar y condimentar ${Math.round(p * 200)} g de pechuga de pollo con limón y sal.`,
          `2. Cocinar ${Math.round(p * 70)} g de arroz en agua hirviendo con sal durante 15 minutos.`,
          '3. Calentar una plancha a fuego fuerte y dorar las pechugas de pollo 5 minutos por lado.',
          `4. Lavar ${Math.max(1, Math.round(p * 0.5))} atado de espinaca y armar ensalada fresca.`,
          '5. Servir el pollo jugoso acompañado del arroz y la ensalada verde.'
        );
        ings.push(
          { nombre: 'pechuga de pollo', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'arroz', cantidad: Math.round(p * 70), unidad: 'g', categoria: 'almacen' },
          { nombre: 'espinaca', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'atado', categoria: 'verduleria' }
        );
      } else if (platoNorm.includes('milanesa')) {
        steps.push(
          `1. Pasar ${Math.round(p * 200)} g de nalga por huevo batido y empanar con ${Math.round(p * 100)} g de pan rallado.`,
          `2. Pelar ${Math.round(p * 250)} g de zapallo anco y hervir en agua con sal hasta ablandar.`,
          `3. Pisar el zapallo caliente con ${Math.round(p * 15)} g de manteca y ${Math.round(p * 25)} ml de leche.`,
          '4. Hornear las milanesas a 200°C en asadera aceitada por 15 minutos dándolas vuelta.',
          '5. Servir las milanesas crocantes con el puré de zapallo bien suave.'
        );
        ings.push(
          { nombre: 'nalga para milanesas', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'pan rallado', cantidad: Math.round(p * 100), unidad: 'g', categoria: 'almacen' },
          { nombre: 'zapallo anco', cantidad: Math.round(p * 250), unidad: 'g', categoria: 'verduleria' },
          { nombre: 'manteca', cantidad: Math.round(p * 15), unidad: 'g', categoria: 'lacteos' },
          { nombre: 'leche', cantidad: Math.round(p * 25), unidad: 'ml', categoria: 'lacteos' }
        );
      } else if (platoNorm.includes('merluza')) {
        steps.push(
          `1. Pelar ${Math.round(p * 200)} g de papa y hervir en cubos hasta que estén tiernas.`,
          `2. Acomodar ${Math.round(p * 200)} g de filet de merluza en una fuente para horno o sartén con un hilo de aceite.`,
          '3. Rociar el pescado con jugo de limón, sal y perejil picado.',
          '4. Cocinar a fuego suave o al horno durante 12 minutos hasta que la merluza esté blanca y firme.',
          '5. Servir el pescado con las papas calientes espolvoreadas con perejil.'
        );
        ings.push(
          { nombre: 'merluza', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'papa', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'verduleria' },
          { nombre: 'limon', cantidad: 2, unidad: 'unidad', categoria: 'verduleria' }
        );
      } else if (platoNorm.includes('lenteja')) {
        steps.push(
          `1. Picar ${Math.max(1, Math.round(p * 0.5))} cebolla y rehogar en una cacerola con aceite.`,
          `2. Cortar ${Math.round(p * 100)} g de calabaza y 1 zanahoria en cubos chicos y sumar a la olla.`,
          `3. Incorporar ${Math.round(p * 100)} g de lentejas y cubrir con agua o caldo caliente.`,
          '4. Cocinar a fuego moderado por 35 minutos hasta tiernizar las lentejas y espesar el caldo.',
          '5. Servir caliente en platos hondos.'
        );
        ings.push(
          { nombre: 'lentejas', cantidad: Math.round(p * 100), unidad: 'g', categoria: 'almacen' },
          { nombre: 'calabaza', cantidad: Math.round(p * 100), unidad: 'g', categoria: 'verduleria' },
          { nombre: 'cebolla', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'unidad', categoria: 'verduleria' }
        );
      } else if (platoNorm.includes('tarta')) {
        steps.push(
          `1. Cortar ${Math.max(3, p)} zapallito en dados y saltear con ${Math.max(1, Math.round(p * 0.5))} cebolla picada.`,
          '2. Escurrir muy bien todo el líquido para no humedecer la masa.',
          `3. Batir ${Math.max(2, Math.round(p * 0.75))} huevo con ${Math.round(p * 50)} g de queso cremoso en cubitos.`,
          '4. Forrar una tartera con 1 tapa de tarta, rellenar y hornear a 180°C por 30 minutos.',
          '5. Dejar reposar 5 minutos y servir tibia.'
        );
        ings.push(
          { nombre: 'zapallito', cantidad: Math.max(3, p), unidad: 'unidad', categoria: 'verduleria' },
          { nombre: 'cebolla', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'unidad', categoria: 'verduleria' },
          { nombre: 'huevo', cantidad: Math.max(2, Math.round(p * 0.75)), unidad: 'unidad', categoria: 'almacen' },
          { nombre: 'queso cremoso', cantidad: Math.round(p * 50), unidad: 'g', categoria: 'lacteos' },
          { nombre: 'tapa de tarta', cantidad: 1, unidad: 'paquete', categoria: 'panaderia' }
        );
      } else if (platoNorm.includes('fideo')) {
        steps.push(
          `1. Hervir ${Math.round(p * 100)} g de fideos en abundante agua con sal.`,
          `2. Formar albóndigas chicas con ${Math.round(p * 150)} g de carne picada sazonada con sal y orégano.`,
          `3. Dorar las albóndigas en sartén y sumar ${Math.round(p * 75)} ml de salsa de tomate.`,
          '4. Cocinar a fuego suave 15 minutos hasta que la salsa espese.',
          '5. Escurrir los fideos y servir con la salsa y albóndigas calientes.'
        );
        ings.push(
          { nombre: 'fideos', cantidad: Math.round(p * 100), unidad: 'g', categoria: 'almacen' },
          { nombre: 'carne picada', cantidad: Math.round(p * 150), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'salsa de tomate', cantidad: Math.round(p * 75), unidad: 'ml', categoria: 'almacen' }
        );
      } else {
        // Asado
        steps.push(
          `1. Encender el fuego con ${Math.max(1, Math.round(p / 4))} paquete de carbón.`,
          `2. Colocar ${Math.round(p * 350)} g de tira de asado y ${Math.round(p * 150)} g de vacío sobre la parrilla con sal gruesa.`,
          '3. Cocinar a fuego moderado 50 minutos del lado del hueso.',
          '4. Dar vuelta la carne y asar 25 minutos más hasta dorar parejo.',
          '5. Servir la carne caliente con ensalada fresca de lechuga y tomate.'
        );
        ings.push(
          { nombre: 'tira de asado', cantidad: Math.round(p * 350), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'vacio', cantidad: Math.round(p * 150), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'carbon', cantidad: Math.max(1, Math.round(p / 4)), unidad: 'paquete', categoria: 'almacen' }
        );
      }
    } else {
      // Cenas
      if (platoNorm.includes('omelette')) {
        steps.push(
          `1. Blanquear ${Math.max(1, Math.round(p * 0.5))} atado de espinaca en agua hirviendo y escurrir bien.`,
          `2. Batir ${Math.max(2, p * 1.5)} huevo con sal y pimienta.`,
          `3. Calentar una sartén con un chorrito de aceite y volcar los huevos.`,
          `4. Agregar la espinaca picada y ${Math.round(p * 40)} g de queso cremoso en el centro.`,
          '5. Doblar por la mitad, dejar derretir el queso 1 minuto y servir con ensalada fresca.'
        );
        ings.push(
          { nombre: 'huevo', cantidad: Math.max(2, Math.round(p * 1.5)), unidad: 'unidad', categoria: 'almacen' },
          { nombre: 'espinaca', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'atado', categoria: 'verduleria' },
          { nombre: 'queso cremoso', cantidad: Math.round(p * 40), unidad: 'g', categoria: 'lacteos' }
        );
      } else if (platoNorm.includes('pastel de papa')) {
        steps.push(
          `1. Pelar ${Math.round(p * 250)} g de papa y hervir en agua con sal hasta ablandar.`,
          `2. Pisar las papas en caliente con ${Math.round(p * 15)} g de manteca y ${Math.round(p * 25)} ml de leche.`,
          `3. Picar ${Math.max(1, Math.round(p * 0.5))} cebolla y dorar con ${Math.round(p * 180)} g de carne picada.`,
          '4. Armar una fuente para horno con la base de carne picada y cubrir con el puré.',
          '5. Gratinar a 200°C en el horno por 20 minutos hasta dorar la superficie.'
        );
        ings.push(
          { nombre: 'carne picada', cantidad: Math.round(p * 180), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'papa', cantidad: Math.round(p * 250), unidad: 'g', categoria: 'verduleria' },
          { nombre: 'cebolla', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'unidad', categoria: 'verduleria' },
          { nombre: 'manteca', cantidad: Math.round(p * 15), unidad: 'g', categoria: 'lacteos' },
          { nombre: 'leche', cantidad: Math.round(p * 25), unidad: 'ml', categoria: 'lacteos' }
        );
      } else if (platoNorm.includes('trucha')) {
        steps.push(
          `1. Pelar ${Math.round(p * 250)} g de calabaza y hervir hasta que esté blanda.`,
          `2. Pisar la calabaza con ${Math.round(p * 15)} g de manteca para hacer el puré.`,
          `3. Calentar una plancha con un hilo de aceite y colocar ${Math.round(p * 200)} g de trucha del lado de la piel.`,
          '4. Cocinar 4 minutos por lado hasta que la carne esté rosada y tierna.',
          '5. Servir la trucha dorada acompañada del puré de calabaza caliente.'
        );
        ings.push(
          { nombre: 'trucha', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'calabaza', cantidad: Math.round(p * 250), unidad: 'g', categoria: 'verduleria' },
          { nombre: 'manteca', cantidad: Math.round(p * 15), unidad: 'g', categoria: 'lacteos' }
        );
      } else if (platoNorm.includes('pizza')) {
        steps.push(
          '1. Estirar 1 bollo de masa de pizza en una pizzera aceitada.',
          `2. Cubrir con ${Math.round(p * 50)} ml de salsa de tomate condimentada con orégano.`,
          `3. Agregar ${Math.round(p * 75)} g de muzzarella en rodajas cubriendo toda la superficie.`,
          '4. Hornear a 240°C durante 12 minutos hasta que la masa esté crocante y el queso fundido.',
          '5. Cortar en porciones y servir caliente.'
        );
        ings.push(
          { nombre: 'harina 000', cantidad: 300, unidad: 'g', categoria: 'almacen' },
          { nombre: 'salsa de tomate', cantidad: Math.round(p * 50), unidad: 'ml', categoria: 'almacen' },
          { nombre: 'muzzarella', cantidad: Math.round(p * 75), unidad: 'g', categoria: 'lacteos' }
        );
      } else if (platoNorm.includes('bondiola')) {
        steps.push(
          `1. Cortar ${Math.round(p * 200)} g de bondiola en bifes medianos y dorar en plancha o sartén.`,
          `2. Pelar ${Math.round(p * 200)} g de batata y cortar en rodajas finas.`,
          '3. Acomodar las batatas en asadera y hornear a 200°C por 20 minutos hasta caramelizar.',
          '4. Servir los bifes de bondiola calientes junto con las batatas doradas.'
        );
        ings.push(
          { nombre: 'bondiola', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'carniceria' },
          { nombre: 'batata', cantidad: Math.round(p * 200), unidad: 'g', categoria: 'verduleria' }
        );
      } else {
        // Sopa crema o cazuela
        steps.push(
          `1. Pelar ${Math.round(p * 250)} g de calabaza y cortar en cubos parejos.`,
          `2. Picar ${Math.max(1, Math.round(p * 0.5))} cebolla y dorar en cacerola con ${Math.round(p * 10)} g de manteca.`,
          '3. Sumar la calabaza, cubrir con caldo y cocinar 20 minutos hasta tiernizar.',
          `4. Incorporar ${Math.round(p * 30)} ml de leche y procesar hasta lograr crema aterciopelada.`,
          '5. Servir caliente con queso rallado.'
        );
        ings.push(
          { nombre: 'calabaza', cantidad: Math.round(p * 250), unidad: 'g', categoria: 'verduleria' },
          { nombre: 'cebolla', cantidad: Math.max(1, Math.round(p * 0.5)), unidad: 'unidad', categoria: 'verduleria' },
          { nombre: 'manteca', cantidad: Math.round(p * 10), unidad: 'g', categoria: 'lacteos' },
          { nombre: 'leche', cantidad: Math.round(p * 30), unidad: 'ml', categoria: 'lacteos' }
        );
      }
    }

    // Si tiene bebida (desayuno o merienda), sumar sus ingredientes
    if (meal.bebida && (meal.tipo === 'desayuno' || meal.tipo === 'merienda')) {
      const bebNorm = normalizeString(meal.bebida);
      if (bebNorm.includes('cafe con leche') || bebNorm.includes('cafe cortado')) {
        if (!ings.some((i) => i.nombre === 'leche')) {
          ings.push({ nombre: 'leche', cantidad: 1, unidad: 'l', categoria: 'lacteos' });
        }
        ings.push({ nombre: 'cafe', cantidad: 50, unidad: 'g', categoria: 'almacen', es_basico: true });
      } else if (bebNorm.includes('mate cocido')) {
        if (!ings.some((i) => i.nombre === 'leche')) {
          ings.push({ nombre: 'leche', cantidad: 500, unidad: 'ml', categoria: 'lacteos' });
        }
        ings.push({ nombre: 'mate cocido', cantidad: 1, unidad: 'paquete', categoria: 'almacen', es_basico: true });
      } else if (bebNorm.includes('licuado')) {
        if (!ings.some((i) => i.nombre === 'banana')) {
          ings.push({ nombre: 'banana', cantidad: p, unidad: 'unidad', categoria: 'verduleria' });
        }
        if (!ings.some((i) => i.nombre === 'leche')) {
          ings.push({ nombre: 'leche', cantidad: 1, unidad: 'l', categoria: 'lacteos' });
        }
      } else if (bebNorm.includes('naranja')) {
        ings.push({ nombre: 'naranja', cantidad: p * 2, unidad: 'unidad', categoria: 'verduleria' });
      } else if (bebNorm.includes('te')) {
        ings.push({ nombre: 'te', cantidad: 1, unidad: 'paquete', categoria: 'almacen', es_basico: true });
      } else if (bebNorm.includes('mate tradicional') || bebNorm.includes('yerba')) {
        ings.push({ nombre: 'yerba mate', cantidad: 1, unidad: 'paquete', categoria: 'almacen', es_basico: true });
      } else if (bebNorm.includes('chocolatada') || bebNorm.includes('submarino')) {
        if (!ings.some((i) => i.nombre === 'leche')) {
          ings.push({ nombre: 'leche', cantidad: 1, unidad: 'l', categoria: 'lacteos' });
        }
        ings.push({ nombre: 'chocolate', cantidad: 100, unidad: 'g', categoria: 'almacen' });
      } else if (bebNorm.includes('yogur')) {
        if (!ings.some((i) => i.nombre.includes('yogur'))) {
          ings.push({ nombre: 'yogur bebible', cantidad: p, unidad: 'unidad', categoria: 'lacteos' });
        }
      }
    }

    // Sanitización silenciosa y chequeo contra pasos
    const chefIngs: ChefIngredient[] = ings.map((it) => {
      const matchingPantry = pantry.find((pt) => normalizeString(pt.name).includes(normalizeString(it.nombre)));
      return {
        nombre: it.nombre,
        cantidad: it.cantidad,
        unidad: it.unidad,
        categoria: it.categoria,
        es_basico: it.es_basico || false,
        opcional: false,
        item_despensa_coincidente: matchingPantry ? matchingPantry.name : null,
      };
    });

    const filtered = filterAbsurdIngredients(meal.plato, chefIngs);
    const validated = validateIngredientsAgainstSteps(steps, filtered);

    return {
      tipo: meal.tipo,
      nombre: meal.plato,
      porciones: p,
      tiempo_minutos: 35,
      por_que_encaja: meal.por_que_encaja,
      bebida: meal.bebida || null,
      pasos: steps,
      analisis_plato: [],
      ingredientes: validated,
    };
  });

  return {
    dia,
    comidas: builtMeals,
  };
}

/**
 * Generador Mock completo de Menú Semanal (utilizado tanto en offline como de respaldo)
 */
export function generateMockMenuResponse(params: {
  daysConfig: Array<{ dia: string; comidas: MealType[] }>;
  targetProfile: string;
  profileDetail?: string;
  persons?: number;
  mandatoryDishes?: string;
  pantry?: PantryItem[];
}): ChefMenuResponse {
  const p = params.persons || 4;
  const plan = generateMockPlanificarSemana(params);

  // Ejecución del validador de variedad en servidor/local
  validateWeeklyPlanVariety(plan.comidas, params.mandatoryDishes ? [params.mandatoryDishes] : []);

  // Construcción día por día con sus pasos e ingredientes
  const activeDays = params.daysConfig.filter((d) => d.comidas.length > 0);
  const days: MenuDay[] = activeDays.map((dayCfg) => {
    const dayMeals = plan.comidas.filter(
      (m) => normalizeString(m.dia) === normalizeString(dayCfg.dia)
    );
    return generateMockDayMealDetail(dayCfg.dia, dayMeals, p, params.pantry || []);
  });

  // Filtro de advertencias para evitar duplicar el cartel fijo de salud
  const filteredWarnings = (plan.advertencias || []).filter((adv) => {
    const norm = normalizeString(adv);
    return !norm.includes('sugerencias generales');
  });

  return {
    modo: 'menu',
    fuera_de_tema: false,
    mensaje: null,
    aclaracion: null,
    dias: days,
    advertencias: filteredWarnings,
  };
}
