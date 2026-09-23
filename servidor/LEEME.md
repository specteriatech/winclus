# Servidor de Winclus: cómo se enciende y cómo se migra

winclus.com es una web estática en Vercel (carpeta `web/`). Desde el 23-sep-2026 tiene además cuatro funciones en `web/api/`
y una base de datos en Supabase para el panel de cliente. **Sin la base de datos, la web funciona igual**: el widget, el
escáner en línea (`/escanear`), el generador de declaración y las páginas. Solo el panel de cliente (`/panel`), la
configuración por clave de sitio (`data-clave`) y las cifras de uso necesitan Supabase.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| `servidor/esquema.sql` | Supabase (Postgres) | Cuentas, sitios con clave, miembros, cifras de uso por día, monitor (páginas, ejecuciones, resultados), escaneos, seguridad por filas, límites por plan, bucket `capturas`. |
| `web/api/entorno.js` | Vercel | Da al panel la URL de Supabase y la clave publicable. |
| `web/api/config.js` | Vercel | `GET /api/config?clave=…`: la configuración del panel de un sitio (logo, nombre, color, lado, pestañas ocultas, cámara, idioma, contacto, arreglos, traducir, describir, explicar). |
| `web/api/uso.js` | Vercel | `POST /api/uso?clave=…`: suma las cifras anónimas que manda el widget al salir de la página (rpc `sumar_uso`). |
| `web/api/escanear.js` | Vercel | `POST /api/escanear {url}`: escáner en línea con Chromium (puppeteer-core + @sparticuz/chromium), axe-core y comprobaciones de la Res. 1519. Funciona sin Supabase (sin límite por hora). |
| `web/panel.html` + `web/vendor/supabase.js` | Navegador | El panel de cliente: entra con enlace al correo (OTP de Supabase Auth), habla con Supabase directamente con la clave publicable; la seguridad por filas decide qué ve cada cual. |
| `herramientas/pruebas/widget/monitor_alojado.js` | GitHub Actions (`.github/workflows/monitor-alojado.yml`) | Cada día a las 06:00 de Colombia revisa las páginas vigiladas de todos los sitios, guarda capturas y resultados, y avisa por webhook. |

## Encender (una vez)

1. **Supabase.** Crear un proyecto (plan Free vale para empezar; región São Paulo). En SQL Editor, pegar y ejecutar `servidor/esquema.sql` entero (es idempotente).
   En Authentication → URL Configuration: Site URL `https://winclus.com`, Redirect URLs `https://winclus.com/panel`. En Authentication → Providers → Email: dejar solo «Magic link / OTP» (sin contraseña).
   Para producción hace falta un SMTP propio (Authentication → SMTP Settings): el correo de fábrica de Supabase manda muy pocos por hora.
2. **Vercel** (proyecto `winclus`, Settings → Environment Variables, Production y Preview):
   - `SUPABASE_URL` = `https://<ref>.supabase.co`
   - `SUPABASE_ANON_KEY` = la clave publicable (`sb_publishable_…` o la `anon` antigua)
   - `SUPABASE_SERVICE_KEY` = la clave de servicio (`service_role`; secreta, solo la usan las funciones)
   - `SAL_IP` = una cadena al azar (sal del hash de la conexión en el escáner)
   Después, un despliegue nuevo (las variables se leen al desplegar).
3. **GitHub** (repositorio `specteriatech/winclus`, Settings → Secrets → Actions): `SUPABASE_URL` y `SUPABASE_SERVICE_KEY`. El workflow «Winclus Monitor alojado» corre solo cada día; se puede lanzar a mano desde Actions.
4. **Planes.** Todas las cuentas nacen con plan `gratis`. Para subir una: `update public.cuentas set plan = 'entidad' where correo = '…';` en el SQL Editor (o desde el panel de Supabase, tabla `cuentas`). Los límites por plan están en la función `limites()` del esquema y repetidos en `web/panel.html` (la prueba `prueba_panel.js` comprueba que coinciden).

## Migrar a otra cuenta de Supabase

1. En la cuenta nueva, crear el proyecto y ejecutar `servidor/esquema.sql`.
2. Copiar los datos: `pg_dump --data-only --schema=public --exclude-table=schema_migrations "<url antigua>" | psql "<url nueva>"` (los usuarios de Auth se exportan desde Authentication → Users o con `pg_dump --schema=auth --table=auth.users`; las capturas del bucket se copian con la API de Storage o se dejan caducar: el monitor las vuelve a hacer al día siguiente).
3. Cambiar las tres variables en Vercel y los dos secrets en GitHub, y desplegar.
4. Supabase también permite **transferir un proyecto entero** entre organizaciones (Project Settings → General → Transfer project): es lo más sencillo si la cuenta nueva es otra organización del mismo usuario.

## Probar en local

- Escáner: `CHROME_PATH=<ruta a chrome.exe> node -e "require('./web/api/escanear.js').escanear('https://…').then(console.log)"` (la prueba `prueba_escanear.js` usa el Chromium de Playwright).
- Panel y clave de sitio: `prueba_panel.js` y `prueba_clave.js` simulan la API con `page.route`; no hace falta Supabase.
- Con Supabase de verdad: `vercel dev --cwd web` con un `.env.local` con las cuatro variables (no se sube al repositorio).
