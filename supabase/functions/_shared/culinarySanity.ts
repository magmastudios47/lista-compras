// Validación silenciosa de ingredientes absurdos y cotejo de pasos en Edge Functions
import { ChefIngredient } from './schemas.ts';

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

interface AbsurdRule {
  dishPatterns: string[];
  forbiddenWords: string[];
  exceptionsWhenRequestContains?: string[];
}

export const ABSURD_INGREDIENTS_RULES: AbsurdRule[] = [
  {
    dishPatterns: ['pastel de papas con pollo'],
    forbiddenWords: ['carne picada', 'carne vacuna', 'arroz', 'fideo', 'fideos', 'polenta', 'lenteja', 'lentejas'],
  },
  {
    dishPatterns: ['pastel de papas', 'pastel de papa'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'polenta', 'lenteja', 'lentejas', 'pollo'],
    exceptionsWhenRequestContains: ['pollo'],
  },
  {
    dishPatterns: ['milanesa con pure de zapallo', 'milanesas con pure de zapallo', 'milanesa con pure de calabaza', 'milanesas con pure de calabaza'],
    forbiddenWords: ['papa', 'papas', 'arroz', 'fideo', 'fideos', 'polenta'],
  },
  {
    dishPatterns: ['milanesa napolitana', 'milanesas napolitanas', 'milanesa a la napolitana', 'milanesas a la napolitana'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'polenta', 'lechuga'],
  },
  {
    dishPatterns: ['tarta de jamon y queso'],
    forbiddenWords: ['carne picada', 'carne vacuna', 'carne', 'pollo', 'arroz', 'fideo', 'fideos', 'zapallo', 'papa'],
  },
  {
    dishPatterns: ['noquis de papa', 'ñoquis de papa'],
    forbiddenWords: ['arroz', 'polenta', 'fideo', 'fideos', 'carne picada', 'lenteja', 'lentejas'],
  },
  {
    dishPatterns: ['tarta de zapallitos', 'tarta de zapallito'],
    forbiddenWords: ['zapallo anco', 'calabaza', 'papa', 'arroz', 'carne picada'],
  },
  {
    dishPatterns: ['pollo al horno con batata', 'pollo con batatas', 'pollo con batata'],
    forbiddenWords: ['papa', 'papas', 'arroz', 'fideo', 'fideos'],
    exceptionsWhenRequestContains: ['papa'],
  },
  {
    dishPatterns: ['fideos con salsa blanca', 'pasta con salsa blanca'],
    forbiddenWords: ['salsa de tomate', 'pure de tomate', 'tomate perita', 'arroz', 'polenta'],
  },
  {
    dishPatterns: ['ensalada de papa y huevo', 'ensalada de papas y huevo'],
    forbiddenWords: ['lechuga', 'arroz', 'fideo', 'fideos', 'carne'],
  },
  {
    dishPatterns: ['tortilla de papas', 'tortilla de papa'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'espinaca', 'acelga', 'polenta'],
  },
  {
    dishPatterns: ['tortilla de verduras', 'tortilla de verdura', 'tortilla de acelga', 'tortilla de espinaca'],
    forbiddenWords: ['papa', 'papas', 'arroz', 'fideos'],
  },
  {
    dishPatterns: ['guiso de lentejas'],
    forbiddenWords: ['fideo', 'fideos', 'polenta', 'pescado', 'merluza'],
  },
  {
    dishPatterns: ['arroz con pollo'],
    forbiddenWords: ['fideo', 'fideos', 'polenta', 'carne picada', 'merluza'],
  },
  {
    dishPatterns: ['empanadas de carne'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'papa', 'zapallo'],
  },
  {
    dishPatterns: ['empanadas de jamon y queso'],
    forbiddenWords: ['carne picada', 'carne', 'pollo', 'arroz'],
  },
  {
    dishPatterns: ['humita en chala', 'cazuela de humita', 'humita'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'carne picada'],
  },
  {
    dishPatterns: ['locro'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'polenta'],
  },
  {
    dishPatterns: ['matambre a la pizza'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'polenta'],
  },
  {
    dishPatterns: ['costillitas de cerdo con pure de manzana'],
    forbiddenWords: ['papa', 'arroz', 'fideo', 'fideos'],
  },
  {
    dishPatterns: ['canelones de verdura y ricota', 'canelones de acelga y ricota'],
    forbiddenWords: ['arroz', 'polenta', 'carne picada'],
  },
  {
    dishPatterns: ['flan casero', 'flan mixto'],
    forbiddenWords: ['harina', 'chocolate', 'levadura', 'manteca'],
  },
  {
    dishPatterns: ['panqueques con dulce de leche'],
    forbiddenWords: ['levadura', 'queso', 'carne', 'pollo'],
  },
  {
    dishPatterns: ['arroz con leche'],
    forbiddenWords: ['fideos', 'sal gruesa', 'pimienta', 'carne', 'cebolla'],
  },
  {
    dishPatterns: ['revuelto gramajo'],
    forbiddenWords: ['arroz', 'fideo', 'fideos', 'polenta', 'zapallo'],
  },
  {
    dishPatterns: ['vitel tone', 'vitel toné'],
    forbiddenWords: ['arroz', 'fideos', 'papa', 'polenta'],
  },
  {
    dishPatterns: ['pure de papas', 'pure de papa'],
    forbiddenWords: ['zapallo', 'calabaza', 'arroz', 'fideo'],
  },
  {
    dishPatterns: ['pure de zapallo', 'pure de calabaza'],
    forbiddenWords: ['papa', 'papas', 'arroz', 'fideo'],
  },
  {
    dishPatterns: ['sopa paraguaya'],
    forbiddenWords: ['fideos', 'arroz', 'papa'],
  },
  {
    dishPatterns: ['pizza muzzarella', 'pizza de muzzarella'],
    forbiddenWords: ['arroz', 'fideos', 'carne picada'],
  },
  {
    dishPatterns: ['trucha a la manteca', 'trucha a la plancha'],
    forbiddenWords: ['carne vacuna', 'carne picada', 'pollo', 'arroz'],
  },
];

export function filterAbsurdIngredients(
  dishOrRequestName: string,
  ingredients: any[]
): any[] {
  if (!dishOrRequestName || !ingredients || ingredients.length === 0) {
    return ingredients;
  }

  const normInput = normalizeString(dishOrRequestName);

  for (const rule of ABSURD_INGREDIENTS_RULES) {
    const matchesPattern = rule.dishPatterns.some((pattern) => {
      const normPattern = normalizeString(pattern);
      return normInput.includes(normPattern);
    });

    if (matchesPattern) {
      if (rule.exceptionsWhenRequestContains) {
        const hasException = rule.exceptionsWhenRequestContains.some((exc) =>
          normInput.includes(normalizeString(exc))
        );
        if (hasException) {
          continue;
        }
      }

      return ingredients.filter((ing) => {
        const normIng = normalizeString(ing.nombre);
        const isForbidden = rule.forbiddenWords.some((word) => {
          const normWord = normalizeString(word);
          // Si el usuario pidió explícitamente este ingrediente (en singular o plural) y no dijo "sin <ingrediente>", nunca filtrarlo
          const baseStem = normWord.replace(/s$/, '');
          const stemRegex = new RegExp(`\\b${baseStem}(?:s|es)?\\b`);
          const sinRegex = new RegExp(`\\b(?:sin|no)\\s+${baseStem}(?:s|es)?\\b`);
          if (stemRegex.test(normInput) && !sinRegex.test(normInput)) {
            return false;
          }
          return (
            normIng === normWord ||
            normIng.startsWith(normWord + ' ') ||
            normIng.endsWith(' ' + normWord) ||
            normIng.includes(' ' + normWord + ' ')
          );
        });
        return !isForbidden;
      });
    }
  }

  return ingredients;
}

export function validateIngredientsAgainstSteps(
  steps: string[] | undefined,
  ingredients: any[]
): any[] {
  if (!steps || steps.length === 0 || !ingredients || ingredients.length === 0) {
    return ingredients;
  }

  const fullStepsText = normalizeString(steps.join(' '));

  return ingredients.map((ing) => {
    if (ing.es_basico) {
      return ing;
    }

    const normName = normalizeString(ing.nombre);
    const words = normName.split(/\s+/).filter((w: string) => w.length > 2);

    const appearsInSteps =
      fullStepsText.includes(normName) ||
      words.some((word: string) => fullStepsText.includes(word));

    if (!appearsInSteps) {
      return {
        ...ing,
        opcional: true,
      };
    }

    return ing;
  });
}
