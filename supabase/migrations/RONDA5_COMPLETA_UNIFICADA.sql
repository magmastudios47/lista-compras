-- ========================================================================
-- LISTA COMPARS - ESQUEMA COMPLETO Y UNIFICADO TODO EN UNO (RONDAS 1 A 5)
-- Compatible con bases de datos nuevas y existentes (100% Idempotente).
-- Pega este script completo en el SQL Editor de tu proyecto Supabase y haz clic en "Run".
-- ========================================================================

-- ========================================================================
-- 0. EXTENSIONES DEL SISTEMA
-- ========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================================================
-- 1. TABLA: households (Hogares)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(4), 'hex'),
    currency TEXT NOT NULL DEFAULT 'ARS',
    monthly_chef_limit INT NOT NULL DEFAULT 40,
    chef_queries_used_month INT NOT NULL DEFAULT 0,
    chef_quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
    pantry_add_mode TEXT NOT NULL DEFAULT 'ask' CHECK (pantry_add_mode IN ('ask', 'auto', 'never')),
    pantry_exclude_cleaning BOOLEAN NOT NULL DEFAULT true,
    city TEXT DEFAULT '',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS pantry_add_mode TEXT NOT NULL DEFAULT 'ask';
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS pantry_exclude_cleaning BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.households ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';

-- ========================================================================
-- 2. TABLA: household_members (Miembros del Hogar)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    display_name TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, user_id)
);

-- Asegurar restricción de rol para incluir 'owner', 'admin', 'member'
ALTER TABLE public.household_members DROP CONSTRAINT IF EXISTS household_members_role_check;
ALTER TABLE public.household_members ADD CONSTRAINT household_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);

-- ========================================================================
-- 3. TABLA: plans (Configuración centralizada de planes y límites)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    monthly_chef_queries INT NOT NULL,
    max_members INT NOT NULL DEFAULT 3,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semilla oficial de planes (Base 6 integrantes, Premium 8 integrantes, Tester interno)
INSERT INTO public.plans (id, name, price_usd, monthly_chef_queries, max_members, features, is_active)
VALUES 
    ('free', 'Plan Gratuito', 0.00, 5, 3, '{"weekly_menu": false, "price_tracking": false}'::jsonb, true),
    ('base', 'Plan Base Hogar', 10.00, 40, 6, '{"weekly_menu": false, "price_tracking": false}'::jsonb, true),
    ('premium', 'Plan Premium Hogar', 20.00, 150, 8, '{"weekly_menu": true, "price_tracking": true}'::jsonb, true),
    ('tester', 'Plan Interno Tester', 0.00, 9999, 99, '{"weekly_menu": true, "price_tracking": true, "internal": true}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_usd = EXCLUDED.price_usd,
    monthly_chef_queries = EXCLUDED.monthly_chef_queries,
    max_members = EXCLUDED.max_members,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active;

-- ========================================================================
-- 4. TABLA: exchange_rates (Tipos de cambio ARS/USD)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_from TEXT NOT NULL DEFAULT 'USD',
    currency_to TEXT NOT NULL DEFAULT 'ARS',
    rate NUMERIC(10,2) NOT NULL CHECK (rate >= 500.00 AND rate <= 10000.00),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(currency_from, currency_to)
);

INSERT INTO public.exchange_rates (currency_from, currency_to, rate)
VALUES ('USD', 'ARS', 1350.00)
ON CONFLICT (currency_from, currency_to) DO UPDATE SET
    rate = EXCLUDED.rate,
    updated_at = now();

-- ========================================================================
-- 5. TABLA: licenses (Licencia activa de cada hogar)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID UNIQUE NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
    valid_until TIMESTAMPTZ,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_household ON public.licenses(household_id);

-- ========================================================================
-- 6. TABLA: household_licenses (Compatibilidad con webhooks previos)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.household_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID UNIQUE NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'lifetime_premium')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
    purchased_at TIMESTAMPTZ,
    amount_paid_usd NUMERIC(10,2),
    amount_paid_ars NUMERIC(10,2),
    exchange_rate NUMERIC(10,2),
    mercadopago_payment_id TEXT,
    mercadopago_preference_id TEXT,
    max_monthly_chef_queries INT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========================================================================
-- 7. TABLA: payments (Registro de pagos de Mercado Pago)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    plan_id TEXT NOT NULL REFERENCES public.plans(id),
    amount_usd NUMERIC(10,2) NOT NULL,
    amount_ars NUMERIC(10,2) NOT NULL,
    exchange_rate NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ARS',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'cancelled')),
    mercadopago_payment_id TEXT UNIQUE,
    mercadopago_preference_id TEXT,
    external_reference TEXT UNIQUE NOT NULL,
    raw_webhook_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_household ON public.payments(household_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_ref ON public.payments(external_reference);
CREATE INDEX IF NOT EXISTS idx_payments_mp_id ON public.payments(mercadopago_payment_id);

-- ========================================================================
-- 8. TABLA: shopping_items (Lista de Compras Compartida)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.shopping_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'unidad',
    category TEXT NOT NULL DEFAULT 'otros' CHECK (
        category IN ('verduleria', 'carniceria', 'almacen', 'lacteos', 'fiambreria', 'panaderia', 'bebidas', 'congelados', 'limpieza', 'otros')
    ),
    is_bought BOOLEAN NOT NULL DEFAULT false,
    bought_at TIMESTAMPTZ,
    estimated_price NUMERIC(10,2),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_items_household ON public.shopping_items(household_id, is_bought);
CREATE INDEX IF NOT EXISTS idx_shopping_items_household_active ON public.shopping_items(household_id) WHERE deleted_at IS NULL;

-- ========================================================================
-- 9. TABLA: pantry_items (Despensa Compartida)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.pantry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    quantity NUMERIC(10,2),
    unit TEXT,
    category TEXT NOT NULL DEFAULT 'almacen' CHECK (
        category IN ('verduleria', 'carniceria', 'almacen', 'lacteos', 'fiambreria', 'panaderia', 'bebidas', 'congelados', 'limpieza', 'otros')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    UNIQUE(household_id, normalized_name)
);

ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_pantry_items_household ON public.pantry_items(household_id);
CREATE INDEX IF NOT EXISTS idx_pantry_items_household_active ON public.pantry_items(household_id) WHERE deleted_at IS NULL;

-- ========================================================================
-- 10. TABLA: ai_usage_log (Auditoría de Uso del Chef IA y Costos)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mode TEXT NOT NULL CHECK (mode IN ('cocinar', 'sugerir', 'interpretar_despensa', 'menu_semanal')),
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    reasoning_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    is_cached BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'rate_limited', 'error', 'quota_exceeded')),
    error_message TEXT,
    model TEXT DEFAULT 'gemini-3.5-flash',
    cost_usd NUMERIC(10, 6) DEFAULT 0.000000,
    origin TEXT DEFAULT 'ia',
    success BOOLEAN DEFAULT true,
    credits_deducted INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columnas para migración segura
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gemini-3.5-flash';
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS prompt_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS completion_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS reasoning_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS total_tokens INT DEFAULT 0;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 6) DEFAULT 0.000000;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'ia';
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS credits_deducted INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_usage_household_created ON public.ai_usage_log(household_id, created_at);

-- ========================================================================
-- 11. TABLA: ai_cache (Caché de Consultas Idénticas de IA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON public.ai_cache(cache_key);

-- ========================================================================
-- 12. TABLA: push_subscriptions (Suscripciones Web Push)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, household_id)
);

-- ========================================================================
-- 13. TABLA: price_reference (Precios de Referencia SEPA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.price_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    normalized_name TEXT NOT NULL,
    zone TEXT NOT NULL,
    price_per_unit NUMERIC(12,2) NOT NULL,
    unit TEXT NOT NULL,
    date DATE NOT NULL,
    source TEXT NOT NULL DEFAULT 'SEPA',
    sample_count INT NOT NULL DEFAULT 1,
    confidence TEXT NOT NULL DEFAULT 'media' CHECK (confidence IN ('alta', 'media', 'baja')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(normalized_name, zone, unit)
);

CREATE INDEX IF NOT EXISTS idx_price_reference_lookup ON public.price_reference(normalized_name, zone);

-- ========================================================================
-- 14. TABLA: user_preferences (Preferencias del Usuario)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    target_profile TEXT NOT NULL DEFAULT 'Comer más sano',
    profile_detail TEXT NOT NULL DEFAULT '',
    ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);

-- ========================================================================
-- 15. TABLA: household_settings (Ajustes Compartidos del Hogar)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.household_settings (
    household_id UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
    pantry_add_mode TEXT NOT NULL DEFAULT 'ask' CHECK (pantry_add_mode IN ('ask', 'auto', 'never')),
    pantry_exclude_cleaning BOOLEAN NOT NULL DEFAULT true,
    dietary_restrictions TEXT[] NOT NULL DEFAULT '{}',
    weekly_menu_days_config JSONB NOT NULL DEFAULT '{"Lunes":["almuerzo","cena"],"Martes":["almuerzo","cena"],"Miércoles":["almuerzo","cena"],"Jueves":["almuerzo","cena"],"Viernes":["almuerzo","cena"],"Sábado":["almuerzo","cena"],"Domingo":["almuerzo","cena"]}'::jsonb,
    weekly_menu_persons INT NOT NULL DEFAULT 4,
    weekly_menu_mandatory_dishes TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_settings_household ON public.household_settings(household_id);

-- ========================================================================
-- 16. TABLA: system_settings (Configuraciones Operativas del Sistema)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (key, value)
VALUES 
    ('access_mode', 'closed'),
    ('trial_credits', '0')
ON CONFLICT (key) DO NOTHING;

-- ========================================================================
-- 17. TABLA: access_codes (Códigos de Activación)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash TEXT UNIQUE NOT NULL,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'base',
    max_uses INT NOT NULL DEFAULT 1,
    times_used INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_codes_hash ON public.access_codes(code_hash);

-- ========================================================================
-- 18. TABLA: access_code_redemptions (Canjes de Códigos)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.access_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id UUID NOT NULL REFERENCES public.access_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(code_id, user_id)
);

-- ========================================================================
-- 19. TABLA: household_invitations (Invitaciones a Integrantes)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.household_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    max_uses INT NOT NULL DEFAULT 1,
    times_used INT NOT NULL DEFAULT 0,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    requires_owner_approval BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.household_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_household ON public.household_invitations(household_id);

-- ========================================================================
-- 20. TABLA: invite_attempt_logs (Auditoría Anti Fuerza Bruta)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.invite_attempt_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    attempt_type TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_attempt_logs_identifier ON public.invite_attempt_logs(identifier, created_at);

-- ========================================================================
-- 21. TABLA: ai_pricing (Tarifario Histórico y Programado de Modelos IA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.ai_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model TEXT NOT NULL,
    input_usd_per_million NUMERIC(10, 4) NOT NULL,
    output_usd_per_million NUMERIC(10, 4) NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(model, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_ai_pricing_model_date ON public.ai_pricing(model, effective_from DESC);

INSERT INTO public.ai_pricing (model, input_usd_per_million, output_usd_per_million, effective_from)
VALUES 
    ('gemini-2.5-flash-lite', 0.1000, 0.4000, '2026-01-01 00:00:00+00'),
    ('gemini-3.5-flash-lite', 0.1000, 0.4000, '2026-01-01 00:00:00+00'),
    ('gemini-2.5-flash', 0.3000, 2.5000, '2026-01-01 00:00:00+00'),
    ('gemini-3.5-flash', 0.7500, 3.7500, '2026-01-01 00:00:00+00'),
    ('gemini-2.5-flash-lite', 0.2000, 0.8000, '2027-01-01 00:00:00+00'),
    ('gemini-3.5-flash-lite', 0.2000, 0.8000, '2027-01-01 00:00:00+00'),
    ('gemini-2.5-flash', 0.6000, 5.0000, '2027-01-01 00:00:00+00'),
    ('gemini-3.5-flash', 1.5000, 7.5000, '2027-01-01 00:00:00+00')
ON CONFLICT (model, effective_from) DO UPDATE SET
    input_usd_per_million = EXCLUDED.input_usd_per_million,
    output_usd_per_million = EXCLUDED.output_usd_per_million;

-- ========================================================================
-- 22. TABLA: credit_ledger (Libro Mayor de Créditos IA)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    delta INT NOT NULL,
    reason TEXT NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_unique_ref 
    ON public.credit_ledger(household_id, reference_id) 
    WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_household_date 
    ON public.credit_ledger(household_id, created_at DESC);

-- ========================================================================
-- 23. TABLA: credit_recharge_packages (Paquetes de Recarga)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.credit_recharge_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits INT NOT NULL,
    price_usd NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.credit_recharge_packages (id, name, credits, price_usd)
VALUES 
    ('pack_25', 'Pack 25 Recetas Chef', 25, 3.00),
    ('pack_60', 'Pack 60 Recetas Chef', 60, 6.00),
    ('pack_150', 'Pack 150 Recetas Chef', 150, 12.00)
ON CONFLICT (id) DO UPDATE SET
    credits = EXCLUDED.credits,
    price_usd = EXCLUDED.price_usd;

-- ========================================================================
-- FUNCIONES DE SEGURIDAD Y NEGOCIO (RPCS)
-- ========================================================================

-- A. Pertenencia a hogar
CREATE OR REPLACE FUNCTION public.user_belongs_to_household(h_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.household_members
        WHERE household_id = h_id
          AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- B. Verificación de licencia activa
CREATE OR REPLACE FUNCTION public.has_active_license(h_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_mode TEXT;
    v_has_license BOOLEAN;
BEGIN
    IF h_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT value INTO v_mode FROM public.system_settings WHERE key = 'access_mode';
    IF v_mode IS NULL THEN
        v_mode := 'closed';
    END IF;

    IF v_mode = 'open' THEN
        RETURN true;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.licenses l
        WHERE l.household_id = h_id
          AND l.status = 'active'
          AND l.plan_id IN ('base', 'premium', 'tester', 'pro')
          AND (l.valid_until IS NULL OR l.valid_until > now())
    ) INTO v_has_license;

    RETURN coalesce(v_has_license, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- C. Cálculo de costo IA
CREATE OR REPLACE FUNCTION public.calculate_ai_cost(
    p_model TEXT,
    p_prompt_tokens INT,
    p_completion_tokens INT,
    p_date TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC AS $$
DECLARE
    v_pricing RECORD;
    v_cost NUMERIC(10, 6) := 0.000000;
BEGIN
    SELECT * INTO v_pricing
    FROM public.ai_pricing
    WHERE model = p_model
      AND effective_from <= coalesce(p_date, now())
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_pricing IS NULL THEN
        SELECT * INTO v_pricing
        FROM public.ai_pricing
        WHERE model = 'gemini-3.5-flash'
          AND effective_from <= coalesce(p_date, now())
        ORDER BY effective_from DESC
        LIMIT 1;
    END IF;

    IF v_pricing IS NOT NULL THEN
        v_cost := (
            (coalesce(p_prompt_tokens, 0) * v_pricing.input_usd_per_million / 1000000.0) +
            (coalesce(p_completion_tokens, 0) * v_pricing.output_usd_per_million / 1000000.0)
        );
    END IF;

    RETURN round(v_cost, 6);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- D. Saldo de créditos de un hogar
CREATE OR REPLACE FUNCTION public.get_household_credit_balance(p_household_id UUID)
RETURNS INT AS $$
DECLARE
    v_balance INT;
BEGIN
    SELECT coalesce(sum(delta), 0) INTO v_balance
    FROM public.credit_ledger
    WHERE household_id = p_household_id;

    RETURN coalesce(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- E. Débito atómico de créditos
CREATE OR REPLACE FUNCTION public.deduct_household_credits(
    p_household_id UUID,
    p_amount INT,
    p_reason TEXT,
    p_reference_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_balance INT;
    v_is_tester BOOLEAN;
    v_ledger_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', true, 'balance', public.get_household_credit_balance(p_household_id));
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.licenses
        WHERE household_id = p_household_id
          AND plan_id = 'tester'
          AND status = 'active'
    ) INTO v_is_tester;

    IF p_reference_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.credit_ledger
        WHERE household_id = p_household_id AND reference_id = p_reference_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'balance', public.get_household_credit_balance(p_household_id)
        );
    END IF;

    v_balance := public.get_household_credit_balance(p_household_id);

    IF NOT v_is_tester AND v_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Créditos insuficientes.',
            'required', p_amount,
            'balance', v_balance
        );
    END IF;

    INSERT INTO public.credit_ledger (
        household_id,
        delta,
        reason,
        reference_id
    ) VALUES (
        p_household_id,
        -p_amount,
        p_reason,
        p_reference_id
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'deducted', p_amount,
        'balance', public.get_household_credit_balance(p_household_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. Acreditación de créditos
CREATE OR REPLACE FUNCTION public.grant_household_credits(
    p_household_id UUID,
    p_amount INT,
    p_reason TEXT,
    p_reference_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_ledger_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser positivo.');
    END IF;

    IF p_reference_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.credit_ledger
        WHERE household_id = p_household_id AND reference_id = p_reference_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'balance', public.get_household_credit_balance(p_household_id)
        );
    END IF;

    INSERT INTO public.credit_ledger (
        household_id,
        delta,
        reason,
        reference_id
    ) VALUES (
        p_household_id,
        p_amount,
        p_reason,
        p_reference_id
    ) RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object(
        'success', true,
        'granted', p_amount,
        'balance', public.get_household_credit_balance(p_household_id)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- G. Tope diario de créditos
CREATE OR REPLACE FUNCTION public.check_daily_credit_limit(
    p_household_id UUID,
    p_amount INT,
    p_daily_limit INT DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
    v_spent_today INT;
    v_is_tester BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.licenses
        WHERE household_id = p_household_id
          AND plan_id = 'tester'
          AND status = 'active'
    ) INTO v_is_tester;

    IF v_is_tester THEN
        RETURN true;
    END IF;

    SELECT coalesce(abs(sum(delta)), 0) INTO v_spent_today
    FROM public.credit_ledger
    WHERE household_id = p_household_id
      AND delta < 0
      AND created_at >= date_trunc('day', now());

    IF (v_spent_today + p_amount) > p_daily_limit THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- H. Crear invitación a hogar
CREATE OR REPLACE FUNCTION public.create_household_invitation(
    p_household_id UUID,
    p_token_hash TEXT,
    p_expires_days INT DEFAULT 7,
    p_max_uses INT DEFAULT 1,
    p_requires_approval BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_is_owner BOOLEAN;
    v_inv_id UUID;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = p_household_id
          AND user_id = auth.uid()
          AND role = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Solo el dueño del hogar puede generar links de invitación.';
    END IF;

    UPDATE public.household_invitations
    SET is_revoked = true
    WHERE household_id = p_household_id
      AND is_revoked = false;

    INSERT INTO public.household_invitations (
        household_id,
        token_hash,
        expires_at,
        max_uses,
        requires_owner_approval,
        created_by
    ) VALUES (
        p_household_id,
        p_token_hash,
        now() + (coalesce(p_expires_days, 7) || ' days')::interval,
        coalesce(p_max_uses, 1),
        coalesce(p_requires_approval, false),
        auth.uid()
    ) RETURNING id INTO v_inv_id;

    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', v_inv_id,
        'expires_days', coalesce(p_expires_days, 7)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- I. Previsualizar invitación
CREATE OR REPLACE FUNCTION public.preview_household_invitation(
    p_token_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_hh RECORD;
    v_recent_attempts INT;
BEGIN
    SELECT count(*) INTO v_recent_attempts
    FROM public.invite_attempt_logs
    WHERE identifier = coalesce(auth.uid()::text, 'anonymous')
      AND success = false
      AND created_at > (now() - interval '15 minutes');

    IF v_recent_attempts >= 8 THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Demasiados intentos fallidos. Espere 15 minutos.');
    END IF;

    SELECT * INTO v_inv
    FROM public.household_invitations
    WHERE token_hash = p_token_hash;

    IF v_inv IS NULL THEN
        INSERT INTO public.invite_attempt_logs (identifier, attempt_type, success)
        VALUES (coalesce(auth.uid()::text, 'anonymous'), 'invite', false);
        RETURN jsonb_build_object('valid', false, 'error', 'Invitación inexistente o token inválido.');
    END IF;

    IF v_inv.is_revoked THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Esta invitación fue revocada.');
    END IF;

    IF v_inv.expires_at <= now() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'La invitación ha expirado.');
    END IF;

    IF v_inv.times_used >= v_inv.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'La invitación ya alcanzó su límite máximo de usos.');
    END IF;

    SELECT id, name, city INTO v_hh
    FROM public.households
    WHERE id = v_inv.household_id;

    RETURN jsonb_build_object(
        'valid', true,
        'household_id', v_hh.id,
        'household_name', v_hh.name,
        'household_city', coalesce(v_hh.city, ''),
        'requires_approval', v_inv.requires_owner_approval
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- J. Unirse a hogar vía invitación
CREATE OR REPLACE FUNCTION public.join_household_via_invitation(
    p_token_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_inv RECORD;
    v_hh RECORD;
    v_plan_id TEXT;
    v_max_members INT := 6;
    v_current_members INT;
    v_already_member BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere autenticación para unirse a un hogar.');
    END IF;

    SELECT * INTO v_inv
    FROM public.household_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_inv IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invitación inexistente.');
    END IF;

    IF v_inv.is_revoked THEN
        RETURN jsonb_build_object('success', false, 'error', 'La invitación ha sido revocada.');
    END IF;

    IF v_inv.expires_at <= now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'La invitación ha expirado.');
    END IF;

    IF v_inv.times_used >= v_inv.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'La invitación ha alcanzado su límite de usos.');
    END IF;

    SELECT * INTO v_hh
    FROM public.households
    WHERE id = v_inv.household_id
    FOR UPDATE;

    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = v_inv.household_id AND user_id = v_user_id
    ) INTO v_already_member;

    IF v_already_member THEN
        RETURN jsonb_build_object('success', true, 'already_member', true, 'household_id', v_inv.household_id);
    END IF;

    SELECT l.plan_id, p.max_members INTO v_plan_id, v_max_members
    FROM public.licenses l
    JOIN public.plans p ON p.id = l.plan_id
    WHERE l.household_id = v_inv.household_id AND l.status = 'active';

    IF v_max_members IS NULL THEN
        v_max_members := 6;
    END IF;

    SELECT count(*) INTO v_current_members
    FROM public.household_members
    WHERE household_id = v_inv.household_id;

    IF v_current_members >= v_max_members THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'El hogar ha alcanzado el límite máximo de integrantes de su plan (' || v_max_members || ').'
        );
    END IF;

    IF v_inv.requires_owner_approval THEN
        RETURN jsonb_build_object(
            'success', true,
            'pending_approval', true,
            'household_id', v_inv.household_id,
            'message', 'Solicitud enviada al dueño del hogar para su aprobación.'
        );
    END IF;

    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_inv.household_id, v_user_id, 'member')
    ON CONFLICT (household_id, user_id) DO NOTHING;

    UPDATE public.household_invitations
    SET times_used = times_used + 1
    WHERE id = v_inv.id;

    INSERT INTO public.invite_attempt_logs (identifier, attempt_type, success)
    VALUES (v_user_id::text, 'invite', true);

    RETURN jsonb_build_object(
        'success', true,
        'household_id', v_inv.household_id,
        'household_name', v_hh.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- K. Canjear código de acceso
CREATE OR REPLACE FUNCTION public.redeem_access_code(
    p_code_hash TEXT,
    p_household_name TEXT,
    p_city TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_code RECORD;
    v_hh_id UUID;
    v_plan RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Se requiere autenticación para canjear un código.');
    END IF;

    SELECT * INTO v_code
    FROM public.access_codes
    WHERE code_hash = p_code_hash
    FOR UPDATE;

    IF v_code IS NULL THEN
        INSERT INTO public.invite_attempt_logs (identifier, attempt_type, success)
        VALUES (v_user_id::text, 'access_code', false);
        RETURN jsonb_build_object('success', false, 'error', 'Código de acceso inexistente o inválido.');
    END IF;

    IF v_code.times_used >= v_code.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'El código de acceso ya fue utilizado.');
    END IF;

    IF v_code.expires_at IS NOT NULL AND v_code.expires_at <= now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'El código de acceso ha expirado.');
    END IF;

    SELECT * INTO v_plan
    FROM public.plans
    WHERE id = v_code.plan_id;

    INSERT INTO public.households (
        name,
        city,
        monthly_chef_limit,
        chef_queries_used_month,
        created_by
    ) VALUES (
        coalesce(nullif(trim(p_household_name), ''), 'Mi Hogar'),
        coalesce(p_city, ''),
        coalesce(v_plan.monthly_chef_queries, 40),
        0,
        v_user_id
    ) RETURNING id INTO v_hh_id;

    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_hh_id, v_user_id, 'owner')
    ON CONFLICT (household_id, user_id) DO UPDATE SET role = 'owner';

    INSERT INTO public.licenses (
        household_id,
        plan_id,
        status,
        valid_until,
        activated_at
    ) VALUES (
        v_hh_id,
        v_code.plan_id,
        'active',
        NULL,
        now()
    ) ON CONFLICT (household_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'active',
        valid_until = NULL;

    UPDATE public.access_codes
    SET times_used = times_used + 1
    WHERE id = v_code.id;

    INSERT INTO public.access_code_redemptions (code_id, user_id, household_id)
    VALUES (v_code.id, v_user_id, v_hh_id);

    INSERT INTO public.invite_attempt_logs (identifier, attempt_type, success)
    VALUES (v_user_id::text, 'access_code', true);

    RETURN jsonb_build_object(
        'success', true,
        'household_id', v_hh_id,
        'household_name', coalesce(nullif(trim(p_household_name), ''), 'Mi Hogar'),
        'plan_id', v_code.plan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- L. Remover integrante de hogar
CREATE OR REPLACE FUNCTION public.remove_household_member(
    p_household_id UUID,
    p_target_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_is_owner BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = p_household_id
          AND user_id = auth.uid()
          AND role = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo el dueño puede remover integrantes.');
    END IF;

    IF p_target_user_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'El dueño no puede auto-eliminarse de su propio hogar.');
    END IF;

    DELETE FROM public.household_members
    WHERE household_id = p_household_id
      AND user_id = p_target_user_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- M. Triggers de nuevo hogar y licencia
CREATE OR REPLACE FUNCTION public.handle_new_household()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.household_members (household_id, user_id, role, display_name)
    VALUES (NEW.id, coalesce(auth.uid(), NEW.created_by), 'owner', 'Creador')
    ON CONFLICT (household_id, user_id) DO NOTHING;

    INSERT INTO public.household_licenses (household_id, plan_type, max_monthly_chef_queries)
    VALUES (NEW.id, 'free', 40)
    ON CONFLICT (household_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_household_created ON public.households;
CREATE TRIGGER on_household_created
    AFTER INSERT ON public.households
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_household();

CREATE OR REPLACE FUNCTION public.handle_new_household_license()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.licenses (household_id, plan_id, status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (household_id) DO NOTHING;

    NEW.monthly_chef_limit := 5;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_household_license_init ON public.households;
CREATE TRIGGER trigger_household_license_init
    BEFORE INSERT ON public.households
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_household_license();

-- ========================================================================
-- ROW LEVEL SECURITY (RLS) - CONFIGURACIÓN COMPLETA
-- ========================================================================

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_attempt_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_recharge_packages ENABLE ROW LEVEL SECURITY;

-- 1. households
DROP POLICY IF EXISTS "Usuarios pueden ver los hogares a los que pertenecen" ON public.households;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden ver su hogar" ON public.households;
CREATE POLICY "Miembros pueden ver su hogar"
    ON public.households FOR SELECT
    USING (public.user_belongs_to_household(id));

DROP POLICY IF EXISTS "Cualquier usuario autenticado puede crear un hogar" ON public.households;
CREATE POLICY "Cualquier usuario autenticado puede crear un hogar"
    ON public.households FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Miembros pueden actualizar los datos de su hogar" ON public.households;
CREATE POLICY "Miembros pueden actualizar los datos de su hogar"
    ON public.households FOR UPDATE
    USING (public.user_belongs_to_household(id));

-- 2. household_members
DROP POLICY IF EXISTS "Miembros pueden ver otros miembros de su hogar" ON public.household_members;
CREATE POLICY "Miembros pueden ver otros miembros de su hogar"
    ON public.household_members FOR SELECT
    USING (public.user_belongs_to_household(household_id));

DROP POLICY IF EXISTS "Usuarios pueden unirse a hogares" ON public.household_members;
CREATE POLICY "Usuarios pueden unirse a hogares"
    ON public.household_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Miembros pueden actualizar su propio perfil de miembro" ON public.household_members;
CREATE POLICY "Miembros pueden actualizar su propio perfil de miembro"
    ON public.household_members FOR UPDATE
    USING (auth.uid() = user_id);

-- 3. plans
DROP POLICY IF EXISTS "Lectura pública de planes" ON public.plans;
CREATE POLICY "Lectura pública de planes"
    ON public.plans FOR SELECT
    USING (true);

-- 4. exchange_rates
DROP POLICY IF EXISTS "Lectura pública de cotizaciones" ON public.exchange_rates;
CREATE POLICY "Lectura pública de cotizaciones"
    ON public.exchange_rates FOR SELECT
    USING (true);

-- 5. licenses
DROP POLICY IF EXISTS "Miembros pueden ver la licencia de su propio hogar" ON public.licenses;
CREATE POLICY "Miembros pueden ver la licencia de su propio hogar"
    ON public.licenses FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 6. household_licenses (compat)
DROP POLICY IF EXISTS "Miembros pueden ver la licencia de su hogar" ON public.household_licenses;
CREATE POLICY "Miembros pueden ver la licencia de su hogar"
    ON public.household_licenses FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 7. payments
DROP POLICY IF EXISTS "Miembros pueden ver los pagos de su propio hogar" ON public.payments;
CREATE POLICY "Miembros pueden ver los pagos de su propio hogar"
    ON public.payments FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 8. shopping_items (Filtrado por pertenencia y licencia en modo cerrado)
DROP POLICY IF EXISTS "Acceso total a shopping_items para miembros del hogar" ON public.shopping_items;
DROP POLICY IF EXISTS "Miembros pueden ver items de compra" ON public.shopping_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden ver items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden ver items de compra"
    ON public.shopping_items FOR SELECT
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden insertar items de compra" ON public.shopping_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden insertar items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden insertar items de compra"
    ON public.shopping_items FOR INSERT
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden actualizar items de compra" ON public.shopping_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden actualizar items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden actualizar items de compra"
    ON public.shopping_items FOR UPDATE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden eliminar items de compra" ON public.shopping_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden eliminar items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden eliminar items de compra"
    ON public.shopping_items FOR DELETE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

-- 9. pantry_items (Filtrado por pertenencia y licencia en modo cerrado)
DROP POLICY IF EXISTS "Acceso total a pantry_items para miembros del hogar" ON public.pantry_items;
DROP POLICY IF EXISTS "Miembros pueden ver items de despensa" ON public.pantry_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden ver items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden ver items de despensa"
    ON public.pantry_items FOR SELECT
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden insertar items de despensa" ON public.pantry_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden insertar items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden insertar items de despensa"
    ON public.pantry_items FOR INSERT
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden actualizar items de despensa" ON public.pantry_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden actualizar items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden actualizar items de despensa"
    ON public.pantry_items FOR UPDATE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden eliminar items de despensa" ON public.pantry_items;
DROP POLICY IF EXISTS "Miembros con licencia activa pueden eliminar items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden eliminar items de despensa"
    ON public.pantry_items FOR DELETE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

-- 10. ai_usage_log
DROP POLICY IF EXISTS "Miembros pueden consultar el log de IA de su hogar" ON public.ai_usage_log;
CREATE POLICY "Miembros pueden consultar el log de IA de su hogar"
    ON public.ai_usage_log FOR SELECT
    USING (public.user_belongs_to_household(household_id));

DROP POLICY IF EXISTS "Edge functions o servicio insertan en ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "Edge functions o servicio insertan en ai_usage_log"
    ON public.ai_usage_log FOR INSERT
    WITH CHECK (public.user_belongs_to_household(household_id));

-- 11. ai_cache
DROP POLICY IF EXISTS "Lectura de caché para usuarios autenticados" ON public.ai_cache;
CREATE POLICY "Lectura de caché para usuarios autenticados"
    ON public.ai_cache FOR SELECT
    USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Inserción en caché para usuarios autenticados" ON public.ai_cache;
CREATE POLICY "Inserción en caché para usuarios autenticados"
    ON public.ai_cache FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 12. push_subscriptions
DROP POLICY IF EXISTS "Usuarios gestionan sus propias suscripciones push" ON public.push_subscriptions;
CREATE POLICY "Usuarios gestionan sus propias suscripciones push"
    ON public.push_subscriptions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 13. price_reference
DROP POLICY IF EXISTS "Allow authenticated read price_reference" ON public.price_reference;
CREATE POLICY "Allow authenticated read price_reference"
    ON public.price_reference FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow anon read price_reference" ON public.price_reference;
CREATE POLICY "Allow anon read price_reference"
    ON public.price_reference FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "Allow service_role manage price_reference" ON public.price_reference;
CREATE POLICY "Allow service_role manage price_reference"
    ON public.price_reference FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 14. user_preferences
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias preferencias" ON public.user_preferences;
CREATE POLICY "Usuarios pueden ver sus propias preferencias"
    ON public.user_preferences FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden insertar sus propias preferencias" ON public.user_preferences;
CREATE POLICY "Usuarios pueden insertar sus propias preferencias"
    ON public.user_preferences FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Usuarios pueden actualizar sus propias preferencias" ON public.user_preferences;
CREATE POLICY "Usuarios pueden actualizar sus propias preferencias"
    ON public.user_preferences FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 15. household_settings
DROP POLICY IF EXISTS "Miembros pueden ver ajustes de su hogar" ON public.household_settings;
CREATE POLICY "Miembros pueden ver ajustes de su hogar"
    ON public.household_settings FOR SELECT
    TO authenticated
    USING (public.user_belongs_to_household(household_id));

DROP POLICY IF EXISTS "Miembros pueden insertar ajustes de su hogar" ON public.household_settings;
CREATE POLICY "Miembros pueden insertar ajustes de su hogar"
    ON public.household_settings FOR INSERT
    TO authenticated
    WITH CHECK (public.user_belongs_to_household(household_id));

DROP POLICY IF EXISTS "Miembros pueden actualizar ajustes de su hogar" ON public.household_settings;
CREATE POLICY "Miembros pueden actualizar ajustes de su hogar"
    ON public.household_settings FOR UPDATE
    TO authenticated
    USING (public.user_belongs_to_household(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id));

-- 16. system_settings
DROP POLICY IF EXISTS "Lectura pública de configuraciones del sistema" ON public.system_settings;
CREATE POLICY "Lectura pública de configuraciones del sistema"
    ON public.system_settings FOR SELECT
    USING (true);

-- 17. access_codes (Solo RPCs o service_role)
-- No hay SELECT público para access_codes para evitar filtración de códigos

-- 18. access_code_redemptions
DROP POLICY IF EXISTS "Usuarios ven sus propios canjes" ON public.access_code_redemptions;
CREATE POLICY "Usuarios ven sus propios canjes"
    ON public.access_code_redemptions FOR SELECT
    USING (user_id = auth.uid());

-- 19. household_invitations
DROP POLICY IF EXISTS "Integrantes del hogar pueden ver sus invitaciones activas" ON public.household_invitations;
CREATE POLICY "Integrantes del hogar pueden ver sus invitaciones activas"
    ON public.household_invitations FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 20. invite_attempt_logs
DROP POLICY IF EXISTS "invite_attempt_logs_internal_only" ON public.invite_attempt_logs;
CREATE POLICY "invite_attempt_logs_internal_only"
    ON public.invite_attempt_logs FOR ALL
    USING (false)
    WITH CHECK (false);

-- 21. ai_pricing
DROP POLICY IF EXISTS "Lectura pública de tarifas de IA" ON public.ai_pricing;
CREATE POLICY "Lectura pública de tarifas de IA"
    ON public.ai_pricing FOR SELECT
    USING (true);

-- 22. credit_ledger
DROP POLICY IF EXISTS "Miembros pueden ver el ledger de su propio hogar" ON public.credit_ledger;
CREATE POLICY "Miembros pueden ver el ledger de su propio hogar"
    ON public.credit_ledger FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 23. credit_recharge_packages
DROP POLICY IF EXISTS "Lectura pública de paquetes de créditos" ON public.credit_recharge_packages;
CREATE POLICY "Lectura pública de paquetes de créditos"
    ON public.credit_recharge_packages FOR SELECT
    USING (true);

-- ========================================================================
-- REALTIME - PUBLICACIÓN SEGURA
-- ========================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Limpieza de caché inicial
DELETE FROM public.ai_cache;

-- FIN DE MIGRACIÓN COMPLETA
