// Cliente y abstracción de Google Gemini API
import { CHEF_SYSTEM_PROMPT } from '../chef-ai/system-prompt';

export interface GeminiCallOptions {
  systemPrompt?: string;
  userData: {
    modo: 'cocinar' | 'sugerir' | 'interpretar_items' | 'interpretar_despensa';
    pedido?: string;
    personas?: number;
    restricciones?: string[];
    despensa?: string[];
    texto_despensa?: string;
  };
}

export interface GeminiResponse<T> {
  data: T;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class GeminiClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model?: string) {
    // Soporte para entornos Deno (Supabase Edge Functions) y Node.js (Vitest)
    const envApiKey =
      apiKey ||
      (typeof Deno !== 'undefined'
        ? Deno.env.get('GEMINI_API_KEY')
        : process.env.GEMINI_API_KEY) ||
      '';

    const envModel =
      model ||
      (typeof Deno !== 'undefined'
        ? Deno.env.get('GEMINI_MODEL')
        : process.env.GEMINI_MODEL) ||
      'gemini-2.5-flash';

    this.apiKey = envApiKey;
    this.model = envModel;
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

    const systemInstruction = options.systemPrompt || CHEF_SYSTEM_PROMPT;

    // Inyectar datos del usuario estrictamente como DATOS estructurados, NUNCA concatenados como instrucciones
    const safePayload = {
      INSTRUCCION_SISTEMA: 'Procesa los siguientes DATOS según tus reglas culinarias.',
      DATOS_CONSULTA: {
        modo: options.userData.modo,
        pedido_comida: options.userData.pedido?.slice(0, 500) || null,
        personas: options.userData.personas || 4,
        restricciones_dietarias: options.userData.restricciones || [],
        productos_despensa: (options.userData.despensa || []).slice(0, 100),
        texto_libre_despensa: options.userData.texto_despensa?.slice(0, 2000) || null,
      },
    };

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

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
      generationConfig: {
        temperature: 0.2, // Baja temperatura para consistencia de ingredientes y respuestas deterministas
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
    } catch (netErr: any) {
      throw new Error(`Error de red al consultar el Chef IA: ${netErr.message}`);
    }

    // Manejo de Rate Limit (HTTP 429) con backoff exponencial
    if (response.status === 429) {
      if (retryCount < 2) {
        const delayMs = Math.pow(2, retryCount) * 1200 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delayMs));
        return this.generateChefResponse(options, validator, retryCount + 1);
      }
      throw new Error('El chef está muy ocupado, probá de nuevo en un minuto.');
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
    return {
      data: validatedData,
      promptTokens: usage.promptTokenCount || 0,
      completionTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0,
    };
  }
}
