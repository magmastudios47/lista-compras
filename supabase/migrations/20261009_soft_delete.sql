-- ========================================================================
-- Migración: Soporte para borrado lógico y sincronización de vaciado en tiempo real
-- ========================================================================

-- 1. Agregar columna deleted_at a shopping_items
ALTER TABLE public.shopping_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Agregar columna deleted_at a pantry_items
ALTER TABLE public.pantry_items 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Índices parciales para optimizar consultas de ítems activos
CREATE INDEX IF NOT EXISTS idx_shopping_items_household_active 
ON public.shopping_items(household_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pantry_items_household_active 
ON public.pantry_items(household_id) WHERE deleted_at IS NULL;
