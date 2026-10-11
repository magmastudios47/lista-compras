# Guía de Configuración Paso a Paso: Lista Compars

¡Felicitaciones! **Lista Compars** ya está completamente programada y lista para usar.

> **¡Buenas noticias!** La aplicación ya funciona de inmediato en tu computadora o celular en **Modo Demostración / Simulador** sin necesidad de registrarte en ningún servicio. Podés abrirla, probar el Chef IA, cargar productos y probar el pago simulado.

Cuando quieras conectar tus cuentas reales para compartir la lista en tiempo real entre distintos celulares y teléfonos de tu familia, seguí estos pasos sencillos en orden. Están escritos para que cualquiera pueda seguirlos sin saber programar.

---

## 0. Cómo arrancar la app en tu computadora

1. Abrí una terminal o consola en la carpeta del proyecto.
2. Escribí y ejecutá:
   ```bash
   npm run dev
   ```
3. Abrí en tu navegador: **`http://localhost:3000`** (o la dirección que te muestre en pantalla).

---

## Paso 1: Crear tu Base de Datos en Supabase (Gratis)

Supabase guarda los productos de tu lista y sincroniza los cambios en tiempo real entre los integrantes de la casa.

1. Entrá a [https://supabase.com](https://supabase.com) y tocá **"Start your project"** (iniciá sesión con tu cuenta de Google o GitHub).
2. Tocá **"New Project"**, poné de nombre `Lista Compars` y elegí una contraseña segura para la base de datos.
3. Elegí la región más cercana (por ejemplo, *São Paulo (sa-east-1)*).
4. Cuando el proyecto termine de crearse (tarda 1 minuto):
   - En el menú lateral izquierdo, tocá el ícono de **SQL Editor** (parece una hoja con código).
   - Tocá **"New Query"**.
   - Ejecutá las migraciones en este orden:
     1. `supabase/migrations/20261007_init.sql` (tablas iniciales y RLS)
     2. `supabase/migrations/20261008_billing_and_payments.sql` (pagos y Mercado Pago)
     3. `supabase/migrations/20261009_soft_delete.sql` (vaciado con deshacer)
     4. `supabase/migrations/20261011_ronda4_settings_and_prices.sql` (despensa auto y tabla price_reference)
   - Tocá el botón verde **"Run"** para cada una.
5. Obtené tus claves:
   - Andá al ícono de engranaje **Project Settings** (abajo a la izquierda) -> **API**.
   - Copiá:
     - **Project URL**
     - **anon / public key**
     - **service_role key** (esta es secreta, solo para el servidor e importador de precios).
6. En la carpeta de tu proyecto, creá un archivo llamado `.env` (copiando el contenido de `.env.example`) y pegá tus valores:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
   ```

---

## Paso 2: Obtener tu Clave de Gemini IA (Nivel Gratuito)

Gemini es la inteligencia artificial que le da vida al Chef. Durante la etapa beta, podés usar el nivel 100% gratuito de Google.

1. Entrá a [https://aistudio.google.com/](https://aistudio.google.com/) con tu cuenta de Google.
2. Tocá el botón azul **"Get API key"** (Obtener clave de API).
3. Tocá **"Create API key in new project"**.
4. Copiá la clave generada y pegala en tu archivo `.env`:
   ```env
   GEMINI_API_KEY=AIzaSy...tu_clave_aqui
   GEMINI_MODEL_CHEF=gemini-2.5-flash
   GEMINI_MODEL_FAST=gemini-2.0-flash-lite
   ```
   *(Nota: `GEMINI_MODEL_CHEF` se usa para recetas, sugerencias y menú semanal con pensamiento/razonamiento leve; `GEMINI_MODEL_FAST` se usa para segmentar texto libre y corregir ortografía).*
   *(Nota: Cuando más adelante decidas pasar al nivel pago de Gemini, solo tenés que activar la facturación en tu cuenta de Google Cloud y mantener esta misma clave, sin modificar una sola línea de código).*

---

## Paso 3: Configurar Mercado Pago (Pago Único por Hogar)

Para que los hogares puedan pagar la licencia en pesos argentinos (ARS) mediante Checkout Pro:

1. Entrá a [https://www.mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) e iniciá sesión con tu cuenta de Mercado Pago.
2. Andá a **"Tus integraciones"** -> **"Crear aplicación"**.
3. Poné de nombre `Lista Compars` y elegí la opción de cobros en Checkout Pro / Web.
4. En el panel de la aplicación, entrá a **"Credenciales de prueba"** (Sandbox) y copiá el **Access Token** y la **Public Key**.
5. En la sección **"Webhooks"** / **"Notificaciones IPN"**:
   - Configurá la URL de tu Edge Function: `https://<tu-proyecto>.supabase.co/functions/v1/mp-webhook`
   - *(Para probar en local en tu computadora antes de desplegar, podés usar un túnel gratuito como `ngrok http 54321` o Cloudflare Tunnel).*
   - Copiá la **Clave secreta del Webhook** generada por Mercado Pago.
6. Guardá estas variables en tu `.env` (y como secrets en Supabase con `supabase secrets set`):
   ```env
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-tu_access_token_de_prueba
   MERCADOPAGO_PUBLIC_KEY=APP_USR-tu_public_key_de_prueba
   MERCADOPAGO_WEBHOOK_SECRET=tu_secreto_de_firma_webhook
   ```

### Cómo actualizar la cotización del dólar (USD/ARS)
La tabla `exchange_rates` en Supabase almacena el valor de referencia con control de sanidad (entre $500 y $10.000 ARS):
```sql
UPDATE public.exchange_rates
SET rate = 1420.00, updated_at = now()
WHERE currency_from = 'USD' AND currency_to = 'ARS';
```

### Cómo asignar un plan manualmente a familiares o pruebas (Sin pagar)
Como el cliente tiene prohibido modificar planes por seguridad (RLS), para activar el plan Base o Premium a tu familia o a vos mismo, abrí el **SQL Editor** de Supabase y ejecutá:
```sql
-- Reemplazá el ID de tu hogar (podés buscarlo con: SELECT id, name FROM public.households;)
DO $$
DECLARE
    v_household_id UUID := 'AQUI-EL-UUID-DE-TU-HOGAR';
    v_plan TEXT := 'premium'; -- 'base' o 'premium'
BEGIN
    -- 1. Actualizar o insertar la licencia
    INSERT INTO public.licenses (household_id, plan_id, status, activated_at, updated_at)
    VALUES (v_household_id, v_plan, 'active', now(), now())
    ON CONFLICT (household_id) DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        status = 'active',
        updated_at = now();

    -- 2. Actualizar el límite mensual de consultas del chef en el hogar
    UPDATE public.households
    SET monthly_chef_limit = CASE WHEN v_plan = 'premium' THEN 150 ELSE 40 END
    WHERE id = v_household_id;
END $$;
```
Al ejecutar esa consulta, el hogar pasará inmediatamente a tener el plan asignado con todas sus funciones habilitadas.

---

## Paso 4: Notificaciones Push (Avisos en el Celular)

Para que a tu familia le suene el teléfono cuando alguien tacha o suma algo:

1. Podés generar un par de claves gratuitas VAPID ejecutando en tu consola:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Te mostrará dos claves (Public Key y Private Key). Pegalas en tu `.env`:
   ```env
   VITE_VAPID_PUBLIC_KEY=tu-clave-publica
   VAPID_PRIVATE_KEY=tu-clave-privada
   ```

---

## Paso 5: Cómo Instalar la App en tu Celular (PWA)

### En Android (Samsung, Motorola, Xiaomi, etc.):
1. Abrí la web en **Google Chrome**.
2. Tocá el botón flotante que aparecerá en pantalla que dice **"Instalar aplicación"** o tocá los 3 puntos de Chrome (⋮) arriba a la derecha y elegí **"Instalar aplicación"**.
3. ¡Listo! Se agregará el icono de Compars a tu pantalla junto a WhatsApp e Instagram.

### En iPhone (iOS Safari):
*Apple exige este paso manual para que las apps web puedan funcionar sin conexión y enviar notificaciones:*
1. Abrí la web en **Safari**.
2. Tocá el botón **Compartir** (el cuadradito con una flecha hacia arriba en la barra inferior de Safari).
3. Deslizá hacia abajo en el menú y tocá **"Agregar a pantalla de inicio"** (ícono con un signo `+`).
4. Tocá **"Agregar"** arriba a la derecha.
5. **Paso fundamental**: Abrí Compars tocando el icono que se acaba de crear en la pantalla de tu iPhone. Cuando te pregunte si querés recibir notificaciones, tocá **"Permitir"**.

---

## Paso 6: Invitar a tu Familia por WhatsApp

1. Abrí Compars en tu celular.
2. En la parte superior, tocá el botón verde con el icono de compartir de WhatsApp.
3. Se abrirá WhatsApp con un mensaje ya redactado y el link directo con tu código familiar.
4. Tu familiar toca el enlace y en menos de 30 segundos ya está viendo la misma lista de compras en tiempo real.

---

## Paso 7: Cómo probar localmente con dos navegadores (Ventana normal e incógnito)

Para verificar cómo interactúan dos personas de la misma casa en tiempo real desde tu propia computadora:

1. **Usuario 1 (Ventana normal de Chrome/Firefox/Edge):**
   - Abrí `http://localhost:3000`.
   - Ingresá como "Facundo" (o tu nombre) y creá tu hogar (ej: "Hogar Pehuenes").
   - En la barra superior, mirá el código de invitación (ej: `AB12CD`) o tocá el botón de compartir enlace.

2. **Usuario 2 (Ventana de incógnito / privada):**
   - Abrí una nueva ventana de incógnito (`Ctrl + Shift + N` o `Cmd + Shift + N`).
   - Abrí `http://localhost:3000` (o pegá el link de invitación con `?join=AB12CD`).
   - Ingresá como "Lucía" (o un segundo email/nombre).
   - Ingresá el código de invitación en la pantalla de bienvenida si no entraste por el enlace directo.

3. **Pruebas en vivo lado a lado:**
   - **Agregar productos:** En la ventana de Facundo, agregá "Yerba mate" o "2 kg de papa". Mirá la ventana de Lucía: el producto aparecerá al instante con el cartel *"Agregado por Facundo"*.
   - **Tachar en el súper:** En la ventana de Lucía, tocá el círculo para marcarlo comprado. En la ventana de Facundo se tachará en tiempo real y sonará el efecto.
   - **Vaciar y Deshacer:** En cualquiera de las dos ventanas, tocá "Vaciar comprados". Desaparecerán de ambas pantallas y aparecerá la barra verde de *"Deshacer (10s)"*. Tocá "Deshacer" y volverán a estar presentes de inmediato.
   - **Aislamiento entre familias:** Si abrís un tercer navegador con otro hogar distinto, podés comprobar que no ve absolutamente nada de la lista, despensa ni licencias del Hogar Pehuenes.

---

## Paso 8: Importar Precios Oficiales SEPA / Precios Claros (Ronda 4)

Para que la lista calcule el presupuesto aproximado en pesos y las recetas estimen su costo según los precios vigentes en **Junín de los Andes y San Martín de los Andes**:

1. En tu terminal ejecutá:
   ```bash
   npm run import-sepa
   ```
2. El script procesará los archivos oficiales de Precios Claros, filtrará las sucursales de La Anónima de la zona, descartará valores atípicos y generará `data/reference_prices.json`.
3. En la app verás automáticamente el total con la leyenda *"aprox."*, el conteo de ítems sin precio y la atribución reglamentaria: *"Fuente: SEPA / Precios Claros (Secretaría de Comercio)"*.
4. Para programar la descarga automática diaria de lunes a viernes, podés usar el workflow gratuito de GitHub Actions incluido en `.github/workflows/update-sepa-prices.yml`.

---

## Paso 9: Ajustes de Despensa Automática (Ronda 4)

Para evitar la confirmación manual cada vez que comprás un producto:

1. Abrí la app y andá a la pestaña **Hogar**.
2. Tocá **"Configuración del Hogar y Despensa"**.
3. En la sección *"Al marcar producto como comprado"*, elegí:
   - **Preguntar**: Te consulta con un diálogo rápido (opción por defecto).
   - **Sumar auto**: Lo agrega de inmediato a la despensa sumando cantidades, mostrando un toast con botón "Deshacer".
   - **No sumar**: No realiza ninguna acción.
4. Podés activar o desactivar la casilla *"No sumar productos de limpieza"* para que lavandinas y detergentes no se mezclen con tus alimentos.
5. El ajuste se sincroniza en vivo con todos los integrantes de tu hogar.

---

## ¿Dudas o Soporte?
Cualquier cambio de recetas, ingredientes patagónicos o ajustes de vocabulario se pueden consultar y modificar en la skill `.agents/skills/chef-ia/SKILL.md` y en las decisiones de diseño en `docs/DECISIONES.md`.
