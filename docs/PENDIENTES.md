# Registro de Pendientes y Diagnósticos (docs/PENDIENTES.md)

Este documento registra el estado de inicio de cada bloque, problemas identificados, diagnósticos, intentos de corrección y cualquier elemento pendiente para revisión.

---

## Estado Inicial (Bloque 0 - Ronda 2+3)
- **Fecha**: 08/10/2026
- **Línea de base de pruebas**: 26 / 26 tests aprobados en Vitest (`test/chef-quality.test.ts` y `test/discount-engine.test.ts`).
- **Línea de base de build**: Vite v6.4.4 compila sin errores en producción (`tsc -b && vite build`).
- **Problemas iniciales identificados a resolver en Ronda 2+3**:
  1. **Mercado Pago (Crítico - Bloque 1)**: El modal de Mercado Pago en cliente activaba el plan Pro localmente de forma simulada (`activatePremium()`), sin esperar webhook del servidor ni verificar firma criptográfica `x-signature` ni idempotencia.
  2. **Chef IA - Fidelidad al plato (Bloque 3)**: Al pedir "milanesa con puré de zapallo" el chef agregaba papa por inercia cultural. Falta incorporar la sección FIDELIDAD AL PLATO y el campo previo de razonamiento `analisis_plato`.
  3. **Texto a mano y categorización (Bloque 4)**: Carencia de catálogo exhaustivo local (se necesitan >=600 ítems) para autocompletar categorías y autocorregir sinónimos y faltas ortográficas rioplatenses sin obligar a llamar a la IA en cada palabra.
  4. **Vaciado seguro (Bloque 5)**: Faltan botones protegidos para vaciar lista y despensa con opción de deshacer de 10 segundos.
  5. **Menú semanal extendido (Bloque 6)**: Soporte de perfiles/objetivos, desglose por comidas y generación en paralelo respetando cuota de IA.
---

## Estado Inicial (Ronda 4)
- **Fecha**: 11/10/2026
- **Línea de base de pruebas**: 79 / 79 tests aprobados en Vitest (`8 test files passed`).
- **Línea de base de build**: Vite v6.4.4 compila sin errores en producción (`tsc -b && vite build` -> 0 errores).
- **Objetivos y problemas a resolver en Ronda 4**:
  1. **Bloque 1 (Chef IA Libre)**: La IA debe generar la receta libremente (sin inyección de recetarios de referencia) en formato "RECETA PRIMERO (5 a 10 pasos detallados con cantidades dentro del texto), INGREDIENTES DESPUÉS (extraídos estrictamente de los pasos)". Reemplaza `analisis_plato`. Validación silenciosa de ~30 platos contra ingredientes absurdos (ej: arroz o fideos en pastel de papas). Validación server de ingredientes vs texto de pasos (opcional si no figura en pasos). Parámetros Gemini actualizados (GEMINI_MODEL_CHEF Flash y GEMINI_MODEL_FAST Flash-Lite de lista oficial vigente, temp 0.3-0.4, reasoning/thinking explorado). Vista previa con receta colapsable sobre ingredientes. Pruebas de regresión culinaria y reporte.
  2. **Bloque 2 (Menú Semanal en dos pasos)**: Paso A ("planificar_semana") devuelve sólo plan (día, tipo, plato, bebida, por_que_encaja). Validador de variedad en servidor (no repetir platos en semana, no >2 días seguidos misma proteína, rotar >=4 bases desayuno/merienda). Paso B con detalle de ingredientes por día (máx 7 llamadas). Bebida variada en desayuno y merienda. Cartel único de sugerencia general (eliminar duplicación de cartel amarillo y rojo). Pruebas de variedad y métrica de llamadas a IA.
  3. **Bloque 3 (Despensa automática al marcar comprado)**: Ajuste de hogar "Al marcar como comprado": Preguntar / Sumar automáticamente / No sumar. Modo automático con reversión al desmarcar y toast "Agregado a la despensa" con Deshacer. Exclusión por defecto de categoría limpieza. Soporte offline e idempotencia.
  4. **Bloque 4 (Precios automáticos SEPA / Precios Claros)**: Estudio y verificación de datos abiertos oficiales SEPA. Cobertura Junín de los Andes / Neuquén. Script importador batch local / tarea periódica con cálculo de mediana descartando valores atípicos. Tabla `price_reference` con RLS. Precedencia: hogar > SEPA > sin precio. Total aprox. y atribución oficial obligatoria visible.
  5. **Bloque 5 (Revisión Final QA)**: Recorrido integral mobile (390x844) y desktop. Verificación de consola y red. Reportes `docs/QA-REPORT-R4.md` y `docs/RONDA4.md`. Actualización de skill, SETUP.md y task.md.

