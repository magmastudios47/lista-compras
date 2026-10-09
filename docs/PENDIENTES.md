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
  6. **Precios (Bloque 7)**: Estimación de costos y análisis de la viabilidad de la base SEPA / Precios Claros.
  7. **Hogares y RLS (Bloque 8)**: Pruebas con múltiples usuarios simulados para garantizar aislamiento estricto de hogares en Supabase.
