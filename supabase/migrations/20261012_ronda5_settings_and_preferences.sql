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

-- Función auxiliar para verificar pertenencia al hogar en políticas RLS
CREATE OR REPLACE FUNCTION public.user_belongs_to_household(h_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.household_members
        WHERE household_id = h_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
