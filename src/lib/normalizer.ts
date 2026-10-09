// Normalizador de texto e ingredientes para español rioplatense

/**
 * Normaliza una cadena eliminando tildes, signos, mayúsculas y espacios sobrantes.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita acentos diacríticos
    .replace(/[^\w\s]/gi, ' ')      // Quita signos de puntuación
    .replace(/\s+/g, ' ')           // Unifica espacios
    .trim();
}

/**
 * Convierte un nombre de ingrediente en español al singular más probable.
 * Respeta excepciones culinarias como fideos, porotos, etc.
 */
export function singularizeIngredient(name: string): string {
  const norm = normalizeString(name);
  if (!norm) return '';

  // Excepciones donde el plural es el nombre común o no debe tocarse
  const exceptions: Record<string, string> = {
    fideos: 'fideos',
    porotos: 'porotos',
    copos: 'copos',
    garbanzos: 'garbanzo',
    frutos: 'frutos',
  };

  if (exceptions[norm]) return exceptions[norm];

  // Sinónimos comunes en Argentina
  const argentineSynonyms: Record<string, string> = {
    patata: 'papa',
    patatas: 'papa',
    maiz: 'choclo',
    pimiento: 'morron',
    pimientos: 'morron',
    morrones: 'morron',
    tomates: 'tomate',
    cebollas: 'cebolla',
    papas: 'papa',
    huevos: 'huevo',
    zanahorias: 'zanahoria',
    zapallitos: 'zapallito',
    manzanas: 'manzana',
    naranjas: 'naranja',
    limones: 'limon',
    milanesas: 'milanesa',
    empanadas: 'empanada',
    tapas: 'tapa',
    latas: 'lata',
    paquetes: 'paquete',
  };

  if (argentineSynonyms[norm]) return argentineSynonyms[norm];

  // Reglas morfológicas simples de singularización
  const words = norm.split(' ');
  const singularWords = words.map((w) => {
    if (argentineSynonyms[w]) return argentineSynonyms[w];
    if (w.endsWith('ces')) return w.slice(0, -3) + 'z'; // nueces -> nuez
    if (w.endsWith('es') && !w.endsWith('les') && !w.endsWith('nes') && w.length > 4) {
      // carnes -> carne, tomates -> tomate ya cubierto
      return w.slice(0, -1);
    }
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) {
      return w.slice(0, -1);
    }
    return w;
  });

  return singularWords.join(' ');
}
