import { describe, it, expect, beforeEach } from 'vitest';
import { ShoppingItem, Household, HouseholdMember } from '../src/types';

/**
 * Simulación de base de datos multi-inquilino con motor de políticas RLS de Supabase.
 * Modela dos sesiones de navegador independientes (Contexto A y Contexto B)
 * y una sesión de un usuario de otro hogar (Contexto C).
 */

interface DBUser {
  id: string;
  email: string;
  display_name: string;
}

interface DBLicense {
  id: string;
  household_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'canceled';
}

interface DBPayment {
  id: string;
  household_id: string;
  user_id: string;
  amount_ars: number;
  status: string;
  external_reference: string;
}

class MockSupabaseMultiTenantEngine {
  public households: Household[] = [];
  public members: HouseholdMember[] = [];
  public shoppingItems: ShoppingItem[] = [];
  public pantryItems: Array<{ id: string; household_id: string; name: string; normalized_name: string }> = [];
  public licenses: DBLicense[] = [];
  public payments: DBPayment[] = [];

  // Canales de suscripción en tiempo real por hogar
  private subscribers: Map<string, Array<(event: string, payload: any) => void>> = new Map();

  subscribe(householdId: string, callback: (event: string, payload: any) => void) {
    if (!this.subscribers.has(householdId)) {
      this.subscribers.set(householdId, []);
    }
    this.subscribers.get(householdId)!.push(callback);
    return () => {
      const list = this.subscribers.get(householdId) || [];
      this.subscribers.set(householdId, list.filter((cb) => cb !== callback));
    };
  }

  private broadcast(householdId: string, event: string, payload: any) {
    const list = this.subscribers.get(householdId) || [];
    list.forEach((cb) => cb(event, payload));
  }

  // Helper RLS: user_belongs_to_household(h_id, u_id)
  userBelongsToHousehold(userId: string | null, householdId: string): boolean {
    if (!userId) return false;
    return this.members.some((m) => m.household_id === householdId && m.user_id === userId);
  }

  // --- Operaciones de Hogar ---
  createHousehold(user: DBUser, name: string): Household {
    const hhId = `hh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hh: Household = {
      id: hhId,
      name,
      invite_code: inviteCode,
      currency: 'ARS',
      monthly_chef_limit: 5,
      chef_queries_used_month: 0,
      created_at: new Date().toISOString(),
    };
    this.households.push(hh);

    // Trigger on_household_created: asigna admin y licencia free
    this.members.push({
      id: `m_${Date.now()}_1`,
      household_id: hhId,
      user_id: user.id,
      role: 'admin',
      display_name: user.display_name,
      joined_at: new Date().toISOString(),
    });

    this.licenses.push({
      id: `lic_${Date.now()}`,
      household_id: hhId,
      plan_id: 'free',
      status: 'active',
    });

    return hh;
  }

  joinHouseholdByCode(user: DBUser, inviteCode: string): { success: boolean; household?: Household; error?: string } {
    const targetHh = this.households.find(
      (h) => h.invite_code.toLowerCase() === inviteCode.trim().toLowerCase()
    );
    if (!targetHh) {
      return { success: false, error: 'Código de invitación no válido' };
    }

    const alreadyMember = this.members.some(
      (m) => m.household_id === targetHh.id && m.user_id === user.id
    );
    if (alreadyMember) {
      return { success: true, household: targetHh };
    }

    // Comprobar límite de miembros según plan
    const license = this.licenses.find((l) => l.household_id === targetHh.id);
    const plan = license?.plan_id || 'free';
    const currentMemberCount = this.members.filter((m) => m.household_id === targetHh.id).length;
    const maxAllowed = plan === 'free' ? 3 : plan === 'base' ? 10 : 999;

    if (currentMemberCount >= maxAllowed) {
      return { success: false, error: 'Se alcanzó el límite de miembros para este plan' };
    }

    const newMember: HouseholdMember = {
      id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      household_id: targetHh.id,
      user_id: user.id,
      role: 'member',
      display_name: user.display_name,
      joined_at: new Date().toISOString(),
    };
    this.members.push(newMember);

    this.broadcast(targetHh.id, 'MEMBER_JOINED', newMember);
    return { success: true, household: targetHh };
  }

  // --- Operaciones de shopping_items con RLS ---
  getShoppingItems(requestingUserId: string, householdId: string): ShoppingItem[] {
    if (!this.userBelongsToHousehold(requestingUserId, householdId)) {
      // RLS Policy "Acceso total a shopping_items para miembros del hogar" -> Denegado
      return [];
    }
    return this.shoppingItems.filter((i) => i.household_id === householdId && !i.deleted_at);
  }

  insertShoppingItem(requestingUserId: string, item: Omit<ShoppingItem, 'id' | 'created_at' | 'updated_at'>): ShoppingItem {
    if (!this.userBelongsToHousehold(requestingUserId, item.household_id)) {
      throw new Error('RLS_ERROR: new row violates row-level security policy for table "shopping_items"');
    }
    const fullItem: ShoppingItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.shoppingItems.push(fullItem);
    this.broadcast(item.household_id, 'INSERT', fullItem);
    return fullItem;
  }

  updateShoppingItem(requestingUserId: string, itemId: string, updates: Partial<ShoppingItem>): ShoppingItem {
    const item = this.shoppingItems.find((i) => i.id === itemId);
    if (!item) throw new Error('NOT_FOUND');

    if (!this.userBelongsToHousehold(requestingUserId, item.household_id)) {
      throw new Error('RLS_ERROR: update violates row-level security policy for table "shopping_items"');
    }

    Object.assign(item, updates, { updated_at: new Date().toISOString() });
    this.broadcast(item.household_id, 'UPDATE', item);
    return item;
  }

  softDeleteItems(requestingUserId: string, householdId: string, itemIds: string[]): void {
    if (!this.userBelongsToHousehold(requestingUserId, householdId)) {
      throw new Error('RLS_ERROR: update violates row-level security policy');
    }
    const now = new Date().toISOString();
    this.shoppingItems.forEach((i) => {
      if (itemIds.includes(i.id) && i.household_id === householdId) {
        i.deleted_at = now;
        this.broadcast(householdId, 'UPDATE', i);
      }
    });
  }

  restoreSoftDeleted(requestingUserId: string, householdId: string, itemIds: string[]): void {
    if (!this.userBelongsToHousehold(requestingUserId, householdId)) {
      throw new Error('RLS_ERROR: update violates row-level security policy');
    }
    this.shoppingItems.forEach((i) => {
      if (itemIds.includes(i.id) && i.household_id === householdId) {
        i.deleted_at = null;
        this.broadcast(householdId, 'UPDATE', i);
      }
    });
  }

  commitPermanentDelete(requestingUserId: string, householdId: string, itemIds: string[]): void {
    if (!this.userBelongsToHousehold(requestingUserId, householdId)) {
      throw new Error('RLS_ERROR: delete violates row-level security policy');
    }
    this.shoppingItems = this.shoppingItems.filter(
      (i) => !(itemIds.includes(i.id) && i.household_id === householdId)
    );
    this.broadcast(householdId, 'DELETE_PERMANENT', itemIds);
  }

  // --- Operaciones de Licencias y Pagos con RLS ---
  getLicenses(requestingUserId: string, householdId: string): DBLicense[] {
    if (!this.userBelongsToHousehold(requestingUserId, householdId)) {
      // RLS Policy "Miembros pueden ver la licencia de su propio hogar"
      return [];
    }
    return this.licenses.filter((l) => l.household_id === householdId);
  }

  clientAttemptModifyLicense(requestingUserId: string, householdId: string): void {
    // Los usuarios autenticados NO tienen política INSERT / UPDATE en licenses
    throw new Error('RLS_ERROR: permission denied for table licenses. No INSERT or UPDATE policy for authenticated users.');
  }

  getPayments(requestingUserId: string, householdId: string): DBPayment[] {
    if (!this.userBelongsToHousehold(requestingUserId, householdId)) {
      // RLS Policy "Miembros pueden ver los pagos de su propio hogar"
      return [];
    }
    return this.payments.filter((p) => p.household_id === householdId);
  }

  clientAttemptModifyPayment(requestingUserId: string): void {
    // Los usuarios autenticados NO tienen política INSERT / UPDATE en payments
    throw new Error('RLS_ERROR: permission denied for table payments. No INSERT or UPDATE policy for authenticated users.');
  }

  // Service role (Edge Function mp-webhook) para activar licencia
  serviceRoleActivateLicense(householdId: string, newPlanId: string): void {
    const lic = this.licenses.find((l) => l.household_id === householdId);
    if (lic) {
      lic.plan_id = newPlanId;
      lic.status = 'active';
      this.broadcast(householdId, 'LICENSE_UPDATED', lic);
    }
  }
}

describe('Bloque 8: Hogares multiusuario y aislamiento RLS', () => {
  let db: MockSupabaseMultiTenantEngine;

  // Tres usuarios de prueba
  const userA: DBUser = { id: 'usr_facundo_01', email: 'facundo@ejemplo.com', display_name: 'Facundo' };
  const userB: DBUser = { id: 'usr_lucia_02', email: 'lucia@ejemplo.com', display_name: 'Lucía' };
  const userC: DBUser = { id: 'usr_intruso_03', email: 'intruso@ejemplo.com', display_name: 'Marcos' };

  beforeEach(() => {
    db = new MockSupabaseMultiTenantEngine();
  });

  it('1. Creación de hogar e invitación por código/link para un segundo miembro', () => {
    // Contexto de Navegador A: Facundo crea el hogar "Hogar Pehuenes"
    const householdA = db.createHousehold(userA, 'Hogar Pehuenes');
    expect(householdA.id).toBeDefined();
    expect(householdA.invite_code.length).toBeGreaterThanOrEqual(6);

    // Facundo es el administrador inicial
    expect(db.members.length).toBe(1);
    expect(db.members[0].role).toBe('admin');
    expect(db.members[0].user_id).toBe(userA.id);

    // Generar enlace de invitación de WhatsApp
    const origin = 'https://listacompars.app';
    const inviteLink = `${origin}?join=${householdA.invite_code}`;
    expect(inviteLink).toContain(householdA.invite_code);

    // Contexto de Navegador B: Lucía abre el link e ingresa el código
    const joinResult = db.joinHouseholdByCode(userB, householdA.invite_code);
    expect(joinResult.success).toBe(true);
    expect(joinResult.household?.id).toBe(householdA.id);

    // El hogar ahora tiene 2 miembros
    const householdMembers = db.members.filter((m) => m.household_id === householdA.id);
    expect(householdMembers.length).toBe(2);
    expect(householdMembers.some((m) => m.user_id === userB.id && m.role === 'member')).toBe(true);
  });

  it('2. Sincronización en tiempo real: Usuario A agrega ítem y Usuario B lo ve', () => {
    const household = db.createHousehold(userA, 'Hogar Pehuenes');
    db.joinHouseholdByCode(userB, household.invite_code);

    // Contexto B (Lucía) escucha cambios en tiempo real
    const browserBReceivedEvents: any[] = [];
    const unsubscribeB = db.subscribe(household.id, (event, payload) => {
      browserBReceivedEvents.push({ event, payload });
    });

    // Contexto A (Facundo) agrega "Yerba mate 1kg"
    const newItem = db.insertShoppingItem(userA.id, {
      household_id: household.id,
      name: 'Yerba mate',
      normalized_name: 'yerba mate',
      quantity: 1,
      unit: 'kg',
      category: 'almacen',
      is_bought: false,
      created_by: userA.id,
      created_by_name: userA.display_name,
    });

    // Verificamos que Lucía recibió el evento INSERT en tiempo real
    expect(browserBReceivedEvents.length).toBe(1);
    expect(browserBReceivedEvents[0].event).toBe('INSERT');
    expect(browserBReceivedEvents[0].payload.name).toBe('Yerba mate');
    expect(browserBReceivedEvents[0].payload.created_by_name).toBe('Facundo');

    // Ambos usuarios ven el ítem al consultar la lista
    const itemsSeenByA = db.getShoppingItems(userA.id, household.id);
    const itemsSeenByB = db.getShoppingItems(userB.id, household.id);
    expect(itemsSeenByA.length).toBe(1);
    expect(itemsSeenByB.length).toBe(1);
    expect(itemsSeenByB[0].id).toBe(newItem.id);

    unsubscribeB();
  });

  it('3. Sincronización en tiempo real: Usuario B marca como comprado y Usuario A lo ve', () => {
    const household = db.createHousehold(userA, 'Hogar Pehuenes');
    db.joinHouseholdByCode(userB, household.invite_code);

    const item = db.insertShoppingItem(userA.id, {
      household_id: household.id,
      name: 'Leche entera',
      normalized_name: 'leche entera',
      quantity: 2,
      unit: 'l',
      category: 'lacteos',
      is_bought: false,
      created_by: userA.id,
      created_by_name: userA.display_name,
    });

    // Contexto A (Facundo) escucha cambios
    const browserAReceivedEvents: any[] = [];
    const unsubscribeA = db.subscribe(household.id, (event, payload) => {
      browserAReceivedEvents.push({ event, payload });
    });

    // Contexto B (Lucía en el supermercado) toca el checkbox y lo marca comprado
    const now = new Date().toISOString();
    const updatedItem = db.updateShoppingItem(userB.id, item.id, {
      is_bought: true,
      bought_at: now,
    });

    // Facundo recibe la actualización en vivo
    expect(browserAReceivedEvents.length).toBe(1);
    expect(browserAReceivedEvents[0].event).toBe('UPDATE');
    expect(browserAReceivedEvents[0].payload.is_bought).toBe(true);
    expect(browserAReceivedEvents[0].payload.bought_at).toBe(now);

    unsubscribeA();
  });

  it('4. Vaciar con Deshacer sincronizado entre ambos miembros', () => {
    const household = db.createHousehold(userA, 'Hogar Pehuenes');
    db.joinHouseholdByCode(userB, household.invite_code);

    const it1 = db.insertShoppingItem(userA.id, {
      household_id: household.id,
      name: 'Pan francés',
      normalized_name: 'pan frances',
      quantity: 1,
      unit: 'kg',
      category: 'panaderia',
      is_bought: true,
      created_by: userA.id,
      created_by_name: userA.display_name,
    });

    const it2 = db.insertShoppingItem(userB.id, {
      household_id: household.id,
      name: 'Manteca',
      normalized_name: 'manteca',
      quantity: 200,
      unit: 'g',
      category: 'lacteos',
      is_bought: true,
      created_by: userB.id,
      created_by_name: userB.display_name,
    });

    // Paso 4.1: Facundo toca "Vaciar comprados" -> borrado lógico inmediato
    db.softDeleteItems(userA.id, household.id, [it1.id, it2.id]);

    // Ninguno ve los ítems en su lista activa
    expect(db.getShoppingItems(userA.id, household.id).length).toBe(0);
    expect(db.getShoppingItems(userB.id, household.id).length).toBe(0);

    // Paso 4.2: Facundo toca "Deshacer" dentro de la ventana de 10s
    db.restoreSoftDeleted(userA.id, household.id, [it1.id, it2.id]);

    // Los ítems reaparecen para ambos miembros inmediatamente
    expect(db.getShoppingItems(userA.id, household.id).length).toBe(2);
    expect(db.getShoppingItems(userB.id, household.id).length).toBe(2);

    // Paso 4.3: Facundo vuelve a vaciar y expira la cuenta regresiva de 10s -> eliminación física definitiva
    db.softDeleteItems(userA.id, household.id, [it1.id, it2.id]);
    db.commitPermanentDelete(userA.id, household.id, [it1.id, it2.id]);

    // Verificación: eliminados físicamente de la base de datos
    expect(db.shoppingItems.filter((i) => i.household_id === household.id).length).toBe(0);
  });

  it('5. Aislamiento RLS estricto: Usuario ajeno NO puede leer ni escribir datos de otro hogar', () => {
    // Hogar 1 (Pehuenes) con Facundo y Lucía
    const hh1 = db.createHousehold(userA, 'Hogar Pehuenes');
    db.joinHouseholdByCode(userB, hh1.invite_code);

    // Hogar 2 (Cordillera) creado por Marcos (Usuario C)
    const hh2 = db.createHousehold(userC, 'Hogar Cordillera');

    // Cargar ítem confidencial en Hogar 1
    const privateItem = db.insertShoppingItem(userA.id, {
      household_id: hh1.id,
      name: 'Café de especialidad',
      normalized_name: 'cafe de especialidad',
      quantity: 1,
      unit: 'unidad',
      category: 'almacen',
      is_bought: false,
      created_by: userA.id,
      created_by_name: userA.display_name,
    });

    // RLS 5.1: Marcos intenta leer shopping_items de Hogar 1 -> recibe lista vacía
    const marcosReadAttempts = db.getShoppingItems(userC.id, hh1.id);
    expect(marcosReadAttempts).toEqual([]);

    // RLS 5.2: Marcos intenta insertar un ítem haciéndose pasar por Hogar 1 -> Rechazado por RLS
    expect(() => {
      db.insertShoppingItem(userC.id, {
        household_id: hh1.id,
        name: 'Item Inyectado Malicioso',
        normalized_name: 'item inyectado malicioso',
        quantity: 10,
        unit: 'unidad',
        category: 'otros',
        is_bought: false,
        created_by: userC.id,
        created_by_name: userC.display_name,
      });
    }).toThrow(/violates row-level security policy/i);

    // RLS 5.3: Marcos intenta modificar un ítem de Hogar 1 -> Rechazado por RLS
    expect(() => {
      db.updateShoppingItem(userC.id, privateItem.id, { is_bought: true });
    }).toThrow(/violates row-level security policy/i);

    // RLS 5.4: Marcos intenta leer las licencias de Hogar 1 -> Retorna vacío
    const marcosLicenseAttempts = db.getLicenses(userC.id, hh1.id);
    expect(marcosLicenseAttempts).toEqual([]);

    // RLS 5.5: Marcos intenta leer los pagos de Hogar 1 -> Retorna vacío
    const marcosPaymentAttempts = db.getPayments(userC.id, hh1.id);
    expect(marcosPaymentAttempts).toEqual([]);
  });

  it('6. RLS en Licencias y Pagos: Clientes NUNCA pueden insertar/actualizar licencias', () => {
    const hh1 = db.createHousehold(userA, 'Hogar Pehuenes');

    // Licencia inicial es Free
    const licA = db.getLicenses(userA.id, hh1.id);
    expect(licA.length).toBe(1);
    expect(licA[0].plan_id).toBe('free');

    // Intento de manipulación de plan desde el cliente por el propio usuario creador
    expect(() => {
      db.clientAttemptModifyLicense(userA.id, hh1.id);
    }).toThrow(/No INSERT or UPDATE policy for authenticated users/i);

    // Intento de manipulación de pagos desde el cliente
    expect(() => {
      db.clientAttemptModifyPayment(userA.id);
    }).toThrow(/No INSERT or UPDATE policy for authenticated users/i);

    // Solo el Service Role (ej. Webhook de Mercado Pago) puede modificar licencias
    db.serviceRoleActivateLicense(hh1.id, 'premium');
    const updatedLic = db.getLicenses(userA.id, hh1.id);
    expect(updatedLic[0].plan_id).toBe('premium');
  });

  it('7. Control de límite de integrantes por plan', () => {
    const hh = db.createHousehold(userA, 'Hogar Pehuenes');
    // En plan free, el límite es de 3 miembros
    const user2: DBUser = { id: 'u2', email: 'u2@mail.com', display_name: 'Miembro 2' };
    const user3: DBUser = { id: 'u3', email: 'u3@mail.com', display_name: 'Miembro 3' };
    const user4: DBUser = { id: 'u4', email: 'u4@mail.com', display_name: 'Miembro 4' };

    expect(db.joinHouseholdByCode(user2, hh.invite_code).success).toBe(true);
    expect(db.joinHouseholdByCode(user3, hh.invite_code).success).toBe(true);

    // El 4to integrante es rechazado por exceder el límite del plan free
    const res4 = db.joinHouseholdByCode(user4, hh.invite_code);
    expect(res4.success).toBe(false);
    expect(res4.error).toMatch(/límite de miembros/i);

    // Se actualiza el plan a Base (permite 10) vía webhook
    db.serviceRoleActivateLicense(hh.id, 'base');

    // Ahora el 4to integrante puede unirse
    const res4AfterUpgrade = db.joinHouseholdByCode(user4, hh.invite_code);
    expect(res4AfterUpgrade.success).toBe(true);
  });
});
