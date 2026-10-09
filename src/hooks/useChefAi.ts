import { useState, useCallback } from 'react';
import {
  ChefCookResponse,
  ChefSuggestResponse,
  ChefInterpretPantryResponse,
  DiscountComparisonResult,
  PantryItem,
} from '../types';
import { useHousehold } from '../context/HouseholdContext';
import { isConfigured, supabase } from '../lib/supabaseClient';
import { calculatePantryDiscounts } from '../lib/discountEngine';

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

          if (fnError || !data) {
            throw new Error(fnError?.message || data?.error || 'Error al consultar al Chef IA.');
          }
          cookData = data as ChefCookResponse;
          incrementChefUsage();
        } else {
          // MOCK / DEMO Provider para desarrollo sin credenciales o fuera de línea
          await new Promise((r) => setTimeout(r, 900));
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
          const { data, error: fnError } = await supabase.functions.invoke('chef-ai', {
            body: {
              modo: 'sugerir',
              despensa: pantry.map((p) => p.name),
              texto_despensa: freeText,
              household_id: household.id,
            },
          });

          if (fnError || !data) {
            throw new Error(fnError?.message || data?.error || 'Error al solicitar sugerencias.');
          }
          suggestData = data as ChefSuggestResponse;
          incrementChefUsage();
        } else {
          await new Promise((r) => setTimeout(r, 800));
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

  // Modo Interpretar Despensa
  const interpretPantry = useCallback(
    async (text: string): Promise<ChefInterpretPantryResponse> => {
      setLoading(true);
      setError(null);

      try {
        let parsedData: ChefInterpretPantryResponse;

        if (isConfigured && household) {
          const { data, error: fnError } = await supabase.functions.invoke('chef-ai', {
            body: {
              modo: 'interpretar_despensa',
              texto_despensa: text,
              household_id: household?.id,
            },
          });

          if (fnError || !data) {
            throw new Error(fnError?.message || data?.error || 'Error al interpretar texto de despensa.');
          }
          parsedData = data as ChefInterpretPantryResponse;
        } else {
          await new Promise((r) => setTimeout(r, 600));
          parsedData = generateMockInterpretPantry(text);
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

  return {
    loading,
    error,
    askToCook,
    askToSuggest,
    interpretPantry,
    remainingQueries,
  };
}

// ========================================================================
// GENERADORES DEMO / OFFLINE REALISTAS PARA ARGENTINA
// ========================================================================

function generateMockCookResponse(
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
      ingredientes: [],
      advertencias: [],
    };
  }

  // Recetas argentinas típicas adaptadas
  if (reqLower.includes('milanesa') || reqLower.includes('pure')) {
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
      ingredientes: [
        {
          nombre: 'nalga para milanesas',
          cantidad: Math.round(persons * 200),
          unidad: 'g',
          categoria: 'carniceria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'huevo',
          cantidad: Math.max(2, Math.round(persons * 0.75)),
          unidad: 'unidad',
          categoria: 'almacen',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: isPantryEgg ? 'huevos de campo' : null,
        },
        {
          nombre: 'pan rallado',
          cantidad: Math.round(persons * 100),
          unidad: 'g',
          categoria: 'almacen',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'papa',
          cantidad: Math.round(persons * 250),
          unidad: 'g',
          categoria: 'verduleria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'leche',
          cantidad: Math.round(persons * 50),
          unidad: 'ml',
          categoria: 'lacteos',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'manteca',
          cantidad: Math.round(persons * 15),
          unidad: 'g',
          categoria: 'lacteos',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'aceite de girasol',
          cantidad: 500,
          unidad: 'ml',
          categoria: 'almacen',
          es_basico: true,
          opcional: false,
          item_despensa_coincidente: 'aceite de girasol',
        },
      ],
      advertencias: [],
    };
  }

  // Tarta de zapallitos
  if (reqLower.includes('tarta') || reqLower.includes('zapallito')) {
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
      ingredientes: [
        {
          nombre: 'zapallito',
          cantidad: Math.max(3, Math.round(persons * 1.5)),
          unidad: 'unidad',
          categoria: 'verduleria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'cebolla',
          cantidad: Math.max(1, Math.round(persons * 0.5)),
          unidad: 'unidad',
          categoria: 'verduleria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: 'cebollas',
        },
        {
          nombre: 'tapa de tarta',
          cantidad: 1,
          unidad: 'paquete',
          categoria: 'lacteos',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'queso cremoso',
          cantidad: Math.round(persons * 75),
          unidad: 'g',
          categoria: 'lacteos',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'huevo',
          cantidad: Math.max(2, Math.round(persons * 0.75)),
          unidad: 'unidad',
          categoria: 'almacen',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: 'huevos de campo',
        },
      ],
      advertencias: [],
    };
  }

  // Asado o genérico carne
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
      ingredientes: [
        {
          nombre: 'tira de asado',
          cantidad: Math.round(persons * 400),
          unidad: 'g',
          categoria: 'carniceria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'chorizo',
          cantidad: persons,
          unidad: 'unidad',
          categoria: 'carniceria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'pan',
          cantidad: persons,
          unidad: 'unidad',
          categoria: 'panaderia',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
        {
          nombre: 'carbon',
          cantidad: Math.max(1, Math.round(persons / 4)),
          unidad: 'paquete',
          categoria: 'almacen',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
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
    ingredientes: [
      {
        nombre: 'arroz',
        cantidad: Math.round(persons * 80),
        unidad: 'g',
        categoria: 'almacen',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: 'arroz largo fino',
      },
      {
        nombre: 'cebolla',
        cantidad: Math.max(1, Math.round(persons * 0.5)),
        unidad: 'unidad',
        categoria: 'verduleria',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: 'cebollas',
      },
      {
        nombre: 'tomate perita',
        cantidad: Math.max(2, Math.round(persons * 1)),
        unidad: 'unidad',
        categoria: 'verduleria',
        es_basico: false,
        opcional: false,
        item_despensa_coincidente: null,
      },
      {
        nombre: 'aceite de girasol',
        cantidad: 50,
        unidad: 'ml',
        categoria: 'almacen',
        es_basico: true,
        opcional: false,
        item_despensa_coincidente: 'aceite de girasol',
      },
    ],
    advertencias: restrictions.length > 0 ? [`Adaptado para: ${restrictions.join(', ')}`] : [],
  };
}

function generateMockSuggestResponse(
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
        ingredientes: [
          {
            nombre: 'arroz',
            cantidad: 320,
            unidad: 'g',
            categoria: 'almacen',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: 'arroz largo fino',
          },
          {
            nombre: 'cebolla',
            cantidad: 2,
            unidad: 'unidad',
            categoria: 'verduleria',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: 'cebollas',
          },
          {
            nombre: 'huevo',
            cantidad: 4,
            unidad: 'unidad',
            categoria: 'almacen',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: 'huevos de campo',
          },
          {
            nombre: 'salsa de soja',
            cantidad: 30,
            unidad: 'ml',
            categoria: 'almacen',
            es_basico: false,
            opcional: true,
            item_despensa_coincidente: null,
          },
        ],
      },
      {
        nombre: 'Tortilla de papas y cebolla clásica',
        porciones: 4,
        tiempo_minutos: 35,
        dificultad: 'facil',
        por_que_conviene: 'Tenés cebolla y huevos; solo necesitás sumar unas papas a la lista.',
        ingredientes: [
          {
            nombre: 'papa',
            cantidad: 800,
            unidad: 'g',
            categoria: 'verduleria',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: null,
          },
          {
            nombre: 'cebolla',
            cantidad: 2,
            unidad: 'unidad',
            categoria: 'verduleria',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: 'cebollas',
          },
          {
            nombre: 'huevo',
            cantidad: 5,
            unidad: 'unidad',
            categoria: 'almacen',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: 'huevos de campo',
          },
          {
            nombre: 'aceite de girasol',
            cantidad: 150,
            unidad: 'ml',
            categoria: 'almacen',
            es_basico: true,
            opcional: false,
            item_despensa_coincidente: 'aceite de girasol',
          },
        ],
      },
      {
        nombre: 'Revuelto gramajo casero',
        porciones: 4,
        tiempo_minutos: 25,
        dificultad: 'facil',
        por_que_conviene: 'Un clásico porteño y patagónico rápido con huevos y cebolla.',
        ingredientes: [
          {
            nombre: 'papa',
            cantidad: 600,
            unidad: 'g',
            categoria: 'verduleria',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: null,
          },
          {
            nombre: 'jamon cocido',
            cantidad: 150,
            unidad: 'g',
            categoria: 'fiambreria',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: null,
          },
          {
            nombre: 'huevo',
            cantidad: 4,
            unidad: 'unidad',
            categoria: 'almacen',
            es_basico: false,
            opcional: false,
            item_despensa_coincidente: 'huevos de campo',
          },
          {
            nombre: 'arvejas',
            cantidad: 1,
            unidad: 'lata',
            categoria: 'almacen',
            es_basico: false,
            opcional: true,
            item_despensa_coincidente: null,
          },
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
