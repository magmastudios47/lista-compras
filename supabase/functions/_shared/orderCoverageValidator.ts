// Validador de Cobertura del Pedido para Supabase Edge Function chef-ai (Deno)
export interface CoverageValidationResult {
  valid: boolean;
  missing: string[];
  excludedViolations: string[];
  mentioned: string[];
}

export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface FoodRule {
  canonical: string;
  pattern: RegExp;
  satisfies: (ingName: string) => boolean;
}

const FOOD_RULES: FoodRule[] = [
  {
    canonical: 'papa',
    pattern: /\b(papas?|patatas?)\b/,
    satisfies: (ing) => /\b(papas?|patatas?)\b/.test(ing),
  },
  {
    canonical: 'acelga',
    pattern: /\bacelgas?\b/,
    satisfies: (ing) => /\bacelgas?\b/.test(ing),
  },
  {
    canonical: 'zapallo',
    pattern: /\b(zapallo|calabaza|anco)\b/,
    satisfies: (ing) => /\b(zapallo|calabaza|anco)\b/.test(ing),
  },
  {
    canonical: 'zapallito',
    pattern: /\bzapallitos?\b/,
    satisfies: (ing) => /\bzapallitos?\b/.test(ing),
  },
  {
    canonical: 'remolacha',
    pattern: /\bremolachas?\b/,
    satisfies: (ing) => /\bremolachas?\b/.test(ing),
  },
  {
    canonical: 'batata',
    pattern: /\b(batatas?|camotes?)\b/,
    satisfies: (ing) => /\b(batatas?|camotes?)\b/.test(ing),
  },
  {
    canonical: 'espinaca',
    pattern: /\bespinacas?\b/,
    satisfies: (ing) => /\bespinacas?\b/.test(ing),
  },
  {
    canonical: 'berenjena',
    pattern: /\bberenjenas?\b/,
    satisfies: (ing) => /\bberenjenas?\b/.test(ing),
  },
  {
    canonical: 'choclo',
    pattern: /\b(choclos?|maiz)\b/,
    satisfies: (ing) => /\b(choclos?|maiz)\b/.test(ing),
  },
  {
    canonical: 'morron',
    pattern: /\b(morron|morrones|pimiento|pimientos)\b/,
    satisfies: (ing) => /\b(morron|morrones|pimiento|pimientos)\b/.test(ing),
  },
  {
    canonical: 'tomate',
    pattern: /\btomates?\b/,
    satisfies: (ing) => /\btomates?\b/.test(ing),
  },
  {
    canonical: 'cebolla',
    pattern: /\bcebollas?\b/,
    satisfies: (ing) => /\bcebollas?\b/.test(ing),
  },
  {
    canonical: 'zanahoria',
    pattern: /\bzanahorias?\b/,
    satisfies: (ing) => /\bzanahorias?\b/.test(ing),
  },
  {
    canonical: 'pollo',
    pattern: /\b(pollo|suprema|pechuga|pata muslo)\b/,
    satisfies: (ing) => /\b(pollo|suprema|pechuga|pata muslo)\b/.test(ing),
  },
  {
    canonical: 'carne',
    pattern: /\b(carne|carne picada|roast beef|paleta|nalga|peceto|cuadril|bife)\b/,
    satisfies: (ing) => /\b(carne|nalga|peceto|cuadril|bife|roast beef|paleta|lomo|vacio|asado)\b/.test(ing),
  },
  {
    canonical: 'pescado',
    pattern: /\b(pescado|merluza|trucha|salmon|atun)\b/,
    satisfies: (ing) => /\b(pescado|merluza|trucha|salmon|atun)\b/.test(ing),
  },
  {
    canonical: 'cerdo',
    pattern: /\b(cerdo|bondiola|pechito|carre|costillita)\b/,
    satisfies: (ing) => /\b(cerdo|bondiola|pechito|carre|costillita|panceta)\b/.test(ing),
  },
  {
    canonical: 'lentejas',
    pattern: /\blentejas?\b/,
    satisfies: (ing) => /\blentejas?\b/.test(ing),
  },
  {
    canonical: 'porotos',
    pattern: /\bporotos?\b/,
    satisfies: (ing) => /\bporotos?\b/.test(ing),
  },
  {
    canonical: 'garbanzos',
    pattern: /\bgarbanzos?\b/,
    satisfies: (ing) => /\bgarbanzos?\b/.test(ing),
  },
  {
    canonical: 'huevo',
    pattern: /\b(huevos?|revuelto|tortilla|omelette)\b/,
    satisfies: (ing) => /\bhuevos?\b/.test(ing),
  },
  {
    canonical: 'queso',
    pattern: /\b(queso|muzzarella|parmesano|cremoso|ricota)\b/,
    satisfies: (ing) => /\b(queso|muzzarella|parmesano|cremoso|ricota|roquefort|sardo)\b/.test(ing),
  },
  {
    canonical: 'arroz',
    pattern: /\barroz\b/,
    satisfies: (ing) => /\barroz\b/.test(ing),
  },
  {
    canonical: 'fideos',
    pattern: /\b(fideos?|tallarines|spaghetti|tirabuzon|cintas|pasta)\b/,
    satisfies: (ing) => /\b(fideos?|tallarines|spaghetti|tirabuzon|cintas|pasta|harina)\b/.test(ing),
  },
  {
    canonical: 'pesto',
    pattern: /\bpesto\b/,
    satisfies: (ing) => /\b(pesto|albahaca|nuez|nueces)\b/.test(ing),
  },
  {
    canonical: 'tarta',
    pattern: /\btartas?\b/,
    satisfies: (ing) => /\b(tapa de tarta|tapas de tarta|masa de tarta|harina)\b/.test(ing),
  },
  {
    canonical: 'milanesa',
    pattern: /\bmilanesas?\b/,
    satisfies: (ing) => /\b(nalga|peceto|bola de lomo|cuadril|pollo|suprema|pan rallado|milanesa)\b/.test(ing),
  },
  {
    canonical: 'ñoquis',
    pattern: /\b(noquis|ñoquis)\b/,
    satisfies: (ing) => /\b(noquis|ñoquis|papa|harina)\b/.test(ing),
  },
];

export function validateOrderCoverage(
  mealRequest: string,
  ingredients: Array<{ nombre: string }>
): CoverageValidationResult {
  const normReq = normalizeText(mealRequest);
  const normIngredients = ingredients.map((i) => normalizeText(i.nombre));

  const excludedItems: string[] = [];
  const exclusionRegex = /\b(?:sin|no|libre de|evitar|sacale)\s+([a-z0-9]+)/g;
  let match: RegExpExecArray | null;
  while ((match = exclusionRegex.exec(normReq)) !== null) {
    if (match[1]) {
      excludedItems.push(match[1]);
    }
  }

  const positiveReq = normReq.replace(/\b(?:sin|no|libre de|evitar|sacale)\s+[a-z0-9]+/g, ' ');

  const requiredFoodRules: FoodRule[] = [];
  for (const rule of FOOD_RULES) {
    const isExcluded = excludedItems.some((ex) => rule.pattern.test(ex) || ex === rule.canonical);
    if (isExcluded) continue;

    if (rule.pattern.test(positiveReq)) {
      requiredFoodRules.push(rule);
    }
  }

  const missing: string[] = [];
  for (const rule of requiredFoodRules) {
    const isPresent = normIngredients.some((ing) => rule.satisfies(ing));
    if (!isPresent) {
      missing.push(rule.canonical);
    }
  }

  const excludedViolations: string[] = [];
  for (const ex of excludedItems) {
    for (const rule of FOOD_RULES) {
      if (rule.pattern.test(ex) || ex === rule.canonical) {
        const found = normIngredients.some((ing) => rule.satisfies(ing));
        if (found) {
          excludedViolations.push(rule.canonical);
        }
      }
    }
  }

  return {
    valid: missing.length === 0 && excludedViolations.length === 0,
    missing,
    excludedViolations,
    mentioned: requiredFoodRules.map((r) => r.canonical),
  };
}
