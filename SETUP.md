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
   - Abrí el archivo de este proyecto ubicado en:  
     `supabase/migrations/20261007_init.sql`
   - Copiá todo el texto y pegalo en el editor de Supabase.
   - Tocá el botón verde **"Run"** (abajo a la derecha). Esto creará todas las tablas y reglas de seguridad automáticamente.
5. Obtené tus claves:
   - Andá al ícono de engranaje **Project Settings** (abajo a la izquierda) -> **API**.
   - Copiá:
     - **Project URL**
     - **anon / public key**
     - **service_role key** (esta es secreta, solo para el servidor).
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
   GEMINI_MODEL=gemini-2.5-flash
   ```
   *(Nota: Cuando más adelante decidas pasar al nivel pago de Gemini, solo tenés que activar la facturación en tu cuenta de Google Cloud y mantener esta misma clave, sin modificar una sola línea de código).*

---

## Paso 3: Configurar Mercado Pago (Pago Único por Hogar)

Para que los hogares puedan pagar la licencia de por vida en pesos argentinos (ARS):

1. Entrá a [https://www.mercadopago.com.ar/developers](https://www.mercadopago.com.ar/developers) e iniciá sesión con tu cuenta de Mercado Pago.
2. Andá a **"Tus integraciones"** -> **"Crear aplicación"**.
3. Poné de nombre `Lista Compars` y elegí la opción de cobros en Checkout Pro / Web.
4. En el panel de la aplicación, entrá a **"Credenciales de prueba"** (para probar sin plata real) o **"Credenciales de producción"**.
5. Copiá el **Access Token** y la **Public Key**, y colocalos en tu archivo `.env`:
   ```env
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
   MERCADOPAGO_PUBLIC_KEY=APP_USR-...
   ARS_USD_RATE=1350
   ```

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

## ¿Dudas o Soporte?
Cualquier cambio de recetas, ingredientes patagónicos o ajustes de vocabulario se pueden consultar y modificar en la skill `.agents/skills/chef-ia/SKILL.md` y en las decisiones de diseño en `docs/DECISIONES.md`.
