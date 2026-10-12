-- ==============================================================================
-- Ronda 5 - Migración: Limpieza de ai_cache
-- Vaciado de la tabla ai_cache para eliminar respuestas obsoletas generadas
-- con versiones previas del prompt o fallbacks estáticos.
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ai_cache'
    ) THEN
        DELETE FROM public.ai_cache;
    END IF;
END $$;
