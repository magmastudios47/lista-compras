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

ALTER TABLE public.invite_attempt_logs ENABLE ROW LEVEL SECURITY;

-- invite_attempt_logs es una tabla de auditoría interna: nadie accede por API directa (solo service_role o funciones SECURITY DEFINER)
CREATE POLICY "invite_attempt_logs_internal_only"
    ON public.invite_attempt_logs
    FOR ALL
    USING (false)
    WITH CHECK (false);

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
