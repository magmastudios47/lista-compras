-- ========================================================================
-- RONDA 5 COMPLETA UNIFICADA - LISTA COMPARS
-- Ejecutar este script una sola vez en el SQL Editor de tu proyecto Supabase
-- ========================================================================

-- ------------------------------------------------------------------------
-- ARCHIVO: supabase/migrations/20261012_ronda5_cache_purge.sql
-- ------------------------------------------------------------------------

-- ==============================================================================
-- Ronda 5 - Migración: Limpieza de ai_cache
-- Vaciado de la tabla ai_cache para eliminar respuestas obsoletas generadas
-- con versiones previas del prompt o fallbacks estáticos.
-- ==============================================================================

TRUNCATE TABLE public.ai_cache;


-- ------------------------------------------------------------------------
-- ARCHIVO: supabase/migrations/20261012_ronda5_settings_and_preferences.sql
-- ------------------------------------------------------------------------

-- ========================================================================
-- Migración: Ronda 5 - Preferencias de Usuario y Ajustes de Hogar Persistentes
-- Archivo: 20261012_ronda5_settings_and_preferences.sql
-- ========================================================================

-- 1. TABLA: user_preferences (Preferencias individuales por usuario)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    target_profile TEXT NOT NULL DEFAULT 'Comer más sano',
    profile_detail TEXT NOT NULL DEFAULT '',
    ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

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


-- 2. TABLA: household_settings (Ajustes compartidos por hogar)
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

-- RLS para household_settings
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

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

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_household_settings_household ON public.household_settings(household_id);


-- ------------------------------------------------------------------------
-- ARCHIVO: supabase/migrations/20261012_ronda5_access_control.sql
-- ------------------------------------------------------------------------

-- ========================================================================
-- LISTA COMPARS - MIGRACIÓN: CONTROL DE ACCESO, LICENCIAS Y CÓDIGOS (RONDA 5)
-- Archivo: 20261012_ronda5_access_control.sql
-- ========================================================================

-- 1. Actualizar límites de integrantes en planes oficiales (Base 6, Premium 8)
UPDATE public.plans SET max_members = 6 WHERE id = 'base';
UPDATE public.plans SET max_members = 8 WHERE id = 'premium';

-- Insertar plan interno 'tester' (no comprable, para pruebas del dueño)
INSERT INTO public.plans (id, name, price_usd, monthly_chef_queries, max_members, features, is_active)
VALUES 
    ('tester', 'Plan Interno Tester', 0.00, 9999, 99, '{"weekly_menu": true, "price_tracking": true, "internal": true}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
    max_members = EXCLUDED.max_members,
    monthly_chef_queries = EXCLUDED.monthly_chef_queries,
    features = EXCLUDED.features,
    is_active = true;

-- 2. TABLA: system_settings (Configuraciones operativas del sistema)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Valores por defecto (closed por defecto según spec de Ronda 5)
INSERT INTO public.system_settings (key, value)
VALUES 
    ('access_mode', 'closed'),
    ('trial_credits', '0')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de configuraciones del sistema"
    ON public.system_settings FOR SELECT
    USING (true);

-- 3. FUNCIÓN: has_active_license(h_id UUID)
-- Verifica si un hogar posee licencia activa o si el sistema está en modo open
CREATE OR REPLACE FUNCTION public.has_active_license(h_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_mode TEXT;
    v_has_license BOOLEAN;
BEGIN
    IF h_id IS NULL THEN
        RETURN false;
    END IF;

    -- Verificar modo del sistema (por defecto 'closed')
    SELECT value INTO v_mode FROM public.system_settings WHERE key = 'access_mode';
    IF v_mode IS NULL THEN
        v_mode := 'closed';
    END IF;

    IF v_mode = 'open' THEN
        RETURN true;
    END IF;

    -- En modo closed, buscar licencia activa y vigente
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

-- 4. TABLA: access_codes (Códigos de activación para familiares y primeros compradores)
CREATE TABLE IF NOT EXISTS public.access_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash TEXT UNIQUE NOT NULL, -- SHA-256 en minúsculas del código normalizado
    plan_id TEXT NOT NULL REFERENCES public.plans(id) DEFAULT 'base',
    max_uses INT NOT NULL DEFAULT 1,
    times_used INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ, -- NULL para sin vencimiento
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_codes_hash ON public.access_codes(code_hash);
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
-- Seguridad: Nadie lee directamente por REST pública la tabla de códigos (solo RPCs seguras)

-- 5. TABLA: access_code_redemptions (Trazabilidad de canjes)
CREATE TABLE IF NOT EXISTS public.access_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_id UUID NOT NULL REFERENCES public.access_codes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(code_id, user_id)
);

ALTER TABLE public.access_code_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios ven sus propios canjes"
    ON public.access_code_redemptions FOR SELECT
    USING (user_id = auth.uid());

-- 6. TABLA: household_invitations (Links de invitación a integrantes con token seguro)
CREATE TABLE IF NOT EXISTS public.household_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL, -- SHA-256 del token aleatorio de >=128 bits
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
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Integrantes del hogar pueden ver sus invitaciones activas"
    ON public.household_invitations FOR SELECT
    USING (public.user_belongs_to_household(household_id));

-- 7. TABLA: invite_attempt_logs (Control de tasa de intentos para frenar fuerza bruta)
CREATE TABLE IF NOT EXISTS public.invite_attempt_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- IP o user_id
    attempt_type TEXT NOT NULL, -- 'invite' | 'access_code'
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_attempt_logs_identifier ON public.invite_attempt_logs(identifier, created_at);

-- ------------------------------------------------------------------------
-- RPC: create_household_invitation
-- Solo dueños del hogar pueden crear invitaciones. Invalida invitaciones anteriores.
-- ------------------------------------------------------------------------
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
    -- Validar que el usuario actual es dueño del hogar
    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = p_household_id
          AND user_id = auth.uid()
          AND role = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Solo el dueño del hogar puede generar links de invitación.';
    END IF;

    -- "Generar nuevo link" invalida los anteriores del hogar
    UPDATE public.household_invitations
    SET is_revoked = true
    WHERE household_id = p_household_id
      AND is_revoked = false;

    -- Insertar nueva invitación
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

-- ------------------------------------------------------------------------
-- RPC: preview_household_invitation
-- Permite previsualizar el hogar antes de confirmar unirse
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_household_invitation(
    p_token_hash TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_inv RECORD;
    v_hh RECORD;
    v_recent_attempts INT;
BEGIN
    -- Rate limit: máximo 8 intentos fallidos en los últimos 15 minutos
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
        'household_city', v_hh.city,
        'requires_approval', v_inv.requires_owner_approval
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- RPC: join_household_via_invitation
-- Validación atómica de tope de integrantes y consumo del token
-- ------------------------------------------------------------------------
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

    -- Bloquear fila de invitación para evitar condiciones de carrera
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

    -- Bloquear fila del hogar para chequear miembros de forma atómica
    SELECT * INTO v_hh
    FROM public.households
    WHERE id = v_inv.household_id
    FOR UPDATE;

    -- Verificar si ya es miembro
    SELECT EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = v_inv.household_id AND user_id = v_user_id
    ) INTO v_already_member;

    IF v_already_member THEN
        RETURN jsonb_build_object('success', true, 'already_member', true, 'household_id', v_inv.household_id);
    END IF;

    -- Obtener tope de integrantes según la licencia activa
    SELECT l.plan_id, p.max_members INTO v_plan_id, v_max_members
    FROM public.licenses l
    JOIN public.plans p ON p.id = l.plan_id
    WHERE l.household_id = v_inv.household_id AND l.status = 'active';

    IF v_max_members IS NULL THEN
        v_max_members := 6; -- Default base
    END IF;

    -- Contar integrantes actuales con bloqueo
    SELECT count(*) INTO v_current_members
    FROM public.household_members
    WHERE household_id = v_inv.household_id;

    IF v_current_members >= v_max_members THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'El hogar ha alcanzado el límite máximo de integrantes de su plan (' || v_max_members || ').'
        );
    END IF;

    -- Si requiere aprobación del dueño, registrar solicitud
    IF v_inv.requires_owner_approval THEN
        -- Insertar miembro en rol pendiente si existiera o devolver status
        RETURN jsonb_build_object(
            'success', true,
            'pending_approval', true,
            'household_id', v_inv.household_id,
            'message', 'Solicitud enviada al dueño del hogar para su aprobación.'
        );
    END IF;

    -- Agregar integrante
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_inv.household_id, v_user_id, 'member')
    ON CONFLICT (household_id, user_id) DO NOTHING;

    -- Incrementar usos de la invitación de forma atómica
    UPDATE public.household_invitations
    SET times_used = times_used + 1
    WHERE id = v_inv.id;

    -- Registrar log de éxito
    INSERT INTO public.invite_attempt_logs (identifier, attempt_type, success)
    VALUES (v_user_id::text, 'invite', true);

    RETURN jsonb_build_object(
        'success', true,
        'household_id', v_inv.household_id,
        'household_name', v_hh.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------
-- RPC: redeem_access_code
-- Canje atómico de código para crear hogar con licencia del plan
-- ------------------------------------------------------------------------
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

    -- Bloquear fila del código para evitar doble canje concurrente
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

    -- Obtener detalles del plan asociado al código
    SELECT * INTO v_plan
    FROM public.plans
    WHERE id = v_code.plan_id;

    -- Crear nuevo hogar
    INSERT INTO public.households (
        name,
        city,
        monthly_chef_limit,
        chef_queries_used_month
    ) VALUES (
        coalesce(nullif(trim(p_household_name), ''), 'Mi Hogar'),
        p_city,
        coalesce(v_plan.monthly_chef_queries, 40),
        0
    ) RETURNING id INTO v_hh_id;

    -- Agregar al usuario como dueño
    INSERT INTO public.household_members (household_id, user_id, role)
    VALUES (v_hh_id, v_user_id, 'owner');

    -- Activar licencia del plan de forma inmediata
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
        NULL, -- De por vida
        now()
    ) ON CONFLICT (household_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'active',
        valid_until = NULL;

    -- Incrementar usos del código
    UPDATE public.access_codes
    SET times_used = times_used + 1
    WHERE id = v_code.id;

    -- Registrar auditoría de canje
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

-- ------------------------------------------------------------------------
-- RPC: remove_household_member
-- Solo el dueño puede remover integrantes (y no a sí mismo si es el único dueño)
-- ------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------
-- ACTUALIZACIÓN DE POLÍTICAS RLS EN TABLAS DE DATOS
-- Solo se puede leer/escribir si el hogar cuenta con licencia activa
-- ------------------------------------------------------------------------
-- 1. shopping_lists
DROP POLICY IF EXISTS "Miembros pueden ver listas de compras" ON public.shopping_lists;
CREATE POLICY "Miembros con licencia activa pueden ver listas de compras"
    ON public.shopping_lists FOR SELECT
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden modificar listas de compras" ON public.shopping_lists;
CREATE POLICY "Miembros con licencia activa pueden modificar listas de compras"
    ON public.shopping_lists FOR ALL
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

-- 2. shopping_items
DROP POLICY IF EXISTS "Miembros pueden ver items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden ver items de compra"
    ON public.shopping_items FOR SELECT
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden insertar items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden insertar items de compra"
    ON public.shopping_items FOR INSERT
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden actualizar items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden actualizar items de compra"
    ON public.shopping_items FOR UPDATE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden eliminar items de compra" ON public.shopping_items;
CREATE POLICY "Miembros con licencia activa pueden eliminar items de compra"
    ON public.shopping_items FOR DELETE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

-- 3. pantry_items
DROP POLICY IF EXISTS "Miembros pueden ver items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden ver items de despensa"
    ON public.pantry_items FOR SELECT
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden insertar items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden insertar items de despensa"
    ON public.pantry_items FOR INSERT
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden actualizar items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden actualizar items de despensa"
    ON public.pantry_items FOR UPDATE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id))
    WITH CHECK (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));

DROP POLICY IF EXISTS "Miembros pueden eliminar items de despensa" ON public.pantry_items;
CREATE POLICY "Miembros con licencia activa pueden eliminar items de despensa"
    ON public.pantry_items FOR DELETE
    USING (public.user_belongs_to_household(household_id) AND public.has_active_license(household_id));


-- ------------------------------------------------------------------------
-- ARCHIVO: supabase/migrations/20261012_ronda5_pricing_and_credits.sql
-- ------------------------------------------------------------------------

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


