// Validador de Variedad del Menú Semanal para Edge Functions de Supabase
export interface VarietyValidationResult {
  valid: boolean;
  errors: string[];
}

function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPrincipalProtein(dishName: string): string {
  const norm = normalizeString(dishName);

  if (norm.includes('trucha') || norm.includes('merluza') || norm.includes('pescado') || norm.includes('salmon') || norm.includes('atun')) {
    return 'pescado';
  }
  if (norm.includes('pollo') || norm.includes('suprema') || norm.includes('pechuga') || norm.includes('pata muslo')) {
    return 'pollo';
  }
  if (norm.includes('cerdo') || norm.includes('bondiola') || norm.includes('carre') || norm.includes('pechito') || norm.includes('matambrito')) {
    return 'cerdo';
  }
  if (
    norm.includes('carne') ||
    norm.includes('nalga') ||
    norm.includes('peceto') ||
    norm.includes('bife') ||
    norm.includes('asado') ||
    norm.includes('vacio') ||
    norm.includes('matambre') ||
    norm.includes('picada') ||
    norm.includes('hamburguesa') ||
    norm.includes('lomo') ||
    norm.includes('estofado') ||
    norm.includes('carbonada') ||
    norm.includes('mondongo') ||
    norm.includes('chorizo') ||
    (norm.includes('milanesa') && !norm.includes('zapallo') && !norm.includes('berenjena') && !norm.includes('soja'))
  ) {
    return 'carne_vacuna';
  }
  if (norm.includes('huevo') || norm.includes('tortilla') || norm.includes('omelette') || norm.includes('revuelto')) {
    return 'huevo';
  }
  if (norm.includes('lenteja') || norm.includes('poroto') || norm.includes('garbanzo') || norm.includes('hummus')) {
    return 'legumbre';
  }
  return 'vegetal_pasta';
}

export function getBreakfastSnackBase(dishName: string): string {
  const norm = normalizeString(dishName);

  if (norm.includes('avena') || norm.includes('porridge') || norm.includes('granola')) {
    return 'avena';
  }
  if (norm.includes('yogur') || norm.includes('yogurt')) {
    return 'yogur';
  }
  if (norm.includes('panqueque') || norm.includes('tortita') || norm.includes('waffle') || norm.includes('crepe') || norm.includes('budin') || norm.includes('muffin')) {
    return 'panqueque_tortita';
  }
  if (norm.includes('huevo') || norm.includes('revuelto') || norm.includes('omelette')) {
    return 'huevo';
  }
  if (norm.includes('licuado') || norm.includes('batido') || norm.includes('smoothie')) {
    return 'licuado';
  }
  if (norm.includes('fruta') || norm.includes('frutos secos') || norm.includes('manzana') || norm.includes('banana')) {
    return 'fruta_frutos_secos';
  }
  return 'tostada_pan';
}

export function validateWeeklyPlanVariety(
  comidas: Array<{ dia: string; tipo: string; plato: string; bebida?: string | null }>,
  mandatoryDishes: string[] = []
): VarietyValidationResult {
  const errors: string[] = [];
  const normalizedMandatory = mandatoryDishes.map((d) => normalizeString(d)).filter(Boolean);

  // 1. Plato único por tipo de comida
  const mealsByType: Record<string, string[]> = {};
  for (const m of comidas) {
    if (!mealsByType[m.tipo]) mealsByType[m.tipo] = [];
    mealsByType[m.tipo].push(m.plato);
  }

  for (const [tipo, platos] of Object.entries(mealsByType)) {
    const seenPlatos = new Set<string>();
    for (const plato of platos) {
      const norm = normalizeString(plato);
      const isMandatory = normalizedMandatory.some((man) => norm.includes(man) || man.includes(norm));
      if (seenPlatos.has(norm) && !isMandatory) {
        errors.push(`El plato "${plato}" está repetido en "${tipo}".`);
      }
      seenPlatos.add(norm);
    }
  }

  // 2. No más de 2 días consecutivos con la misma proteína principal
  const daysOrder = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const proteinByDayLunch: Record<string, string> = {};
  const proteinByDayDinner: Record<string, string> = {};

  for (const m of comidas) {
    const dayNorm = normalizeString(m.dia);
    if (m.tipo === 'almuerzo') {
      proteinByDayLunch[dayNorm] = getPrincipalProtein(m.plato);
    } else if (m.tipo === 'cena') {
      proteinByDayDinner[dayNorm] = getPrincipalProtein(m.plato);
    }
  }

  let streakProteinLunch = '';
  let streakCountLunch = 0;
  for (const day of daysOrder) {
    const prot = proteinByDayLunch[day];
    if (prot && prot !== 'vegetal_pasta') {
      if (prot === streakProteinLunch) {
        streakCountLunch++;
        if (streakCountLunch > 2) {
          errors.push(`La proteína "${prot}" se repite más de 2 días seguidos en almuerzos.`);
          break;
        }
      } else {
        streakProteinLunch = prot;
        streakCountLunch = 1;
      }
    } else {
      streakCountLunch = 0;
    }
  }

  let streakProteinDinner = '';
  let streakCountDinner = 0;
  for (const day of daysOrder) {
    const prot = proteinByDayDinner[day];
    if (prot && prot !== 'vegetal_pasta') {
      if (prot === streakProteinDinner) {
        streakCountDinner++;
        if (streakCountDinner > 2) {
          errors.push(`La proteína "${prot}" se repite más de 2 días seguidos en cenas.`);
          break;
        }
      } else {
        streakProteinDinner = prot;
        streakCountDinner = 1;
      }
    } else {
      streakCountDinner = 0;
    }
  }

  // 3. En desayunos y meriendas rotan al menos 4 bases
  const breakfastAndSnackMeals = comidas.filter((m) => m.tipo === 'desayuno' || m.tipo === 'merienda');
  if (breakfastAndSnackMeals.length >= 4) {
    const distinctBases = new Set<string>();
    for (const m of breakfastAndSnackMeals) {
      distinctBases.add(getBreakfastSnackBase(m.plato));
    }
    if (distinctBases.size < 4) {
      errors.push(
        `En desayunos y meriendas solo rotan ${distinctBases.size} bases distintas. Deben rotar al menos 4.`
      );
    }
  }

  // 4. REGLA 4: por_que_encaja debe ser único y específico por plato (Ronda 5 Bloque 2)
  const seenPorQueEncaja = new Set<string>();
  for (const m of comidas as any[]) {
    if (m.por_que_encaja) {
      const normText = normalizeString(m.por_que_encaja);
      if (normText.length > 5) {
        if (seenPorQueEncaja.has(normText)) {
          errors.push(
            `El texto "por_que_encaja" ("${m.por_que_encaja}") está repetido en el plan. Cada plato debe tener una justificación única adaptada al objetivo.`
          );
          break;
        }
        seenPorQueEncaja.add(normText);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
