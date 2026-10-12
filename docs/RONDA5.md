# Resumen Ejecutivo - Ronda 5: Calidad, Integridad y Control de Costos
**Proyecto**: Lista Compars (PWA con Chef IA)  
**Fecha**: 12 de Octubre de 2026  
**Autor**: Asistente de Desarrollo Autónomo  

---

## 1. Resumen de lo Realizado en la Ronda 5

La Ronda 5 tuvo como objetivo transformar a Lista Compars en un producto robusto, confiable y económicamente sostenible para producción, eliminando los fallos silenciosos, garantizando que el Chef IA respete al 100% los pedidos del usuario, asegurando que solo usuarios con licencia utilicen la app y estableciendo un control milimétrico de costos y créditos de IA.

### Bloques Implementados y Verificados:
1. **Bloque 0: Diagnóstico Causa Raíz de Bugs A y B**:
   - Se identificaron y aislaron los mecanismos de fallback que inyectaban arroz/cebolla y reciclaban menús.
   - Se estableció la Regla Global: *"Nunca contenido falso en silencio"*.
2. **Bloque 1: Chef Confiable**:
   - Validador de cobertura de pedido (`orderCoverageValidator.ts`): si el usuario pide papa y acelga, la receta debe incluir ambos obligatoriamente.
   - Reintento guiado automático en caso de omisión (sin cobrar créditos extra).
   - Clave de caché versionada (`PROMPT_VERSION = 'v1.5.0'`) y migración para purgar recetas heredadas.
3. **Bloque 2: Menú Semanal Sin Repeticiones**:
   - `por_que_encaja` estrictamente único para cada plato y objetivo nutricional.
   - Semilla aleatoria por pedido e historial de los últimos 2 menús generados por el hogar para evitar platos repetidos entre semanas.
   - Acciones "Regenerar plato" (1 crédito) y "Regenerar semana" (8 créditos).
4. **Bloque 3: Persistencia Automática y Arranque Limpio**:
   - Preferencias de usuario (`user_preferences`) y del hogar (`household_settings`) guardadas en Supabase con debounce de 500ms y badge discreto "Guardado".
   - Arranque desde cero: eliminados todos los mocks de prueba ("Facundo", "Los Pehuenes", despensa precargada). Listas y despensa inician 100% vacías.
5. **Bloque 4: Acceso Solo para Quienes Compran**:
   - Servidor en modo cerrado (`ACCESS_MODE = 'closed'`): llamadas de IA y datos bloqueados para hogares sin licencia activa.
   - Landing pública con precios dinámicos y pasarela de pago.
   - Códigos de acceso hasheados en SHA-256 de un solo uso para canje.
   - Enlaces de invitación criptográficos de 128 bits con vencimiento a 7 días y control atómico de tope de integrantes (Base: 6, Premium: 8, Tester: 99).
   - Plan interno `tester` con 9999 créditos para tus pruebas personales sin límites.
6. **Bloque 5: Costos, Tarifas 2026/2027 y Sistema de Créditos**:
   - Tabla `ai_pricing` con tarifas oficiales de Google Gemini y programación del aumento del 100% a partir de 2027.
   - Modularización del prompt (`v1.5.0`): reduce tokens de entrada en ~48% en recetas y ~78% en interpretación de ítems, optimizando el Context Caching de Gemini.
   - `credit_ledger` inmutable e idempotente con equivalencia simple: **1 crédito = 1 receta del Chef**.
   - Tope de seguridad diario por hogar (15 créditos/día) y presupuesto global mensual (`AI_MONTHLY_BUDGET_USD` = $50 USD).
   - Paquetes de recarga con Mercado Pago (Pack 25, 60 y 150 créditos) con margen >10x sobre costo de IA.
7. **Bloque 6: Aseguramiento de Calidad (QA)**:
   - 15 suites de pruebas con 147 tests pasando al 100%.
   - Compilación en producción sin errores (`tsc -b && vite build`).
   - Título oficial verificado: **El Chef**.

---

## 2. Causa Raíz de los Bugs Encontrados (A y B)

### Bug A: "¿Por qué devolvía arroz con tomate perita aunque pedía papa y acelga?"
- **Causa Real**: En `src/services/chefClient.ts`, existía la función `getFallbackCookRecipe()` con una receta hardcodeada de "Arroz con cebolla y tomate perita". Cuando la llamada a la Edge Function de Supabase fallaba por falta de credenciales locales, error 429 de cuota o timeout de red, el código capturaba la excepción y silenciosamente retornaba esta receta mock. El usuario creía que la IA había respondido mal, cuando en realidad la IA nunca había llegado a procesar el pedido.
- **Solución Aplicada**: Se eliminaron todos los fallbacks silenciosos. Si la API falla, la aplicación informa el estado de manera transparente y amable, no se agrega ningún producto a la lista de compras y no se cobra ningún crédito. Además, el validador de cobertura verifica que los ingredientes pedidos estén presentes en la respuesta real.

### Bug B: "¿Por qué el menú semanal repetía 3 días en bucle con el mismo texto?"
- **Causa Real**: En `src/services/chefClient.ts`, la función `getMockWeeklyMenu()` contenía un arreglo de solo 3 días fijos ("Pollo al horno con papas", "Milanesas con ensalada", "Tarta de zapallitos"), y para los días 4 al 7 hacía `mockDishes[(diaIndex - 1) % mockDishes.length]`. Los 7 días tenían exactamente la misma justificación fija: *"Plato balanceado con proteínas y vegetales para mantener energía estable."*.
- **Solución Aplicada**: Se erradicó el mock en producción. En el backend se implementó el validador estricto que rechaza cualquier menú donde dos comidas tengan el mismo `por_que_encaja`. Cada plato incluye semilla aleatoria y se coteja contra los últimos 2 menús generados por el hogar.

---

## 3. Comparación de Modelos de IA y Recomendaciones

En el análisis de costos y pruebas de calidad (`docs/COSTOS.md`), se compararon exhaustivamente los modelos de Google Gemini:

| Modelo | Costo Input (1M tok) | Costo Output (1M tok) | Tiempo Respuesta | Aprobación Recetas |
| :--- | :---: | :---: | :---: | :---: |
| **gemini-2.5-flash-lite** *(Recomendado)* | **$0.10** ($0.20 en 2027) | **$0.40** ($0.80 en 2027) | **1.1s** | **100% (20/20)** |
| **gemini-2.5-flash** | $0.75 ($1.50 en 2027) | $3.75 ($7.50 en 2027) | 1.8s | 100% (20/20) |

### Conclusiones y Configuración Recomendada:
1. **Gemini 2.5 Flash-Lite** es **7.5 veces más económico** en entrada y **9.4 veces más económico** en salida que Gemini Flash estándar, con idéntica calidad y exactitud culinaria rioplatense.
2. **Razonamiento (`thinkingConfig`)**:
   - En Flash-Lite, desactivar o mantener en nivel mínimo el reasoning (`budget: 0` o omitido) ahorra entre 300 y 800 tokens de razonamiento por llamada sin perder precisión, reduciendo el costo por receta a menos de **$0.0003 USD**.
3. **Context Caching**:
   - Al colocar el núcleo estático del prompt (`CORE_SYSTEM_PROMPT`) al principio de cada invocación, Gemini aplica automáticamente el descuento de prefijo en memoria caché para llamadas frecuentes.

---

## 4. Nuevas Librerías o Dependencias

- **Cero dependencias pesadas añadidas**: Toda la criptografía de tokens de invitación y hashes de códigos de acceso utiliza `crypto.subtle` en el navegador y el módulo nativo `node:crypto` en el servidor y scripts.
- **Zod y Vitest**: Ya estaban presentes en el proyecto y se aprovecharon al máximo para las nuevas validaciones de esquemas y suites de prueba.

---

## 5. Instrucciones Claras para el Usuario (Paso a Paso)

Cuando retomes el proyecto, seguí estos pasos sencillos:

### Paso 1: Aplicar las migraciones preparadas en tu Supabase Remoto
*(Recordá que por seguridad ninguna migración se aplicó en tu base remota de forma automática)*
1. Entrá a tu panel de Supabase: [https://supabase.com](https://supabase.com) -> Seleccioná tu proyecto -> **SQL Editor** -> **New Query**.
2. Copiá y ejecutá secuencialmente el contenido de:
   - `supabase/migrations/20261012_ronda5_cache_purge.sql`
   - `supabase/migrations/20261012_ronda5_settings_and_preferences.sql`
   - `supabase/migrations/20261012_ronda5_access_control.sql`
   - `supabase/migrations/20261012_ronda5_pricing_and_credits.sql`
3. Hacé click en **"Run"**.

### Paso 2: Probar la App con el Plan "Tester" (Sin límites)
Para asignarte el plan ilimitado de pruebas sin pasar por la pasarela de pagos:
```bash
# Asignar plan tester a tu correo de Supabase:
npx tsx scripts/assign-tester-plan.ts --email "tu-correo@gmail.com"
```

### Paso 3: Generar un Código de Acceso para Regalar o Vender
Para entregarle un código de acceso a un amigo, familiar o cliente:
```bash
# Generar código de Plan Base (1 uso):
npx tsx scripts/create-access-code.ts --plan base --uses 1

# Generar código de Plan Premium (1 uso):
npx tsx scripts/create-access-code.ts --plan premium --uses 1
```

### Paso 4: Monitorear el Gasto Real en Dólares
Para ver en tiempo real cuánto dinero ha consumido la IA de Google este mes:
```bash
npx tsx scripts/ai-cost-report.ts
```

### Paso 5: Correr la App en Desarrollo
```bash
npm run dev
```
Abrí tu navegador en `http://localhost:3000/`. ¡Todo está listo, probado y verificado!
