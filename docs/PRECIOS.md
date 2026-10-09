# Estudio de Viabilidad e Integración: SEPA / Precios Claros para Lista Compars

## 1. Resumen Ejecutivo
Este documento analiza la factibilidad técnica, legal y operativa de integrar la base de datos abierta del **SEPA (Sistema Electrónico de Publicidad de Precios Argentinos)** / **Precios Claros**, administrada por la Secretaría de Comercio de la Nación Argentina, en la aplicación **Lista Compars**.

El objetivo es evaluar cómo nutrir la lista de compras y las recetas del Chef IA con precios de referencia reales en pesos argentinos (ARS), con foco geográfico inicial en **Junín de los Andes y la Provincia del Neuquén**.

---

## 2. Origen Normativo y Acceso a los Datos

### 2.1 Marco Regulatorio y Licencia
- **Resolución 12/2016** de la Secretaría de Comercio (Ministerio de Producción / Economía de la Nación): Obliga a las cadenas de supermercados minoristas y mayoristas que superan determinado umbral de facturación a informar diariamente todos sus precios de góndola antes de las 06:00 AM.
- **Licencia**: Publicado bajo la política de Datos Abiertos de la República Argentina y licencia permisiva tipo **Creative Commons Atribución (CC-BY 4.0)**, lo que permite su reutilización comercial y no comercial citando la fuente oficial.

### 2.2 Dónde y Cómo se Accede
- **Portal Oficial**: Portal de Datos de Desarrollo Productivo (`datos.produccion.gob.ar/dataset/sepa-precios`) y portal ciudadano `preciosclaros.gob.ar`.
- **Inexistencia de API REST oficial para consultas individuales**: La Secretaría de Comercio **no brinda una API pública en tiempo real** para consultar precios producto a producto desde una app cliente.
- **Mecanismo de distribución**: Descargas masivas (batch) en archivos comprimidos (`.zip` con archivos delimitados `.csv`) actualizados de lunes a viernes en horas de la madrugada.

---

## 3. Formato, Estructura y Volumen de los Datos

### 3.1 Estructura Relacional de los Datasets
El esquema de datos del SEPA se compone fundamentalmente de tres tablas tabulares:

1. **`sucursales.csv`**:
   - `id_comercio` (identificador único de la cadena o CUIT).
   - `id_bandera` (nombre comercial: ej. "La Anónima", "Carrefour Express", "Coto").
   - `id_sucursal` (código único de boca de expendio).
   - `nombre`, `direccion`, `localidad`, `provincia`, `latitud`, `longitud`.
2. **`productos.csv`**:
   - `id_producto`: Código de barras internacional **EAN-13 / GTIN**.
   - `marca`: Fabricante/marca registrada (ej. "La Serenísima", "Molinos", "Arcor").
   - `descripcion`: Denominación comercial (ej. "LECHE ENTERA SACHET 1 L").
   - `categoria`: Clasificación del producto.
   - `presentacion`: Unidad de venta y contenido neto (ej. "1 lt", "500 gr").
3. **`precios.csv`**:
   - `id_comercio`, `id_bandera`, `id_sucursal`.
   - `id_producto` (EAN-13).
   - `precio_unitario_bulto`: Precio regular informado.
   - `precio_unitario_promo`: Precio promocional o con descuento si aplicare.
   - `fecha_vigencia`.

### 3.2 Volumen y Desafíos de Escala
- **Volumen diario nacional**: Entre **10 y 15 millones de filas** al día.
- **Peso**: Entre 300 MB y 600 MB comprimido (ZIP) y más de **3.5 GB descomprimido** cada día.
- **Conclusión de viabilidad en cliente**: Es **técnicamente inviable y prohibitivo** que la PWA o el cliente móvil descargue o parsee estos archivos. El procesamiento debe ser obligatoriamente un proceso batch backend en el servidor.

---

## 4. Cobertura Geográfica: Junín de los Andes y Neuquén

### 4.1 Realidad Comercial en Junín de los Andes
- **Cadenas bajo obligación SEPA**:
  - La única cadena de supermercados de alcance nacional presente en Junín de los Andes con obligación de reporte diario bajo la Res. 12/2016 es **La Anónima** (Sociedad Anónima Importadora y Exportadora de la Patagonia).
  - La sucursal de Junín de los Andes (`La Anónima Sucursal 063`, sobre calle Olavarría / Cnel. Suárez) está formalmente censada en el dataset de sucursales de Neuquén.
  - Para referencias de precios en hipermercados alternativos (Carrefour, Coto, ChangoMás), las sucursales más cercanas se localizan en Neuquén Capital (~380 km) o Zapala.
- **Comercios locales no incluidos**:
  - Carnicerías de barrio, verdulerías locales, panaderías familiares y pequeños almacenes de Junín de los Andes **no reportan al SEPA**.
  - En la Patagonia andina, una porción significativa del gasto de frescos (carne de novillo, fruta del Alto Valle, pan artesanal) se adquiere en estos comercios no censados.
- **Estrategia para Lista Compars**:
  - Usar los precios de La Anónima Junín de los Andes como **referencia base de supermercado**.
  - Complementar con el sistema de **precios recordados por hogar** (`priceMemory.ts`) que permite al usuario ingresar el precio real que pagó en su carnicería o verdulería habitual y recordarlo permanentemente para su familia.

---

## 5. Mapeo entre Productos Normalizados y el Catálogo SEPA

### 5.1 El Problema del Desacople Semántico
- **En Lista Compars**: Los productos son conceptos genéricos de góndola rioplatense (ej. `"leche entera"`, `"papa"`, `"cebolla"`, `"harina 000"`, `"nalga"`).
- **En SEPA**: Los registros son SKU comerciales hiperespecíficos con marca y código de barras EAN-13 (ej. `7793940302010 - LECHE ENTERA ULTRA LA SERENISIMA SACHET 1 L`).

### 5.2 Estrategia de Cruce Propuesta
1. **Mapeo Curado de Canasta Básica (Top 100 productos)**:
   - Asociar nuestros 100 productos más frecuentes (`src/lib/catalog.ts`) con una lista de 3 a 5 EANs representativos de marcas líderes y marcas propias del supermercado local.
2. **Cálculo de Precios Agregados (Mediana y Rango)**:
   - Para un producto genérico como `"leche entera"`, no mostrar un único precio rígido sino la **mediana de precios de la categoría** en la sucursal local:
     - `Precio estimado: $1.450 aprox. (rango $1.200 - $1.650)`
3. **Ponderación Híbrida**:
   - Prioridad 1: Precio recordado históricamente por el hogar (`household_prices`).
   - Prioridad 2: Mediana de precios SEPA en La Anónima Junín de los Andes.
   - Prioridad 3: Promedio de referencia de la categoría.

---

## 6. Riesgos y Limitaciones Detectadas

| Riesgo | Impacto | Mitigación |
| :--- | :--- | :--- |
| **Precio de lista vs. Góndola real** | Medio | SEPA publica el precio formal declarado a las 6 AM; promociones bancarias, reintegros o errores de etiquetado local pueden diferir. Se indica siempre la leyenda **"aprox."** en la UI. |
| **Falta de cobertura en comercios chicos** | Alto | Verdulerías y carnicerías locales no están en SEPA. La función de precio recordado por hogar resuelve este vacío. |
| **Inflación / Volatilidad cambiaria** | Alto | Los precios en Argentina sufren ajustes mensuales/quincenales. Se descartan precios con más de 30 días sin actualizar. |
| **Sobrecarga de almacenamiento** | Crítico | Jamás importar los 15 millones de filas de todo el país a Supabase. Filtrar solo provincia de Neuquén y la canasta relevante antes de persistir. |

---

## 7. Propuesta de Arquitectura Técnica (Fase Futura)

```mermaid
flowchart TD
    A["Secretaría de Comercio (datos.produccion.gob.ar)"] -->|Descarga diaria 07:00 AM (ZIP/CSV)| B["Cron Worker / GitHub Action nocturno"]
    B -->|Filtro: sucursales Neuquén & Junín de los Andes| C["Limpieza y Reducción (12M -> ~3.000 filas)"]
    C -->|Mapeo con Catálogo Local Argentine| D["Cálculo de Mediana por Producto Genérico"]
    D -->|Upsert tabla liviana| E[("Supabase: reference_prices")]
    E -->|Lectura con caché CDN| F["PWA Lista Compars (Cliente)"]
```

### Componentes de la Solución:
1. **Worker ETL Liviano (Python / Node)**:
   - Se ejecuta una vez al día a las 07:00 AM mediante GitHub Actions o Supabase Edge Function con cron schedule.
   - Descarga el archivo diario, filtra por `id_provincia == 'NQN'` y `id_comercio == 'La Anonima'`.
   - Reduce los gigabytes a un JSON de apenas **~150 KB**.
2. **Tabla Supabase `reference_prices`**:
   - `normalized_name TEXT PRIMARY KEY`
   - `median_price NUMERIC(10,2)`
   - `min_price NUMERIC(10,2)`
   - `max_price NUMERIC(10,2)`
   - `store_branch TEXT`
   - `updated_at TIMESTAMPTZ`
3. **Consumo en la App**:
   - Lectura pública en solo lectura (RLS) con `stale-while-revalidate`.
   - Si no hay conexión o no hay precio de referencia, la app recurre transparentemente a la memoria de precios del hogar.

---

## 8. Conclusión y Próximos Pasos
La base SEPA es una herramienta valiosa de datos abiertos para la Argentina, pero su integración debe ser **asincrónica y filtrada a nivel de servidor**. 

La base implementada en este bloque (memoria por hogar en `priceMemory.ts`, total del carrito con leyenda "aprox." y estimación por receta) sienta los cimientos perfectos para recibir estos precios de referencia sin alterar la lógica de negocio ni degradar la velocidad de la PWA.
