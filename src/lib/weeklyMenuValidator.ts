// Validador de Variedad del Menú Semanal (Ronda 4)
import { normalizeString } from './normalizer';
import { PlanificarSemanaMeal } from '../types';

export interface VarietyValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Clasifica la proteína o componente principal de un plato argentino
 */
export function getPrincipalProtein(dishName: string): string {
  const norm = normalizeString(dishName);

  // Pescado
  if (norm.includes('trucha') || norm.includes('merluza') || norm.includes('pescado') || norm.includes('salmon') || norm.includes('atun')) {
    return 'pescado';
  }
  // Pollo / Aves
  if (norm.includes('pollo') || norm.includes('suprema') || norm.includes('pechuga') || norm.includes('pata muslo')) {
    return 'pollo';
  }
  // Cerdo
  if (norm.includes('cerdo') || norm.includes('bondiola') || norm.includes('carre') || norm.includes('pechito') || norm.includes('matambrito')) {
    return 'cerdo';
  }
  // Carne vacuna
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
  // Huevos
  if (norm.includes('huevo') || norm.includes('tortilla') || norm.includes('omelette') || norm.includes('revuelto')) {
    return 'huevo';
  }
  // Legumbres
  if (norm.includes('lenteja') || norm.includes('poroto') || norm.includes('garbanzo') || norm.includes('hummus')) {
    return 'legumbre';
  }
  // Vegetariano / Pastas / Verduras
  return 'vegetal_pasta';
}

/**
 * Identifica la base del desayuno o merienda
 */
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
  // Tostadas / pan / galletitas
  return 'tostada_pan';
}

/**
 * Validador estricto de variedad sobre el plan de comidas
 */
export function validateWeeklyPlanVariety(
  comidas: PlanificarSemanaMeal[],
  mandatoryDishes: string[] = []
): VarietyValidationResult {
  const errors: string[] = [];
  const normalizedMandatory = mandatoryDishes.map((d) => normalizeString(d)).filter(Boolean);

  // 1. REGLA 1: Para un mismo tipo de comida no puede repetirse el mismo plato en la semana
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
        errors.push(`El plato "${plato}" está repetido en el tipo "${tipo}" durante la semana.`);
      }
      seenPlatos.add(norm);
    }
  }

  // 2. REGLA 2: No puede haber más de 2 días seguidos con la misma proteína principal
  // Evaluamos días en orden cronológico (lunes a domingo)
  const daysOrder = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  
  // Extraemos la proteína principal para comidas principales (almuerzos y cenas)
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

  // Chequeo de racha consecutiva en almuerzos
  let streakProteinLunch = '';
  let streakCountLunch = 0;
  for (const day of daysOrder) {
    const prot = proteinByDayLunch[day];
    if (prot && prot !== 'vegetal_pasta') {
      if (prot === streakProteinLunch) {
        streakCountLunch++;
        if (streakCountLunch > 2) {
          errors.push(`Proteína principal "${prot}" repetida más de 2 días consecutivos en almuerzos.`);
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

  // Chequeo de racha consecutiva en cenas
  let streakProteinDinner = '';
  let streakCountDinner = 0;
  for (const day of daysOrder) {
    const prot = proteinByDayDinner[day];
    if (prot && prot !== 'vegetal_pasta') {
      if (prot === streakProteinDinner) {
        streakCountDinner++;
        if (streakCountDinner > 2) {
          errors.push(`Proteína principal "${prot}" repetida más de 2 días consecutivos en cenas.`);
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

  // 3. REGLA 3: En desayunos y meriendas rotan al menos 4 bases distintas durante la semana
  const breakfastAndSnackMeals = comidas.filter((m) => m.tipo === 'desayuno' || m.tipo === 'merienda');
  if (breakfastAndSnackMeals.length >= 4) {
    const distinctBases = new Set<string>();
    for (const m of breakfastAndSnackMeals) {
      distinctBases.add(getBreakfastSnackBase(m.plato));
    }
    if (distinctBases.size < 4) {
      errors.push(
        `En desayunos y meriendas solo rotan ${distinctBases.size} bases distintas. Se requieren al menos 4.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
