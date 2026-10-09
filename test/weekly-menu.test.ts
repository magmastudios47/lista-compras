import { describe, it, expect } from 'vitest';
import { MenuResponseSchema, MenuItemMealSchema } from '../supabase/functions/_shared/schemas';
import { generateMockMenuResponse } from '../src/hooks/useChefAi';
import { mergeDuplicateIngredients, calculatePantryDiscounts } from '../src/lib/discountEngine';
import { PantryItem } from '../src/types';

describe('Bloque 6: Menú Semanal Mejorado (Modo "menu", Perfiles y Unificación)', () => {
  it('1. Valida el esquema Zod MenuResponseSchema con todos sus campos obligatorios', () => {
    const validMenu = {
      modo: 'menu',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      dias: [
        {
          dia: 'lunes',
          comidas: [
            {
              tipo: 'desayuno',
              nombre: 'Tostadas con palta y huevo',
              porciones: 2,
              tiempo_minutos: 15,
              por_que_encaja: 'Proteína y grasas buenas para arrancar el día.',
              analisis_plato: ['tostadas: pan, palta', 'huevo revuelto: huevo, manteca'],
              ingredientes: [
                {
                  nombre: 'huevo',
                  cantidad: 2,
                  unidad: 'unidad',
                  categoria: 'almacen',
                  es_basico: false,
                  opcional: false,
                  item_despensa_coincidente: null,
                },
                {
                  nombre: 'pan',
                  cantidad: 2,
                  unidad: 'unidad',
                  categoria: 'panaderia',
                  es_basico: false,
                  opcional: false,
                  item_despensa_coincidente: null,
                },
              ],
            },
          ],
        },
      ],
      advertencias: ['Son sugerencias generales, no reemplazan a un profesional.'],
    };

    const parsed = MenuResponseSchema.parse(validMenu);
    expect(parsed.modo).toBe('menu');
    expect(parsed.dias.length).toBe(1);
    expect(parsed.dias[0].comidas[0].analisis_plato).toBeDefined();
    expect(parsed.dias[0].comidas[0].analisis_plato[0]).toContain('tostadas');
  });

  it('2. Respeta FIDELIDAD AL PLATO en las comidas del menú (puré de zapallo sin papa)', () => {
    const response = generateMockMenuResponse({
      daysConfig: [
        { dia: 'Lunes', comidas: ['cena'] },
      ],
      targetProfile: 'General',
      persons: 4,
    });

    const cena = response.dias[0].comidas.find((c) => c.tipo === 'cena');
    expect(cena).toBeDefined();
    expect(cena?.analisis_plato).toBeDefined();

    // Si es milanesa con puré de zapallo, debe contener zapallo anco y NO papa
    if (cena?.nombre.includes('puré de zapallo')) {
      const names = cena.ingredientes.map((i) => i.nombre.toLowerCase());
      expect(names.some((n) => n.includes('zapallo'))).toBe(true);
      expect(names.some((n) => n.includes('papa'))).toBe(false);
    }
  });

  it('3. Genera comidas para combinaciones arbitrarias de días y tipos de comida', () => {
    const response = generateMockMenuResponse({
      daysConfig: [
        { dia: 'Lunes', comidas: ['desayuno', 'almuerzo'] },
        { dia: 'Martes', comidas: ['cena'] },
        { dia: 'Viernes', comidas: ['desayuno', 'almuerzo', 'merienda', 'cena'] },
      ],
      targetProfile: 'Deportista',
      persons: 2,
    });

    expect(response.dias.length).toBe(3);
    const lunes = response.dias.find((d) => d.dia === 'Lunes');
    expect(lunes?.comidas.length).toBe(2);
    expect(lunes?.comidas.map((c) => c.tipo)).toEqual(['desayuno', 'almuerzo']);

    const viernes = response.dias.find((d) => d.dia === 'Viernes');
    expect(viernes?.comidas.length).toBe(4);
  });

  it('4. Unifica ingredientes duplicados entre comidas y aplica descuento de despensa', () => {
    const response = generateMockMenuResponse({
      daysConfig: [
        { dia: 'Lunes', comidas: ['desayuno', 'almuerzo', 'cena'] },
        { dia: 'Martes', comidas: ['almuerzo', 'cena'] },
      ],
      targetProfile: 'Comer más sano',
      persons: 4,
    });

    // Despensa inicial con huevos y cebollas
    const pantry: PantryItem[] = [
      {
        id: 'p-1',
        household_id: 'h-1',
        name: 'huevo',
        normalized_name: 'huevo',
        quantity: 12,
        unit: 'unidad',
        category: 'almacen',
        created_at: '',
        updated_at: '',
      },
      {
        id: 'p-2',
        household_id: 'h-1',
        name: 'cebolla',
        normalized_name: 'cebolla',
        quantity: 2,
        unit: 'unidad',
        category: 'verduleria',
        created_at: '',
        updated_at: '',
      },
    ];

    const allIngs = response.dias.flatMap((d) => d.comidas.flatMap((c) => c.ingredientes));
    const merged = mergeDuplicateIngredients(allIngs);

    // Los ingredientes unificados no deben tener nombres repetidos
    const names = merged.map((i) => i.nombre);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    // Motor de descuento
    const comparisons = calculatePantryDiscounts(merged, pantry);
    expect(comparisons.length).toBe(merged.length);

    // Huevos deben figurar cubiertos o parcialmente cubiertos gracias a la despensa
    const eggComparison = comparisons.find((c) => c.ingrediente.nombre.toLowerCase().includes('huevo'));
    if (eggComparison) {
      expect(eggComparison.despensa_item).not.toBeNull();
    }
  });

  it('5. Agrega advertencia médica si el usuario menciona condiciones como diabetes o celiaquía', () => {
    const response = generateMockMenuResponse({
      daysConfig: [{ dia: 'Lunes', comidas: ['almuerzo'] }],
      targetProfile: 'Sin TACC',
      profileDetail: 'Tengo diabetes tipo 2 y celiaquía',
      persons: 2,
    });

    expect(response.advertencias.length).toBeGreaterThanOrEqual(2);
    expect(
      response.advertencias.some((a) => a.toLowerCase().includes('médico') || a.toLowerCase().includes('nutricionista'))
    ).toBe(true);
  });
});
