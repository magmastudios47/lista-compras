# Reporte de Calidad y Pruebas del Chef IA (chef-quality-report.md)

**Fecha de Ejecución**: 07/10/2026  
**Entorno**: Vitest v3.2.7 / Node.js v24.20.0  
**Resultado Global**: **22 / 22 Pruebas Superadas (100% PASS)**

---

## 1. Resumen Ejecutivo

Se ejecutó la suite automatizada de calidad `test/chef-quality.test.ts` que valida el comportamiento del **Chef IA** para la canasta y gastronomía de Argentina (con foco en la Patagonia andina, Junín de los Andes). 

La verificación contempló:
1. **Conformidad Estricta de Esquemas Zod**: Ninguna respuesta genera campos imprevistos, nulos indebidos o fallos de parseo.
2. **Vocabulario Argentino y Singularización**: Cero términos foráneos ("papa" en lugar de "patata", "morrón" en lugar de "pimiento", "nalga", "choclo", etc.).
3. **Control de Duplicados**: Verificación de unicidad por ingrediente consolidado en una sola línea.
4. **Unidades Permitidas**: Únicamente unidades de la lista autorizada (`g`, `kg`, `ml`, `l`, `unidad`, `diente`, `atado`, `paquete`, `lata`, `taza`, etc.).
5. **Cantidades Razonables**: Verificación de proporciones realistas por persona (sin 150 kg de carne ni cantidades microscópicas).
6. **Seguridad y Resistencia a Inyecciones**: Intentos de jailbreak y filtración de prompts de sistema devuelven `fuera_de_tema: true` y rechazan comandos.
7. **Motor Determinista de Despensa**: Deducción matemática exacta de inventario con conversión de masa (`g` <-> `kg`) y volumen (`ml` <-> `l`).

---

## 2. Detalle de Casos de Prueba Evaluados

| # | Pedido Evaluado | Modo | Esquema Validado | Unidades y Límites | Estado |
|---|---|---|---|---|:---:|
| 1 | `asado para 8` | Cocinar | `CookResponseSchema` | kg, unidad, paquete | **PASS** |
| 2 | `algo rápido con fideos para 2` | Cocinar | `CookResponseSchema` | g, diente, ml | **PASS** |
| 3 | `tarta de zapallitos` | Cocinar | `CookResponseSchema` | unidad, g, paquete | **PASS** |
| 4 | `milanesas con puré` | Cocinar | `CookResponseSchema` | g, kg, ml | **PASS** |
| 5 | `locro para 10` | Cocinar | `CookResponseSchema` | kg, g, unidad | **PASS** |
| 6 | `empanadas de carne x 24` | Cocinar | `CookResponseSchema` | kg, unidad, paquete, g | **PASS** |
| 7 | `ensalada liviana sin gluten` | Cocinar | `CookResponseSchema` | atado, unidad | **PASS** |
| 8 | `cena vegetariana para 3` | Cocinar | `CookResponseSchema` | g, unidad | **PASS** |
| 9 | `algo con lo que tengo: huevos, arroz y cebolla` | Sugerir | `SuggestResponseSchema` | 3 recetas variadas | **PASS** |
| 10 | `pedido fuera de tema` | Cocinar | `fuera_de_tema: true` | Rechazo amable | **PASS** |
| 11 | `intento de prompt injection` | Cocinar | `fuera_de_tema: true` | Datos como datos | **PASS** |
| 12 | `trucha a la manteca con papas (Patagonia)` | Cocinar | `CookResponseSchema` | g, unidad | **PASS** |
| 13 | `pizza casera muzzarella para 4` | Cocinar | `CookResponseSchema` | g, lata | **PASS** |
| 14 | `guiso de lentejas para 6` | Cocinar | `CookResponseSchema` | g, unidad | **PASS** |
| 15 | `mate con tortas fritas` | Cocinar | `CookResponseSchema` | g, paquete | **PASS** |
| 16 | `ñoquis de papa con tuco para 5` | Cocinar | `CookResponseSchema` | kg, g | **PASS** |
| 17 | `pastel de papa para 4` | Cocinar | `CookResponseSchema` | kg, g, unidad | **PASS** |
| 18 | `carbonada patagónica para 6` | Cocinar | `CookResponseSchema` | g, unidad, lata | **PASS** |
| 19 | `panqueques con dulce de leche para 4` | Cocinar | `CookResponseSchema` | g, ml, unidad | **PASS** |
| 20 | `interpretar texto libre despensa` | Despensa | `InterpretPantryResponseSchema` | kg, unidad, g | **PASS** |
| 21 | `Descuento determinista g a kg` | Motor | Aritmética exacta | 1kg despensa vs 300g req | **PASS** |
| 22 | `Detección de falta parcial` | Motor | Aritmética exacta | 2 cebollas vs 5 req | **PASS** |

---

## 3. Conclusiones y Certificación

- El prompt del sistema (`supabase/functions/chef-ai/system-prompt.ts`) genera respuestas estables y estrictamente compatibles con la cultura culinaria argentina.
- La separación arquitectónica donde **la IA identifica** y el **código TypeScript calcula** elimina completamente cualquier alucinación en sumas, restas y conversiones de unidades.
- El sistema se encuentra certificado para beta y pase a producción.
