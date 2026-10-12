# Diagnóstico Técnico de Causa Raíz - Ronda 5 (docs/DIAGNOSTICO-R5.md)

**Fecha**: 12 de Octubre de 2026  
**Investigador**: Antigravity Assistant  
**Estado**: Completado con evidencia empírica irrefutable  

---

## 1. Resumen de los Hallazgos

Los síntomas reportados por el usuario:
- **Bug A**: Al pedir *"tortilla de papas con acelga para 2"*, el Chef devolvía el título correcto pero siempre los mismos ingredientes genéricos: *arroz 160 g, cebolla, tomate perita, aceite de girasol*. Además, descontaba una consulta del mes.
- **Bug B**: En el menú semanal (almuerzo y cena, 7 días), los platos seguían un ciclo estricto de 3 (`lunes = jueves = domingo`, `martes = viernes`, `miércoles = sábado`) y todos repetían exactamente el mismo texto en `por_que_encaja` (*"Almuerzo balanceado con proteínas y energía equilibrada"* y *"Cena digestiva, reconfortante y rendidora para la familia"*).

**Diagnóstico concluyente**:  
**El contenido mostrado en la pantalla NUNCA fue generado por el modelo de Google Gemini.**  
Fue producido por funciones simuladoras locales (mocks de fallback) dentro de `src/hooks/useChefAi.ts`. El cliente ejecutó estos fallbacks en silencio tras un fallo de conexión/servidor con la IA y procedió a descontar consultas al usuario como si la llamada hubiera sido exitosa.

---

## 2. Evidencia de Código y Localización Exacta

### A. Causa Raíz del Bug A: `generateMockCookResponse`
- **Archivo**: `src/hooks/useChefAi.ts`
- **Líneas**: 1044 a 1069
```typescript
// Plato default dinámico
return {
  modo: 'cocinar',
  fuera_de_tema: false,
  mensaje: null,
  aclaracion: null,
  receta: {
    nombre: mealRequest.charAt(0).toUpperCase() + mealRequest.slice(1),
    porciones: persons,
    tiempo_minutos: 35,
    dificultad: 'facil',
    pasos: [
      'Preparar y picar los vegetales de base.',
      'Cocinar a fuego medio incorporando los ingredientes principales.',
      'Servir caliente y disfrutar en familia.',
    ],
  },
  analisis_plato: [`${mealRequest}: arroz, cebolla, tomate perita, aceite de girasol`],
  ingredientes: [
    { nombre: 'arroz', cantidad: Math.round(persons * 80), unidad: 'g', categoria: 'almacen', ... },
    { nombre: 'cebolla', cantidad: Math.max(1, Math.round(persons * 0.5)), unidad: 'unidad', ... },
    { nombre: 'tomate perita', cantidad: Math.max(2, Math.round(persons * 1)), unidad: 'unidad', ... },
    { nombre: 'aceite de girasol', cantidad: 50, unidad: 'ml', categoria: 'almacen', ... },
  ],
  ...
};
```
- **Mecanismo**: Cuando el usuario pedía un plato que no coincidía con los 6 casos de prueba hardcodeados (milanesas, guiso, asado, etc.), el switch caía en este `return` default. Para 2 personas (`persons = 2`), calculaba `2 * 80 = 160 g de arroz`, `1 cebolla`, `2 tomates perita` y `50 ml de aceite`.
- **Por qué descontó consulta**: En `src/hooks/useChefAi.ts` líneas 70-72 y 76-78:
```typescript
} else {
  console.warn('Edge Function chef-ai no disponible, usando motor local:', fnError);
  await new Promise((r) => setTimeout(r, 600));
  cookData = generateMockCookResponse(mealRequest, persons, dietaryRestrictions, pantry);
  incrementChefUsage(); // <-- ERROR CRÍTICO: cobra una consulta al usuario por datos falsos
}
```

---

### B. Causa Raíz del Bug B: `generateMockPlanificarSemana`
- **Archivo**: `src/hooks/useChefAi.ts`
- **Líneas**: 1224 a 1327 (incorporado originalmente en commit `5a470b5`)
- **Mecanismo**:
  - `lunchDishes` contenía un array de **3 platos**:
    0: Pollo a la plancha con arroz
    1: Tarta de zapallitos
    2: Fideos con salsa de tomate y albóndigas
  - Se seleccionaba mediante: `lunchDishes[dayIndex % lunchDishes.length]` (donde `length = 3`):
    - Día 0 (Lunes) % 3 = 0 -> Plato 0
    - Día 1 (Martes) % 3 = 1 -> Plato 1
    - Día 2 (Miércoles) % 3 = 2 -> Plato 2
    - Día 3 (Jueves) % 3 = 0 -> **Plato 0 (igual a Lunes)**
    - Día 4 (Viernes) % 3 = 1 -> **Plato 1 (igual a Martes)**
    - Día 5 (Sábado) % 3 = 2 -> **Plato 2 (igual a Miércoles)**
    - Día 6 (Domingo) % 3 = 0 -> **Plato 0 (igual a Lunes y Jueves)**
  - Y para todos los almuerzos asignaba el texto fijo:
    `por_que_encaja: 'Almuerzo balanceado con proteínas y energía equilibrada.'`
  - Y para todas las cenas asignaba el texto fijo:
    `por_que_encaja: 'Cena digestiva, reconfortante y rendidora para la familia.'`
- **Invocación silenciosa**: En `src/hooks/useChefAi.ts` líneas 361-377, si el Paso A fallaba o no había respuesta de la función Edge, caía a `generateMockMenuResponse(params)` y ejecutaba `incrementChefUsage()`.

---

## 3. ¿Por Qué Fallaba la Conexión con la IA Real?

Al investigar la cadena completa de llamadas (Frontend -> Supabase Edge Function -> Google Gemini API):

1. **Ausencia de `GEMINI_API_KEY` en el `.env` local**:
   El archivo `.env` tenía configurada la URL de Supabase y las tasas de cambio, pero no contenía la clave `GEMINI_API_KEY`.
2. **Clave de desarrollo válida recuperada**:
   El usuario había proporcionado la clave `[REDACTED_API_KEY]`. Probada directamente contra `generativelanguage.googleapis.com`, la clave es válida y pertenece al nivel gratuito de Google AI Studio.
3. **Deprecación de modelos (`HTTP 404 NOT_FOUND`)**:
   Al invocar la API con la configuración previa (`gemini-2.5-flash` y `gemini-2.5-flash-lite` / `gemini-2.0-flash-lite`), la API de Google devolvió:
   ```json
   {
     "error": {
       "code": 404,
       "message": "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash for the latest features and improvements.",
       "status": "NOT_FOUND"
     }
   }
   ```
   Google retiró `gemini-2.5-flash` para nuevos proyectos/claves en favor de **`gemini-3.8-flash`** (para tareas complejas de razonamiento y cocina) y **`gemini-3.5-flash-lite`** (para tareas rápidas de texto).
4. **Comportamiento en cascada**:
   Al dar 404 la API de Google:
   - La Edge Function capturaba el error y devolvía HTTP 500 al cliente.
   - El hook `useChefAi` del cliente capturaba el HTTP 500 en su bloque `catch`.
   - En lugar de alertar al usuario del error, ejecutaba el generador mock y descontaba una consulta mensual.

---

## 4. Evidencia Empírica con la API Real de Gemini

Tras configurar `GEMINI_MODEL_CHEF=gemini-3.8-flash` y `GEMINI_MODEL_FAST=gemini-3.5-flash-lite` y ejecutar la prueba de diagnóstico real (`scripts/diagnose_real_api.ts`):

### Caso A: Pedido crudo *"tortilla de papas con acelga para 2"*
- **Receta generada por Gemini**: "Tortilla de papas con acelga" (2 porciones).
- **Pasos**: Hervir y escurrir 1 atado de acelga; cortar 400 g de papas; picar cebolla; batir 4 huevos; cuajar la tortilla.
- **Ingredientes extraídos por el modelo**:
  - `acelga`: 1 atado (verduleria)
  - `papa`: 400 g (verduleria)
  - `cebolla`: 1 unidad (verduleria)
  - `huevo`: 4 unidad (almacen)
  - `aceite de girasol`: 4 cucharada (almacen)
  - `sal`: 1 cucharadita (almacen)
  - `pimienta negra`: 1 pizca (almacen)
- **Contraste**: **0 gramos de arroz, 0 tomates perita**. La IA real comprende a la perfección la gastronomía rioplatense y respeta fielmente la preparación solicitada.

### Caso B: Menú semanal 7 días (Almuerzo y Cena) con perfil Deportista
- **Total comidas generadas**: 14 comidas independientes.
- **Variedad de platos**:
  - Lunes: Pechugas de pollo al horno con puré de batata / Merluza a la plancha con ensalada.
  - Martes: Bife de cuadril a la plancha con arroz y ensalada / Omelette de 3 huevos con jamón y queso.
  - Miércoles: Fideos tirabuzón con boloñesa magra / Suprema de pollo con puré de zapallo anco.
  - Jueves: Guiso de lentejas con roast beef / Tarta de acelga y huevo.
  - Viernes: Milanesas de nalga al horno con puré de papas / Brochetas de pollo y vegetales.
  - Sábado: Arroz con pollo salteado / Bife de cerdo a la plancha con batatas al horno.
  - Domingo: Asado a la olla con papas y zanahorias / Revuelto de zapallitos con huevo y queso.
- **Textos de `por_que_encaja`**: Cada uno es 100% específico, por ejemplo:
  - *"Aporte alto de proteína magra con carbohidratos complejos para recuperar energía después de entrenar."*
  - *"Cena liviana rica en proteínas de pescado y ácidos grasos saludables, ideal para la recuperación nocturna."*
  - *"Combinación potente de legumbres y carne que aporta hierro, proteínas vegetales y carbohidratos complejos."*
- **Contraste**: **Sin ciclo de 3 días y sin textos genéricos repetidos**.

---

## 5. Revisión de la Clave de Caché (`ai_cache`)

En `supabase/functions/chef-ai/index.ts` líneas 159-165:
```typescript
const normalizedKey = modo === 'planificar_semana'
  ? `${modo}_${(pedido || '').trim().toLowerCase()}_${Date.now()}`
  : `${modo}_${(pedido || texto_despensa || JSON.stringify(dias_config || '')).trim().toLowerCase()}_${personas || 4}_${(restricciones || []).sort().join(',')}_${objetivo_perfil || ''}`;
```
**Deficiencias identificadas**:
1. **Falta de versión de prompt**: No incluye `PROMPT_VERSION`. Si el prompt o los esquemas cambian, se siguen sirviendo respuestas cacheadas viejas.
2. **Normalización incompleta**: Solo hace `.trim().toLowerCase()`, sin eliminar acentos ni puntuación superflua.
3. **Caché de respuestas inválidas**: No había validación previa de cobertura del pedido antes de insertar en `ai_cache`.
4. **Limpieza necesaria**: Se requiere una migración SQL para purgar cualquier registro residual en `ai_cache`.

---

## 6. Plan de Corrección para la Ronda 5

Siguiendo la **REGLA GLOBAL: NUNCA CONTENIDO FALSO EN SILENCIO**:

1. **Eliminar fallbacks silenciosos**: Si la función Edge o la API fallan (429, timeout, error 500, clave ausente), el hook `useChefAi` **debe lanzar un error claro y amigable al usuario**, no agregar nada a la lista ni a la despensa, y **NO descontar créditos**.
2. **Bandera `AI_DEMO_MODE`**:
   - `AI_DEMO_MODE=true` existirá exclusivamente para desarrollo offline explícito.
   - Si está encendida, mostrará un badge visible permanente `"MODO DEMO"` en la interfaz y **nunca descontará créditos**.
   - Por defecto estará apagada (`false`).
3. **Campo `origen`**:
   - Cada respuesta llevará el campo `origen: 'ia' | 'cache'`.
   - Se guardará en `ai_usage_log`.
4. **Modelos vigentes**:
   - Variables de entorno `GEMINI_MODEL_CHEF=gemini-3.8-flash` y `GEMINI_MODEL_FAST=gemini-3.5-flash-lite`.
5. **Test anti-fallbacks**:
   - Test automatizado que verifique que ante una falla simulada de red/servidor (con `AI_DEMO_MODE=false`), el sistema arroja error y **nunca** devuelve recetas de respaldo ni descuenta créditos.
