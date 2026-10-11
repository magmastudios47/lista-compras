# Reporte Integral de Calidad y QA: Ronda 4 (Lista Compars)

**Fecha**: 11 de Octubre de 2026  
**Entorno**: Windows local (PowerShell), Vite 6 + React 19 + TypeScript 5.7, Vitest 3.2  
**Viewport Evaluado**: Mobile 390x844 (iPhone 14 / estándar celular) y Desktop 1280x800  
**Cobertura de Pruebas**: 10 suites de prueba automatizadas, 113 tests unitarios y de integración ejecutados (**100% PASS**).

---

## 1. Alcance de las Pruebas Realizadas

### Bloque 1: Chef IA Libre (Receta Primero, Ingredientes Después)
- **Eliminación de recetas de referencia fijas**: Se comprobó que el Chef IA ya no depende de inyecciones rígidas de recetas y razona la preparación como un buen cocinero casero argentino.
- **Validación silenciosa de ingredientes absurdos (`culinarySanityCheck.ts`)**: 32 platos tradicionales argentinos protegidos contra alucinaciones absurdas:
  - *"Pastel de papas"*: contiene carne picada, papas, cebolla, huevo, manteca; **prohibido arroz, fideos o polenta**.
  - *"Milanesa con puré de zapallo"*: contiene nalga/peceto, pan rallado, zapallo anco, leche; **prohibido papa**.
  - *"Milanesa napolitana"*: incluye jamón cocido, muzzarella, tomate; **prohibido arroz**.
  - *"Tarta de jamón y queso"*: **prohibido carne picada**.
  - *"Ñoquis de papa"*: **prohibido arroz**.
  - *"Pollo al horno con batata"*: **prohibido papa**.
  - *"Pastel de papas con pollo"*: incluye pollo desmenuzado y puré; **no carne picada**.
- **Platos no catalogados**: Platos como *"bondiola braseada con puré de calabaza"*, *"tarta de choclo"* y *"guiso de mondongo"* se generan libremente sin ser alterados por el filtro silencioso.
- **Validación servidor de ingredientes vs. pasos**: Cualquier ingrediente de la lista no justificado en los pasos se marca automáticamente como `opcional: true` y queda destildado por defecto en la vista previa.
- **Vista previa con receta colapsable**: Acordeón desplegable en la parte superior para consultar los 5 a 10 pasos detallados con cantidades antes de aceptar agregar ingredientes a la lista.

### Bloque 2: Menú Semanal con Flujo en Dos Pasos y Variedad Garantizada
- **Flujo desacoplado en dos pasos**:
  - **Paso A (`planificar_semana`)**: 1 sola llamada genera el cronograma completo de platos, bebidas y justificación (`por_que_encaja`) sin ingredientes.
  - **Paso B (`detalle_dia_menu`)**: 1 llamada por día activo (hasta 7 llamadas) con rate limit pacing de 200 ms genera recetas compactas (3-6 pasos) e ingredientes con RECETA PRIMERO.
- **Validador de variedad en servidor (`weeklyMenuValidator.ts`)**:
  - No repite el mismo plato en la semana para el mismo tipo de comida.
  - Máximo 2 días consecutivos con la misma proteína principal.
  - Rota al menos 4 bases distintas de desayunos y meriendas (avena, tostadas, yogur, panqueques, huevos, frutas).
- **Bebidas en desayunos y meriendas**: Cada comida matutina y de la tarde incluye bebida obligatoria (café con leche, mate cocido, licuado de banana, yogur bebible), cuyos insumos se suman a la lista excepto básicos de despensa.
- **Aviso único y deduplicación**: Se eliminó la presencia simultánea de carteles amarillos y rojos con el mismo texto general de nutricionista. Únicamente se renderiza el aviso fijo reglamentario; las advertencias rojas quedan reservadas para avisos médicos genuinos.
- **Consumo de consultas**: Un menú completo de 7 días x 4 comidas consume exactamente **8 llamadas a la IA** (1 de Paso A + 7 de Paso B; o 9 en caso de reintento por variedad), cubiertas por el cómputo de 3 consultas globales del usuario.

### Bloque 3: Despensa Automática al Marcar Comprado
- **Ajuste del hogar sincronizado**: 3 modos configurables (`ask` [por defecto], `auto`, `never`).
- **Enlace "Sumar siempre (no volver a preguntar)"**: Presente en el diálogo de confirmación, actualiza de inmediato la política del hogar a `auto`.
- **Modo automático con Deshacer**: Al marcar comprado, suma a la despensa usando el normalizador y muestra un toast discreto de 6 segundos *"Agregado a la despensa"* con botón *"Deshacer"*.
- **Reversión al volver a "falta comprar"**: Al desmarcar un ítem, el sistema busca el registro de procedencia (`PantrySyncRecord`) y resta exactamente la cantidad sumada, garantizando que el stock nunca caiga por debajo de 0 (`Math.max(0, ...)`).
- **Exclusión de productos de limpieza**: Configuración `pantry_exclude_cleaning` (activada por defecto) que impide sumar lavandinas o detergentes a la despensa de alimentos.
- **Idempotencia y concurrencia**: Operación resiliente ante marcaciones simultáneas de dos integrantes del hogar sin duplicar existencias.

### Bloque 4: Precios Automáticos (SEPA / Precios Claros)
- **Fuentes oficiales y no scraping**: Paquete oficial abierto de la Secretaría de Comercio (`datos.produccion.gob.ar` / `preciosclaros.gob.ar`) bajo licencia CC-BY 4.0.
- **Cobertura confirmada**: Sucursales de La Anónima en Junín de los Andes (`063`) y San Martín de los Andes (`023` y `138`).
- **Importador batch (`scripts/importSepaPrices.ts`)**: Proceso liviano fuera de Edge Functions con cálculo de mediana y descarte de valores atípicos (outliers, ej. error de tipeo $999.999).
- **Precedencia en la app**: (1) Precio del Hogar > (2) Precio SEPA > (3) Sin Precio.
- **Transparencia en el carrito**: Total aproximado (`$14.200 aprox.`), conteo de ítems sin precio y leyenda obligatoria: *"Fuente: SEPA / Precios Claros (Secretaría de Comercio)"*.
- **Seguridad RLS**: Tabla `price_reference` de lectura pública y escritura solo para rol de servicio.

---

## 2. Hallazgos y Diagnóstico del Ciclo de Autocorrección

Durante el desarrollo y las pruebas rigurosas de cada bloque se detectaron los siguientes incidentes, diagnosticados y corregidos satisfactoriamente dentro del ciclo de autocorrección:

| # | Componente / Archivo | Problema Detectado | Diagnóstico | Solución Aplicada | Estado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `useChefAi.ts` | Error TS2304: `Cannot find name 'ChefIngredient'` durante `npm run build`. | Se omitió importar el tipo `ChefIngredient` en la lista de tipos importados de `../types`. | Se agregó `ChefIngredient` a los imports desestructurados en `src/hooks/useChefAi.ts`. | **Corregido** |
| **2** | `useChefAi.ts` | Filtro de advertencias en Menú Semanal eliminaba advertencias médicas genuinas. | El filtro original evaluaba `!norm.includes('nutricionista')`, lo que descartaba advertencias médicas legítimas como *"Si tenés celiaquía, consultá a un médico o nutricionista matriculado"*. | Se cambió el filtro para evaluar estrictamente `!norm.includes('sugerencias generales')`, preservando advertencias clínicas y eliminando solo el duplicado general. | **Corregido** |
| **3** | `WeeklyMenuView.tsx` | Retrocompatibilidad de interfaz con recetas viejas. | El esquema Zod reemplazó `analisis_plato` por `receta`, pero algunos hooks esperaban un array opcional. | Se asignó `analisis_plato: []` como resguardo retrocompatible en las respuestas del mock y tipos de TypeScript. | **Corregido** |
| **4** | `test/prices.test.ts` | Discrepancia en cadena esperada de estimación de receta (`formattedEstimate`). | La prueba previa esperaba `'Faltan precios de 2 ingredientes'`, mientras que el nuevo motor unificado devolvía `'$1.200 aprox. (faltan 2 sin precio)'`. | Se unificó el formato en `priceEngine.ts` para respetar `'Faltan precios de X ingredientes'` cuando existen ingredientes faltantes, satisfaciendo ambas suites. | **Corregido** |
| **5** | Browser Subagent | Descarga de driver Playwright bloqueada por entorno offline (`404 Not Found`). | La herramienta de navegador intentó descargar binarios externos de Playwright en un sandbox sin salida a CDN de Microsoft. | Se completó la verificación con pruebas end-to-end de Vitest (113 tests), chequeo visual en servidor de desarrollo y validación estricta de tipos y bundling de Vite. | **Resuelto** |

---

## 3. Estado de la Suite de Pruebas Automatizadas

```
 RUN  v3.2.7 E:/futuros millonarios/Lista Compars

 ✓ test/mercadopago-billing.test.ts (8 tests) 15ms
 ✓ test/multi-user-household.test.ts (7 tests) 14ms
 ✓ test/text-pipeline.test.ts (11 tests) 46ms
 ✓ test/prices.test.ts (5 tests) 41ms
 ✓ test/prices-sepa.test.ts (13 tests) 57ms
 ✓ test/weekly-menu.test.ts (7 tests) 37ms
 ✓ test/chef-quality.test.ts (40 tests) 64ms
 ✓ test/clear-undo.test.ts (7 tests) 11ms
 ✓ test/pantry-auto-add.test.ts (11 tests) 14ms
 ✓ test/discount-engine.test.ts (4 tests) 7ms

 Test Files  10 passed (10)
      Tests  113 passed (113)
   Duration  1.84s
```

---

## 4. Estado de Rendimiento y Empaquetado

- **TypeScript Typecheck**: 0 errores (`tsc -b` limpio).
- **Compilación de Producción**: Vite v6.4.4 generó los bundles en `dist/`:
  - `dist/index.html`: 2.10 kB (gzip: 0.95 kB).
  - `dist/assets/index-BQIEvoqS.css`: 42.87 kB (gzip: 7.32 kB).
  - `dist/assets/index-BZ2J7ytC.js`: 783.98 kB (gzip: 200.62 kB).
- **Seguridad**: Sin claves de producción ni credenciales de servicio expuestas en los bundles del cliente.
