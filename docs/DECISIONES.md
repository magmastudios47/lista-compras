# Registro de Decisiones de Arquitectura y Diseño (DECISIONES.md)

Este documento registra todas las decisiones autónomas tomadas durante el desarrollo de **Lista Compars**, seleccionando siempre la opción más simple, robusta y alineada con la realidad de Argentina y la PWA móvil.

---

### Decisión 1: Modelo de IA por defecto y abstracción
- **Contexto**: Se requiere usar la familia Gemini sin fijar nombres estáticos en el código, evitando modelos obsoletos y soportando el nivel gratuito con fallback a premium.
- **Decisión**: Se utiliza la variable de entorno `GEMINI_MODEL`, configurando por defecto `gemini-2.5-flash` (o `gemini-3-flash-preview` configurable). Toda interacción se centraliza en un módulo `GeminiClient` en Edge Functions y un adaptador `AiProvider` que implementa reintentos exponenciales con jitter para el código HTTP 429.
- **Razón**: Permite cambiar de modelo o proveedor (por ej. Vertex AI o modelos futuros de la familia 3.x) simplemente modificando una variable de entorno en Supabase, sin tocar código.

---

### Decisión 2: Estrategia de Normalización y Comparación Determinista
- **Contexto**: La IA devuelve nombres como "tomates perita" y en despensa hay "tomate perita", o unidades en gramos vs kilogramos.
- **Decisión**:
  1. Se implementa una librería determinista de normalización de cadenas (eliminación de acentos, minúsculas, singularización simple para español rioplatense).
  2. Matriz de conversión de unidades:
     - Masa: `1 kg = 1000 g`
     - Volumen: `1 l = 1000 ml`
     - Conteos: `unidad`, `diente`, `atado`, `lata`, `paquete` no son convertibles a masa sin densidad, se tratan por separado.
  3. Si la despensa tiene la misma unidad (o convertible) y cantidad suficiente, el ítem se descuenta totalmente; si tiene cantidad parcial, se descuenta la porción y se anota lo faltante; si la despensa tiene `cantidad: null` (ej. "tengo aceite"), se considera que hay disponible y se marca como básico ya disponible con advertencia al usuario.

---

### Decisión 3: Arquitectura Offline y Sincronización
- **Contexto**: En los supermercados de Junín de los Andes y la Patagonia (como La Anónima, Todo o cooperativas), la señal celular suele ser deficiente o inexistente en los pasillos interiores.
- **Decisión**:
  - Almacenamiento local mediante `IndexedDB` / `localStorage` sincronizado con Supabase.
  - Cada modificación genera una entrada en una cola de mutaciones local (`mutation_queue`).
  - Estrategia de resolución de conflictos: **Last-Write-Wins (LWW)** basada en `updated_at` (marca de tiempo ISO).
  - Interfaz optimista: la UI refleja cambios de inmediato y sincroniza en segundo plano cuando el evento `online` se dispara.

---

### Decisión 4: Simulación y Modo Mock para Desarrollo Local
- **Contexto**: El usuario ejecutará la app antes de configurar sus credenciales reales de Supabase, Gemini y Mercado Pago.
- **Decisión**:
  - La aplicación cuenta con un adaptador local transparente: si las variables de entorno de Supabase están vacías o en modo demo, la app arranca con un **Demo Provider** que simula base de datos en localStorage, permitiendo probar el 100% de la UI, la PWA, el chef simulado, las invitaciones y el flujo de Mercado Pago sin arrojar pantallas blancas de error.
  - Al cargar credenciales reales en `.env`, el sistema conmuta automáticamente a producción.

---

### Decisión 5: Integración de Mercado Pago y Precios
- **Contexto**: Pago único por hogar para licencia de por vida ("Premium del Hogar"). Los precios se fijan en USD (por ej. USD 4.99) y se liquidan en ARS.
- **Decisión**:
  - El backend cuenta con una tasa de cambio de referencia (configurable vía variable `ARS_USD_RATE` o API de cotización con fallback seguro a valor de mercado $1350 ARS/USD).
  - El pago único otorga consultas ilimitadas del chef (cuota mensual 9999) y funciones avanzadas del menú semanal.
  - Para pruebas, se incluye el botón de simulación de pago sandbox y retorno por Deep Link PWA.

---

### Decisión 6: Notificaciones Push en iOS y Android
- **Contexto**: iOS requiere que la app esté explícitamente instalada en la pantalla de inicio desde Safari para habilitar Push Notifications (Web Push API).
- **Decisión**:
  - El asistente de instalación PWA detecta dinámicamente si el navegador es iOS Safari y muestra un modal ilustrado interactivo indicando: "Paso 1: Tocá el botón Compartir (cuadrado con flecha) -> Paso 2: Elegí 'Agregar a pantalla de inicio' -> Paso 3: Abrí la app desde tu pantalla de inicio para recibir avisos de tu familia".
  - En Android y Desktop, utiliza el evento `beforeinstallprompt` automático con un botón destacado.

---

### Decisión 7: Límites y Prestaciones Centralizadas por Plan
- **Contexto**: Los límites de consultas y prestaciones no deben dispersarse en el código del cliente ni alterarse sin trazabilidad.
- **Decisión**:
  - Se centralizan en la tabla `plans`:
    - **Free (Sin pago)**: 5 consultas del chef/mes, hasta 3 integrantes.
    - **Base**: 10 USD (o equivalente en ARS), 40 consultas del chef/mes, hasta 10 integrantes.
    - **Premium**: 20 USD, 150 consultas del chef/mes, hasta 99 integrantes, menú semanal y seguimiento de precios.
    - **Upgrade Base a Premium**: 10 USD (diferencia exacta calculada en servidor).
  - El límite mensual se aplica en el servidor en la Edge Function `chef-ai` y en el trigger de base de datos.

---

### Decisión 8: Arquitectura de Pagos Inviolable (Servidor Único)
- **Contexto**: El cliente no puede otorgar ni activar planes bajo ningún concepto.
- **Decisión**:
  - Se eliminó cualquier mock o simulación en cliente que active planes.
  - El cliente solo crea una orden en `create-checkout` y redirige a Mercado Pago.
  - La activación se realiza exclusivamente en `mp-webhook` mediante verificación de firma criptográfica HMAC-SHA256 (`x-signature`), consulta a la API de Mercado Pago, validación de estado aprobado y coincidencia exacta de monto esperado.
  - Las tablas `licenses` y `payments` tienen RLS estricto: deniegan cualquier `INSERT`, `UPDATE` o `DELETE` a usuarios autenticados o anónimos (solo service role escribe).

---

### Decisión 9: Fidelidad al Plato y Razonamiento previo (analisis_plato)
- **Contexto**: El modelo de lenguaje agregaba ingredientes "típicos" automáticos por asociación (por ejemplo agregar papa al pedir puré de zapallo).
- **Decisión**:
  - Se introdujo una regla crítica en el prompt del sistema denominada **FIDELIDAD AL PLATO** que prohíbe añadir guarniciones o ingredientes estándar si fueron explícitamente reemplazados por una variante calificada.
  - Se exige al modelo un paso de razonamiento previo tipo Chain-of-Thought en el campo `analisis_plato` (array de strings descomponiendo componentes antes de listar ingredientes).
  - El servidor y cliente validan con Zod la presencia de `analisis_plato`.
  - El generador mock local reproduce fielmente esta descomposición para desarrollo offline y testing determinista.

---

### Decisión 10: Catálogo Local Offline (711 ítems), Pipeline Unificado y Modo interpretar_items
- **Contexto**: Errores ortográficos ("papaa", "tomte"), frases sin separadores ("papa huevo leche", "papas fritas") y falta de categorización automática dificultaban el uso rápido con una mano.
- **Decisión**:
  - Se construyó un catálogo local versionado (`src/lib/catalog.ts`, v1.1.0) con 711 productos de góndola argentina indexados por mapa exacto, sinónimos y categorías.
  - Se implementó un algoritmo *Greedy Longest-Match-First* que preserva ítems compuestos ("papas fritas", "dulce de leche", "pan rallado") y segmenta listas continuas sin comas ("papa huevo leche" -> 3 productos).
  - Normalización y comparación tolerante con distancia Levenshtein (umbral según longitud) que autocorrige errores tipográficos comunes en el cliente sin requerir conexión a internet.
  - Memoria de categorías por hogar (`saveHouseholdCategoryOverride`) que aprende y respeta cuando un usuario reclasifica un producto.
  - Se introdujo el modo `interpretar_items` (reemplazando a `interpretar_despensa`) con cuota mensual dedicada e independiente de 200 consultas/mes por hogar, rate limit propio y caché global.
  - El cruce entre el Chef y la despensa (`discountEngine.ts`) utiliza comparación aproximada para tolerar plurales o diferencias menores de tipeo.

---

### Decisión 11: Botones de Vaciado Protegidos, Borrado Lógico Inmediato y Deshacer de 10 Segundos
- **Contexto**: Eliminar la lista de compras o la despensa por error es frustrante para una familia en el súper. Se requería evitar toques accidentales y permitir deshacer inmediatamente durante 10 segundos, tanto en línea como sin conexión.
- **Decisión**:
  - **Ubicación protegida**: Los botones "Vaciar lista completa" y "Vaciar solo comprados" en la lista de compras, así como "Vaciar despensa", se ubicaron dentro de menús de acciones secundarios (`MoreVertical`) protegidos contra toques fortuitos del pulgar.
  - **Borrado lógico instantáneo**: Al presionar la acción, los elementos se ocultan inmediatamente en la interfaz marcando `deleted_at: ISOString`. Si hay conexión a Supabase, se propaga el update de `deleted_at` para sincronizar el vaciado en tiempo real con todos los dispositivos del hogar.
  - **Toast flotante con cuenta regresiva de 10s**: Aparece un toast visible con badge de segundos restantes (`10s`...`0s`), descripción de la cantidad de productos y un botón destacado "Deshacer".
  - **Restauración o eliminación física**:
    - Si el usuario presiona "Deshacer" dentro de los 10 segundos, `deleted_at` se restablece a `null` de inmediato y todos los elementos vuelven a su posición previa sin pérdida de datos.
  - **Soporte Offline**: `offlineStorage` maneja `deleted_at` en memoria y persistencia local universal; si se confirma la eliminación sin conexión, se encolan mutaciones de tipo `delete` en la cola de sincronización.

---

### Decisión 12: Menú Semanal Mejorado (Modo "menu", Perfiles Nutricionales y Cuotas)
- **Contexto**: Planificar una semana completa de comidas en una sola llamada a un LLM suele exceder tokens de salida o generar platos monótonos. Además, requiere adaptarse a perfiles (deportista, bajar de peso, niños) sin dar consejos médicos no autorizados y evitando comprar ingredientes repetidos.
- **Decisión**:
  - **Panel configurable por día**: Permite elegir qué comidas planificar (`desayuno`, `almuerzo`, `merienda`, `cena`) para cada día de la semana, con atajos rápidos ("Todas las comidas", "Solo almuerzo/cena", "Limpiar").
  - **Perfiles y seguridad**: Selección rápida de perfiles (Deportista, Bajar de peso, Ganar masa muscular, Niños, etc.) y campo libre. Se implementó un aviso fijo obligatorio: *"Son sugerencias generales, no reemplazan a un nutricionista o profesional de la salud"*, con advertencias automáticas ante condiciones médicas declaradas (diabetes, celiaquía, etc.).
  - **Fidelidad al Plato en cada comida**: Toda comida incluye `analisis_plato` para justificar cada ingrediente según el pedido exacto sin ingredientes inventados.
  - **Lista unificada en el servidor/cliente**: Los ingredientes de todas las comidas se unifican sumando cantidades con unidades compatibles (`mergeDuplicateIngredients`) y se descuentan de forma determinista contra la despensa (`calculatePantryDiscounts`), permitiendo desmarcar ingredientes antes de confirmar.

---

### Decisión 14: Verificación Multiusuario en Tiempo Real, Aislamiento RLS y Estrategia de Despliegue
- **Contexto**: Un hogar compartido involucra múltiples miembros simultáneos (comprando en el súper, planificando en casa) que deben colaborar en tiempo real sin colisiones y sin poder acceder a información de otros hogares.
- **Decisión**:
  - **Pruebas automáticas multisesión (`test/multi-user-household.test.ts`)**: Se modelaron dos contextos de navegador concurrentes (Usuario A creador y Usuario B invitado) verificando sincronización y aislamiento.
  - **Aislamiento RLS en todas las tablas**: Se garantizó que los usuarios de otros hogares no pueden leer ni modificar ítems ajenos.

---

### Decisión 15: Resiliencia de Usuario y Hogar Inmediato para Visitantes y Producción
- **Contexto**: Al desplegar en producción (Netlify) con variables de Supabase configuradas, los visitantes que no han iniciado sesión mediante Google o Magic Link no tenían `user` ni `household` activo. Esto provocaba que llamadas a la base de datos o llamadas a la función Edge del Chef lanzaran excepciones no capturadas y congelaran las interacciones de los botones de la interfaz.
- **Decisión**:
  - **Autenticación e inicio sin fricción**: Si el visitante aún no tiene sesión iniciada, `AuthContext` intenta login anónimo o crea una sesión local persistente en `localStorage`. El usuario nunca es nulo.
  - **Garantía de Hogar Activo**: `HouseholdContext` asigna siempre un hogar activo (ya sea de Supabase, de la memoria local persistida o el hogar por defecto). De esta forma, ningún hook ni botón falla por falta de hogar.
  - **Tolerancia a fallos en Supabase & Edge Functions**: Si las Edge Functions o las políticas RLS rechazan una llamada antes de autenticarse completamente, los hooks (`useShoppingList`, `usePantry`, `useChefAi`) capturan el error de forma transparente y ejecutan los motores locales de procesamiento argentino y optimización de despensa sin interrumpir la experiencia de usuario.
  - **Invalidación de Caché PWA**: Se actualizó la versión de caché del Service Worker a `compars-v1.0.1` para forzar a los dispositivos a descartar los bundles anteriores.

---

### Decisión 16: Ronda 4 Bloque 1 - Chef que crea la receta libremente (Receta Primero, Ingredientes Después)
- **Contexto**: Anteriormente el modelo generaba un campo `analisis_plato` y luego inventaba ingredientes desconectados de los pasos o alucinaba almidones (como arroz en pastel de papas). El usuario determinó que NO debe haber recetas pregrabadas ni recetario inyectado: la IA debe generar la receta libremente como un buen cocinero casero argentino.
- **Decisión**:
  1. **Eliminación de Recetario de Referencia**: La IA no recibe inyección de recetas fijas.
  2. **Validación Silenciosa de 32 Platos Clásicos (`culinarySanityCheck.ts`)**: Mantiene una lista estricta de ingredientes manifiestamente absurdos (ej: arroz o fideos en pastel de papas, papa en puré de zapallo). Solo se aplica en el servidor/cliente si el plato coincide; si es un plato no catalogado o raro, no se modifica nada.
  3. **Receta Primero**: El JSON se genera obligatoriamente en este orden: primero `receta` con 5 a 10 pasos detallados con cantidades expresadas en los pasos; y luego `ingredientes` extraídos de esos pasos. Esto reemplaza formalmente al campo `analisis_plato`.
  4. **Validación Servidor de Ingredientes contra Pasos**: Los ingredientes de la lista que no aparezcan en los pasos se marcan automáticamente como `opcional: true` y quedan destildados por defecto en la vista previa del carrito.
  5. **Modelos y Thinking**: Se desacopló `GEMINI_MODEL_CHEF` (`gemini-2.5-flash` a temperatura 0.35 con pensamiento leve de 1024 tokens) de `GEMINI_MODEL_FAST` (`gemini-2.0-flash-lite` para interpretar ítems), logrando máxima precisión culinaria y óptimo consumo de cuota gratuita.
  6. **UI**: Se agregó un acordeón colapsable en la vista previa del chef para consultar los pasos detallados de la receta antes de agregar los faltantes a la lista.

---

### Decisión 17: Ronda 4 Bloque 2 - Menú Semanal con Flujo en Dos Pasos, Variedad Garantizada y Aviso Único
- **Contexto**: Anteriormente el planificador ejecutaba llamadas diarias independientes que causaban repetición de platos (ej. el mismo desayuno los 7 días con perfil Deportista), carecía de bebidas para desayunos/meriendas y mostraba carteles de advertencia duplicados en la UI.
- **Decisión**:
  1. **Flujo en Dos Pasos**:
     - **Paso A (`planificar_semana`)**: Una sola llamada que genera el cronograma completo de platos, bebidas y justificaciones nutricionales (`por_que_encaja`) sin ingredientes. No utiliza la caché de respuestas previa.
     - **Paso B (`detalle_dia_menu`)**: Detalle de ingredientes y recetas compactas (3-6 pasos) generado por día (hasta 7 llamadas) con rate limit pacing (200ms entre días). Cada plato aplica las reglas de "RECETA PRIMERO" y validación silenciosa.
     - **Medición de llamadas**: Un menú completo de 7 días consume exactamente **8 llamadas a la IA** (1 de Paso A + 7 de Paso B; o 9 en caso de un reintento por variedad), cubiertas por el cómputo de 3 consultas globales del usuario.
  2. **Validador de Variedad en el Servidor (`weeklyMenuValidator.ts`)**:
     - No se repiten platos del mismo tipo en la semana (salvo pedidos obligatorios del usuario).
     - No más de 2 días seguidos con la misma proteína principal.
     - Desayunos y meriendas rotan al menos 4 bases distintas (avena, tostadas, yogur, panqueques, huevos, frutas, etc.).
     - Si la IA viola las reglas, se reintenta automáticamente una vez informando los errores sin descontar consultas adicionales.
  3. **Bebidas en Desayuno y Merienda**: Cada desayuno y merienda incluye una bebida variada (café con leche, mate cocido, licuado, té, yogur bebible), cuyos insumos se suman a la lista excepto básicos de despensa.
  4. **Aviso Único y Limpieza Visual**: Se eliminó la duplicación de carteles de advertencia. Solo se renderiza un banner amarillo permanente de recomendación general; el aviso rojo se reserva exclusivamente para advertencias médicas auténticas devueltas por la IA.

---

### Decisión 18: Ronda 4 Bloque 3 - Despensa Automática al Marcar Comprado, Reversión Idempotente y Exclusión de Limpieza
- **Contexto**: Confirmar manualmente "¿Sumar a la despensa?" por cada ítem marcado como comprado resultaba tedioso durante la compra en el supermercado.
- **Decisión**:
  1. **Ajuste del Hogar Sincronizado**:
     - Opciones: "Preguntar" (`ask`, por defecto), "Sumar automáticamente a la despensa" (`auto`) o "No sumar" (`never`).
     - En el modal de confirmación se incorporó el enlace *"Sumar siempre (no volver a preguntar)"* que persiste la preferencia `auto` para todo el hogar.
     - Cualquier miembro puede modificarlo desde la configuración del hogar, sincronizándose vía Supabase Realtime y almacenamiento local offline.
  2. **Exclusión Configurable de Limpieza**:
     - Por defecto (`pantry_exclude_cleaning: true`), los productos clasificados como `'limpieza'` (lavandina, detergente, desinfectante) no se suman a la despensa de alimentos ni disparan consultas. Puede desactivarse desde los ajustes del hogar.
  3. **Rastreo de Procedencia y Reversión Idempotente (`PantryAutoSyncManager`)**:
     - Cada producto sumado a la despensa desde la lista de compras genera un registro de procedencia (`PantrySyncRecord`: `shoppingItemId`, `pantryItemId`, `quantityAdded`).
     - Al desmarcar un ítem (volver a "falta comprar") o al presionar "Deshacer" en el toast discreto de 6 segundos, se resta con precisión la cantidad sumada (`calculateRevertedPantryItem`), garantizando que la despensa nunca quede con valores negativos (`Math.max(0, ...)`).
     - La verificación de registro previo previene sumas duplicadas si dos integrantes marcan ítems simultáneamente.

---

### Decisión 19: Ronda 4 Bloque 4 - Precios de Referencia Oficiales SEPA / Precios Claros con Precedencia Híbrida
- **Contexto**: Los usuarios no querían cargar los precios uno por uno a mano. Existe el dataset oficial diario del SEPA (Secretaría de Comercio), pero carece de API pública individual y pesa varios gigabytes al descomprimirse a nivel nacional.
- **Decisión**:
  1. **Fuentes Oficiales y No Scraping**:
     - Se utilizan exclusivamente fuentes de Datos Abiertos oficiales (`datos.produccion.gob.ar` / `preciosclaros.gob.ar`) bajo licencia Creative Commons CC-BY 4.0. Se prohíbe taxativamente el scraping o el uso de endpoints no documentados de cadenas privadas.
  2. **Importador Batch Desacoplado (`scripts/importSepaPrices.ts`)**:
     - Funciona fuera de Edge Functions para evitar timeouts y costos de procesamiento. Puede ejecutarse localmente con `npm run import-sepa` o programarse gratuitamente mediante GitHub Actions (`.github/workflows/update-sepa-prices.yml`).
     - Filtra por sucursales cordilleranas de Neuquén: Junín de los Andes (La Anónima 063) y San Martín de los Andes (La Anónima 023 y 138).
     - Convierte la presentación a unidad de medida base ($/kg, $/l, $/unidad).
     - Aplica cálculo de mediana descartando valores atípicos (outliers que superen 3x la mediana o estén debajo de 0.25x).
  3. **Honestidad de Datos y Seguridad**:
     - Los productos envasados se etiquetan con confianza alta/media según cantidad de muestras. Frescos (carnicería/verdulería) se etiquetan con confianza baja o sin dato. Nunca se inventan precios ni se usan modelos de lenguaje para alucinar valores.
     - Tabla `price_reference` en Supabase con RLS: lectura para usuarios de la app, escritura solo para el rol de servicio.
  4. **Precedencia Estricta en la App**:
     - `1. Precio del Hogar` > `2. Precio de Referencia SEPA` > `3. Sin Precio`.
     - El presupuesto del carrito muestra total aproximado, conteo de ítems sin precio y la atribución legal obligatoria: *"Fuente: SEPA / Precios Claros (Secretaría de Comercio)"*.





---

### Decisión 20: Ronda 5 Bloque 0 y 1 - Regla Global Anti-Fallbacks Silenciosos, Cobertura del Pedido y Purga de Caché
- **Contexto**: Diagnóstico de Bugs A y B reveló que ante fallos en la Edge Function, el cliente devolvía silenciosamente un menú mock y una receta con arroz, cebolla, tomate perita y aceite de girasol, descontando cuota del usuario.
- **Decisión**:
  1. **Regla Global "Nunca Contenido Falso en Silencio"**: Se eliminaron todos los caminos de mock o fallback en producción. Ante cualquier fallo de la IA (sin clave, 429, timeout, error JSON), el usuario ve un mensaje amable y transparente, no se agregan productos a la lista y no se cobran consultas/créditos.
  2. **Modo Demo Explícito (`VITE_AI_DEMO_MODE=true`)**: Mocks solo operan si la bandera está activada para desarrollo, con un badge visible "MODO DEMO" y sin descontar consultas.
  3. **Trazabilidad de Respuestas (`origen: 'ia' | 'cache' | 'demo'`)**: Cada respuesta informa su origen y se audita en `ai_usage_log`.
  4. **Validador de Cobertura del Pedido (`orderCoverageValidator.ts`)**: Los productos mencionados en el pedido (ej. papa y acelga) deben estar presentes en los ingredientes resultantes (salvo exclusiones "sin X"). Si falta alguno, se reintenta una única vez guiando al modelo sin costo adicional.
  5. **Versión de Caché (`PROMPT_VERSION = 'v1.5.0'`) y Purga**: Clave de caché incluye pedido normalizado, personas, restricciones ordenadas y `PROMPT_VERSION`. Migración `20261012_ronda5_cache_purge.sql` purga entradas heredadas con recetas genéricas.

---

### Decisión 21: Ronda 5 Bloque 2 - Menú Semanal Sin Repeticiones, por_que_encaja Único y Rotación entre Semanas
- **Contexto**: Los platos del menú semanal seguían un patrón de 3 ciclos con textos idénticos en `por_que_encaja` y podían repetirse de una semana a otra.
- **Decisión**:
  1. **por_que_encaja Estrictamente Único**: Validación en cliente y servidor que rechaza planes con justificaciones repetidas. Cada plato debe justificar por qué encaja con su comida y objetivo nutricional.
  2. **Semilla Aleatoria y Rotación Histórica (`weeklyMenuHistory.ts`)**: Cada pedido envía una semilla aleatoria (`semilla`) y los platos de los últimos 2 menús generados por el hogar (`platos_recientes_evitar`), asegurando que no se repitan platos entre semanas consecutivas.
  3. **Regeneración Específica**: Se implementaron las funciones "Regenerar este plato" (modo `regenerar_plato`) y "Regenerar la semana".

---

### Decisión 22: Ronda 5 Bloque 3 - Persistencia Automática, Sincronización y Arranque Limpio desde Cero
- **Contexto**: Las configuraciones se reiniciaban al recargar, la app arrancaba con datos ficticios ("Facundo", "Cabaña Los Pehuenes", "Junín de los Andes") y productos de despensa precargados.
- **Decisión**:
  1. **Tablas Persistentes con RLS**:
     - `public.user_preferences` (por usuario): `theme` ('light' | 'dark' | 'system'), `target_profile`, `profile_detail`, `ui_preferences`. RLS por `auth.uid()`.
     - `public.household_settings` (por hogar, compartida): `pantry_add_mode`, `pantry_exclude_cleaning`, `dietary_restrictions`, `weekly_menu_days_config`, `weekly_menu_persons`, `weekly_menu_mandatory_dishes`, `city`. RLS por pertenencia al hogar.
  2. **Persistencia Automática con Debounce (~500ms) e Indicador Discreto**:
     - Se creó `SettingsContext` que escribe de inmediato en `localStorage` (offline-first instantáneo) y dispara un guardado debounced de 500ms a Supabase.
     - Indicador discreto `<SaveIndicator />` con badge "Guardado" en encabezados. Sincronización multidispositivo mediante Supabase Realtime `postgres_changes`.
     - Separación de responsabilidades: las restricciones alimentarias son del hogar; el perfil de objetivo nutricional es del usuario.
  3. **Arranque desde Cero sin Datos Predeterminados**:
     - Se eliminaron todos los mocks y auto-logins ("Facundo", "Los Pehuenes", semillas iniciales de productos).
     - Flujo de bienvenida obligatorio: Ingreso -> Nombre para mostrar (vacío, obligatorio) -> "Crear mi hogar" (nombre vacío, ciudad opcional) o "Unirme con link o código".
     - Al ingresar, las listas, despensa y menú inician completamente vacíos.
