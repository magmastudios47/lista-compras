-- ========================================================================
-- LISTA COMPARS - MIGRACIÓN: SISTEMA DE PLANES, PAGOS Y LICENCIAS
-- Archivo: 20261008_billing_and_payments.sql
-- ========================================================================

-- 1. TABLA: plans (Configuración centralizada de planes y límites)
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY, -- 'free', 'base', 'premium'
    name TEXT NOT NULL,
    price_usd NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    monthly_chef_queries INT NOT NULL,
    max_members INT NOT NULL DEFAULT 3,
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Semilla de planes oficiales
INSERT INTO public.plans (id, name, price_usd, monthly_chef_queries, max_members, features)
VALUES 
    ('free', 'Plan Gratuito', 0.00, 5, 3, '{"weekly_menu": false, "price_tracking": false}'::jsonb),
    ('base', 'Plan Base Hogar', 10.00, 40, 10, '{"weekly_menu": false, "price_tracking": false}'::jsonb),
    ('premium', 'Plan Premium Hogar', 20.00, 150, 99, '{"weekly_menu": true, "price_tracking": true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_usd = EXCLUDED.price_usd,
    monthly_chef_queries = EXCLUDED.monthly_chef_queries,
    max_members = EXCLUDED.max_members,
    features = EXCLUDED.features;

-- 2. TABLA: exchange_rates (Tipos de cambio editables con control de sanidad)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_from TEXT NOT NULL DEFAULT 'USD',
    currency_to TEXT NOT NULL DEFAULT 'ARS',
    rate NUMERIC(10,2) NOT NULL CHECK (rate >= 500.00 AND rate <= 10000.00), -- Control de sanidad estricto
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE(currency_from, currency_to)
);

-- Tasa inicial de referencia
INSERT INTO public.exchange_rates (currency_from, currency_to, rate)
VALUES ('USD', 'ARS', 1350.00)
ON CONFLICT (currency_from, currency_to) DO UPDATE SET
    rate = EXCLUDED.rate,
    updated_at = now();

-- 3. TABLA: licenses (Licencia activa de cada hogar)
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID UNIQUE NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
    valid_until TIMESTAMPTZ, -- NULL indica licencia de por vida
    activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. TABLA: payments (Registro inmutable y trazable de pagos de Mercado Pago)
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

-- Índices de consulta y rendimiento
CREATE INDEX IF NOT EXISTS idx_payments_household ON public.payments(household_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_ref ON public.payments(external_reference);
CREATE INDEX IF NOT EXISTS idx_payments_mp_id ON public.payments(mercadopago_payment_id);
CREATE INDEX IF NOT EXISTS idx_licenses_household ON public.licenses(household_id);

-- ========================================================================
-- SEGURIDAD ESTRICTA: ROW LEVEL SECURITY (RLS)
-- ========================================================================
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 1. plans: Lectura pública para usuarios autenticados y anónimos. CERO inserción/actualización desde cliente.
CREATE POLICY "Lectura pública de planes"
    ON public.plans FOR SELECT
    USING (true);

-- 2. exchange_rates: Lectura pública. CERO inserción/actualización desde cliente.
CREATE POLICY "Lectura pública de cotizaciones"
    ON public.exchange_rates FOR SELECT
    USING (true);

-- 3. licenses: Los usuarios SOLO pueden LEER la licencia de su propio hogar.
-- PROHIBIDO: No existe ninguna política de INSERT, UPDATE o DELETE para clientes.
-- Solo el service role (Edge Functions) puede escribir en licenses.
CREATE POLICY "Miembros pueden ver la licencia de su propio hogar"
    ON public.licenses FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 4. payments: Los usuarios SOLO pueden LEER los pagos de su propio hogar.
-- PROHIBIDO: No existe ninguna política de INSERT, UPDATE o DELETE para clientes.
-- Solo el service role (Edge Functions) puede escribir en payments.
CREATE POLICY "Miembros pueden ver los pagos de su propio hogar"
    ON public.payments FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- ========================================================================
-- TRIGGER: Asignar licencia 'free' por defecto al crear un hogar
-- ========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_household_license()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.licenses (household_id, plan_id, status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (household_id) DO NOTHING;

    -- Ajustar límite del hogar a 5 consultas por defecto (plan free)
    NEW.monthly_chef_limit := 5;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger BEFORE insert en households para asegurar cuota inicial de 5
DROP TRIGGER IF EXISTS trigger_household_license_init ON public.households;
CREATE TRIGGER trigger_household_license_init
    BEFORE INSERT ON public.households
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_household_license();
