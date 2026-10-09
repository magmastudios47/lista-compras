import { Category, Unit } from '../types';
import { ARGENTINE_CATALOG, CATALOG_EXACT_MAP, CatalogProduct } from './catalog';
import { normalizeString, singularizeIngredient } from './normalizer';

export interface ProcessedItem {
  texto_original: string;
  nombre: string;
  cantidad: number | null;
  unidad: Unit | null;
  categoria: Category;
  corregido: boolean;
  confianza: 'alta' | 'media' | 'baja';
  sugerencia?: string | null;
}

/**
 * Distancia Levenshtein clásica optimizada con dos vectores
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const v0 = new Int32Array(b.length + 1);
  const v1 = new Int32Array(b.length + 1);

  for (let i = 0; i <= b.length; i++) v0[i] = i;

  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }

  return v0[b.length];
}

/**
 * Extrae cantidad y unidad si están al frente del texto.
 * Ejemplos:
 *  "2 cebollas" -> cantidad 2, unidad 'unidad', resto 'cebollas'
 *  "1 kg de papa" -> cantidad 1, unidad 'kg', resto 'papa'
 *  "medio kilo de papa" -> cantidad 0.5, unidad 'kg', resto 'papa'
 *  "250 g de carne picada" -> cantidad 250, unidad 'g', resto 'carne picada'
 */
export function extractQuantityAndUnit(text: string): {
  cleanName: string;
  quantity: number | null;
  unit: Unit | null;
} {
  let clean = text.trim();

  // 1. Manejo de expresiones coloquiales como "medio kilo", "un cuarto kilo"
  if (/^medio\s+kilo\s+(?:de\s+)?/i.test(clean)) {
    return {
      cleanName: clean.replace(/^medio\s+kilo\s+(?:de\s+)?/i, '').trim(),
      quantity: 0.5,
      unit: 'kg',
    };
  }
  if (/^(?:un\s+)?cuarto\s+kilo\s+(?:de\s+)?/i.test(clean)) {
    return {
      cleanName: clean.replace(/^(?:un\s+)?cuarto\s+kilo\s+(?:de\s+)?/i, '').trim(),
      quantity: 0.25,
      unit: 'kg',
    };
  }
  if (/^medio\s+litro\s+(?:de\s+)?/i.test(clean)) {
    return {
      cleanName: clean.replace(/^medio\s+litro\s+(?:de\s+)?/i, '').trim(),
      quantity: 0.5,
      unit: 'l',
    };
  }

  // 2. Regex con números (enteros o decimales con coma o punto)
  // Ej: "2 cebollas", "1.5 kg papa", "1,5kg de papa", "500g queso"
  const regexNum = /^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilogramos?|g|gramos?|grs?|l|litros?|ml|cc|latas?|paquetes?|paq|atados?|dientes?|tazas?|cucharadas?|cucharaditas?|unidades?|u\b)?\s*(?:de\s+)?(.*)$/i;
  const match = clean.match(regexNum);

  if (match) {
    const rawNum = parseFloat(match[1].replace(',', '.'));
    const rawUnit = (match[2] || '').toLowerCase();
    const remainingText = match[3]?.trim() || '';

    let parsedUnit: Unit | null = null;
    if (rawUnit.startsWith('k')) parsedUnit = 'kg';
    else if (rawUnit.startsWith('gr') || rawUnit === 'g') parsedUnit = 'g';
    else if (rawUnit.startsWith('ml') || rawUnit === 'cc') parsedUnit = 'ml';
    else if (rawUnit.startsWith('l') && !rawUnit.includes('ata')) parsedUnit = 'l';
    else if (rawUnit.startsWith('lat')) parsedUnit = 'lata';
    else if (rawUnit.startsWith('paq')) parsedUnit = 'paquete';
    else if (rawUnit.startsWith('atad')) parsedUnit = 'atado';
    else if (rawUnit.startsWith('dient')) parsedUnit = 'diente';
    else if (rawUnit.startsWith('taz')) parsedUnit = 'taza';
    else if (rawUnit.startsWith('cucharadit')) parsedUnit = 'cucharadita';
    else if (rawUnit.startsWith('cucharad')) parsedUnit = 'cucharada';
    else if (rawUnit.startsWith('u')) parsedUnit = 'unidad';
    else if (!rawUnit) parsedUnit = 'unidad'; // "2 cebollas" -> 2 unidades

    return {
      cleanName: remainingText || clean,
      quantity: isNaN(rawNum) ? null : rawNum,
      unit: parsedUnit,
    };
  }

  return { cleanName: clean, quantity: null, unit: null };
}

/**
 * Busca un producto en el catálogo por coincidencia exacta, sinónimos o Levenshtein
 */
export function matchCatalogItem(query: string): {
  product: CatalogProduct;
  confidence: 'alta' | 'media';
  corregido: boolean;
  sugerencia?: string;
} | null {
  const norm = normalizeString(query);
  if (!norm) return null;

  // 1. Calce exacto en Map
  const exact = CATALOG_EXACT_MAP.get(norm);
  if (exact) {
    return { product: exact, confidence: 'alta', corregido: exact.nombre !== norm };
  }

  // 2. Singularización previa
  const singular = singularizeIngredient(norm);
  const exactSingular = CATALOG_EXACT_MAP.get(singular);
  if (exactSingular) {
    return { product: exactSingular, confidence: 'alta', corregido: true };
  }

  // 3. Búsqueda aproximada mediante Levenshtein
  let bestMatch: CatalogProduct | null = null;
  let minDistance = Infinity;

  // Comparar con nombres y sinónimos
  for (const prod of ARGENTINE_CATALOG) {
    const distNombre = levenshtein(norm, prod.nombre);
    if (distNombre < minDistance) {
      minDistance = distNombre;
      bestMatch = prod;
    }

    // También comparar contra sinónimos
    for (const sin of prod.sinonimos) {
      const distSin = levenshtein(norm, sin);
      if (distSin < minDistance) {
        minDistance = distSin;
        bestMatch = prod;
      }
    }
  }

  if (bestMatch) {
    const maxLen = Math.max(norm.length, bestMatch.nombre.length);
    // Para palabras cortas (<= 4 letras, ej: "papaa" dist 1 con "papa", "tomte" dist 1 con "tomate")
    if (norm.length <= 4 && minDistance <= 1) {
      return { product: bestMatch, confidence: 'alta', corregido: true };
    }
    // Para palabras medianas/largas (distancia <= 2 y ratio alto)
    if (norm.length > 4 && minDistance <= 2) {
      return { product: bestMatch, confidence: 'alta', corregido: true };
    }
    // Calce dudoso para sugerencia
    if (minDistance <= 3 && (1 - minDistance / maxLen) >= 0.65) {
      return {
        product: bestMatch,
        confidence: 'media',
        corregido: false,
        sugerencia: `¿Quisiste decir ${bestMatch.nombre}?`,
      };
    }
  }

  return null;
}

/**
 * Segmenta una cadena de texto sin separadores buscando el calce más largo en el catálogo.
 * Ej: "papa huevo leche" -> ["papa", "huevo", "leche"]
 *     "papas fritas" -> ["papas fritas"]
 *     "dulce de leche pan rallado" -> ["dulce de leche", "pan rallado"]
 */
export function segmentLongestMatch(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text.trim()];

  const segments: string[] = [];
  let i = 0;

  while (i < words.length) {
    let matchedLength = 0;
    let matchedChunk = '';

    // Probar ventanas desde 4 palabras descendiendo a 1
    const maxWindow = Math.min(4, words.length - i);
    for (let w = maxWindow; w >= 1; w--) {
      const candidate = words.slice(i, i + w).join(' ');
      const match = matchCatalogItem(candidate);
      if (match && match.confidence === 'alta') {
        matchedLength = w;
        matchedChunk = candidate;
        break;
      }
    }

    if (matchedLength > 0) {
      segments.push(matchedChunk);
      i += matchedLength;
    } else {
      // Si ninguna ventana calzó, agregar la palabra individual
      segments.push(words[i]);
      i += 1;
    }
  }

  return segments;
}

// ========================================================================
// MEMORIA DE CATEGORÍAS POR HOGAR Y CACHÉ LOCAL
// ========================================================================

const CATEGORY_OVERRIDES_KEY = 'compars_category_overrides';
const AI_CACHE_KEY = 'compars_ai_items_cache';

const memoryFallbackStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {}
  return memoryFallbackStorage.get(key) || null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
    }
  } catch {}
  memoryFallbackStorage.set(key, value);
}

export function getHouseholdCategoryOverride(itemName: string, householdId?: string): Category | null {
  try {
    const key = householdId ? `${CATEGORY_OVERRIDES_KEY}_${householdId}` : CATEGORY_OVERRIDES_KEY;
    const stored = getStorageItem(key);
    if (!stored) return null;
    const map = JSON.parse(stored);
    const norm = normalizeString(itemName);
    return map[norm] || null;
  } catch {
    return null;
  }
}

export function saveHouseholdCategoryOverride(itemName: string, category: Category, householdId?: string) {
  try {
    const key = householdId ? `${CATEGORY_OVERRIDES_KEY}_${householdId}` : CATEGORY_OVERRIDES_KEY;
    const stored = getStorageItem(key);
    const map = stored ? JSON.parse(stored) : {};
    map[normalizeString(itemName)] = category;
    setStorageItem(key, JSON.stringify(map));
  } catch {
    // ignorar
  }
}

export function getCachedAiItem(query: string): ProcessedItem | null {
  try {
    const stored = getStorageItem(AI_CACHE_KEY);
    if (!stored) return null;
    const map = JSON.parse(stored);
    const norm = normalizeString(query);
    return map[norm] || null;
  } catch {
    return null;
  }
}

export function saveCachedAiItem(query: string, item: ProcessedItem) {
  try {
    const stored = getStorageItem(AI_CACHE_KEY);
    const map = stored ? JSON.parse(stored) : {};
    map[normalizeString(query)] = item;
    setStorageItem(AI_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignorar
  }
}

// ========================================================================
// PIPELINE PRINCIPAL UNIFICADO
// ========================================================================

/**
 * Procesa cualquier texto ingresado a mano (un solo producto o texto compuesto),
 * resolviendo ortografía, separadores, segmentación y categorías.
 */
export function processHandwrittenText(rawText: string, householdId?: string): ProcessedItem[] {
  if (!rawText || !rawText.trim()) return [];

  const trimmed = rawText.trim();

  // 1. Detectar si contiene separadores explícitos: comas, saltos de línea, punto y coma, " y ", " e "
  const hasSeparators = /[,;\n\r]|\s+y\s+|\s+e\s+/i.test(trimmed);

  let initialChunks: string[] = [];

  if (hasSeparators) {
    initialChunks = trimmed
      .split(/[,;\n\r]+|\s+y\s+|\s+e\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    // No tiene separadores: verificar si la frase completa es un único producto (ej: "papas fritas", "dulce de leche")
    const { cleanName } = extractQuantityAndUnit(trimmed);
    const wholeMatch = matchCatalogItem(cleanName);

    if (wholeMatch && wholeMatch.confidence === 'alta') {
      initialChunks = [trimmed];
    } else {
      // Si no es un único producto en el catálogo, segmentar por longest match
      initialChunks = segmentLongestMatch(trimmed);
    }
  }

  // 2. Procesar cada chunk
  const results: ProcessedItem[] = [];

  for (const chunk of initialChunks) {
    if (!chunk.trim()) continue;

    // a. Extraer cantidad y unidad si están al frente
    const { cleanName, quantity, unit } = extractQuantityAndUnit(chunk);
    const norm = normalizeString(cleanName);

    // b. Verificar memoria de categoría del hogar
    const overrideCategory = getHouseholdCategoryOverride(norm, householdId);

    // c. Verificar catálogo
    const catalogMatch = matchCatalogItem(norm);

    if (catalogMatch) {
      results.push({
        texto_original: chunk,
        nombre: catalogMatch.product.nombre,
        cantidad: quantity,
        unidad: unit || catalogMatch.product.unidad_por_defecto,
        categoria: overrideCategory || catalogMatch.product.categoria,
        corregido: catalogMatch.corregido || cleanName !== catalogMatch.product.nombre,
        confianza: catalogMatch.confidence,
        sugerencia: catalogMatch.sugerencia || null,
      });
      continue;
    }

    // d. Verificar caché de IA previa
    const cachedAi = getCachedAiItem(norm);
    if (cachedAi) {
      results.push({
        ...cachedAi,
        texto_original: chunk,
        cantidad: quantity || cachedAi.cantidad,
        unidad: unit || cachedAi.unidad,
        categoria: overrideCategory || cachedAi.categoria,
      });
      continue;
    }

    // e. No reconocido en catálogo ni caché: marcar para sugerencia o IA
    const singular = singularizeIngredient(norm) || norm;
    results.push({
      texto_original: chunk,
      nombre: singular,
      cantidad: quantity,
      unidad: unit || 'unidad',
      categoria: overrideCategory || 'otros',
      corregido: false,
      confianza: 'baja',
      sugerencia: null,
    });
  }

  return results;
}
