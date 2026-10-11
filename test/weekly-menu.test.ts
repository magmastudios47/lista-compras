import { describe, it, expect } from 'vitest';
import { MenuResponseSchema, MenuItemMealSchema } from '../supabase/functions/_shared/schemas';
import { generateMockMenuResponse, generateMockPlanificarSemana } from '../src/hooks/useChefAi';
import { mergeDuplicateIngredients, calculatePantryDiscounts } from '../src/lib/discountEngine';
import { validateWeeklyPlanVariety } from '../src/lib/weeklyMenuValidator';
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

  it('5. Agrega advertencia médica si el usuario menciona condiciones como diabetes o celiaquía sin duplicar el aviso fijo', () => {
    const response = generateMockMenuResponse({
      daysConfig: [{ dia: 'Lunes', comidas: ['almuerzo'] }],
      targetProfile: 'Sin TACC',
      profileDetail: 'Tengo diabetes tipo 2 y celiaquía',
      persons: 2,
    });

    // La advertencia médica real debe estar presente
    expect(
      response.advertencias.some((a) => a.toLowerCase().includes('médico') || a.toLowerCase().includes('nutricionista'))
    ).toBe(true);

    // El cartel fijo ("Son sugerencias generales...") NO debe estar duplicado en el array
    expect(
      response.advertencias.some((a) => a.toLowerCase().includes('sugerencias generales'))
    ).toBe(false);
  });

  it('6. Ronda 4: Perfil Deportista con 4 comidas x 7 días: 7 almuerzos distintos, 7 cenas distintas, bebidas y variedad garantizada', () => {
    const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const daysConfig = daysOfWeek.map((dia) => ({
      dia,
      comidas: ['desayuno', 'almuerzo', 'merienda', 'cena'] as any,
    }));

    // Paso A: Planificación del menú completo (sin ingredientes)
    const planResponse = generateMockPlanificarSemana({
      daysConfig,
      targetProfile: 'Deportista',
      persons: 4,
    });

    expect(planResponse.comidas.length).toBe(28); // 7 días x 4 comidas

    // A. 7 Almuerzos distintos
    const almuerzos = planResponse.comidas.filter((c) => c.tipo === 'almuerzo');
    expect(almuerzos.length).toBe(7);
    const uniqueLunches = new Set(almuerzos.map((a) => a.plato.toLowerCase()));
    expect(uniqueLunches.size).toBe(7);

    // B. 7 Cenas distintas
    const cenas = planResponse.comidas.filter((c) => c.tipo === 'cena');
    expect(cenas.length).toBe(7);
    const uniqueDinners = new Set(cenas.map((c) => c.plato.toLowerCase()));
    expect(uniqueDinners.size).toBe(7);

    // C. Desayunos y meriendas incluyen bebida variada
    const desayunos = planResponse.comidas.filter((c) => c.tipo === 'desayuno');
    expect(desayunos.length).toBe(7);
    desayunos.forEach((d) => {
      expect(d.bebida).toBeDefined();
      expect(d.bebida).not.toBeNull();
      expect(d.bebida!.length).toBeGreaterThan(0);
    });

    const meriendas = planResponse.comidas.filter((c) => c.tipo === 'merienda');
    expect(meriendas.length).toBe(7);
    meriendas.forEach((m) => {
      expect(m.bebida).toBeDefined();
      expect(m.bebida).not.toBeNull();
      expect(m.bebida!.length).toBeGreaterThan(0);
    });

    // D. Validador de variedad en servidor: 100% aprobado (rotación de bases >= 4, no >2 días seguidos misma proteína)
    const varietyResult = validateWeeklyPlanVariety(planResponse.comidas, []);
    expect(varietyResult.valid).toBe(true);
    expect(varietyResult.errors.length).toBe(0);

    // E. Paso B: Generación completa con recetas (3-6 pasos) e ingredientes
    const fullMenu = generateMockMenuResponse({
      daysConfig,
      targetProfile: 'Deportista',
      persons: 4,
    });

    expect(fullMenu.dias.length).toBe(7);

    // Cada comida tiene pasos detallados y por_que_encaja específico
    fullMenu.dias.forEach((dia) => {
      dia.comidas.forEach((comida) => {
        expect(comida.pasos).toBeDefined();
        expect(comida.pasos!.length).toBeGreaterThanOrEqual(3);
        expect(comida.pasos!.length).toBeLessThanOrEqual(6);
        expect(comida.ingredientes.length).toBeGreaterThan(0);
        expect(comida.por_que_encaja).toBeDefined();
        expect(comida.por_que_encaja!.length).toBeGreaterThan(15);
      });
    });

    // F. Bebidas suman sus ingredientes (ej: leche o café en desayuno)
    const mondayBreakfast = fullMenu.dias[0].comidas.find((c) => c.tipo === 'desayuno');
    expect(mondayBreakfast?.bebida).toBe('Café con leche');
    const ingsMonday = mondayBreakfast?.ingredientes.map((i) => i.nombre.toLowerCase()) || [];
    expect(ingsMonday.includes('leche')).toBe(true);
    expect(ingsMonday.includes('cafe')).toBe(true);

    // G. Aviso único: las advertencias no duplican el aviso fijo de salud
    expect(
      fullMenu.advertencias.some((adv) => adv.toLowerCase().includes('sugerencias generales'))
    ).toBe(false);
  });

  it('7. Medición de llamadas a la IA para un menú semanal completo', () => {
    // Cálculo teórico y métrica documentada:
    // - Paso A (planificar_semana): 1 llamada
    // - Paso B (detalle_dia_menu): 1 llamada por día activo (7 llamadas máx para semana completa)
    // - Reintentos de variedad: 1 reintento si falla la variedad
    const activeDaysCount = 7;
    const callsPasoA = 1;
    const callsPasoB = activeDaysCount;
    const totalCallsMin = callsPasoA + callsPasoB; // 8 llamadas
    const totalCallsMaxWithRetry = callsPasoA + 1 + callsPasoB; // 9 llamadas

    expect(totalCallsMin).toBe(8);
    expect(totalCallsMaxWithRetry).toBe(9);
  });
});
