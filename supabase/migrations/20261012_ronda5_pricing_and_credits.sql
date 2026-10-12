-- ========================================================================
-- LISTA COMPARS - MIGRACIÓN: PRECIOS DE IA, CRÉDITOS Y LEDGER (RONDA 5 - BLOQUE 5)
-- Archivo: 20261012_ronda5_pricing_and_credits.sql
-- ========================================================================

-- 1. TABLA: ai_pricing (Tarifario histórico y programado de modelos de IA en USD por millón de tokens)
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
ALTER TABLE public.ai_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de tarifas de IA" ON public.ai_pricing FOR SELECT USING (true);

-- Semilla de tarifas vigentes 2026 (según ai.google.dev/pricing)
INSERT INTO public.ai_pricing (model, input_usd_per_million, output_usd_per_million, effective_from)
VALUES 
    -- Gemini 2.5 / 3.5 Flash-Lite (modelo económico ultra-rápido)
    ('gemini-2.5-flash-lite', 0.1000, 0.4000, '2026-01-01 00:00:00+00'),
    ('gemini-3.5-flash-lite', 0.1000, 0.4000, '2026-01-01 00:00:00+00'),
    -- Gemini 2.5 / 3.5 Flash (modelo completo estándar)
    ('gemini-2.5-flash', 0.3000, 2.5000, '2026-01-01 00:00:00+00'),
    ('gemini-3.5-flash', 0.7500, 3.7500, '2026-01-01 00:00:00+00'),
    -- Tarifas programadas para el 1 de Enero de 2027 (aumento anunciado de modelos Flash)
    ('gemini-2.5-flash-lite', 0.2000, 0.8000, '2027-01-01 00:00:00+00'),
    ('gemini-3.5-flash-lite', 0.2000, 0.8000, '2027-01-01 00:00:00+00'),
    ('gemini-2.5-flash', 0.6000, 5.0000, '2027-01-01 00:00:00+00'),
    ('gemini-3.5-flash', 1.5000, 7.5000, '2027-01-01 00:00:00+00')
ON CONFLICT (model, effective_from) DO UPDATE SET
    input_usd_per_million = EXCLUDED.input_usd_per_million,
    output_usd_per_million = EXCLUDED.output_usd_per_million;

-- 2. FUNCIÓN: calculate_ai_cost
-- Calcula el costo exacto en USD buscando la tarifa vigente a la fecha de la consulta
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
        -- Fallback con tarifa estándar de Flash si no coincide el nombre exacto
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

-- 3. EXPANDIR: ai_usage_log con métricas de tokens y costos
ALTER TABLE public.ai_usage_log
    ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gemini-3.5-flash',
    ADD COLUMN IF NOT EXISTS prompt_tokens INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS completion_tokens INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reasoning_tokens INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10, 6) DEFAULT 0.000000,
    ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'ia',
    ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;

-- 4. TABLA: credit_ledger (Libro mayor inmutable y de doble entrada para créditos de IA)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    delta INT NOT NULL, -- Positivo = otorgado/recargado, Negativo = consumido
    reason TEXT NOT NULL, -- 'plan_grant', 'chef_recipe', 'weekly_menu', 'regenerate_dish', 'recharge_pack', 'admin_adjustment'
    reference_id TEXT, -- Para idempotencia estricta (ej. query_uuid, payment_id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restricción de unicidad para garantizar idempotencia por hogar y referencia
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_unique_ref 
    ON public.credit_ledger(household_id, reference_id) 
    WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_household_date 
    ON public.credit_ledger(household_id, created_at DESC);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

-- Seguridad RLS: Miembros solo pueden LEER los movimientos de su hogar.
-- CERO escritura directa desde el cliente. Solo funciones SECURITY DEFINER o service role.
CREATE POLICY "Miembros pueden ver el ledger de su propio hogar"
    ON public.credit_ledger FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 5. FUNCIÓN: get_household_credit_balance
-- Devuelve el balance neto de créditos disponibles del hogar
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

-- 6. FUNCIÓN: deduct_household_credits
-- Débito atómico e idempotente de créditos
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

    -- Verificar si es plan tester (los testers tienen crédito virtual ilimitado)
    SELECT EXISTS (
        SELECT 1 FROM public.licenses
        WHERE household_id = p_household_id
          AND plan_id = 'tester'
          AND status = 'active'
    ) INTO v_is_tester;

    -- Si ya se procesó este reference_id (operación idempotente), devolver éxito
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

    -- Consultar saldo actual
    v_balance := public.get_household_credit_balance(p_household_id);

    IF NOT v_is_tester AND v_balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Créditos insuficientes.',
            'required', p_amount,
            'balance', v_balance
        );
    END IF;

    -- Insertar débito en el libro mayor
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

-- 7. FUNCIÓN: grant_household_credits
-- Acreditación idempotente (para recargas o cuota inicial)
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

    -- Idempotencia estricta por reference_id
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

-- 8. FUNCIÓN: check_daily_credit_limit
-- Verifica si el hogar supera el tope diario de consumo (por defecto 15 créditos/día)
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
    -- Plan tester exento del tope diario
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

-- 9. TABLA: credit_recharge_packages (Paquetes de créditos comprables con margen >= 3x)
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

ALTER TABLE public.credit_recharge_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de paquetes de créditos" ON public.credit_recharge_packages FOR SELECT USING (true);
