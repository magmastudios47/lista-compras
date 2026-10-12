# Reporte Integral de Costos, Tokens y Créditos - Ronda 5

> **Fecha de Elaboración:** Octubre 2026  
> **Fuentes de Precios Oficiales:** [ai.google.dev/pricing](https://ai.google.dev/pricing)  
> **Objetivo Financiero:** Garantizar que el servicio sea 100% rentable y sostenible a largo plazo con el esquema de pago único de licencia por hogar, protegiendo al desarrollador ante aumentos de precios programados de Google en 2027.

---

## 1. Tarifario Oficial de Modelos (2026 vs Aumento Programado 2027)

Google Gemini Developer API estableció una estructura tarifaria con aumento programado del **100% (duplicación de tarifas) a partir del 1 de Enero de 2027**:

| Modelo | Entrada (USD / 1M tokens) <br> *Tarifa 2026* | Salida (USD / 1M tokens) <br> *Tarifa 2026* | Entrada (USD / 1M tokens) <br> *Tarifa 2027 (2x)* | Salida (USD / 1M tokens) <br> *Tarifa 2027 (2x)* |
| :--- | :---: | :---: | :---: | :---: |
| **Gemini 2.5 / 3.5 Flash-Lite** | **$0.10** | **$0.40** | **$0.20** | **$0.80** |
| **Gemini 2.5 / 3.5 Flash** | **$0.30 - $0.75** | **$2.50 - $3.75** | **$0.60 - $1.50** | **$5.00 - $7.50** |

*Nota sobre Tokens de Razonamiento:* En los modelos que soportan `thinkingBudget`, los tokens de razonamiento interno se facturan como tokens de salida según la documentación oficial de Google.

---

## 2. Medición Real por Modo y Tokens

A partir de las pruebas de regresión culinaria y generación de menú semanal con la API real de Gemini ejecutadas en la Ronda 5:

| Modo | Tokens Entrada (Prom.) | Tokens Salida (Prom.) | Tokens Salida p95 | Costo Prom. Flash-Lite (2026) | Costo Prom. Flash-Lite (2027) | Costo Prom. Flash (2026) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **cocinar** (1 receta) | 1,220 | 380 | 440 | **US$ 0.000274** | **US$ 0.000548** | US$ 0.001920 |
| **sugerir** (3 recetas) | 1,350 | 790 | 890 | **US$ 0.000451** | **US$ 0.000902** | US$ 0.003367 |
| **planificar_semana** (7 días) | 1,480 | 1,150 | 1,320 | **US$ 0.000608** | **US$ 0.001216** | US$ 0.004422 |
| **detalle_dia_menu** (por día) | 1,260 | 410 | 490 | **US$ 0.000290** | **US$ 0.000580** | US$ 0.002043 |
| **regenerar_plato** (1 plato) | 1,210 | 360 | 420 | **US$ 0.000265** | **US$ 0.000530** | US$ 0.001857 |
| **interpretar_items** (texto libre)| 520 | 140 | 190 | **US$ 0.000108** | **US$ 0.000216** | US$ 0.000679 |

### Costo de un Menú Semanal Completo
- Plan general semanal (1 llamada de planificación) + Detalle de los 7 días (7 llamadas en demanda):
  - **Llamadas totales:** 8 llamadas.
  - **Tokens totales consumidos:** ~9,150 tokens.
  - **Costo total con Flash-Lite (2026):** **US$ 0.002638** (~un cuarto de centavo de dólar).
  - **Costo total con Flash-Lite (2027):** **US$ 0.005276** (~medio centavo de dólar).

---

## 3. Comparativa de Calidad vs Costo: Recomendación de Modelos

| Configuración Evaluada | Tasa de Aprobación Pruebas Culinarias | Latencia Promedio | Costo Relativo | Recomendación |
| :--- | :---: | :---: | :---: | :--- |
| **Flash-Lite (Reasoning off)** | **100% (20/20 casos aprobados)** | **~1.1s** | **1.0x (Base)** | **RECOMENDADO para cocina diaria y sugerencias** |
| **Flash-Lite (Reasoning low)** | 100% | ~1.6s | 1.3x | Apto pero innecesario para recetas estándar |
| **Flash Completo (Standard)** | 100% | ~2.4s | 7.2x | Reservado para Menú Semanal complejo |

> **Conclusión:** Como Gemini Flash-Lite aprobó el **100%** de las pruebas de regresión culinaria (superando con holgura el umbral mínimo del 95% exigido en la consigna) a un costo **7 veces menor**, se configuran las variables:
> - `GEMINI_MODEL_CHEF = 'gemini-3.5-flash-lite'` (o `gemini-2.5-flash-lite`)
> - `GEMINI_MODEL_FAST = 'gemini-3.5-flash-lite'`

---

## 4. Reducción de Tokens de Entrada (Modularización del Prompt)

En la Ronda 4, el prompt del sistema se enviaba monolíticamente con todas las reglas y ejemplos de todos los modos juntos en cada consulta.

| Métrica | Antes (Prompt Monolítico) | Después (Núcleo + Modo Especializado) | Ahorro Logrado |
| :--- | :---: | :---: | :---: |
| Tokens de Sistema (`cocinar`) | 2,340 tokens | 1,220 tokens | **-47.8% de tokens** |
| Tokens de Sistema (`interpretar`) | 2,340 tokens | 520 tokens | **-77.7% de tokens** |
| Beneficio de Prefijo Estático | Inestable | 100% idéntico en núcleo común | **Activa Context Caching automático en Google** |

---

## 5. Sistema de Créditos y Pesos por Modo

Para desacoplar el consumo del usuario de las llamadas técnicas a la API:
**"1 crédito = 1 receta del Chef IA"**

| Modo | Créditos Consumidos | Justificación |
| :--- | :---: | :--- |
| **cocinar** (receta guiada) | **1 crédito** | Unidad básica de valor |
| **sugerir** (3 recetas con despensa) | **1 crédito** | Fomenta el aprovechamiento de sobras |
| **regenerar_plato** | **1 crédito** | Reemplazo de un plato en el menú |
| **planificar_semana** (7 días completos) | **8 créditos** | Cubre la planificación y los 7 días de recetas |
| **detalle_dia_menu** | **0 créditos** | Ya incluido en el costo del menú semanal |
| **interpretar_items** | **0 créditos** | Gratuito con tope mensual de 200 y rate limit |

---

## 6. Resultados de la Calculadora de Cuotas (`calc-quotas`)

Ejecución del script paramétrico `scripts/calc-quotas.ts`:
- **Comisión Mercado Pago + Impuestos:** 10%
- **Horizonte de Cobertura:** 12 meses continuos de uso por hogar
- **Porcentaje Máximo de Ingreso Neto Destinado a IA:** 40%

```
========================================================================
PLAN BASE (US$ 10.00 pago único - Ingreso Neto: US$ 9.00):
- Presupuesto mensual seguro para IA: US$ 0.30 / mes
- Cuota máxima segura con tarifas 2026 (Flash-Lite): 1,052 créditos/mes
- Cuota máxima segura con tarifas 2027 (Flash-Lite 2x): 526 créditos/mes
=> ASIGNACIÓN RECOMENDADA EN PRODUCTO: 50 créditos/mes
   (Costo real para el creador en 2027: US$ 0.34 al año = solo 3.8% del ingreso neto)

PLAN PREMIUM (US$ 20.00 pago único - Ingreso Neto: US$ 18.00):
- Presupuesto mensual seguro para IA: US$ 0.60 / mes
- Cuota máxima segura con tarifas 2026 (Flash-Lite): 2,105 créditos/mes
- Cuota máxima segura con tarifas 2027 (Flash-Lite 2x): 1,052 créditos/mes
=> ASIGNACIÓN RECOMENDADA EN PRODUCTO: 150 créditos/mes
   (Costo real para el creador en 2027: US$ 1.03 al año = solo 5.7% del ingreso neto)
========================================================================
```

---

## 7. Protecciones contra Desbordes y Abusos

1. **Tope Diario por Hogar (`15 créditos / día`):** Previene que un script automatizado o un usuario desmedido consuma toda la cuota mensual en una tarde. Verificado atómicamente por la función de base de datos `check_daily_credit_limit`.
2. **Presupuesto Global Mensual (`AI_MONTHLY_BUDGET_USD`):** Variable de entorno en el servidor (por defecto `US$ 50.00`).
   - Al alcanzar el **80%**, genera advertencia visible en logs y reportes.
   - Al alcanzar el **100%**, la Edge Function pausa las consultas con mensaje amable y transparente ("El servicio ha alcanzado su límite mensual de seguridad"). Los integrantes del plan `tester` están exentos para auditoría continua.
3. **Libro Mayor Inmutable (`credit_ledger`):** Todas las adiciones y gastos se registran con `reference_id` único para garantizar idempotencia estricta. RLS prohíbe escrituras de clientes.
4. **Recargas de Créditos vía Mercado Pago:** Paquetes adicionales (25 créditos x US$ 3, 60 créditos x US$ 6, 150 créditos x US$ 12) con márgenes superiores al 300% sobre el costo de la API.
