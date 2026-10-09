-- ========================================================================
-- LISTA COMPARS - ESQUEMA DE BASE DE DATOS SUPABASE
-- Migración inicial: 20261007_init.sql
-- ========================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------
-- 1. TABLA: households (Hogares)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(4), 'hex'),
    currency TEXT NOT NULL DEFAULT 'ARS',
    monthly_chef_limit INT NOT NULL DEFAULT 40,
    chef_queries_used_month INT NOT NULL DEFAULT 0,
    chef_quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 2. TABLA: household_members (Miembros del Hogar)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.household_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    display_name TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, user_id)
);

-- ------------------------------------------------------------------------
-- 3. TABLA: shopping_items (Lista de Compras Compartida)
-- ------------------------------------------------------------------------
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
    estimated_price NUMERIC(10,2), -- Arquitectura preparada para presupuesto estimado
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 4. TABLA: pantry_items (Despensa: "Ya tengo en casa")
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pantry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    quantity NUMERIC(10,2), -- Puede ser NULL si no se especificó cantidad
    unit TEXT,             -- Puede ser NULL
    category TEXT NOT NULL DEFAULT 'almacen' CHECK (
        category IN ('verduleria', 'carniceria', 'almacen', 'lacteos', 'fiambreria', 'panaderia', 'bebidas', 'congelados', 'limpieza', 'otros')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(household_id, normalized_name)
);

-- ------------------------------------------------------------------------
-- 5. TABLA: ai_usage_log (Auditoría de Uso del Chef IA)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    mode TEXT NOT NULL CHECK (mode IN ('cocinar', 'sugerir', 'interpretar_despensa', 'menu_semanal')),
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    total_tokens INT NOT NULL DEFAULT 0,
    is_cached BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'rate_limited', 'error', 'quota_exceeded')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------
-- 6. TABLA: ai_cache (Caché de Consultas Idénticas)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- ------------------------------------------------------------------------
-- 7. TABLA: household_licenses (Planes y Licencias de Mercado Pago)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- 8. TABLA: push_subscriptions (Suscripciones Web Push)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, household_id)
);

-- ------------------------------------------------------------------------
-- ÍNDICES DE RENDIMIENTO
-- ------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_household_members_user ON public.household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_household ON public.shopping_items(household_id, is_bought);
CREATE INDEX IF NOT EXISTS idx_pantry_items_household ON public.pantry_items(household_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_household_created ON public.ai_usage_log(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON public.ai_cache(cache_key);

-- ------------------------------------------------------------------------
-- FUNCIONES DE SEGURIDAD (RLS HELPERS)
-- ------------------------------------------------------------------------
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: households
-- ------------------------------------------------------------------------
CREATE POLICY "Usuarios pueden ver los hogares a los que pertenecen"
    ON public.households FOR SELECT
    USING (public.user_belongs_to_household(id));

CREATE POLICY "Cualquier usuario autenticado puede crear un hogar"
    ON public.households FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Miembros pueden actualizar los datos de su hogar"
    ON public.households FOR UPDATE
    USING (public.user_belongs_to_household(id));

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: household_members
-- ------------------------------------------------------------------------
CREATE POLICY "Miembros pueden ver otros miembros de su hogar"
    ON public.household_members FOR SELECT
    USING (public.user_belongs_to_household(household_id));

CREATE POLICY "Usuarios pueden unirse a hogares"
    ON public.household_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Miembros pueden actualizar su propio perfil de miembro"
    ON public.household_members FOR UPDATE
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: shopping_items
-- ------------------------------------------------------------------------
CREATE POLICY "Acceso total a shopping_items para miembros del hogar"
    ON public.shopping_items FOR ALL
    USING (public.user_belongs_to_household(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id));

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: pantry_items
-- ------------------------------------------------------------------------
CREATE POLICY "Acceso total a pantry_items para miembros del hogar"
    ON public.pantry_items FOR ALL
    USING (public.user_belongs_to_household(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id));

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: ai_usage_log
-- ------------------------------------------------------------------------
CREATE POLICY "Miembros pueden consultar el log de IA de su hogar"
    ON public.ai_usage_log FOR SELECT
    USING (public.user_belongs_to_household(household_id));

CREATE POLICY "Edge functions o servicio insertan en ai_usage_log"
    ON public.ai_usage_log FOR INSERT
    WITH CHECK (public.user_belongs_to_household(household_id));

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: ai_cache
-- ------------------------------------------------------------------------
CREATE POLICY "Lectura de caché para usuarios autenticados"
    ON public.ai_cache FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Inserción en caché para usuarios autenticados"
    ON public.ai_cache FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: household_licenses
-- ------------------------------------------------------------------------
CREATE POLICY "Miembros pueden ver la licencia de su hogar"
    ON public.household_licenses FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- ------------------------------------------------------------------------
-- POLÍTICAS RLS: push_subscriptions
-- ------------------------------------------------------------------------
CREATE POLICY "Usuarios gestionan sus propias suscripciones push"
    ON public.push_subscriptions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- TRIGGER: Auto-crear membresía de admin al crear hogar
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_household()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.household_members (household_id, user_id, role, display_name)
    VALUES (NEW.id, auth.uid(), 'admin', 'Creador');

    INSERT INTO public.household_licenses (household_id, plan_type, max_monthly_chef_queries)
    VALUES (NEW.id, 'free', 40);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_household_created
    AFTER INSERT ON public.households
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_household();

-- ------------------------------------------------------------------------
-- HABILITACIÓN DE REALTIME PARA TABLAS COMPARTIDAS
-- ------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
