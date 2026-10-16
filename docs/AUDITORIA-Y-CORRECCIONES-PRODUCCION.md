# Auditoría Técnica Profunda y Correcciones para Producción y Monetización

**Proyecto:** Lista Compars (PWA Colaborativa con Chef IA y Mercado Pago)  
**Fecha de Auditoría:** 16 de Octubre de 2026  

---

## 1. Resumen Ejecutivo

Se realizó una auditoría integral de ingeniería de software de extremo a extremo (Frontend React/TypeScript, PWA/Service Worker, Backend Supabase Edge Functions en Deno, Esquema PostgreSQL/RLS/RPCs y Pasarela de Monetización con Mercado Pago).

Se identificaron y corrigieron **16 errores críticos y estructurales** que impedían el correcto funcionamiento de la aplicación en producción y bloqueaban los flujos de monetización (cobros, activación de códigos, acreditación de créditos, guardado en base de datos e inteligencia artificial).

---

## 2. Errores Críticos Detectados y Corregidos

### A. Monetización, Licencias y Pasarela de Pagos (Mercado Pago & Códigos)

1. **`ReferenceError: targetPlan is not defined` en `supabase/functions/create-checkout/index.ts`**:
   - **Problema**: La variable `const targetPlan` estaba declarada dentro del bloque `else` (solo para planes), pero se referenciaba fuera del bloque al armar el payload de Mercado Pago y la respuesta JSON (`targetPlan.name`, `targetPlan.monthly_chef_queries`). Cualquier intento de checkout (tanto de planes como de paquetes de recarga de créditos) lanzaba un error 500 en tiempo de ejecución.
   - **Solución**: Se unificaron las variables `planName`, `planTitle` y `planDescription` en el ámbito superior para soportar tanto planes (`base`, `premium`, `upgrade`) como paquetes de recarga (`pack_25`, `pack_60`, `pack_150`).

2. **Violación de Clave Foránea (`payments_plan_id_fkey`) al comprar paquetes de recarga**:
   - **Problema**: La tabla `public.payments` definía `plan_id TEXT NOT NULL REFERENCES public.plans(id)`. Al intentar comprar un paquete de créditos (`pack_25`, `pack_60`, `pack_150`), el `INSERT` en `public.payments` fallaba en PostgreSQL porque los paquetes están en `credit_recharge_packages` y no en `plans`.
   - **Solución**: Se eliminó la restricción `payments_plan_id_fkey` en las migraciones SQL (`ESQUEMA_COMPLETO_TODO_EN_UNO.sql`, `RONDA5_COMPLETA_UNIFICADA.sql` y `20261012_ronda5_pricing_and_credits.sql`) y se unificaron los precios de los paquetes (`US$ 1.50`, `US$ 3.00` y `US$ 6.00`) entre base de datos, frontend y tests.

3. **Canje de Códigos de Acceso (`redeem_access_code`) no acreditaba créditos en `credit_ledger` y duplicaba hogares**:
   - **Problema**:
     - Al registrarse en `UserSetupFlow`, el usuario creaba primero su hogar (`free`) y luego pasaba a `AccessGateView`. Al canjear un código en `AccessGateView`, el RPC `redeem_access_code` siempre hacía `INSERT INTO public.households` creando un segundo hogar en vez de activar el hogar existente. Al recargar la app, `HouseholdContext` hacía `.limit(1)` sin ordenar y cargaba el primer hogar sin licencia, dejando al usuario bloqueado permanentemente en el paywall.
     - Además, `redeem_access_code` activaba la licencia en `public.licenses`, pero **nunca insertaba los créditos iniciales en `public.credit_ledger`**. Como resultado, `get_household_credit_balance` devolvía `0` y el Chef IA rechazaba todas las consultas por `"Créditos insuficientes (saldo: 0)"`.
   - **Solución**:
     - `redeem_access_code` ahora detecta si el usuario ya es dueño de un hogar sin licencia paga y activa ese mismo hogar (o crea uno nuevo si no tenía ninguno), además de acreditar atómicamente los créditos iniciales del plan en `public.credit_ledger`.
     - `HouseholdContext.tsx` ahora ordena los hogares por `joined_at DESC`, prioriza el hogar con licencia activa y refresca inmediatamente `fetchCredits()` tras canjear un código o unirse por invitación.

4. **Detección de URL de retorno de Mercado Pago (`back_urls` y `PaymentReturnView.tsx`)**:
   - **Problema**: `create-checkout` configuraba `back_urls` como `/checkout/success?ref=...` sin incluir el parámetro `payment_status`, mientras que `App.tsx` solo mostraba `PaymentReturnView` si existía `?payment_status=` o `?status=`.
   - **Solución**: `create-checkout` ahora incluye `?payment_status=approved|failure|pending&ref=...` y tanto `App.tsx` como `PaymentReturnView.tsx` reconocen tanto los query params como las rutas `/checkout/*`.

5. **Fallo de inserción en `mp-webhook/index.ts` ante firmas inválidas**:
   - **Problema**: Ante un fallo de firma HMAC, `mp-webhook` intentaba insertar en `ai_usage_log` con `household_id: null`, fallando por la restricción `NOT NULL`.
   - **Solución**: Se redirigió el registro de auditoría de seguridad hacia `invite_attempt_logs`.

---

### B. Persistencia de Lista de Compras, Despensa y Autenticación (PostgreSQL & React)

6. **IDs no-UUID en `useShoppingList.ts` y `usePantry.ts` rechazados por PostgreSQL (`22P02 invalid input syntax for type uuid`)**:
   - **Problema**: Las tablas `shopping_items` y `pantry_items` usan `id UUID PRIMARY KEY`. Sin embargo, el frontend generaba IDs con formato `"item_1760..._abcd"` y `"pantry_1760..._abcd"` y los enviaba en el `.insert()`. PostgreSQL rechazaba todos los inserts por no ser UUIDs válidos y el bloque `try/catch` ignoraba el error en silencio.
   - **Solución**: Se implementó `generateUuid()` (`crypto.randomUUID()` con fallback RFC4122) y `isValidUuid()` en `src/lib/normalizer.ts`, utilizándolos en `useShoppingList.ts` y `usePantry.ts`.

7. **Sincronización de listas vacías desde Supabase**:
   - **Problema**: `useShoppingList.ts` y `usePantry.ts` tenían `if (!error && data && data.length > 0)`, por lo que si otro integrante vaciaba la lista en la nube (`data = []`), la caché local seguía mostrando los ítems borrados.
   - **Solución**: Se corrigió la condición a `if (!error && Array.isArray(data))`.

8. **Corte prematuro de sesión y listener en `AuthContext.tsx`**:
   - **Problema**: Si existía un usuario en `localStorage`, el `useEffect` de `AuthContext.tsx` hacía `return;` antes de invocar `supabase.auth.getSession()` y sin suscribirse a `supabase.auth.onAuthStateChange()`, impidiendo detectar sesiones expiradas, redirecciones OAuth de Google o enlaces mágicos.
   - **Solución**: Se mantiene la carga optimista desde `localStorage`, pero siempre se verifica la sesión contra Supabase Auth y se registra el listener de cambios de estado.

---

### C. Chef IA y Planificador de Menú Semanal

9. **Eliminación indebida de ingredientes pedidos por el usuario en `culinarySanity.ts` / `culinarySanityCheck.ts`**:
   - **Problema**: La regla de sanidad para `"tortilla de papas"` tenía `'acelga'` y `'espinaca'` en `forbiddenWords`, y `"tortilla de acelga"` tenía `'papa'` en `forbiddenWords`. Cuando el usuario pedía `"tortilla de papas con acelga"`, `filterAbsurdIngredients` eliminaba `'acelga'` de la receta generada por Gemini, tras lo cual `validateOrderCoverage` detectaba que faltaba `'acelga'` y devolvía **Error HTTP 422**.
   - **Solución**: `filterAbsurdIngredients` ahora verifica si el ingrediente aparece explícitamente solicitado en el pedido del usuario (en singular o plural y sin estar precedido por `"sin"` o `"no"`), preservándolo siempre que haya sido pedido.

10. **Pérdida de parámetros `dia`, `tipo` y `comidas` en `supabase/functions/_shared/gemini.ts`**:
    - **Problema**: `GeminiClient.generateChefResponse` no incluía `dia`, `tipo` ni `comidas` dentro de `safePayload.DATOS_CONSULTA`, dejando a Gemini a ciegas en los modos `detalle_dia_menu` y `regenerar_plato`.
    - **Solución**: Se incorporaron `dia`, `tipo` y `comidas` al payload estructurado enviado a Gemini.

11. **Ausencia de prompt específico para `detalle_dia_menu` en `system-prompt.ts`**:
    - **Problema**: `getSystemPromptForMode('detalle_dia_menu')` devolvía `PROMPT_MODE_COCINAR` (cuyo esquema JSON es `{ modo: 'cocinar', receta: ... }`), provocando que la validación Zod `DetalleDiaMenuResponseSchema` fallara en el Paso B del Menú Semanal.
    - **Solución**: Se creó y conectó `PROMPT_MODE_DETALLE_DIA_MENU` con el esquema exacto `{ modo: 'detalle_dia_menu', dia, comidas: [...] }`.

12. **Colisión de claves de caché (`ai_cache`) en `chef-ai/index.ts`**:
    - **Problema**: En `detalle_dia_menu`, `normalizedOrder` era vacío (`""`), por lo que los 7 días de la semana generaban el mismo `cacheKey` y devolvían los ingredientes del Lunes. En `regenerar_plato`, la clave era fija y devolvía el mismo plato cacheado. En `sugerir`, no se incluía la lista `despensa`.
    - **Solución**: Se incluyeron `dia`, `comidas`, `tipo`, `platos_ya_elegidos`, `despensa` y semilla dinámica para `regenerar_plato` y `planificar_semana`.

13. **Restricción `ai_usage_log_mode_check` desactualizada en SQL**:
    - **Problema**: La tabla `ai_usage_log` solo aceptaba 4 modos antiguos en su `CHECK`, rechazando `interpretar_items`, `planificar_semana`, `detalle_dia_menu` y `regenerar_plato`.
    - **Solución**: Se actualizó el constraint SQL para admitir los 9 modos válidos.

14. **Cadena de respaldo automática ante error 404 de modelo en `GeminiClient`**:
    - **Problema**: Si el nombre de modelo configurado en variables de entorno no estaba habilitado para una cuenta/API key específica y devolvía HTTP 404, la función fallaba de inmediato.
    - **Solución**: Se añadió una cadena de fallback automática en `gemini.ts` (`gemini-2.5-flash-lite` -> `gemini-2.5-flash` -> `gemini-2.0-flash` -> `gemini-3.5-flash-lite`) ante respuestas HTTP 404.

15. **Mejoras en `WeeklyMenuView.tsx`, `ChefModal.tsx` y `useChefAi.ts`**:
    - Se eliminó el banner de error duplicado en `ChefModal.tsx`.
    - En `ChefModal.tsx` (modo Sugerir), se reemplazó el filtro básico `.includes()` por el motor determinista `calculatePantryDiscounts()` con conversión de unidades.
    - En `WeeklyMenuView.tsx`, el menú semanal generado ahora se persiste en `localStorage` por hogar para no perderse al cambiar de pestaña.
    - En `useChefAi.ts`, se corrigió el descuento local del menú semanal a `8` créditos (en lugar de `3`) y se agregó `extractEdgeFunctionError()` para extraer los mensajes reales de error JSON de las Edge Functions de Supabase.

16. **Iconos PWA Reales (`192x192` y `512x512`)**:
    - **Problema**: `public/icons/icon-192.png` y `public/icons/icon-512.png` eran imágenes placeholder de 1x1 píxel (70 bytes), lo que impedía que Chrome/Android e iOS aprobaran la instalación PWA.
    - **Solución**: Se generaron iconos PNG reales de alta resolución (`192x192` y `512x512` RGBA) en `public/icons/` y `dist/icons/`.
