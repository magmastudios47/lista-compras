// Cliente y abstracción de Google Gemini API
import { getSystemPromptForMode, CHEF_SYSTEM_PROMPT } from '../chef-ai/system-prompt';

export interface GeminiCallOptions {
  systemPrompt?: string;
  userData: {
    modo: 'cocinar' | 'sugerir' | 'interpretar_items' | 'interpretar_despensa' | 'menu' | 'planificar_semana' | 'detalle_dia_menu' | 'regenerar_plato';
    pedido?: string;
    personas?: number;
    restricciones?: string[];
    despensa?: string[];
    texto_despensa?: string;
    dias_config?: any;
    objetivo_perfil?: string;
    objetivo_detalle?: string;
    platos_obligatorios?: string;
    platos_ya_elegidos?: string[];
    ingredientes_obligatorios?: string[];
    platos_recientes_evitar?: string[];
    semilla?: number | string;
    dia?: string;
    tipo?: string;
    comidas?: any[];
  };
  thinkingBudget?: number;
}

export interface GeminiResponse<T> {
  data: T;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  modelUsed: string;
}

export class GeminiClient {
  private apiKey: string;
  private chefModel: string;
  private fastModel: string;
  private baseUrl: string;

  constructor(apiKey?: string, chefModel?: string, fastModel?: string) {
    // Soporte para entornos Deno (Supabase Edge Functions) y Node.js (Vitest)
    const envApiKey =
      apiKey ||
      (typeof Deno !== 'undefined'
        ? Deno.env.get('GEMINI_API_KEY')
        : process.env.GEMINI_API_KEY) ||
      '';

    const envChefModel =
      chefModel ||
      (typeof Deno !== 'undefined'
        ? Deno.env.get('GEMINI_MODEL_CHEF') || Deno.env.get('GEMINI_MODEL')
        : process.env.GEMINI_MODEL_CHEF || process.env.GEMINI_MODEL) ||
      'gemini-2.5-flash';

    const envFastModel =
      fastModel ||
      (typeof Deno !== 'undefined'
        ? Deno.env.get('GEMINI_MODEL_FAST')
        : process.env.GEMINI_MODEL_FAST) ||
      'gemini-2.0-flash-lite';

    this.apiKey = envApiKey;
    this.chefModel = envChefModel;
    this.fastModel = envFastModel;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  /**
   * Ejecuta la llamada al modelo con reintentos para error 429 (rate limit)
   */
  async generateChefResponse<T>(
    options: GeminiCallOptions,
    validator: (raw: any) => T,
    retryCount = 0
  ): Promise<GeminiResponse<T>> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada en las variables de entorno.');
    }

    const systemInstruction = options.systemPrompt || getSystemPromptForMode(options.userData.modo);

    // Seleccionar modelo adecuado: FAST para interpretar_items, CHEF para cocinar/sugerir/planificar
    const isFastMode =
      options.userData.modo === 'interpretar_items' ||
      options.userData.modo === 'interpretar_despensa';
    const activeModel = isFastMode ? this.fastModel : this.chefModel;

    // Inyectar datos del usuario estrictamente como DATOS estructurados
    const safePayload = {
      INSTRUCCION_SISTEMA: 'Procesa los siguientes DATOS según tus reglas culinarias.',
      DATOS_CONSULTA: {
        modo: options.userData.modo,
        pedido_comida: options.userData.pedido?.slice(0, 500) || null,
        personas: options.userData.personas || 4,
        restricciones_dietarias: options.userData.restricciones || [],
        productos_despensa: (options.userData.despensa || []).slice(0, 100),
        texto_libre_despensa: options.userData.texto_despensa?.slice(0, 2000) || null,
        dias_config: options.userData.dias_config || null,
        objetivo_perfil: options.userData.objetivo_perfil || null,
        objetivo_detalle: options.userData.objetivo_detalle || null,
        platos_obligatorios: options.userData.platos_obligatorios || null,
        platos_ya_elegidos: options.userData.platos_ya_elegidos || null,
        ingredientes_obligatorios: options.userData.ingredientes_obligatorios || null,
        platos_recientes_a_evitar: options.userData.platos_recientes_evitar || null,
        semilla_aleatoria: options.userData.semilla || null,
      },
    };

    const endpoint = `${this.baseUrl}/models/${activeModel}:generateContent?key=${this.apiKey}`;

    const envThinking =
      typeof Deno !== 'undefined'
        ? Deno.env.get('GEMINI_THINKING_BUDGET')
        : process.env.GEMINI_THINKING_BUDGET;

    const thinkingBudget =
      options.thinkingBudget !== undefined
        ? options.thinkingBudget
        : envThinking !== undefined
        ? parseInt(envThinking, 10)
        : undefined;

    const generationConfig: any = {
      temperature: 0.35, // Temperatura baja 0.3 a 0.4 para consistencia y rigor culinario
      maxOutputTokens: 3000,
      responseMimeType: 'application/json',
    };

    if (thinkingBudget !== undefined && !isNaN(thinkingBudget)) {
      generationConfig.thinkingConfig = { thinkingBudget };
    }

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(safePayload, null, 2) }],
        },
      ],
      generationConfig,
    };

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (netErr: any) {
      clearTimeout(timeoutId);
      if (retryCount < 2) {
        const delayMs = Math.pow(2, retryCount) * 1500;
        await new Promise((r) => setTimeout(r, delayMs));
        return this.generateChefResponse(options, validator, retryCount + 1);
      }
      throw new Error(`Error de red al consultar el Chef IA: ${netErr.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    // Manejo de Rate Limit (HTTP 429) y Servidor Ocupado (HTTP 503 / 500) con backoff exponencial
    if (response.status === 429 || response.status === 503 || response.status === 502) {
      if (retryCount < 3) {
        const delayMs = Math.pow(2, retryCount) * 2000 + Math.random() * 800;
        await new Promise((r) => setTimeout(r, delayMs));
        return this.generateChefResponse(options, validator, retryCount + 1);
      }
      if (response.status === 429) {
        throw new Error('El chef está muy ocupado, probá de nuevo en un minuto.');
      }
      throw new Error('El servicio de IA está experimentando alta demanda, intentá nuevamente.');
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error de Gemini API (${response.status}): ${errText}`);
    }

    const jsonResponse = await response.json();
    const candidateText =
      jsonResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpiar posibles bloques markdown si el modelo los incluyó
    const cleanedText = candidateText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    let rawData: any;
    try {
      rawData = JSON.parse(cleanedText);
    } catch (parseErr) {
      // Reintento único si el JSON fue inválido
      if (retryCount === 0) {
        return this.generateChefResponse(options, validator, 1);
      }
      throw new Error('El chef devolvió una respuesta con formato inválido. Por favor, probá reformulando el pedido.');
    }

    // Validar con Zod
    let validatedData: T;
    try {
      validatedData = validator(rawData);
    } catch (zodErr: any) {
      if (retryCount === 0) {
        return this.generateChefResponse(options, validator, 1);
      }
      throw new Error(`La respuesta del chef no cumple el esquema requerido: ${zodErr.message}`);
    }

    const usage = jsonResponse.usageMetadata || {};
    const candDetails = usage.candidatesTokensDetails || [];
    const reasoningCount = (candDetails[0]?.reasoningTokenCount) || usage.thinkingTokenCount || 0;

    return {
      data: validatedData,
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      reasoningTokens: reasoningCount,
      totalTokens: usage.totalTokenCount || 0,
      modelUsed: activeModel,
    };
  }
}
