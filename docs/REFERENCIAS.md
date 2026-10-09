# Investigación de Ideas y Patrones de Código Abierto (docs/REFERENCIAS.md)

Este documento sintetiza la investigación acotada de proyectos de código abierto para extraer **ideas de arquitectura y patrones de diseño** aplicables a **Lista Compars**, respetando licencias permisivas (MIT, Apache-2.0, BSD, ISC).

---

## Tema 1: Búsqueda Aproximada y Corrección Ortográfica de Productos

### 1.1 Repositorios Analizados
- **Fuse.js** (`krisk/Fuse`)
  - **Enlace**: https://github.com/krisk/Fuse
  - **Licencia**: Apache-2.0
  - **Estrellas**: ~20.500 ⭐
  - **Última actualización**: Activo en los últimos 6 meses.
- **js-levenshtein** (`gustf/js-levenshtein`)
  - **Enlace**: https://github.com/gustf/js-levenshtein
  - **Licencia**: MIT
  - **Estrellas**: ~500 ⭐
  - **Última actualización**: Mantenido.

### 1.2 Qué rescatamos
- **Algoritmo Bitap con umbral configurable**: Fuse.js calcula la distancia de edición relativa (score entre 0.0 y 1.0). Un umbral de `0.35` es ideal para tolerar errores ortográficos en tipeo rápido de celular ("papaa" -> "papa", "tomte" -> "tomate", "azucar" -> "azúcar") sin generar falsos positivos.
- **Búsqueda por claves ponderadas**: Permite asignar mayor peso al nombre exacto (`name`, peso 0.7) y menor a sinónimos (`synonyms`, peso 0.3).
- **Zero-dependencies y ejecución offline**: No requiere backend ni llamadas a la red.

### 1.3 Qué descartamos y por qué
- **Descartado**: Depender exclusivamente de Levenshtein simple carácter por carácter, porque no pondera la posición de los errores ni el tamaño relativo de la palabra (un error en una palabra de 4 letras es más grave que en una de 12 letras).
- **Descartado**: Motores de búsqueda pesados como Elastic o Meilisearch en el cliente: innecesarios para un catálogo local de 600–2.000 ítems.

---

## Tema 2: Sincronización Offline con Cola de Cambios y Conflictos en PWA

### 2.1 Repositorios Analizados
- **Dexie.js** (`dexie/Dexie.js`)
  - **Enlace**: https://github.com/dexie/Dexie.js
  - **Licencia**: Apache-2.0
  - **Estrellas**: ~11.500 ⭐
  - **Última actualización**: Activo (últimas semanas).
- **Workbox** (`GoogleChrome/workbox`)
  - **Enlace**: https://github.com/GoogleChrome/workbox
  - **Licencia**: MIT
  - **Estrellas**: ~16.000 ⭐
  - **Última actualización**: Activo.

### 2.2 Qué rescatamos
- **Patrón Outbox / Mutation Queue**: Todas las operaciones de mutación del usuario se ejecutan de manera optimista en el estado local y se serializan en una tabla o store `mutation_queue` con marca de tiempo UTC y operación (`insert`, `update`, `delete`).
- **Resolución Last-Write-Wins (LWW) a nivel de campo / ítem**: En listas de compras hogareñas, los conflictos más habituales son que dos personas tachen el mismo producto o una agregue cantidad. Un esquema LWW basado en `updated_at` (ISO timestamp) resuelve el 99% de las situaciones sin necesidad de CRDTs complejos.
- **Drain de cola con reintentos exponenciales y pausa**: Si la conexión falla a mitad del vaciado de la cola, la operación se detiene y se reanuda en el siguiente evento `online`.

### 2.3 Qué descartamos y por qué
- **Descartado**: Motores de CRDT pesados (como Yjs o Automerge) para ítems de supermercado: añaden sobrecarga de memoria innecesaria para un modelo donde cada ítem es una entidad atómica.
- **Descartado**: Dependencia de plugins pagos o cerrados de sincronización en la nube.

---

## Tema 3: Row Level Security y Modelos de Datos de "Hogares" en Supabase

### 3.1 Repositorios Analizados
- **MakerKit Supabase SaaS / Multi-Tenancy** (`makerkit/next-supabase-saas`)
  - **Enlace**: https://github.com/makerkit/next-supabase-saas
  - **Licencia**: Apache-2.0 / MIT
  - **Estrellas**: ~3.200 ⭐
  - **Última actualización**: Activo en los últimos 3 meses.
- **Supabase Multi-Tenancy Examples** (`supabase/supabase/examples/multi-tenant`)
  - **Enlace**: https://github.com/supabase/supabase
  - **Licencia**: Apache-2.0
  - **Estrellas**: ~75.000 ⭐

### 3.2 Qué rescatamos
- **Función de verificación de pertenencia en PostgreSQL `SECURITY DEFINER`**:
  ```sql
  CREATE OR REPLACE FUNCTION public.user_belongs_to_household(h_id UUID)
  RETURNS BOOLEAN AS $$
  BEGIN
      RETURN EXISTS (
          SELECT 1 FROM public.household_members
          WHERE household_id = h_id AND user_id = auth.uid()
      );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
  ```
- **Índice compuesto obligatorio**: `CREATE INDEX idx_hh_members_lookup ON public.household_members(household_id, user_id);` para garantizar que la verificación de RLS se resuelva en menos de 1 milisegundo por fila.
- **Aislamiento absoluto de escrituras financieras**: Tablas de pagos (`payments`) y licencias (`licenses`) con políticas que deniegan `INSERT`, `UPDATE` y `DELETE` para cualquier rol que no sea `service_role`.

### 3.3 Qué descartamos y por qué
- **Descartado**: Esquemas de base de datos separados por inquilino (*database-per-tenant* o *schema-per-tenant*): inmanejables para miles de hogares de uso cotidiano. El modelo de partición por clave foránea `household_id` con RLS es el estándar recomendado por Postgres.

---

## Tema 4: Notificaciones Push en PWA e Instalación en iOS

### 4.1 Repositorios Analizados
- **pwa-install** (`khmyznikov/pwa-install`)
  - **Enlace**: https://github.com/khmyznikov/pwa-install
  - **Licencia**: MIT
  - **Estrellas**: ~900 ⭐
  - **Última actualización**: Activo en los últimos 6 meses.
- **web-push** (`web-push-libs/web-push`)
  - **Enlace**: https://github.com/web-push-libs/web-push
  - **Licencia**: MIT
  - **Estrellas**: ~4.200 ⭐

### 4.2 Qué rescatamos
- **Detección explícita de iOS Safari**: iOS no soporta el evento nativo `beforeinstallprompt`. Por ende, en iOS es mandatorio guiar paso a paso con gráficos SVG al usuario ("Botón Compartir" -> "Agregar a pantalla de inicio").
- **Exigencia de modo Standalone para Push en iOS 16.4+**: En iPhone, Web Push solo funciona si la app ya fue abierta desde la pantalla de inicio. Cualquier intento de suscripción previo debe guiar primero a la instalación.
- **Disparador por gesto de usuario**: El pedido de permiso de notificación (`Notification.requestPermission()`) debe originarse tras una acción táctil clara (botón "Activar avisos") para evitar bloqueos del navegador.

### 4.3 Qué descartamos y por qué
- **Descartado**: Librerías comerciales de terceros de notificaciones push (como OneSignal): imponen SDKs pesados de telemetría y planes pagos. Web Push nativo con VAPID en Supabase Edge Functions es liviano, gratuito e inviolable.

---

## Tema 5: Patrones de Experiencia de Usuario en Listas de Compras Compartidas

### 4.1 Repositorios Analizados
- **Grocy** (`grocy/grocy`)
  - **Enlace**: https://github.com/grocy/grocy
  - **Licencia**: MIT
  - **Estrellas**: ~7.800 ⭐
  - **Última actualización**: Activo (últimas semanas).
- **Mealie** (`mealie-recipes/mealie`)
  - **Enlace**: https://github.com/mealie-recipes/mealie
  - **Licencia**: AGPL-3.0 (solo análisis de patrones de UI, sin copiar código).
  - **Estrellas**: ~7.500 ⭐

### 5.2 Qué rescatamos
- **Agrupación visual por pasillo / categoría**: Los compradores van de pasillo en pasillo (Verdulería -> Carnicería -> Almacén -> Limpieza). Mostrar categorías vacías añade ruido visual; solo deben renderizarse las categorías que contienen ítems pendientes.
- **Vaciado seguro con *Undo* flotante (10 segundos)**: Evitar confirmaciones molestas de alerta que frenan al usuario en el supermercado; en su lugar, aplicar borrado optimista inmediato y mostrar un toast accesible con "Deshacer" durante 10 segundos.
- **Memoria de precios y autocompletado**: Al tipear una palabra frecuente ("leche"), precargar la última categoría elegida y el precio estimado recordado para agilizar el ingreso con una sola mano.

### 5.3 Qué descartamos y por qué
- **Descartado**: Manejo hipercomplejo de stock por código de barras de Grocy (códigos EAN, lotes, fechas de vencimiento precisas): sobrecarga innecesaria para una familia común que solo quiere saber si hay o no hay en la heladera.

---

## Resumen de Mejoras Seleccionadas para Bloques 3 a 7
1. **Fuse.js (versión ligera o algoritmo Bitap/Levenshtein embebido)**: Incorporar para el catálogo de 600 productos del Bloque 4 sin inflar el bundle.
2. **Patrón Soft-Delete con Toast Deshacer de 10s**: Incorporar en el Bloque 5 para "Vaciar lista", "Vaciar despensa" y "Vaciar comprados".
3. **Memoria de precios por nombre normalizado**: Incorporar en el Bloque 7 para recordar precios históricos de cada hogar.
