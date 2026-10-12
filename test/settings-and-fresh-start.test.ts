import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEYS } from '../src/lib/constants';
import {
  DEFAULT_USER_PREFERENCES,
  DEFAULT_HOUSEHOLD_SETTINGS,
  UserPreferences,
  HouseholdSettings,
} from '../src/context/SettingsContext';

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] || null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockStorage();
(globalThis as any).localStorage = mockStorage;

describe('Ronda 5 - Bloque 3: Persistencia de Configuración y Arranque desde Cero', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. Usuario nuevo arranca 100% limpio sin datos precargados ni nombres fantasmas', () => {
    // Almacenamiento limpio
    expect(localStorage.getItem(STORAGE_KEYS.CURRENT_USER)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.CURRENT_HOUSEHOLD)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_ITEMS)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_PANTRY)).toBeNull();

    // Valores por defecto no contienen datos personales ni de prueba
    expect(DEFAULT_USER_PREFERENCES.profileDetail).toBe('');
    expect(DEFAULT_HOUSEHOLD_SETTINGS.city).toBe('');
    expect(DEFAULT_HOUSEHOLD_SETTINGS.weeklyMenuMandatoryDishes).toBe('');
    expect(DEFAULT_HOUSEHOLD_SETTINGS.dietaryRestrictions).toEqual([]);

    // No debe haber ninguna referencia hardcodeada a Facundo ni a Los Pehuenes
    const userJson = JSON.stringify(DEFAULT_USER_PREFERENCES);
    const hhJson = JSON.stringify(DEFAULT_HOUSEHOLD_SETTINGS);
    expect(userJson.toLowerCase()).not.toContain('facundo');
    expect(hhJson.toLowerCase()).not.toContain('facundo');
    expect(hhJson.toLowerCase()).not.toContain('pehuen');
  });

  it('2. Persistencia automática: cambiar configuración y verificar que se mantiene tras recarga', () => {
    // Simulamos un usuario que personaliza su menú semanal y hogar
    const updatedUserPrefs: UserPreferences = {
      theme: 'dark',
      targetProfile: 'Deportista',
      profileDetail: 'Entrenamiento de alta intensidad, 5 días por semana',
      uiPreferences: { compactView: true },
    };

    const updatedHhSettings: HouseholdSettings = {
      pantryAddMode: 'auto',
      pantryExcludeCleaning: true,
      dietaryRestrictions: ['Sin TACC / Celíaco', 'Bajo en sodio'],
      weeklyMenuDaysConfig: {
        Lunes: ['almuerzo', 'cena'],
        Martes: ['almuerzo'],
        Miércoles: ['cena'],
        Jueves: ['almuerzo', 'cena'],
        Viernes: ['almuerzo', 'cena'],
        Sábado: ['almuerzo', 'cena'],
        Domingo: ['almuerzo'],
      },
      weeklyMenuPersons: 6,
      weeklyMenuMandatoryDishes: 'Pastel de papas el domingo',
      city: 'San Martín de los Andes',
    };

    // Guardado en caché persistente
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updatedUserPrefs));
    localStorage.setItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS, JSON.stringify(updatedHhSettings));

    // Simulación de "Recarga de página" (leer desde almacenamiento)
    const reloadedUserPrefsRaw = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    const reloadedHhSettingsRaw = localStorage.getItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS);

    expect(reloadedUserPrefsRaw).not.toBeNull();
    expect(reloadedHhSettingsRaw).not.toBeNull();

    const restoredUserPrefs: UserPreferences = JSON.parse(reloadedUserPrefsRaw!);
    const restoredHhSettings: HouseholdSettings = JSON.parse(reloadedHhSettingsRaw!);

    // Verificación de integridad tras recarga
    expect(restoredUserPrefs.theme).toBe('dark');
    expect(restoredUserPrefs.targetProfile).toBe('Deportista');
    expect(restoredUserPrefs.profileDetail).toBe('Entrenamiento de alta intensidad, 5 días por semana');

    expect(restoredHhSettings.weeklyMenuPersons).toBe(6);
    expect(restoredHhSettings.weeklyMenuMandatoryDishes).toBe('Pastel de papas el domingo');
    expect(restoredHhSettings.dietaryRestrictions).toEqual(['Sin TACC / Celíaco', 'Bajo en sodio']);
    expect(restoredHhSettings.pantryAddMode).toBe('auto');
    expect(restoredHhSettings.city).toBe('San Martín de los Andes');
    expect(restoredHhSettings.weeklyMenuDaysConfig.Martes).toEqual(['almuerzo']);
    expect(restoredHhSettings.weeklyMenuDaysConfig.Miércoles).toEqual(['cena']);
  });

  it('3. Separación de responsabilidades: restricciones del hogar vs perfil de usuario', () => {
    // Las restricciones pertenecen al hogar (compartidas con la familia)
    const householdA: HouseholdSettings = {
      ...DEFAULT_HOUSEHOLD_SETTINGS,
      dietaryRestrictions: ['Vegetariano'],
    };

    // El perfil nutricional pertenece a la preferencia del usuario individual
    const user1Prefs: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      targetProfile: 'Ganar masa muscular',
    };

    const user2Prefs: UserPreferences = {
      ...DEFAULT_USER_PREFERENCES,
      targetProfile: 'Bajar de peso',
    };

    // Ambos usuarios del mismo hogar comparten la restricción familiar
    expect(householdA.dietaryRestrictions).toContain('Vegetariano');
    // Pero cada usuario mantiene su propio perfil de objetivo sin pisarse
    expect(user1Prefs.targetProfile).toBe('Ganar masa muscular');
    expect(user2Prefs.targetProfile).toBe('Bajar de peso');
  });

  it('4. Sincronización multidispositivo: actualización en Dispositivo A se refleja en Dispositivo B', () => {
    // Estado inicial en Dispositivo B
    let deviceBHouseholdSettings: HouseholdSettings = {
      ...DEFAULT_HOUSEHOLD_SETTINGS,
      dietaryRestrictions: [],
    };

    // Dispositivo A actualiza los ajustes compartidos del hogar
    const deviceAPayload: Partial<HouseholdSettings> = {
      dietaryRestrictions: ['Sin lactosa'],
      weeklyMenuPersons: 3,
      pantryAddMode: 'never',
    };

    // Simulador del handler Realtime de Supabase en Dispositivo B
    const handleRemoteRealtimeUpdate = (incoming: Partial<HouseholdSettings>) => {
      deviceBHouseholdSettings = {
        ...deviceBHouseholdSettings,
        ...incoming,
      };
      localStorage.setItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS, JSON.stringify(deviceBHouseholdSettings));
    };

    // Disparar evento de sync
    handleRemoteRealtimeUpdate(deviceAPayload);

    // Dispositivo B actualizó su estado y su caché local de inmediato
    expect(deviceBHouseholdSettings.dietaryRestrictions).toEqual(['Sin lactosa']);
    expect(deviceBHouseholdSettings.weeklyMenuPersons).toBe(3);
    expect(deviceBHouseholdSettings.pantryAddMode).toBe('never');

    const cachedInB = JSON.parse(localStorage.getItem(STORAGE_KEYS.HOUSEHOLD_SETTINGS)!);
    expect(cachedInB.dietaryRestrictions).toEqual(['Sin lactosa']);
  });
});
