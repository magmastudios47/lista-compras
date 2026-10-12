import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

// ========================================================================
// MODELO Y LÓGICA DE CONTROL DE ACCESO (RONDA 5 - BLOQUE 4)
// ========================================================================

interface LicenseRecord {
  id: string;
  household_id: string;
  plan_id: 'free' | 'base' | 'premium' | 'tester';
  status: 'active' | 'expired' | 'canceled';
  valid_until: string | null;
}

interface AccessCodeRecord {
  id: string;
  code_hash: string;
  plan_id: 'base' | 'premium' | 'tester';
  max_uses: number;
  times_used: number;
  expires_at: string | null;
}

interface HouseholdInvitationRecord {
  id: string;
  household_id: string;
  token_hash: string;
  expires_at: string;
  max_uses: number;
  times_used: number;
  is_revoked: boolean;
  requires_owner_approval: boolean;
}

interface HouseholdMemberRecord {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
}

function sha256Hex(text: string): string {
  return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

function sha256Code(text: string): string {
  return crypto.createHash('sha256').update(text.trim().toUpperCase()).digest('hex');
}

class AccessControlEngine {
  accessMode: 'closed' | 'open' = 'closed';
  trialCredits: number = 0;

  plans: Record<string, { max_members: number; monthly_chef_queries: number }> = {
    free: { max_members: 3, monthly_chef_queries: 5 },
    base: { max_members: 6, monthly_chef_queries: 40 },
    premium: { max_members: 8, monthly_chef_queries: 150 },
    tester: { max_members: 99, monthly_chef_queries: 9999 },
  };

  licenses: Map<string, LicenseRecord> = new Map();
  accessCodes: Map<string, AccessCodeRecord> = new Map();
  invitations: Map<string, HouseholdInvitationRecord> = new Map();
  members: HouseholdMemberRecord[] = [];
  shoppingItems: Array<{ id: string; household_id: string; name: string }> = [];

  hasActiveLicense(householdId: string): boolean {
    if (this.accessMode === 'open') return true;

    const lic = this.licenses.get(householdId);
    if (!lic) return false;
    if (lic.status !== 'active') return false;
    if (lic.valid_until && new Date(lic.valid_until) <= new Date()) return false;
    return ['base', 'premium', 'tester'].includes(lic.plan_id);
  }

  // RLS Simulation: shopping item access
  queryShoppingItems(userId: string, householdId: string): { allowed: boolean; data: any[] } {
    const isMember = this.members.some((m) => m.household_id === householdId && m.user_id === userId);
    if (!isMember) {
      return { allowed: false, data: [] };
    }

    const licensed = this.hasActiveLicense(householdId);
    if (!licensed) {
      return { allowed: false, data: [] }; // En modo closed sin licencia activa RLS rechaza
    }

    const items = this.shoppingItems.filter((i) => i.household_id === householdId);
    return { allowed: true, data: items };
  }

  // Edge Function simulation: Chef AI call
  callChefAi(householdId: string, mode: string): { status: number; body: any } {
    if (this.accessMode === 'closed') {
      const licensed = this.hasActiveLicense(householdId);
      if (!licensed && this.trialCredits <= 0) {
        return {
          status: 403,
          body: {
            error: 'Acceso restringido: este hogar no cuenta con una licencia activa de Lista Compars.',
            code: 'LICENSE_REQUIRED',
          },
        };
      }
    }

    const lic = this.licenses.get(householdId);
    const plan = lic ? lic.plan_id : 'free';
    if ((mode === 'menu' || mode === 'planificar_semana') && plan !== 'premium' && plan !== 'tester') {
      return {
        status: 403,
        body: {
          error: 'La planificación del Menú Semanal requiere el plan Premium.',
          requires_premium: true,
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        origen: 'ia',
      },
    };
  }

  // RPC simulation: preview_household_invitation
  previewInvitation(rawToken: string): { valid: boolean; error?: string; household_id?: string } {
    const tokenHash = sha256Hex(rawToken);
    const inv = this.invitations.get(tokenHash);

    if (!inv) return { valid: false, error: 'Invitación inexistente o token inválido.' };
    if (inv.is_revoked) return { valid: false, error: 'Esta invitación fue revocada.' };
    if (new Date(inv.expires_at) <= new Date()) return { valid: false, error: 'La invitación ha expirado.' };
    if (inv.times_used >= inv.max_uses) return { valid: false, error: 'La invitación ya alcanzó su límite máximo de usos.' };

    return { valid: true, household_id: inv.household_id };
  }

  // RPC simulation: join_household_via_invitation (atómica con bloqueo de miembros)
  joinViaInvitation(userId: string, rawToken: string): { success: boolean; error?: string } {
    const preview = this.previewInvitation(rawToken);
    if (!preview.valid || !preview.household_id) {
      return { success: false, error: preview.error };
    }

    const hhId = preview.household_id;
    const inv = this.invitations.get(sha256Hex(rawToken))!;

    // Verificar si ya es integrante
    if (this.members.some((m) => m.household_id === hhId && m.user_id === userId)) {
      return { success: true };
    }

    // Tope de integrantes según el plan activo del hogar
    const lic = this.licenses.get(hhId);
    const planId = lic?.status === 'active' ? lic.plan_id : 'base';
    const maxMembers = this.plans[planId]?.max_members || 6;

    const currentCount = this.members.filter((m) => m.household_id === hhId).length;
    if (currentCount >= maxMembers) {
      return {
        success: false,
        error: `El hogar ha alcanzado el límite máximo de integrantes de su plan (${maxMembers}).`,
      };
    }

    // Unión atómica
    this.members.push({
      id: `m_${Date.now()}_${userId}`,
      household_id: hhId,
      user_id: userId,
      role: 'member',
    });

    inv.times_used += 1;
    return { success: true };
  }

  // RPC simulation: redeem_access_code
  redeemAccessCode(userId: string, rawCode: string, householdName: string): { success: boolean; error?: string; household_id?: string } {
    const codeHash = sha256Code(rawCode);
    const code = this.accessCodes.get(codeHash);

    if (!code) return { success: false, error: 'Código de acceso inexistente o inválido.' };
    if (code.times_used >= code.max_uses) return { success: false, error: 'El código de acceso ya fue utilizado.' };
    if (code.expires_at && new Date(code.expires_at) <= new Date()) {
      return { success: false, error: 'El código de acceso ha expirado.' };
    }

    const newHhId = `hh_${Date.now()}`;
    code.times_used += 1;

    this.members.push({
      id: `m_${Date.now()}`,
      household_id: newHhId,
      user_id: userId,
      role: 'owner',
    });

    this.licenses.set(newHhId, {
      id: `lic_${Date.now()}`,
      household_id: newHhId,
      plan_id: code.plan_id,
      status: 'active',
      valid_until: null,
    });

    return { success: true, household_id: newHhId };
  }

  // Webhook Mercado Pago simulation
  processWebhook(payload: { status: string; household_id: string; plan_id: any; signatureValid: boolean }): boolean {
    if (!payload.signatureValid) return false;
    if (payload.status !== 'approved') return false; // Solo pagos aprobados activan licencia

    this.licenses.set(payload.household_id, {
      id: `lic_${Date.now()}`,
      household_id: payload.household_id,
      plan_id: payload.plan_id,
      status: 'active',
      valid_until: null,
    });
    return true;
  }
}

// ========================================================================
// SUITE DE PRUEBAS DEL BLOQUE 4
// ========================================================================

describe('Bloque 4: Control de Acceso, Licencias y Seguridad', () => {
  let engine: AccessControlEngine;

  beforeEach(() => {
    engine = new AccessControlEngine();
    engine.accessMode = 'closed';
  });

  it('1. Usuario sin licencia no lee ni escribe datos ni usa el chef en modo cerrado', () => {
    const hhId = 'hh_sin_licencia';
    const userId = 'user_1';

    engine.members.push({
      id: 'm1',
      household_id: hhId,
      user_id: userId,
      role: 'owner',
    });

    engine.shoppingItems.push({
      id: 'item_1',
      household_id: hhId,
      name: 'Yerba Mate 1kg',
    });

    // 1.1 hasActiveLicense debe ser false
    expect(engine.hasActiveLicense(hhId)).toBe(false);

    // 1.2 RLS no permite leer items
    const rlsRead = engine.queryShoppingItems(userId, hhId);
    expect(rlsRead.allowed).toBe(false);
    expect(rlsRead.data).toHaveLength(0);

    // 1.3 Chef IA devuelve 403 LICENSE_REQUIRED
    const chefRes = engine.callChefAi(hhId, 'cocinar');
    expect(chefRes.status).toBe(403);
    expect(chefRes.body.code).toBe('LICENSE_REQUIRED');
  });

  it('2. Link de invitación: rechaza tokens vencidos, revocados o con cupo agotado', () => {
    const hhId = 'hh_1';
    const rawTokenValid = 'TOKEN128BITABCDEFGHIJKL12345678';
    const rawTokenExpired = 'TOKENEXPIRED12345678901234567890';
    const rawTokenRevoked = 'TOKENREVOKED12345678901234567890';
    const rawTokenUsedUp = 'TOKENUSEDUP123456789012345678900';

    // Activar licencia en el hogar
    engine.licenses.set(hhId, {
      id: 'lic_1',
      household_id: hhId,
      plan_id: 'base',
      status: 'active',
      valid_until: null,
    });

    // Token Vencido
    engine.invitations.set(sha256Hex(rawTokenExpired), {
      id: 'inv_exp',
      household_id: hhId,
      token_hash: sha256Hex(rawTokenExpired),
      expires_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // expiró hace 1 hora
      max_uses: 1,
      times_used: 0,
      is_revoked: false,
      requires_owner_approval: false,
    });

    // Token Revocado
    engine.invitations.set(sha256Hex(rawTokenRevoked), {
      id: 'inv_rev',
      household_id: hhId,
      token_hash: sha256Hex(rawTokenRevoked),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      max_uses: 1,
      times_used: 0,
      is_revoked: true,
      requires_owner_approval: false,
    });

    // Token con Cupo Agotado
    engine.invitations.set(sha256Hex(rawTokenUsedUp), {
      id: 'inv_used',
      household_id: hhId,
      token_hash: sha256Hex(rawTokenUsedUp),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      max_uses: 1,
      times_used: 1,
      is_revoked: false,
      requires_owner_approval: false,
    });

    // Validar token vencido
    const resExp = engine.joinViaInvitation('u2', rawTokenExpired);
    expect(resExp.success).toBe(false);
    expect(resExp.error).toContain('ha expirado');

    // Validar token revocado
    const resRev = engine.joinViaInvitation('u2', rawTokenRevoked);
    expect(resRev.success).toBe(false);
    expect(resRev.error).toContain('revocada');

    // Validar token sin cupo
    const resUsed = engine.joinViaInvitation('u2', rawTokenUsedUp);
    expect(resUsed.success).toBe(false);
    expect(resUsed.error).toContain('límite máximo de usos');
  });

  it('3. Tope atómico de integrantes por plan (Base 6, Premium 8)', () => {
    const hhId = 'hh_base';
    engine.licenses.set(hhId, {
      id: 'lic_base',
      household_id: hhId,
      plan_id: 'base',
      status: 'active',
      valid_until: null,
    });

    // Cargar 5 integrantes iniciales
    for (let i = 1; i <= 5; i++) {
      engine.members.push({
        id: `m_${i}`,
        household_id: hhId,
        user_id: `u_${i}`,
        role: i === 1 ? 'owner' : 'member',
      });
    }

    const token = 'SECURETOKEN123456789012345678901';
    engine.invitations.set(sha256Hex(token), {
      id: 'inv_cap',
      household_id: hhId,
      token_hash: sha256Hex(token),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      max_uses: 10,
      times_used: 0,
      is_revoked: false,
      requires_owner_approval: false,
    });

    // El 6to integrante se une exitosamente (completa los 6 del Plan Base)
    const res6 = engine.joinViaInvitation('u_6', token);
    expect(res6.success).toBe(true);

    // El 7mo integrante debe ser RECHAZADO por exceder el tope de 6
    const res7 = engine.joinViaInvitation('u_7', token);
    expect(res7.success).toBe(false);
    expect(res7.error).toContain('límite máximo de integrantes de su plan (6)');

    // Si se actualiza a plan Premium, el tope sube a 8
    engine.licenses.set(hhId, {
      id: 'lic_prem',
      household_id: hhId,
      plan_id: 'premium',
      status: 'active',
      valid_until: null,
    });

    // Ahora el 7mo y el 8vo sí pueden unirse
    const res7b = engine.joinViaInvitation('u_7', token);
    expect(res7b.success).toBe(true);
    const res8 = engine.joinViaInvitation('u_8', token);
    expect(res8.success).toBe(true);

    // El 9no es rechazado por el tope de 8
    const res9 = engine.joinViaInvitation('u_9', token);
    expect(res9.success).toBe(false);
    expect(res9.error).toContain('límite máximo de integrantes de su plan (8)');
  });

  it('4. Código de acceso usado dos veces falla (single-use)', () => {
    const rawCode = 'COMPARS-BASE-7X9K2M';
    engine.accessCodes.set(sha256Code(rawCode), {
      id: 'ac_1',
      code_hash: sha256Code(rawCode),
      plan_id: 'base',
      max_uses: 1,
      times_used: 0,
      expires_at: null,
    });

    // Primer canje: exitoso
    const res1 = engine.redeemAccessCode('user_a', rawCode, 'Familia Gómez');
    expect(res1.success).toBe(true);
    expect(res1.household_id).toBeDefined();

    // El hogar creado cuenta con licencia activa inmediatamente
    expect(engine.hasActiveLicense(res1.household_id!)).toBe(true);

    // Segundo intento con el mismo código: RECHAZADO
    const res2 = engine.redeemAccessCode('user_b', rawCode, 'Familia Pérez');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('ya fue utilizado');
  });

  it('5. Aislamiento RLS: usuario de otro hogar no puede leer datos ajenos', () => {
    const hhA = 'hh_A';
    const hhB = 'hh_B';

    // Ambos con licencia activa
    engine.licenses.set(hhA, { id: 'lA', household_id: hhA, plan_id: 'base', status: 'active', valid_until: null });
    engine.licenses.set(hhB, { id: 'lB', household_id: hhB, plan_id: 'base', status: 'active', valid_until: null });

    // Usuario A pertenece solo al hogar A
    engine.members.push({ id: 'mA', household_id: hhA, user_id: 'user_A', role: 'owner' });
    // Usuario B pertenece al hogar B
    engine.members.push({ id: 'mB', household_id: hhB, user_id: 'user_B', role: 'owner' });

    engine.shoppingItems.push({ id: 'iB', household_id: hhB, name: 'Asado 2kg' });

    // Usuario A intenta leer items del hogar B: RLS lo bloquea
    const access = engine.queryShoppingItems('user_A', hhB);
    expect(access.allowed).toBe(false);
    expect(access.data).toHaveLength(0);
  });

  it('6. Licencia no se activa sin pago debidamente aprobado por Mercado Pago', () => {
    const hhId = 'hh_compra';

    // Webhook con firma inválida: rechazado
    const r1 = engine.processWebhook({
      status: 'approved',
      household_id: hhId,
      plan_id: 'base',
      signatureValid: false,
    });
    expect(r1).toBe(false);
    expect(engine.hasActiveLicense(hhId)).toBe(false);

    // Webhook con status pending: rechazado
    const r2 = engine.processWebhook({
      status: 'pending',
      household_id: hhId,
      plan_id: 'base',
      signatureValid: true,
    });
    expect(r2).toBe(false);
    expect(engine.hasActiveLicense(hhId)).toBe(false);

    // Webhook con status rejected: rechazado
    const r3 = engine.processWebhook({
      status: 'rejected',
      household_id: hhId,
      plan_id: 'base',
      signatureValid: true,
    });
    expect(r3).toBe(false);
    expect(engine.hasActiveLicense(hhId)).toBe(false);

    // Webhook aprobado con firma correcta: ACTIVA LICENCIA
    const r4 = engine.processWebhook({
      status: 'approved',
      household_id: hhId,
      plan_id: 'base',
      signatureValid: true,
    });
    expect(r4).toBe(true);
    expect(engine.hasActiveLicense(hhId)).toBe(true);
  });

  it('7. Plan interno tester: créditos ilimitados y acceso completo a menú semanal', () => {
    const hhTester = 'hh_tester';
    engine.licenses.set(hhTester, {
      id: 'lic_tester',
      household_id: hhTester,
      plan_id: 'tester',
      status: 'active',
      valid_until: null,
    });

    expect(engine.hasActiveLicense(hhTester)).toBe(true);

    // Permite Chef en modo cocinar
    const chefCook = engine.callChefAi(hhTester, 'cocinar');
    expect(chefCook.status).toBe(200);

    // Permite menú semanal sin exigir upgrade
    const chefMenu = engine.callChefAi(hhTester, 'planificar_semana');
    expect(chefMenu.status).toBe(200);
  });
});
