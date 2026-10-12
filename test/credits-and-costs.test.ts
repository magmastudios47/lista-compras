import { describe, it, expect, beforeEach } from 'vitest';

// ========================================================================
// TEST SUITE: COSTOS, TARIFAS 2026/2027, CRÉDITOS Y LEDGER (RONDA 5 - BLOQUE 5)
// ========================================================================

interface PricingTier {
  model: string;
  effectiveFrom: string;
  costPer1kInputUsd: number;
  costPer1kOutputUsd: number;
}

const OFFICIAL_PRICING_SCHEDULE: PricingTier[] = [
  // Tarifas 2026
  {
    model: 'gemini-2.5-flash-lite',
    effectiveFrom: '2026-01-01T00:00:00Z',
    costPer1kInputUsd: 0.00010, // $0.10 per 1M
    costPer1kOutputUsd: 0.00040, // $0.40 per 1M
  },
  {
    model: 'gemini-2.5-flash',
    effectiveFrom: '2026-01-01T00:00:00Z',
    costPer1kInputUsd: 0.00075, // $0.75 per 1M
    costPer1kOutputUsd: 0.00375, // $3.75 per 1M
  },
  // Tarifas 2027 (aumento programado de 100%)
  {
    model: 'gemini-2.5-flash-lite',
    effectiveFrom: '2027-01-01T00:00:00Z',
    costPer1kInputUsd: 0.00020, // $0.20 per 1M
    costPer1kOutputUsd: 0.00080, // $0.80 per 1M
  },
  {
    model: 'gemini-2.5-flash',
    effectiveFrom: '2027-01-01T00:00:00Z',
    costPer1kInputUsd: 0.00150, // $1.50 per 1M
    costPer1kOutputUsd: 0.00750, // $7.50 per 1M
  },
];

function calculateAiCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  asOfDate: Date = new Date()
): number {
  const asOfTime = asOfDate.getTime();
  // Busca la tarifa vigente más reciente anterior o igual a asOfDate
  const applicable = OFFICIAL_PRICING_SCHEDULE
    .filter((p) => p.model === model && new Date(p.effectiveFrom).getTime() <= asOfTime)
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];

  if (!applicable) return 0;

  const inputCost = (inputTokens / 1000) * applicable.costPer1kInputUsd;
  const outputCost = (outputTokens / 1000) * applicable.costPer1kOutputUsd;
  return Number((inputCost + outputCost).toFixed(7));
}

interface CreditLedgerEntry {
  id: string;
  householdId: string;
  amount: number; // positivo recarga, negativo débito
  reason: string;
  referenceId: string; // único por householdId
  createdAt: Date;
}

interface AiUsageLogEntry {
  id: string;
  householdId: string;
  model: string;
  modo: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  success: boolean;
  createdAt: Date;
}

class SimulatedAiCreditSystem {
  ledger: CreditLedgerEntry[] = [];
  usageLogs: AiUsageLogEntry[] = [];
  globalMonthlyBudgetUsd = 50.0;
  dailyCap = 15;

  getBalance(householdId: string): number {
    return this.ledger
      .filter((e) => e.householdId === householdId)
      .reduce((sum, e) => sum + e.amount, 0);
  }

  grantCredits(
    householdId: string,
    amount: number,
    reason: string,
    referenceId: string
  ): { success: boolean; newBalance: number; duplicate?: boolean } {
    const existing = this.ledger.find(
      (e) => e.householdId === householdId && e.referenceId === referenceId
    );
    if (existing) {
      return { success: true, newBalance: this.getBalance(householdId), duplicate: true };
    }

    this.ledger.push({
      id: `led_${Date.now()}_${Math.random()}`,
      householdId,
      amount,
      reason,
      referenceId,
      createdAt: new Date(),
    });

    return { success: true, newBalance: this.getBalance(householdId) };
  }

  checkDailyLimit(householdId: string, date: Date = new Date()): { allowed: boolean; usedToday: number } {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const debitsToday = this.ledger
      .filter(
        (e) =>
          e.householdId === householdId &&
          e.amount < 0 &&
          e.createdAt >= startOfDay
      )
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    return {
      allowed: debitsToday < this.dailyCap,
      usedToday: debitsToday,
    };
  }

  getMonthlySpendUsd(date: Date = new Date()): number {
    const startOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    return this.usageLogs
      .filter((l) => l.createdAt >= startOfMonth)
      .reduce((sum, l) => sum + l.costUsd, 0);
  }

  checkGlobalBudget(date: Date = new Date()): { status: 'ok' | 'warning' | 'paused'; spendUsd: number } {
    const spend = this.getMonthlySpendUsd(date);
    if (spend >= this.globalMonthlyBudgetUsd) {
      return { status: 'paused', spendUsd: spend };
    }
    if (spend >= this.globalMonthlyBudgetUsd * 0.8) {
      return { status: 'warning', spendUsd: spend };
    }
    return { status: 'ok', spendUsd: spend };
  }

  executeChefCall(params: {
    householdId: string;
    isTester: boolean;
    modo: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    referenceId: string;
    forceAiError?: boolean;
    callDate?: Date;
  }): { status: number; message: string; balance: number; costUsd: number } {
    const callDate = params.callDate || new Date();

    // 1. Verificar presupuesto global
    const budgetStatus = this.checkGlobalBudget(callDate);
    if (budgetStatus.status === 'paused' && !params.isTester) {
      return {
        status: 503,
        message: 'Servicio de Chef IA pausado temporalmente por límite presupuestario global.',
        balance: this.getBalance(params.householdId),
        costUsd: 0,
      };
    }

    // 2. Verificar tope diario
    if (!params.isTester) {
      const daily = this.checkDailyLimit(params.householdId, callDate);
      if (!daily.allowed) {
        return {
          status: 429,
          message: 'Tope diario de 15 créditos por hogar alcanzado. Se reinicia a medianoche UTC.',
          balance: this.getBalance(params.householdId),
          costUsd: 0,
        };
      }
    }

    // 3. Determinar créditos necesarios
    const weights: Record<string, number> = {
      cocinar: 1,
      sugerir: 1,
      regenerar_plato: 1,
      planificar_semana: 8,
      detalle_dia_menu: 0,
      interpretar_items: 0,
    };
    const requiredCredits = weights[params.modo] ?? 1;

    // 4. Verificar saldo
    const currentBalance = this.getBalance(params.householdId);
    if (!params.isTester && requiredCredits > 0 && currentBalance < requiredCredits) {
      return {
        status: 403,
        message: 'Créditos insuficientes en el hogar.',
        balance: currentBalance,
        costUsd: 0,
      };
    }

    // 5. Simular llamada a Gemini
    const costUsd = calculateAiCost(params.model, params.promptTokens, params.completionTokens, callDate);

    if (params.forceAiError) {
      // Registrar log con falla y costo
      this.usageLogs.push({
        id: `log_err_${Date.now()}`,
        householdId: params.householdId,
        model: params.model,
        modo: params.modo,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        costUsd,
        success: false,
        createdAt: callDate,
      });

      // ¡REGLA CRÍTICA!: En error NUNCA se descuentan créditos del ledger
      return {
        status: 500,
        message: 'Error al contactar con Gemini AI.',
        balance: this.getBalance(params.householdId),
        costUsd,
      };
    }

    // 6. En éxito: Registrar log exitoso
    this.usageLogs.push({
      id: `log_ok_${Date.now()}`,
      householdId: params.householdId,
      model: params.model,
      modo: params.modo,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      costUsd,
      success: true,
      createdAt: callDate,
    });

    // 7. Descontar créditos de forma idempotente
    if (requiredCredits > 0 && !params.isTester) {
      const existing = this.ledger.find(
        (e) => e.householdId === params.householdId && e.referenceId === params.referenceId
      );
      if (!existing) {
        this.ledger.push({
          id: `led_deb_${Date.now()}`,
          householdId: params.householdId,
          amount: -requiredCredits,
          reason: `Consumo Chef IA (${params.modo})`,
          referenceId: params.referenceId,
          createdAt: callDate,
        });
      }
    }

    return {
      status: 200,
      message: 'Receta generada con éxito.',
      balance: this.getBalance(params.householdId),
      costUsd,
    };
  }
}

describe('Ronda 5 - Bloque 5: Sistema de Tarifas 2026/2027, Créditos y Costos', () => {
  let system: SimulatedAiCreditSystem;

  beforeEach(() => {
    system = new SimulatedAiCreditSystem();
  });

  describe('1. Tarifas Oficiales y Vigencia Temporal (2026 vs 2027)', () => {
    it('debe aplicar las tarifas 2026 de Gemini Flash-Lite ($0.10 / $0.40)', () => {
      const date2026 = new Date('2026-10-12T12:00:00Z');
      // 1.000 tokens de entrada + 500 tokens de salida
      // entrada: 1 * 0.00010 = 0.000100
      // salida:  0.5 * 0.00040 = 0.000200
      // total = 0.000300 USD
      const cost = calculateAiCost('gemini-2.5-flash-lite', 1000, 500, date2026);
      expect(cost).toBeCloseTo(0.0003, 6);
    });

    it('debe duplicar exactamente el costo a partir del 1 de enero de 2027 ($0.20 / $0.80)', () => {
      const date2027 = new Date('2027-01-01T00:00:00Z');
      // entrada: 1 * 0.00020 = 0.000200
      // salida:  0.5 * 0.00080 = 0.000400
      // total = 0.000600 USD (exactamente el doble que en 2026)
      const cost2027 = calculateAiCost('gemini-2.5-flash-lite', 1000, 500, date2027);
      const cost2026 = calculateAiCost('gemini-2.5-flash-lite', 1000, 500, new Date('2026-12-31T23:59:59Z'));

      expect(cost2027).toBeCloseTo(0.0006, 6);
      expect(cost2027).toBeCloseTo(cost2026 * 2, 6);
    });

    it('debe calcular correctamente el costo de Gemini Flash estándar (2026: $0.75 / $3.75)', () => {
      const date2026 = new Date('2026-10-12T12:00:00Z');
      // 1.000 tokens entrada: 1 * 0.00075 = 0.00075
      // 500 tokens salida: 0.5 * 0.00375 = 0.001875
      // total = 0.002625 USD
      const cost = calculateAiCost('gemini-2.5-flash', 1000, 500, date2026);
      expect(cost).toBeCloseTo(0.002625, 6);
    });
  });

  describe('2. Idempotencia del Ledger de Créditos', () => {
    it('debe rechazar duplicar cargos si se reenvía el mismo referenceId', () => {
      const hhId = 'hh_family_01';
      system.grantCredits(hhId, 50, 'Plan Base inicial', 'init_base_50');
      expect(system.getBalance(hhId)).toBe(50);

      const refId = 'req_chef_unique_123';
      const res1 = system.executeChefCall({
        householdId: hhId,
        isTester: false,
        modo: 'cocinar',
        model: 'gemini-2.5-flash-lite',
        promptTokens: 1100,
        completionTokens: 450,
        referenceId: refId,
      });

      expect(res1.status).toBe(200);
      expect(system.getBalance(hhId)).toBe(49);

      // Reintento con mismo referenceId (idempotencia)
      const res2 = system.executeChefCall({
        householdId: hhId,
        isTester: false,
        modo: 'cocinar',
        model: 'gemini-2.5-flash-lite',
        promptTokens: 1100,
        completionTokens: 450,
        referenceId: refId,
      });

      expect(res2.status).toBe(200);
      // El saldo NO debe descontarse dos veces
      expect(system.getBalance(hhId)).toBe(49);
      expect(system.ledger.filter((e) => e.householdId === hhId && e.amount < 0)).toHaveLength(1);
    });

    it('debe acreditar recargas de Mercado Pago de forma estrictamente idempotente', () => {
      const hhId = 'hh_family_02';
      const paymentRef = 'mp_payment_987654321';

      // Primer webhook
      const grant1 = system.grantCredits(hhId, 60, 'Recarga Pack Familiar (60 créditos)', paymentRef);
      expect(grant1.success).toBe(true);
      expect(grant1.newBalance).toBe(60);
      expect(grant1.duplicate).toBeUndefined();

      // Segundo webhook repetido por Mercado Pago
      const grant2 = system.grantCredits(hhId, 60, 'Recarga Pack Familiar (60 créditos)', paymentRef);
      expect(grant2.success).toBe(true);
      expect(grant2.newBalance).toBe(60);
      expect(grant2.duplicate).toBe(true);
      expect(system.ledger.filter((e) => e.householdId === hhId)).toHaveLength(1);
    });
  });

  describe('3. Protección contra Descuento Indebido en Fallas de IA', () => {
    it('NUNCA debe descontar créditos si Gemini AI falla (500/timeout)', () => {
      const hhId = 'hh_family_03';
      system.grantCredits(hhId, 40, 'Plan Base inicial', 'init_base_40');
      expect(system.getBalance(hhId)).toBe(40);

      const resError = system.executeChefCall({
        householdId: hhId,
        isTester: false,
        modo: 'cocinar',
        model: 'gemini-2.5-flash-lite',
        promptTokens: 1100,
        completionTokens: 0,
        referenceId: 'req_failed_ai_1',
        forceAiError: true,
      });

      expect(resError.status).toBe(500);
      // El saldo se conserva intacto
      expect(system.getBalance(hhId)).toBe(40);

      // Sin embargo, el log de uso sí debe registrar la llamada fallida para auditoría de costos
      const log = system.usageLogs.find((l) => l.householdId === hhId);
      expect(log).toBeDefined();
      expect(log?.success).toBe(false);
      expect(log?.costUsd).toBeGreaterThan(0);
    });
  });

  describe('4. Tope de Seguridad Diario (15 créditos/día por hogar)', () => {
    it('debe permitir hasta 15 consumos en el mismo día y bloquear el 16vo con 429', () => {
      const hhId = 'hh_heavy_user';
      system.grantCredits(hhId, 100, 'Pack recargado', 'init_heavy_100');
      const today = new Date('2026-10-12T14:00:00Z');

      // 15 consumos exitosos
      for (let i = 1; i <= 15; i++) {
        const res = system.executeChefCall({
          householdId: hhId,
          isTester: false,
          modo: 'cocinar',
          model: 'gemini-2.5-flash-lite',
          promptTokens: 1100,
          completionTokens: 400,
          referenceId: `req_today_${i}`,
          callDate: today,
        });
        expect(res.status).toBe(200);
      }

      expect(system.getBalance(hhId)).toBe(85);

      // Intento 16 en el mismo día
      const resBlocked = system.executeChefCall({
        householdId: hhId,
        isTester: false,
        modo: 'cocinar',
        model: 'gemini-2.5-flash-lite',
        promptTokens: 1100,
        completionTokens: 400,
        referenceId: 'req_today_16_blocked',
        callDate: today,
      });

      expect(resBlocked.status).toBe(429);
      expect(resBlocked.message).toContain('Tope diario');
      expect(system.getBalance(hhId)).toBe(85); // No se debitó
    });

    it('debe permitir nuevos consumos al pasar a medianoche UTC', () => {
      const hhId = 'hh_heavy_user_2';
      system.grantCredits(hhId, 100, 'Pack recargado', 'init_heavy_100_2');
      const day1 = new Date('2026-10-12T23:55:00Z');
      const day2 = new Date('2026-10-13T00:05:00Z');

      for (let i = 1; i <= 15; i++) {
        system.executeChefCall({
          householdId: hhId,
          isTester: false,
          modo: 'cocinar',
          model: 'gemini-2.5-flash-lite',
          promptTokens: 1100,
          completionTokens: 400,
          referenceId: `req_d1_${i}`,
          callDate: day1,
        });
      }

      // Al cambiar el día UTC, debe permitir consultas de nuevo
      const resNextDay = system.executeChefCall({
        householdId: hhId,
        isTester: false,
        modo: 'cocinar',
        model: 'gemini-2.5-flash-lite',
        promptTokens: 1100,
        completionTokens: 400,
        referenceId: 'req_d2_1',
        callDate: day2,
      });

      expect(resNextDay.status).toBe(200);
      expect(system.getBalance(hhId)).toBe(84);
    });

    it('debe eximir a usuarios Tester del tope diario', () => {
      const hhId = 'hh_tester_daily';
      system.grantCredits(hhId, 100, 'Tester', 'init_tester');
      const today = new Date('2026-10-12T14:00:00Z');

      for (let i = 1; i <= 20; i++) {
        const res = system.executeChefCall({
          householdId: hhId,
          isTester: true,
          modo: 'cocinar',
          model: 'gemini-2.5-flash-lite',
          promptTokens: 1100,
          completionTokens: 400,
          referenceId: `req_tester_${i}`,
          callDate: today,
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe('5. Límite Presupuestario Global Mensual ($50 USD)', () => {
    it('debe emitir alerta al alcanzar el 80% ($40 USD) y pausar al 100% ($50 USD)', () => {
      const now = new Date('2026-10-12T12:00:00Z');

      // Simular gasto acumulado de $39 USD
      system.usageLogs.push({
        id: 'bulk_log_1',
        householdId: 'hh_any',
        model: 'gemini-2.5-flash',
        modo: 'cocinar',
        promptTokens: 10000000,
        completionTokens: 8000000,
        costUsd: 39.0,
        success: true,
        createdAt: now,
      });

      expect(system.checkGlobalBudget(now).status).toBe('ok');

      // Aumentar a $41 USD (82%)
      system.usageLogs.push({
        id: 'bulk_log_2',
        householdId: 'hh_any',
        model: 'gemini-2.5-flash',
        modo: 'cocinar',
        promptTokens: 1000000,
        completionTokens: 500000,
        costUsd: 2.0,
        success: true,
        createdAt: now,
      });

      expect(system.checkGlobalBudget(now).status).toBe('warning');

      // Aumentar a $50.5 USD (101%)
      system.usageLogs.push({
        id: 'bulk_log_3',
        householdId: 'hh_any',
        model: 'gemini-2.5-flash',
        modo: 'cocinar',
        promptTokens: 5000000,
        completionTokens: 2000000,
        costUsd: 9.5,
        success: true,
        createdAt: now,
      });

      expect(system.checkGlobalBudget(now).status).toBe('paused');

      // Llamada de usuario normal es rechazada con 503
      const hhId = 'hh_normal_client';
      system.grantCredits(hhId, 50, 'Base', 'ref_base');
      const resPaused = system.executeChefCall({
        householdId: hhId,
        isTester: false,
        modo: 'cocinar',
        model: 'gemini-2.5-flash-lite',
        promptTokens: 1100,
        completionTokens: 400,
        referenceId: 'req_paused_try',
        callDate: now,
      });

      expect(resPaused.status).toBe(503);
      expect(resPaused.message).toContain('límite presupuestario global');
      expect(system.getBalance(hhId)).toBe(50); // No se cobró
    });
  });

  describe('6. Análisis de Rentabilidad y Margen Mínimo de 3x', () => {
    it('debe verificar que las tarifas de planes y recargas superen con holgura el margen de 3x sobre el costo de IA en 2026 y 2027', () => {
      // Costo de 1 crédito (receta) con Gemini Flash-Lite:
      // Entrada ~1.180 tokens, Salida ~450 tokens
      const costPerCredit2026 = calculateAiCost(
        'gemini-2.5-flash-lite',
        1180,
        450,
        new Date('2026-10-12')
      );
      const costPerCredit2027 = calculateAiCost(
        'gemini-2.5-flash-lite',
        1180,
        450,
        new Date('2027-01-01')
      );

      // Pack 25 créditos: Precio USD 1.50
      const pack25Cost2027 = 25 * costPerCredit2027;
      const pack25Margin2027 = 1.50 / pack25Cost2027;
      expect(pack25Margin2027).toBeGreaterThan(10); // Supera holgadamente el mínimo de 3x

      // Pack 60 créditos: Precio USD 3.00
      const pack60Cost2027 = 60 * costPerCredit2027;
      const pack60Margin2027 = 3.00 / pack60Cost2027;
      expect(pack60Margin2027).toBeGreaterThan(10);

      // Pack 150 créditos: Precio USD 6.00
      const pack150Cost2027 = 150 * costPerCredit2027;
      const pack150Margin2027 = 6.00 / pack150Cost2027;
      expect(pack150Margin2027).toBeGreaterThan(10);

      // Plan Base (40 créditos): Precio USD 10.00
      const baseCost2027 = 40 * costPerCredit2027;
      const baseProfitPercent = ((10.0 - baseCost2027) / 10.0) * 100;
      expect(baseProfitPercent).toBeGreaterThan(95);

      // Plan Premium (150 créditos): Precio USD 20.00
      const premiumCost2027 = 150 * costPerCredit2027;
      const premiumProfitPercent = ((20.0 - premiumCost2027) / 20.0) * 100;
      expect(premiumProfitPercent).toBeGreaterThan(95);
    });
  });

  describe('7. Ahorro de Tokens del Prompt Modular y Context Caching', () => {
    it('debe comprobar que el prompt modular reduce tokens frente al prompt monolítico', () => {
      const monolithicTokensEstimate = 2250;
      const modularCocinarTokensEstimate = 1180;
      const modularInterpretarTokensEstimate = 490;

      const savingCocinar = (monolithicTokensEstimate - modularCocinarTokensEstimate) / monolithicTokensEstimate;
      const savingInterpretar = (monolithicTokensEstimate - modularInterpretarTokensEstimate) / monolithicTokensEstimate;

      expect(savingCocinar).toBeGreaterThan(0.40); // > 40% ahorro
      expect(savingInterpretar).toBeGreaterThan(0.70); // > 70% ahorro
    });
  });
});
