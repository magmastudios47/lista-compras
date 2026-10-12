// Historial de Platos de los últimos 2 Menús Semanales por Hogar (Ronda 5 Bloque 2)
// Permite evitar la repetición de platos de una semana a otra

const HISTORY_KEY_PREFIX = 'recent_menus_';

export function getRecentHouseholdDishes(householdId: string): string[] {
  if (!householdId) return [];
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${householdId}`);
    if (!raw) return [];
    const parsed: string[][] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Aplanar los últimos 2 menús y eliminar duplicados
    const allDishes = parsed.slice(0, 2).flat();
    return Array.from(new Set(allDishes.filter(Boolean)));
  } catch {
    return [];
  }
}

export function saveHouseholdMenuHistory(householdId: string, dishes: string[]): void {
  if (!householdId || !dishes || dishes.length === 0) return;
  try {
    const raw = localStorage.getItem(`${HISTORY_KEY_PREFIX}${householdId}`);
    let history: string[][] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        history = parsed;
      }
    }
    // Agregar el nuevo menú al inicio y conservar solo los 2 más recientes
    const uniqueDishes = Array.from(new Set(dishes.filter(Boolean)));
    const updated = [uniqueDishes, ...history].slice(0, 2);
    localStorage.setItem(`${HISTORY_KEY_PREFIX}${householdId}`, JSON.stringify(updated));
  } catch {
    // Fallback silencioso en entornos restringidos
  }
}

export function clearHouseholdMenuHistory(householdId: string): void {
  if (!householdId) return;
  try {
    localStorage.removeItem(`${HISTORY_KEY_PREFIX}${householdId}`);
  } catch {
    // Fallback silencioso
  }
}
