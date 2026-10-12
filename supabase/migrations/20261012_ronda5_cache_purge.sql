-- ==============================================================================
-- Ronda 5 - Migración: Limpieza y creación segura de ai_cache
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    response_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON public.ai_cache(cache_key);
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- Vaciar respuestas obsoletas si existían
DELETE FROM public.ai_cache;
