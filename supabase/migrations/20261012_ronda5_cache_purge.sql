-- ==============================================================================
-- Ronda 5 - Migración: Limpieza de ai_cache
-- Vaciado de la tabla ai_cache para eliminar respuestas obsoletas generadas
-- con versiones previas del prompt o fallbacks estáticos.
-- ==============================================================================

TRUNCATE TABLE public.ai_cache;
