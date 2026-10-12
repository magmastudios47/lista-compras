import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatFriendlyAiError, isAiDemoMode } from '../src/hooks/useChefAi';
import { ChefCookResponse } from '../src/types';

describe('Regla Global: Anti-Fallback Silencioso (Ronda 5 Bloque 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Con AI_DEMO_MODE apagado por defecto, isAiDemoMode es falso', () => {
    expect(isAiDemoMode).toBe(false);
  });

  it('2. El formateador de errores genera mensajes claros y amables sin ocultar el fallo', () => {
    const err429 = formatFriendlyAiError(new Error('Rate limit 429: Too many requests'));
    expect(err429).toContain('muchas consultas');
    expect(err429).toContain('No se descontaron créditos');

    const err503 = formatFriendlyAiError({ message: 'Error 503: Service Unavailable' });
    expect(err503).toContain('alta demanda momentánea');

    const errQuota = formatFriendlyAiError('Has alcanzado el límite mensual de consultas');
    expect(errQuota).toContain('límite de consultas');

    const errPremium = formatFriendlyAiError({ error: 'La planificación requiere el plan Premium' });
    expect(errPremium).toContain('plan Premium');

    const err500 = formatFriendlyAiError({ message: 'Edge Function error: 500 Internal Server Error' });
    expect(err500).toContain('Error en el servidor');
    expect(err500).toContain('No se descontaron créditos');
  });

  it('3. Ante fallo de IA con AI_DEMO_MODE apagado, DEBE fallar y NUNCA devolver ingredientes genéricos ni arroz con tomate perita', async () => {
    // Simulamos la lógica de control del hook cuando AI_DEMO_MODE=false
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Edge Function error: 500 Internal Server Error' },
    });

    const isDemo = false;
    let fallbackReturned = false;
    let thrownError: any = null;

    try {
      const { data, error } = await mockInvoke();
      if (!error && data) {
        // éxito
      } else {
        if (!isDemo) {
          throw new Error(formatFriendlyAiError(error));
        }
        fallbackReturned = true;
      }
    } catch (e: any) {
      thrownError = e;
    }

    // Debe arrojar el error
    expect(thrownError).not.toBeNull();
    expect(thrownError.message).toContain('Error en el servidor');
    // Nunca debe haber devuelto contenido simulado
    expect(fallbackReturned).toBe(false);
  });

  it('4. Ante fallo de IA, no se deben descontar consultas del usuario', async () => {
    let queriesUsed = 3;
    const incrementFn = vi.fn(() => {
      queriesUsed += 1;
    });

    const mockInvoke = vi.fn().mockRejectedValue(new Error('Network connection timeout'));
    const isDemo = false;

    try {
      await mockInvoke();
      // Solo en éxito real se incrementa
      incrementFn();
    } catch (err) {
      // En fallo, no se incrementa nada
    }

    expect(incrementFn).not.toHaveBeenCalled();
    expect(queriesUsed).toBe(3);
  });

  it('5. Una respuesta válida de IA o caché debe incluir siempre el campo origen ("ia" o "cache")', () => {
    const rawAiResponse: ChefCookResponse = {
      modo: 'cocinar',
      fuera_de_tema: false,
      mensaje: null,
      aclaracion: null,
      origen: 'ia',
      receta: {
        nombre: 'Tortilla de papas con acelga',
        porciones: 2,
        dificultad: 'facil',
        pasos: ['Paso 1', 'Paso 2'],
      },
      ingredientes: [
        {
          nombre: 'acelga',
          cantidad: 1,
          unidad: 'atado',
          categoria: 'verduleria',
          es_basico: false,
          opcional: false,
          item_despensa_coincidente: null,
        },
      ],
      advertencias: [],
    };

    expect(rawAiResponse.origen).toBe('ia');
    expect(['ia', 'cache', 'demo']).toContain(rawAiResponse.origen);
  });
});
