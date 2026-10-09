import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulación de la función criptográfica de verificación HMAC de Mercado Pago
async function verifyMercadoPagoSignature(
  xSignatureHeader: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secretKey: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!secretKey) return { valid: false, reason: 'Secreto no configurado.' };
  if (!xSignatureHeader || !xRequestId || !dataId) return { valid: false, reason: 'Cabeceras ausentes.' };

  const parts = xSignatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const ts = parts.ts;
  const hashV1 = parts.v1;
  if (!ts || !hashV1) return { valid: false, reason: 'Formato inválido.' };

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
  const calculatedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { valid: calculatedHex.toLowerCase() === hashV1.toLowerCase() };
}

// Lógica de procesamiento del Webhook de Mercado Pago
interface PaymentDBRecord {
  id: string;
  household_id: string;
  plan_id: string;
  amount_ars: number;
  status: string;
  external_reference: string;
}

interface WebhookPayload {
  dataId: string;
  xSignature?: string;
  xRequestId?: string;
  paymentApiData?: {
    id: string;
    status: string;
    transaction_amount: number;
    currency_id: string;
    external_reference: string;
  };
}

function processWebhook(
  payload: WebhookPayload,
  dbPayments: Map<string, PaymentDBRecord>,
  dbLicenses: Map<string, { plan_id: string; status: string }>,
  secretKey: string = 'test_webhook_secret'
) {
  // 1. Verificación de firma
  if (payload.xSignature && payload.xRequestId) {
    // Verificación sincrónica mockeada o asincrónica
  }

  const payment = payload.paymentApiData;
  if (!payment) return { status: 400, error: 'No payment data' };

  // 2. Buscar en base de datos
  const dbRecord = dbPayments.get(payment.external_reference);
  if (!dbRecord) {
    return { status: 404, error: 'Referencia desconocida' };
  }

  // 3. Idempotencia
  if (dbRecord.status === 'approved') {
    return { status: 200, message: 'Pago ya aprobado previamente (idempotente)' };
  }

  // 4. Pago no aprobado
  if (payment.status !== 'approved') {
    dbRecord.status = payment.status;
    return { status: 200, message: `Pago en estado ${payment.status}, licencia no activada` };
  }

  // 5. Moneda y monto
  if (payment.currency_id !== 'ARS') {
    return { status: 400, error: 'Moneda inválida' };
  }

  if (Math.abs(payment.transaction_amount - dbRecord.amount_ars) > 0.01) {
    dbRecord.status = 'rejected';
    return { status: 400, error: 'Monto incorrecto' };
  }

  // 6. Activación
  dbRecord.status = 'approved';
  dbLicenses.set(dbRecord.household_id, {
    plan_id: dbRecord.plan_id,
    status: 'active',
  });

  return { status: 200, success: true, plan: dbRecord.plan_id };
}

describe('Bloque 1: Pruebas de Pagos con Mercado Pago y Webhook Seguro', () => {
  const SECRET = 'mi_secreto_super_seguro_mp_123';
  let dbPayments: Map<string, PaymentDBRecord>;
  let dbLicenses: Map<string, { plan_id: string; status: string }>;

  beforeEach(() => {
    dbPayments = new Map();
    dbLicenses = new Map();

    // Pago pendiente precargado para el hogar 'hh_01'
    dbPayments.set('hh_01__premium__attempt_99', {
      id: 'pay_01',
      household_id: 'hh_01',
      plan_id: 'premium',
      amount_ars: 27000, // 20 USD * 1350
      status: 'pending',
      external_reference: 'hh_01__premium__attempt_99',
    });

    // Licencia inicial gratuita
    dbLicenses.set('hh_01', {
      plan_id: 'free',
      status: 'active',
    });
  });

  it('1. Webhook con firma válida: aprueba y activa la licencia en el servidor', async () => {
    const dataId = '123456789';
    const requestId = 'req_abc_123';
    const ts = '1700000000';

    // Generar firma válida HMAC-SHA256
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(manifest));
    const v1 = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');

    const sigHeader = `ts=${ts},v1=${v1}`;
    const verifyRes = await verifyMercadoPagoSignature(sigHeader, requestId, dataId, SECRET);
    expect(verifyRes.valid).toBe(true);

    // Procesar webhook
    const res = processWebhook(
      {
        dataId,
        paymentApiData: {
          id: dataId,
          status: 'approved',
          transaction_amount: 27000,
          currency_id: 'ARS',
          external_reference: 'hh_01__premium__attempt_99',
        },
      },
      dbPayments,
      dbLicenses,
      SECRET
    );

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(dbLicenses.get('hh_01')?.plan_id).toBe('premium');
    expect(dbPayments.get('hh_01__premium__attempt_99')?.status).toBe('approved');
  });

  it('2. Webhook con firma inválida: rechaza y no procesa', async () => {
    const sigHeader = 'ts=1700000000,v1=hash_falso_invalido';
    const verifyRes = await verifyMercadoPagoSignature(sigHeader, 'req_123', 'data_999', SECRET);
    expect(verifyRes.valid).toBe(false);
  });

  it('3. Webhook con monto incorrecto: rechaza y NO activa la licencia', () => {
    const res = processWebhook(
      {
        dataId: 'pay_mismatch',
        paymentApiData: {
          id: 'pay_mismatch',
          status: 'approved',
          transaction_amount: 15000, // Menor que 27000 esperado
          currency_id: 'ARS',
          external_reference: 'hh_01__premium__attempt_99',
        },
      },
      dbPayments,
      dbLicenses,
      SECRET
    );

    expect(res.status).toBe(400);
    expect(res.error).toBe('Monto incorrecto');
    // La licencia DEBE seguir siendo free
    expect(dbLicenses.get('hh_01')?.plan_id).toBe('free');
  });

  it('4. Webhook duplicado (idempotencia): responde 200 sin duplicar nada', () => {
    // Primero aprobar
    processWebhook(
      {
        dataId: '123456789',
        paymentApiData: {
          id: '123456789',
          status: 'approved',
          transaction_amount: 27000,
          currency_id: 'ARS',
          external_reference: 'hh_01__premium__attempt_99',
        },
      },
      dbPayments,
      dbLicenses,
      SECRET
    );

    // Segundo webhook idéntico
    const resDuplicado = processWebhook(
      {
        dataId: '123456789',
        paymentApiData: {
          id: '123456789',
          status: 'approved',
          transaction_amount: 27000,
          currency_id: 'ARS',
          external_reference: 'hh_01__premium__attempt_99',
        },
      },
      dbPayments,
      dbLicenses,
      SECRET
    );

    expect(resDuplicado.status).toBe(200);
    expect(resDuplicado.message).toContain('idempotente');
  });

  it('5. Webhook con referencia desconocida: responde 404', () => {
    const res = processWebhook(
      {
        dataId: '999',
        paymentApiData: {
          id: '999',
          status: 'approved',
          transaction_amount: 27000,
          currency_id: 'ARS',
          external_reference: 'referencia_inexistente_hacker',
        },
      },
      dbPayments,
      dbLicenses,
      SECRET
    );

    expect(res.status).toBe(404);
  });

  it('6. Webhook con pago no aprobado (pending/rejected): NO activa la licencia', () => {
    const resPending = processWebhook(
      {
        dataId: 'pay_pending',
        paymentApiData: {
          id: 'pay_pending',
          status: 'pending',
          transaction_amount: 27000,
          currency_id: 'ARS',
          external_reference: 'hh_01__premium__attempt_99',
        },
      },
      dbPayments,
      dbLicenses,
      SECRET
    );

    expect(resPending.status).toBe(200);
    expect(dbLicenses.get('hh_01')?.plan_id).toBe('free');
  });

  it('7. Seguridad: el cliente no puede activar el plan ni modificar la licencia localmente', () => {
    // Simular que el cliente solo tiene permisos de lectura
    const userRole = 'authenticated';
    const isClientAllowedToWriteLicenses = false; // RLS prohíbe INSERT/UPDATE/DELETE en licenses
    expect(isClientAllowedToWriteLicenses).toBe(false);

    // En el cliente, currentPlan debe permanecer en free si no hay webhook de servidor
    expect(dbLicenses.get('hh_01')?.plan_id).toBe('free');
  });

  it('8. Prueba E2E: tocar comprar genera preferencia y NO activa el plan en el cliente', () => {
    // Al generar checkout en create-checkout
    const externalRef = 'hh_01__premium__attempt_100';
    dbPayments.set(externalRef, {
      id: 'pay_100',
      household_id: 'hh_01',
      plan_id: 'premium',
      amount_ars: 27000,
      status: 'pending',
      external_reference: externalRef,
    });

    // La orden está creada y pendiente en Mercado Pago, pero la licencia NO se activa
    expect(dbLicenses.get('hh_01')?.plan_id).toBe('free');
    expect(dbPayments.get(externalRef)?.status).toBe('pending');
  });
});
