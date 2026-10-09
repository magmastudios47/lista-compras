# Resumen de Entrega: Ronda 2+3 (docs/RONDA2-3.md)

**Proyecto**: Lista Compars (PWA Mobile-First con Chef IA, Hogares Compartidos y Facturación Mercado Pago)  
**Modalidad**: Trabajo autónomo integral sin interrupciones  
**Estado Final**: **COMPLETADO CON ÉXITO**

---

## 1. Resumen de Todo lo Hecho por Bloques

### Bloque 0: Línea Base, Git y Diagnóstico Inicial
- Inicialización de repositorio Git local con historial de commits atómicos por bloque (`git init`).
- Verificación de línea base de pruebas y compilación inicial.
- Creación de `docs/PENDIENTES.md` para registro continuo de anomalías y diagnósticos.

### Bloque 1: Pagos con Mercado Pago (Servidor, Webhook con Firma HMAC y RLS)
- **Corrección crítica**: Se eliminó de raíz la activación simulada del plan Pro en el cliente. Ninguna pantalla o botón puede activar planes por sí misma.
- **Base de datos Supabase**: Se diseñaron las tablas `plans`, `licenses`, `payments` y `exchange_rates` en la migración `supabase/migrations/20261008_billing_and_payments.sql`.
- **Row Level Security (RLS)**: Los usuarios autenticados únicamente pueden LEER las licencias y pagos de su propio hogar. Cero permisos de `INSERT`, `UPDATE` o `DELETE` para clientes; la escritura está estrictamente restringida a `service_role` (Edge Functions).
- **Edge Function `create-checkout`**: Calcula el monto exclusivamente en el servidor a partir de los precios oficiales en USD y la tasa ARS; genera preferencia de Checkout Pro con `external_reference` único y registra el pago en estado `pending`.
- **Edge Function `mp-webhook`**: Verifica la cabecera `x-signature` calculando el HMAC-SHA256 con el secreto de Mercado Pago; valida monto, moneda y estado `approved` antes de activar la licencia con idempotencia ante notificaciones repetidas.
- **Páginas de retorno pasivas**: Vistas de éxito, pendiente y error que solo consultan la licencia en tiempo real a Supabase sin tocar los datos.
- **Cotización y saneamiento**: Cotización editable en la tabla `exchange_rates` con control de sanidad (límite entre $500 y $10.000 ARS).
- **Límites por plan**: Free (5 consultas/mes, 3 miembros), Base 10 USD (40 consultas/mes, 10 miembros), Premium 20 USD (150 consultas/mes, miembros ilimitados, menú semanal y precios).
- **Script seguro en `SETUP.md`**: SQL con `service_role` para asignar planes a mano a familiares o pruebas sin pasar por la pasarela.

### Bloque 2: Investigación de Ideas en GitHub
- Búsqueda y análisis de repositorios de código abierto con licencias permisivas (MIT, Apache-2.0, BSD) en 5 temas clave:
  1. Búsqueda difusa y corrección ortográfica de productos.
  2. Sincronización offline en PWAs con resolución Last-Write-Wins.
  3. Modelos multi-inquilino de hogares y políticas RLS en Supabase.
  4. Notificaciones push en iOS y Android.
  5. Ergonomía UX de listas de compras para una sola mano en el supermercado.
- Documentación completa en `docs/REFERENCIAS.md` con enlaces, licencias, estrellas, patrones rescatados y descartados.

### Bloque 3: Corregir el Chef (Fidelidad al Plato)
- **Corrección crítica**: Al pedir "milanesa con puré de zapallo" el chef agregaba papa por inercia cultural.
- **Prompt del sistema**: Se incorporó la sección obligatoria **FIDELIDAD AL PLATO** y el campo de razonamiento inicial `analisis_plato` en los modos `cocinar` y `sugerir`.
- **Esquema Zod**: Validación estructurada de `analisis_plato` antes del array de ingredientes.
- **Batería de regresión**: 32 pruebas culinarias exhaustivas ("puré de zapallo" sin papa, "tarta de zapallitos" sin zapallo anco, "tortilla de verduras" sin papa, "fideos con salsa blanca" sin tomate, "ensalada de lentejas" sin lechuga, "pollo con batata" sin papa, etc.).
- **Reporte de calidad**: Actualización de `docs/chef-quality-report.md`.

### Bloque 4: Texto Escrito a Mano (Catálogo Argentino >= 600 ítems, Ortografía y Categorías)
- **Catálogo local versionado (`src/lib/argentineProductsCatalog.ts`)**: Base de datos de **711 productos habituales en góndolas argentinas**, con nombres normalizados, sinónimos populares, unidades sugeridas y categorías de supermercado. Funciona 100% offline.
- **Pipeline único de procesamiento de texto (`src/lib/textPipeline.ts`)**:
  - Separadores múltiples (comas, saltos de línea, punto y coma y la palabra "y").
  - Normalización rioplatense (minúsculas, sin tildes, singularización).
  - Búsqueda exacta, sinónimos y difusa con distancia de Levenshtein (umbral <= 2).
  - Segmentación de textos sin comas buscando el calce más largo ("papas fritas" es 1 producto; "papa huevo leche" son 3).
- **Nuevo modo de IA `interpretar_items`**: Cuota independiente de 200 consultas mensuales por hogar, con rate limit propio y caché global para no repetir consultas idénticas.
- **Categorización automática y personalizada**: Todo producto agregado recibe categoría inmediata; si el usuario la cambia, la app recuerda su preferencia para ese hogar.

### Bloque 5: Botones de Vaciar con Deshacer
- **Ubicación protegida**: Botones *"Vaciar solo comprados"* y *"Vaciar lista completa"* dentro de un menú contextual para evitar toques accidentales en el supermercado.
- **Borrado lógico (`deleted_at`)**: Al pulsar, los ítems desaparecen de la vista activa de inmediato sin borrarse físicamente.
- **Toast con cuenta regresiva**: Barra flotante de 10 segundos con contador visible en segundos (`{secondsLeft}s`) y botón verde *"Deshacer"*. Al expirar, se ejecuta la eliminación definitiva en la base de datos y en el almacenamiento local.
- **Sincronización en tiempo real y offline**: Ambas acciones se sincronizan inmediatamente con todos los miembros del hogar.

### Bloque 6: Menú Semanal Mejorado
- **Panel por comidas**: Selección por día (Lunes a Domingo) de cualquier combinación de desayuno, almuerzo, merienda y cena, con atajos masivos.
- **Objetivos y perfiles**: Opciones rápidas (Deportista, Bajar de peso, Ganar masa muscular, Vegetariano, Económico, Para niños, Sin TACC, etc.) con texto libre opcional.
- **Aviso de salud obligatorio**: Cartel visible *"Son sugerencias generales, no reemplazan a un nutricionista o profesional de la salud"*, con advertencias médicas automáticas ante patologías declaradas.
- **Control de límites y cuotas**: El menú semanal está reservado para hogares con plan Premium y descuenta 3 consultas del cupo mensual centralizado.
- **Lista unificada**: El cliente/servidor consolida ingredientes sumando cantidades, descuenta lo que ya existe en la despensa y permite desmarcar ítems antes de volcarlos al changuito.

### Bloque 7: Precios por Producto, Estimación por Receta y Estudio SEPA
- **Precio opcional y total discreto**: Campo de precio en cada ítem. El total de la lista se muestra de forma discreta con la leyenda `${total} aprox.`.
- **Memoria de precios por hogar (`src/lib/priceMemory.ts`)**: Todo precio ingresado se guarda por nombre normalizado aislado por hogar; al escribir el producto en el drawer, se sugiere automáticamente el último precio pagado con un botón de un toque.
- **Estimación de costo por receta**: Si todos los ingredientes tienen precio recordado, calcula el costo aproximado; si no, indica con exactitud cuántos precios faltan.
- **Investigación SEPA / Precios Claros (`docs/PRECIOS.md`)**: Estudio detallado sobre los datasets abiertos de la Secretaría de Comercio (Res. 12/2016), volumen diario (12M+ filas), cobertura en Junín de los Andes (cadena La Anónima), riesgos de precios de góndola y propuesta de arquitectura batch para el backend.

### Bloque 8: Hogares Multiusuario y Despliegue
- **Pruebas de dos usuarios concurrentes (`test/multi-user-household.test.ts`)**: 7 pruebas de integración modelando dos contextos de navegador independientes (Usuario A creador y Usuario B invitado), verificando unión por código/link, sincronización de altas en tiempo real, tachado de ítems en góndola, vaciado seguro con deshacer y límites de integrantes por plan.
- **Aislamiento RLS en todas las tablas**: Comprobación estricta de que usuarios de otros hogares no pueden leer ni escribir datos ajenos.
- **Guía de prueba local con dos navegadores**: Incorporada en `SETUP.md` (Paso 7: ventana normal e incógnito).
- **Guía de despliegue gratuito (`docs/DEPLOY.md`)**: Instrucciones paso a paso para publicar en Vercel, Netlify o Cloudflare Pages, configuración de variables de entorno y webhook de Mercado Pago.

### Bloque 9: Revisión Final Completa (QA)
- Verificación del bundle del cliente (`dist/`): 0 claves maestras ni secretos presentes.
- Verificación de PWA: Manifiesto y Service Worker respondiendo con HTTP 200.
- Ejecución completa de tests: **79 de 79 pruebas aprobadas**.
- Compilación de producción: `npm run build` exitoso sin advertencias de tipos.
- Creación de `docs/QA-REPORT.md`, `docs/RONDA2-3.md`, y actualización de `.agents/skills/chef-ia/SKILL.md`, `SETUP.md` y `task.md`.

---

## 2. Decisiones de Diseño Tomadas (Resumen de `docs/DECISIONES.md`)

1. **Decisión 8 (Mercado Pago Server-Side)**: El cliente nunca activa planes. Se usa HMAC-SHA256 en la Edge Function para validar notificaciones de pago.
2. **Decisión 9 (Fidelidad al Plato)**: Inclusión obligatoria del campo de razonamiento previo `analisis_plato` en el esquema de Gemini para erradicar la papa en platos que no la llevan.
3. **Decisión 10 (Pipeline Lingüístico Híbrido)**: Catálogo local sin conexión de 711 productos argentinos con Levenshtein y calce más largo; IA reservada como fallback con caché global y cuota propia de 200/mes.
4. **Decisión 11 (Vaciado con Borrado Lógico y Deshacer)**: Eliminación en dos fases (`deleted_at` inmediato + ventana de 10 segundos para restaurar + eliminación física al expirar).
5. **Decisión 12 (Menú Semanal Gated a Premium)**: Generación estructurada de comidas, aviso de salud obligatorio y costo de 3 consultas por menú completo.
6. **Decisión 13 (Memoria de Precios Aislada y SEPA Batch)**: Precios recordados aislados por `household_id` y arquitectura batch nocturna propuesta para Precios Claros.
7. **Decisión 14 (Aislamiento RLS y Despliegue en Vercel)**: RLS estricto para proteger hogares y documentación de hosting gratuito.

---

## 3. Librerías Utilizadas

No se añadieron librerías pesadas ni dependencias riesgosas al bundle:
- **`canvas-confetti`**: Ya presente para efectos de celebración al completar la lista de compras.
- **`zod`**: Ya presente para validación de contratos del Chef IA y Edge Functions.
- **`@supabase/supabase-js`**: Ya presente para autenticación, base de datos y suscripciones en tiempo real.
- **Algoritmo de Levenshtein**: Implementado de forma nativa en TypeScript puro en `src/lib/textPipeline.ts` (0 dependencias externas, 0 overhead).
- **Catálogo Argentino**: Módulo nativo en `src/lib/argentineProductsCatalog.ts` (711 productos curados).

---

## 4. Lista Corta y Ordenada de lo que te Toca Revisar a Mano

Cuando vuelvas, seguí estos pasos sencillos en orden:

1. **Probar la app en tu navegador**:
   - Abrí `http://localhost:3000` en tu computadora (el servidor de desarrollo está activo).
   - Abrí una ventana normal y una ventana de incógnito siguiendo el **Paso 7 de `SETUP.md`** para ver cómo se sincronizan dos celulares/personas de la misma casa en tiempo real.

2. **Probar el Chef con puré de zapallo**:
   - Tocá el botón central del Chef IA y pedí: `"Milanesa con puré de zapallo para 4"`.
   - Verificá en los ingredientes que incluya zapallo y **no agregue papa**.

3. **Probar el texto con faltas de ortografía**:
   - En la lista de compras o en la despensa, escribí rápido: `"papaa, tomte, dulce de leche"`.
   - Comprobá cómo el catálogo corrige automáticamente a *papa* y *tomate*, categorizándolos en verdulería y almacén sin que tengas que elegir la categoría a mano.

4. **Probar el vaciado con deshacer**:
   - Tocá el menú de opciones de la lista (`⋮`) -> *"Vaciar solo comprados"*.
   - Verificá que aparece la barra inferior con los 10 segundos y tocá *"Deshacer"* para restaurarlos.

5. **Configurar tus credenciales cuando quieras salir a producción**:
   - **Mercado Pago**: En [Mercado Pago Developers](https://www.mercadopago.com.ar/developers), obtené tus credenciales de prueba y configuralas en tu `.env` o en Supabase (ver **Paso 3 de `SETUP.md`**).
   - **Gemini**: Obtené tu clave gratuita en [Google AI Studio](https://aistudio.google.com/) (ver **Paso 2 de `SETUP.md`**).
   - **Publicar en Vercel**: Cuando quieras que tu familia lo tenga en sus celulares reales, seguí los pasos sencillos de **`docs/DEPLOY.md`**.
