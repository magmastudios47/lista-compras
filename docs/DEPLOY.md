# Guía de Despliegue Gratuito en Producción: Lista Compars

Esta guía explica paso a paso cómo publicar la aplicación web (PWA) **Lista Compars** de forma 100% gratuita usando **Vercel**, **Netlify** o **Cloudflare Pages**, conectándola a tu base de datos Supabase y al webhook de Mercado Pago.

> **Importante**: No necesitas pagar nada en ninguna de estas plataformas para el uso familiar o pequeños proyectos. Los niveles gratuitos cubren de sobra tráfico, SSL automático, CDN global y dominio `.vercel.app`, `.netlify.app` o `.pages.dev`.

---

## 1. Opciones de Hosting Recomendadas (Elegí Una)

| Proveedor | Ventajas | Configuración necesaria |
| :--- | :--- | :--- |
| **Vercel** *(Recomendado)* | Integración nativa con Vite, deploys instantáneos desde GitHub, SSL automático. | Build Command: `npm run build`<br>Output Directory: `dist` |
| **Cloudflare Pages** | Ancho de banda ilimitado, latencia ultrabaja en Argentina/Sudamérica. | Framework preset: `Vite`<br>Build: `npm run build`<br>Output: `dist` |
| **Netlify** | Muy simple, excelente soporte de PWA y formularios. | Build Command: `npm run build`<br>Publish directory: `dist` |

---

## 2. Paso a Paso para Desplegar en Vercel (Opción Recomendada)

### A. Subir tu código a GitHub (Privado o Público)
1. Creá un repositorio en [https://github.com](https://github.com) llamado `lista-compars`.
2. Vinculá tu repositorio local y hacé push (cuando estés listo para publicar):
   ```bash
   git remote add origin https://github.com/TU_USUARIO/lista-compars.git
   git branch -M main
   git push -u origin main
   ```

### B. Importar en Vercel
1. Entrá a [https://vercel.com](https://vercel.com) e iniciá sesión con tu cuenta de GitHub.
2. Tocá **"Add New..."** -> **"Project"**.
3. Seleccioná el repositorio `lista-compars` y tocá **"Import"**.
4. En la pantalla de configuración:
   - **Framework Preset**: Detectará automáticamente `Vite`.
   - **Root Directory**: `./` (la raíz del proyecto).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables (Variables de Entorno)**: Expandí esta sección y cargá las siguientes variables (ver sección 4 abajo).
6. Tocá **"Deploy"**. En menos de 2 minutos tu app estará online en una dirección como:  
   `https://lista-compars.vercel.app`

---

## 3. Despliegue en Cloudflare Pages o Netlify

### Cloudflare Pages:
1. Entrá al panel de Cloudflare -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
2. Seleccioná tu repo.
3. Build preset: `Vite`. Build command: `npm run build`. Output: `dist`.
4. Cargá las variables de entorno y tocá **Save and Deploy**.

### Netlify:
1. Entrá a [https://netlify.com](https://netlify.com) -> **Add new site** -> **Import an existing project**.
2. Build command: `npm run build`. Publish directory: `dist`.
3. Configurá las variables de entorno en **Site configuration** -> **Environment variables**.

---

## 4. Variables de Entorno para Producción

En el panel del proveedor que elijas (Vercel/Cloudflare/Netlify), configurá las siguientes variables de entorno:

### Variables Públicas del Cliente (con prefijo `VITE_`):
| Variable | Descripción | Ejemplo / Dónde obtenerla |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | URL de tu proyecto de Supabase | `https://xyzcompany.supabase.co` (Supabase -> Settings -> API) |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase | `eyJhbGciOi...` (Supabase -> Settings -> API -> anon public) |
| `VITE_GEMINI_API_KEY` | Clave gratuita de Google Gemini (opcional en cliente si usas Edge Function) | `AIzaSy...` (Google AI Studio) |
| `VITE_GEMINI_MODEL` | Modelo de Gemini utilizado | `gemini-2.5-flash` |
| `VITE_VAPID_PUBLIC_KEY` | Clave pública para Web Push | Obtenida con `npx web-push generate-vapid-keys` |

> ⚠️ **REGLA DE SEGURIDAD CRÍTICA**: Nunca cargues `SUPABASE_SERVICE_ROLE_KEY` ni `MERCADOPAGO_ACCESS_TOKEN` como variables `VITE_` en el cliente. Esas dos claves secretas **solo deben configurarse en Supabase Edge Functions** (servidor).

---

## 5. Configurar Supabase Auth (URLs de Redirección)

Para que el inicio de sesión con Google o Magic Link funcione correctamente en tu dominio de producción:

1. Entrá a tu panel de [Supabase](https://supabase.com) -> Tu Proyecto.
2. En el menú lateral izquierdo, andá a **Authentication** -> **URL Configuration**.
3. **Site URL**: Configura la URL pública de tu app:
   ```
   https://tu-app.vercel.app
   ```
4. **Redirect URLs**: Agregá las siguientes URLs permitidas:
   ```
   https://tu-app.vercel.app/**
   https://tu-app.vercel.app
   http://localhost:3000/**
   ```
5. Guardá los cambios tocando **Save**.

---

## 6. Configurar el Webhook de Mercado Pago en Producción

Cuando un integrante del hogar paga una licencia en pesos argentinos por Checkout Pro, Mercado Pago le avisa a tu servidor.

### A. Desplegar la Edge Function en Supabase:
En tu terminal local con Supabase CLI instalado (`supabase login` y `supabase link --project-ref <tu-project-id>`):
```bash
# Guardar secretos en el servidor seguro de Supabase
supabase secrets set MERCADOPAGO_ACCESS_TOKEN="APP_USR-tu-token-produccion-o-prueba"
supabase secrets set MERCADOPAGO_WEBHOOK_SECRET="tu-secreto-de-firma"
supabase secrets set GEMINI_API_KEY="AIzaSy-tu-clave"

# Desplegar las funciones
supabase functions deploy mp-webhook
supabase functions deploy create-checkout
supabase functions deploy chef-ai
```

### B. Configurar la URL en Mercado Pago Developers:
1. Entrá a [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app).
2. Entrá a tu aplicación -> **Webhooks** o **Notificaciones IPN**.
3. Modo de producción (o modo prueba si estás testeando sandbox):
   - **URL de producción**:  
     `https://<TU-PROJECT-ID>.supabase.co/functions/v1/mp-webhook`
   - **Eventos a escuchar**: Seleccioná **"Pagos" (`payment`)**.
4. Copiá la clave secreta de firma que te muestra Mercado Pago y asegúrate de haberla configurado en `MERCADOPAGO_WEBHOOK_SECRET`.

---

## 7. Verificación Post-Despliegue

Una vez completados los pasos anteriores:
1. Abrí `https://tu-app.vercel.app` en tu celular.
2. Comprobá que podés crear un hogar o unirte con el código de invitación.
3. Instalá la PWA en tu pantalla de inicio siguiendo el asistente incluido en la app.
4. Activá el modo avión en tu celular y verificá que la app sigue abriendo, mostrando tus productos y permitiendo agregar ítems en modo offline.
5. Al reconectar internet, comprobá que los ítems se sincronizan automáticamente con el resto del hogar.
