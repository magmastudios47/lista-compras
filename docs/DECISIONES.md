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

