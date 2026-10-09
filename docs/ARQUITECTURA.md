# Arquitectura del Sistema: Lista Compars (PWA)

## 1. Visión General del Sistema

**Lista Compars** es una PWA (Progressive Web Application) mobile-first diseñada específicamente para hogares de Argentina (con foco regional inicial en la Patagonia andina, Junín de los Andes). Su propósito es sincronizar listas de compras en tiempo real entre convivientes, potenciada por un **Chef IA** que convierte ideas de comida y existencias de la despensa en ingredientes indispensables, calculando de forma determinista únicamente los faltantes.

```
                    ┌────────────────────────────────────────┐
                    │      Cliente PWA (React + Vite)        │
                    │   - Service Worker (Cache First/SWR)   │
                    │   - Offline Queue (IndexedDB/LWW)      │
                    │   - Realtime Subscriptions             │
                    └───────┬────────────────────────┬───────┘
                            │                        │
               Supabase SDK │ (Auth/DB/Realtime)     │ Edge Function / Direct
                            ▼                        ▼
        ┌─────────────────────────────┐   ┌─────────────────────────────┐
        │       Supabase Cloud        │   │    Edge Functions (Deno)    │
        │ - Postgres + RLS            │   │  - chef-ai                  │
        │ - Auth (Magic Link, Google) │◄──┤    • Gemini Flash-Lite      │
        │ - Realtime Broadcast/CDC    │   │    • Rate Limit (5 req/min) │
        │ - Database Webhooks         │   │    • Cuota Mensual (40/mes) │
        └─────────────────────────────┘   │    • Cache & Descuento Det. │
                                          │  - mercadopago-webhook      │
                                          │  - push-notify              │
                                          └──────────────┬──────────────┘
                                                         │
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │ Servicios Externos:         │
                                          │ - Google Gemini API         │
                                          │ - Mercado Pago API          │
                                          │ - Web Push Service (VAPID)  │
                                          └─────────────────────────────┘
```

---

## 2. Estructura del Proyecto

```
/
├── .agents/
│   └── skills/
│       └── chef-ia/
│           └── SKILL.md                 # Skill del proyecto con prompts y esquemas
├── docs/
│   ├── ARQUITECTURA.md                  # Este documento
│   ├── DECISIONES.md                    # Registro de decisiones de diseño
│   └── chef-quality-report.md           # Informe de pruebas de calidad del Chef IA
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── gemini.ts               # Abstracción cliente Gemini con backoff
│   │   │   ├── schemas.ts              # Esquemas Zod compartidos
│   │   │   ├── normalizer.ts           # Normalización de texto rioplatense
│   │   │   └── discount-engine.ts      # Aritmética determinista de despensa
│   │   ├── chef-ai/
│   │   │   ├── index.ts                # Handler Edge Function del Chef
│   │   │   └── system-prompt.ts        # Prompt del sistema del Chef Rioplatense
│   │   ├── mercadopago-webhook/
│   │   │   └── index.ts                # Procesamiento de pagos de por vida
│   │   └── push-notify/
│   │       └── index.ts                # Envío de notificaciones Web Push
│   └── migrations/
│       └── 20261007_init.sql           # DDL completo con RLS y triggers
├── public/
│   ├── manifest.json                   # Web App Manifest PWA
│   ├── sw.js                           # Service Worker para offline y push
│   ├── favicon.ico
│   └── icons/                          # Iconos PWA 192x192, 512x512, maskable
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── chef/                       # Modales Cocinar, Sugerir, Interpretar
│   │   ├── common/                     # Botones, Badges, Modales, Drawer
│   │   ├── layout/                     # Header, Bottom Nav, Offline Bar
│   │   ├── pantry/                     # Vista y gestor de despensa
│   │   ├── pwa/                        # Install Prompt iOS & Android
│   │   └── shopping/                   # Lista agrupada por categorías, ítems
│   ├── context/
│   │   ├── AuthContext.tsx             # Estado de autenticación
│   │   ├── HouseholdContext.tsx        # Hogar activo, miembros, invitaciones
│   │   └── OfflineSyncContext.tsx      # Gestión de cola offline y conexión
│   ├── hooks/
│   │   ├── useChefAi.ts                # Hook para invocar el Chef con caché local
│   │   ├── usePantry.ts                # Hook de despensa
│   │   └── useShoppingList.ts          # Hook de lista de compras con realtime
│   ├── lib/
│   │   ├── constants.ts                # Categorías argentinas, unidades, límites
│   │   ├── discountEngine.ts           # Motor determinista duplicado en cliente
│   │   ├── normalizer.ts               # Normalización singular y minúsculas
│   │   ├── offlineStorage.ts           # IndexedDB / localStorage helper
│   │   ├── pushManager.ts              # Suscripción VAPID
│   │   └── supabaseClient.ts           # Cliente Supabase con fallback a mock
│   ├── types/
│   │   └── index.ts                    # Tipos TypeScript integrales
│   ├── App.tsx                         # Componente raíz con rutas y tabs
│   ├── main.tsx                        # Punto de entrada
│   └── index.css                       # Tailwind CSS y tokens de diseño
├── test/
│   ├── chef-quality.test.ts            # Script de pruebas con los 20 casos
│   └── discount-engine.test.ts         # Pruebas unitarias de descuento de despensa
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env.example
├── task.md
└── SETUP.md
```

---

## 3. Modelo de Datos Relacional (Postgres + Supabase)

### 3.1 Entidades Principales
1. **households**: Hogares (núcleo de aislamiento de datos).
2. **household_members**: Vinculación usuario-hogar con roles (`admin`, `member`) y nombre visible.
3. **shopping_items**: Productos de la lista de compras (`is_bought`, categoría, unidad, cantidad, precio estimado opcional).
4. **pantry_items**: Despensa del hogar ("Ya tengo en casa") con cantidades y unidades opcionales.
5. **ai_usage_log**: Auditoría de consumo del Chef IA (modo, tokens, si usó caché, timestamps).
6. **ai_cache**: Respuestas cacheadas por hash de entrada para ahorrar tokens y responder en milisegundos.
7. **household_licenses**: Estado de suscripción/pago único de Mercado Pago y cuota mensual configurada.
8. **push_subscriptions**: Credenciales Web Push por usuario y hogar para notificaciones de compras/cambios.

### 3.2 Esquema de Seguridad (Row Level Security - RLS)
- Ninguna tabla expone datos públicamente.
- Todos los accesos se validan con la función `user_belongs_to_household(household_id)`.
- Solo los miembros de un hogar pueden leer, insertar, actualizar o eliminar ítems de su propio hogar.

---

## 4. Motor de Descuento Determinista de Despensa

La IA no realiza cálculos matemáticos de descuento de inventario, pues los LLMs pueden alucinar cantidades.
El proceso se divide en:
1. **IA**: Identifica los ingredientes necesarios y busca si existe un ítem en la despensa con nombre afín (`item_despensa_coincidente`).
2. **Backend Determinista**:
   - Normaliza nombres con `normalizer.ts` (quita acentos, convierte a minúsculas y singular).
   - Comprueba compatibilidad de unidades:
     - Masa: `g` y `kg` (factor de conversión 1000).
     - Volumen: `ml` y `l` (factor de conversión 1000).
     - Discretos: `unidad`, `diente`, `atado`, `lata`, `paquete` (deben coincidir en unidad).
   - Si la despensa tiene cantidad indefinida (ej. "tengo azúcar" sin número), se avisa en la vista previa y se sugiere no comprar o marcar como básico.
   - Si la cantidad en despensa >= cantidad requerida: el ítem se marca como `100% cubierto` ("Ya lo tenés").
   - Si la cantidad en despensa < cantidad requerida: se calcula el faltante exacto:
     $$\text{Faltante} = \text{Requerido} - \text{Disponible}$$
     y se agrega a la lista de compra solo el delta faltante.
   - Si el ítem ya existía en la lista de compras, se unifica sumando la cantidad requerida.

---

## 5. Arquitectura Offline y Sincronización

1. **Service Worker (`sw.js`)**:
   - Cachea todos los assets estáticos (HTML, JS, CSS, iconos) con estrategia *Stale-While-Revalidate*.
2. **Storage Local (`IndexedDB / localStorage`)**:
   - Mantiene una copia local de la lista del hogar activo.
3. **Cola de Mutaciones (`mutation_queue`)**:
   - Cada acción del usuario (agregar, editar, tachar, borrar) se aplica de inmediato al estado local (Optimistic UI) y se encola.
   - Al detectar reconexión (`window.addEventListener('online')`), la cola se procesa secuencialmente contra Supabase.
   - **Resolución de Conflictos**: Last-Write-Wins (LWW) comparando `updated_at`. Si el servidor tiene una versión posterior a la fecha local, se actualiza la versión del servidor.

---

## 6. Integración de Pagos con Mercado Pago

- **Modelo**: Pago único por hogar para licencia "De por vida" (Lifetime).
- **Precio**: Definido en USD (ej. USD 4.99 o USD 9.99) y liquidado en pesos argentinos (ARS) al tipo de cambio de referencia.
- **Flujo**:
  1. Frontend solicita creación de preferencia a la Edge Function `mercadopago-webhook`.
  2. Edge Function consulta tasa de cambio, crea la preferencia en Mercado Pago con webhook url.
  3. Al confirmarse el pago mediante IPN / Webhook, el backend actualiza `household_licenses` pasando `plan_type = 'lifetime_premium'` y elevando la cuota mensual a 9999 consultas.
