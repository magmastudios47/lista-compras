# Estudio de Viabilidad e Integración: SEPA / Precios Claros para Lista Compars

## 1. Resumen Ejecutivo
Este documento analiza la factibilidad técnica, legal y operativa de integrar la base de datos abierta del **SEPA (Sistema Electrónico de Publicidad de Precios Argentinos)** / **Precios Claros**, administrada por la Secretaría de Comercio de la Nación Argentina, en la aplicación **Lista Compars**.

El objetivo es nutrir la lista de compras y las recetas del Chef IA con precios de referencia reales en pesos argentinos (ARS), con foco geográfico en **Junín de los Andes y alrededores (San Martín de los Andes y Provincia del Neuquén)** sin requerir carga manual obligatoria por parte del usuario.

---

## 2. Origen Normativo, Licencia y Acceso a los Datos

### 2.1 Marco Regulatorio y Licencia
- **Resolución 12/2016** de la Secretaría de Comercio (Ministerio de Economía de la Nación): Obliga a las cadenas de supermercados minoristas y mayoristas que superan determinado umbral de facturación a informar diariamente todos sus precios de góndola antes de las 06:00 AM.
- **Licencia Oficial**: Publicado bajo la política de Datos Abiertos de la República Argentina y licencia permisiva tipo **Creative Commons Atribución (CC-BY 4.0)**, lo que permite su reutilización comercial y no comercial citando la fuente oficial.
- **Atribución Requerida**: *"Fuente: SEPA / Precios Claros (Secretaría de Comercio)"*. La app muestra esta atribución en el resumen del presupuesto del carrito y en las tarjetas de estimación del Chef.

### 2.2 Dónde y Cómo se Accede
- **Portal Oficial**: Portal de Datos Abiertos de la Producción (`datos.produccion.gob.ar/dataset/sepa-precios` / `datos.gob.ar`) y portal ciudadano `preciosclaros.gob.ar`.
- **Inexistencia de API REST pública para consultas individuales**: La Secretaría de Comercio **no brinda una API pública en tiempo real** para consultar precios producto a producto desde una app cliente. Los endpoints internos del buscador ciudadano cambian frecuentemente y no están garantizados como estables.
- **Mecanismo oficial de distribución**: Descargas masivas (batch) en archivos comprimidos (`.zip` con archivos delimitados `.csv` de `sucursales.csv`, `productos.csv` y `precios.csv`) actualizados de lunes a viernes en horas de la madrugada.
- **Prohibición de Scraping**: No se utilizan endpoints no documentados ni se scrapean páginas web de supermercados (La Anónima u otros).

---

## 3. Cobertura Geográfica: Junín de los Andes y San Martín de los Andes

### 3.1 Evidencia de Sucursales en la Zona (Provincia del Neuquén)
A partir del análisis del dataset de sucursales informado bajo el SEPA, se constató la siguiente cobertura en la zona cordillerana:

| Cadena / Bandera | ID Sucursal | Localidad | Dirección | Estado en SEPA |
| :--- | :--- | :--- | :--- | :--- |
| **La Anónima** | `063` | Junín de los Andes | Cnel. Suárez 300 / Olavarría | **Activa y reporta diariamente** |
| **La Anónima** | `023` | San Martín de los Andes | Av. San Martín 657 | **Activa y reporta diariamente** |
| **La Anónima** | `138` | San Martín de los Andes | Perito Moreno 1100 | **Activa y reporta diariamente** |
| **La Anónima** | `012` | Zapala | Av. San Martín 400 | Activa (~170 km) |
| **Carrefour / Coto** | Varios | Neuquén Capital | Diversas | Activa (~380 km, no aplica a zona andina) |

### 3.2 Realidad Comercial de Comercios Chicos y Frescos
- Pequeños comercios, almacenes familiares, panaderías, carnicerías de barrio y verdulerías de Junín de los Andes **no reportan al SEPA** (por quedar debajo del umbral de facturación de la resolución).
- **Honestidad de datos**:
  - Los productos envasados (leche, fideos, arroz, aceite, harina, azúcar, yerba, manteca, puré de tomate) tienen alta representatividad y exactitud en el catálogo.
  - Los productos de verdulería y carnicería varían según corte, estación y proveedor local; se catalogan con **confianza baja** o **sin dato**, y nunca se inventan precios ni se usan modelos de lenguaje para adivinarlos.
  - La memoria de precios del hogar (`priceMemory.ts`) permite a la familia fijar sus precios reales pagados en los comercios locales.

---

## 4. Arquitectura del Importador y Base de Datos

### 4.1 Proceso Batch Fuera de Edge Functions
Debido al volumen de los archivos diarios (más de 3 GB descomprimidos a nivel nacional), el procesamiento se ejecuta fuera de las Edge Functions:
1. **Script CLI**: `scripts/importSepaPrices.ts` ejecutable con `npm run import-sepa`.
2. **Tarea Periódica Gratuita en GitHub Actions**: `.github/workflows/update-sepa-prices.yml` programada de lunes a viernes a las 07:00 AM (hora Argentina).
3. **Mapeo a Catálogo**:
   - Cruza descripciones de SEPA con el catálogo de Lista Compars (`src/lib/catalog.ts`).
   - Normaliza la unidad de medida según la presentación:
     - 500 g de fideos -> precio por kg = precio / 0.5.
     - 900 ml de aceite -> precio por litro = precio / 0.9.
     - 6 unidades de huevos -> precio por unidad = precio / 6.
4. **Cálculo de Mediana y Filtro de Outliers**:
   - Si existen 3 o más muestras, se descartan valores atípicos que superen 3x la mediana o estén por debajo de 0.25x (ej. errores tipográficos en góndola como $999.999).
   - Se calcula la mediana matemática final sobre las muestras válidas.

### 4.2 Tabla `price_reference` en Supabase
Esquema de base de datos migrado en `supabase/migrations/20261011_ronda4_settings_and_prices.sql`:
- Columnas: `id`, `normalized_name`, `zone`, `price_per_unit`, `unit`, `date`, `source`, `sample_count`, `confidence`, `created_at`, `updated_at`.
- Restricción única: `UNIQUE(normalized_name, zone, unit)`.
- **Seguridad RLS**:
  - Lectura: permitida para usuarios autenticados y anónimos de la app.
  - Escritura: estrictamente restringida a `service_role` (solo el importador batch).

---

## 5. Orden de Precedencia y Experiencia en la App

En la aplicación (`src/lib/priceEngine.ts`), el cálculo de precios respeta el siguiente orden estricto:

```
1. PRECIO CARGADO POR EL HOGAR (priceMemory / manual en el ítem)
   ↓ (si no existe)
2. PRECIO DE REFERENCIA SEPA DE LA ZONA (price_reference)
   ↓ (si no existe)
3. SIN PRECIO (no inventar datos)
```

### 5.1 En la Lista de Compras
- **Total del Carrito**: Mostrado como `$14.200 aprox.`
- **Indicador de cobertura**: Indica cuántos productos no tienen precio (ej. `2 productos sin precio`).
- **Atribución oficial visible**: `Fuente: SEPA / Precios Claros (Secretaría de Comercio)`.
- **Etiqueta en cada producto**:
  - Productos con precio del hogar: `• $1.500 (hogar)`
  - Productos con precio SEPA: `• $1.455 (SEPA)`
  - Productos sin precio: `• +Precio` (permite ingresar valor con un toque).

### 5.2 En las Recetas del Chef IA
- Las tarjetas de sugerencias y la vista previa de preparación calculan el costo estimado de los ingredientes aplicando la misma precedencia y mostrando la atribución oficial.

---

## 6. Instrucciones Paso a Paso para Ejecutar la Importación

### Opción A: Ejecución Local con Archivo de Muestra
El repositorio incluye archivos de muestra listos para usar en `data/sepa-sample/`:
```bash
npm run import-sepa
```
El script generará o actualizará `data/reference_prices.json` con los precios procesados y filtrados para Junín de los Andes y San Martín de los Andes.

### Opción B: Ejecución Local con el Paquete Oficial Diario de SEPA
1. Descargá el paquete diario de Precios Claros desde el portal oficial de datos abiertos del Ministerio de Economía.
2. Descomprimí los archivos `sucursales.csv`, `productos.csv` y `precios.csv` en una carpeta (por ejemplo `data/sepa-live/`).
3. Ejecutá el importador apuntando a esa carpeta:
   ```bash
   npx tsx scripts/importSepaPrices.ts --dataDir=data/sepa-live
   ```
4. Los precios agregados y las medianas se generarán automáticamente en `data/reference_prices.json` y se sincronizarán con Supabase si están configuradas las variables de entorno (`SUPABASE_SERVICE_ROLE_KEY`).

### Opción C: Ejecución Automática en la Nube (GitHub Actions)
1. En el repositorio de GitHub, configurá los siguientes Secrets en *Settings > Secrets and variables > Actions*:
   - `SUPABASE_URL`: URL del proyecto de Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Clave de rol de servicio (secreta).
2. El workflow `.github/workflows/update-sepa-prices.yml` se ejecutará automáticamente todas las mañanas de lunes a viernes o cuando se active manualmente mediante el botón **Run workflow** en la pestaña Actions.
