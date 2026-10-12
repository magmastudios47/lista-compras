# Reporte de Aseguramiento de Calidad (QA) - Ronda 5
**Proyecto**: Lista Compars (PWA con Chef IA)  
**Fecha de Ejecución**: 12 de Octubre de 2026  
**Entorno de Pruebas**: Local Node v24 / Vitest v3.2.7 / Vite v6.4.4 / Supabase Local & Cloud Schema  
**Estado General**: **100% APROBADO (15/15 archivos de test, 147/147 pruebas pasando, 0 errores de compilación)**

---

## 1. Resumen Ejecutivo de la Suite de Pruebas Automatizadas

Se ejecutó la suite completa de pruebas unitarias y de integración end-to-end simuladas con Vitest:

| Archivo de Prueba | Casos | Resultado | Duración |
| :--- | :---: | :---: | :---: |
| `test/chef-coverage-regression.test.ts` | 6 | **PASS** | 13 ms |
| `test/chef-quality.test.ts` | 40 | **PASS** | 83 ms |
| `test/anti-fallback.test.ts` | 5 | **PASS** | 9 ms |
| `test/weekly-menu.test.ts` | 7 | **PASS** | 39 ms |
| `test/settings-and-fresh-start.test.ts` | 4 | **PASS** | 8 ms |
| `test/access-control.test.ts` | 7 | **PASS** | 12 ms |
| `test/credits-and-costs.test.ts` | 12 | **PASS** | 15 ms |
| `test/mercadopago-billing.test.ts` | 8 | **PASS** | 60 ms |
| `test/pantry-auto-add.test.ts` | 11 | **PASS** | 11 ms |
| `test/multi-user-household.test.ts` | 7 | **PASS** | 15 ms |
| `test/clear-undo.test.ts` | 7 | **PASS** | 10 ms |
| `test/prices-sepa.test.ts` | 13 | **PASS** | 60 ms |
| `test/prices.test.ts` | 5 | **PASS** | 42 ms |
| `test/text-pipeline.test.ts` | 11 | **PASS** | 45 ms |
| `test/discount-engine.test.ts` | 4 | **PASS** | 7 ms |
| **TOTAL** | **147** | **100% PASS** | **2.35 s** |

---

## 2. Matriz de Cobertura de Requerimientos - Ronda 5

### Bloque 0: Diagnóstico Causa Raíz Bugs A y B & Regla Anti-Fallbacks
- [x] **Causa Raíz Bug A documentada**: Localizada en `src/services/chefClient.ts` (función `getFallbackCookRecipe`) y fallback interno de la Edge Function ante errores HTTP o de cuota.
- [x] **Causa Raíz Bug B documentada**: Localizada en `src/services/chefClient.ts` (función `getMockWeeklyMenu`) que reciclaba un ciclo fijo de 3 días con `por_que_encaja` idéntico.
- [x] **Regla Global "Nunca contenido falso en silencio"**:
  - Eliminados todos los caminos de fallback o mock en producción.
  - El usuario ve un mensaje transparente ante indisponibilidad de red/IA.
  - La falla nunca agrega productos inesperados ni cobra créditos.
  - Bandera `VITE_AI_DEMO_MODE=true` requerida para modo de desarrollo, con badge visible.
  - Campo `origen: 'ia' | 'cache' | 'demo'` en respuestas y logs.

### Bloque 1: Chef Confiable
- [x] **Validador de Cobertura del Pedido (`orderCoverageValidator.ts`)**: Todo producto mencionado (ej. papa, acelga) debe estar en los ingredientes (salvo exclusiones explícitas "sin X").
- [x] **Reintento único en caso de omisión**: Se retroalimenta al modelo indicando los faltantes sin cobrar créditos extra al usuario.
- [x] **Clave de Caché `PROMPT_VERSION = 'v1.5.0'`**: Incluye pedido normalizado, personas, restricciones y versión del prompt.
- [x] **Migración de Purga**: `20261012_ronda5_cache_purge.sql` purga recetas genéricas antiguas.

### Bloque 2: Menú Semanal Sin Repeticiones
- [x] **`por_que_encaja` estrictamente único**: Validación en cliente y servidor rechaza justificaciones idénticas.
- [x] **Semilla aleatoria por pedido**: Cada generación incluye una semilla aleatoria para evitar determinismo repetitivo.
- [x] **Histórico de últimos 2 menús (`platos_recientes_evitar`)**: Almacena platos previos del hogar y los excluye en generaciones sucesivas.
- [x] **Funciones de Regeneración**: Botones y acciones "Regenerar plato" (modo `regenerar_plato`, 1 crédito) y "Regenerar semana" (modo `planificar_semana`, 8 créditos).

### Bloque 3: Configuración Persistente y Arranque Limpio
- [x] **Tablas persistentes con RLS**: `user_preferences` (tema, perfil nutricional) y `household_settings` (despensa, comensales, días, ciudad).
- [x] **Debounce ~500ms y SaveIndicator**: Guardado automático en segundo plano con badge visual "Guardado".
- [x] **Sincronización en vivo multidispositivo**: Cambios compartidos del hogar se reflejan en tiempo real vía Supabase Realtime.
- [x] **Arranque desde Cero**: Eliminados todos los datos predeterminados ("Facundo", "Cabaña Los Pehuenes", "Junín de los Andes", despensa precargada). Listas y menús inician vacíos.

### Bloque 4: Acceso Solo para Quienes Compran
- [x] **Modo Cerrado (`ACCESS_MODE = 'closed'`)**: Función `has_active_license(household_id)` en SQL y Edge Functions bloquea llamadas de IA y datos a hogares sin plan activo.
- [x] **Landing Pública (`PublicLandingView`)**: Información clara de la app, precios dinámicos desde servidor y accesos a login/compra.
- [x] **Códigos de Acceso (`access_codes`)**: Hasheados con SHA-256 en mayúsculas, un solo uso por defecto, canje atómico mediante `redeem_access_code`.
- [x] **Enlaces de Invitación Criptográficos 128-bit**: Tokens generados criptográficamente, hash SHA-256 en base de datos, revocables, vencimiento de 7 días.
- [x] **Control Atómico de Límite de Integrantes**: Base (máx 6), Premium (máx 8), Tester (máx 99). Verificación con bloqueo de fila en `join_household_via_invitation`.
- [x] **Plan Interno "Tester"**: Asignable vía `scripts/assign-tester-plan.ts` con 9999 créditos.

### Bloque 5: Costos, Créditos y Recargas
- [x] **Tarifas Oficiales Google AI 2026/2027**: Programación en tabla `ai_pricing` con duplicación de tarifas a partir del 1 de enero de 2027 ($0.10/$0.40 -> $0.20/$0.80 Flash-Lite; $0.75/$3.75 -> $1.50/$7.50 Flash).
- [x] **Prompt Modular (`v1.5.0`)**: Núcleo común inicial (`CORE_SYSTEM_PROMPT`) para Context Caching de Gemini + sub-prompts por modo. Reducción de ~48% en tokens de receta y ~78% en interpretación de ítems.
- [x] **Contabilidad Inmutable e Idempotente (`credit_ledger`)**:
  - `cocinar`: 1 crédito
  - `sugerir`: 1 crédito
  - `regenerar_plato`: 1 crédito
  - `planificar_semana`: 8 créditos
  - `detalle_dia_menu`: 0 créditos
  - `interpretar_items`: 0 créditos
  - En fallos de IA **NUNCA** se cobran créditos.
- [x] **Tope Diario de Seguridad**: Máximo 15 créditos por día calendario UTC por hogar (reinicia a medianoche).
- [x] **Presupuesto Global Mensual**: `AI_MONTHLY_BUDGET_USD` ($50 USD). Alerta al 80%, pausa con 503 al 100%.
- [x] **Recargas Mercado Pago**: Paquetes de 25, 60 y 150 créditos con margen superior a 10x sobre costo de IA (excediendo ampliamente la regla de 3x). Acreditación idempotente por webhook.
- [x] **Scripts de Auditoría**: `scripts/calc-quotas.ts` y `scripts/ai-cost-report.ts`.

---

## 3. Verificación de UI y Experiencia de Usuario (Mobile & Desktop)

- **Título del Modal del Chef**: Verificado en `ChefModal.tsx`. Título limpio: `El Chef` (sin "Chef IA" ni nombres viejos).
- **Sección de Uso de IA en Ajustes**: Presente en `HouseholdModal.tsx` con saldo en tiempo real, tope diario de 15 créditos, equivalencias y botón para comprar recargas con Mercado Pago.
- **Aviso de Créditos en Menú Semanal**: Visible en `WeeklyMenuView.tsx`: *"este menú usa 8 créditos • te quedan X créditos"*.
- **Diseño Responsivo**:
  - Viewport móvil (390x844): Navegación inferior accesible con una sola mano, modales adaptados con scroll interno (`max-h-[90vh]`), botones de acción de 44px+ para pulsación táctil.
  - Viewport escritorio (1280x800): Contenedores centrados `max-w-md` y `max-w-4xl`, sin desbordes horizontales ni tipografías rotas.

---

## 4. Estado de Build y Producción

- **Compilador TypeScript**: `tsc -b` completado con 0 errores.
- **Vite Production Bundler**: `vite build` completado en 5.20s con 1.992 módulos transformados.
- **Servidor Local**: Activo en `http://localhost:3000/` con respuesta HTTP 200 OK y entrega del árbol React.
