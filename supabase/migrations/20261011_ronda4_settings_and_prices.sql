-- ========================================================================
-- Migración: Ronda 4 - Ajustes de Despensa Automática y Referencia de Precios SEPA
-- Archivo: 20261011_ronda4_settings_and_prices.sql
-- ========================================================================

-- 1. Ajustes del hogar: pantry_add_mode y pantry_exclude_cleaning
ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS pantry_add_mode TEXT NOT NULL DEFAULT 'ask' CHECK (pantry_add_mode IN ('ask', 'auto', 'never')),
ADD COLUMN IF NOT EXISTS pantry_exclude_cleaning BOOLEAN NOT NULL DEFAULT true;

-- 2. Tabla price_reference: Precios de referencia agregados de fuentes oficiales (SEPA / Precios Claros)
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

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_price_reference_lookup
ON public.price_reference(normalized_name, zone);

-- 3. Seguridad de price_reference: Lectura pública/autenticada, escritura solo service_role
ALTER TABLE public.price_reference ENABLE ROW LEVEL SECURITY;

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
