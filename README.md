# Winclus

**Tecnología que incluye, un mundo que avanza.** · [winclus.com](https://winclus.com)

[![Pruebas del widget](https://github.com/specteriatech/winclus/actions/workflows/pruebas.yml/badge.svg)](https://github.com/specteriatech/winclus/actions/workflows/pruebas.yml) · [Evidencia](https://winclus.com/evidencia) · [Demostración de cinco minutos](https://winclus.com/demo) · [Comparación](https://winclus.com/comparar)

Winclus es un programa gratuito para Windows que mueve el puntero del ratón con la cabeza o con los ojos y hace clic con un parpadeo o un gesto de la cara. Solo necesita una cámara web. Está pensado para personas con discapacidades o dificultades motoras que no pueden usar un ratón o un teclado convencional.

Todo se procesa en el equipo: no hace falta cuenta, no necesita internet y no envía la imagen de la cámara a ningún sitio.

## Instalar

**Con un comando** (PowerShell, sin permisos de administrador):

```powershell
irm https://winclus.com/instalar.ps1 | iex
```

**Con el ZIP**: descarga `Winclus-Windows.zip` desde la [última release](https://github.com/specteriatech/winclus/releases/latest), descomprímelo y abre `Winclus.exe`. Dentro va un `LEEME.txt` con los pasos.

Requisitos: Windows 10 u 11 de 64 bits y una cámara web.

## Qué hace

- **Puntero** con la cabeza, con los ojos, o híbrido (los ojos para saltar, la cabeza para afinar).
- **Clic** con parpadeo, boca, cejas o quedándose quieto. Con cada clic aprende y afina la puntería sin calibrar.
- **Menú de clics**: cerrando los ojos algo más de un segundo aparece un anillo con clic derecho, doble clic, arrastrar, rueda, teclado y pausa.
- **Teclado en pantalla** con sugerencias de palabras en español.
- **Voz**: frases guardadas que se leen en voz alta.
- **Asistente**: «abre el correo», «escribe hola a Ana»… y lo hace paso a paso.
- **Perfiles** exportables (`.winclus`) para llevar la configuración a otro equipo.

## Widget web

`web/widget.js` lleva lo mismo a cualquier página: se añade con una línea y funciona sin cuentas ni servidores propios.

```html
<script src="https://winclus.com/widget-0.6.3.js" async integrity="sha384-FeiNXFNVKDCeM1Ij/mlzczg34t44aNH37bUr+UiW2lqmRpmyed/p0wUoidZ45c1g" crossorigin="anonymous"></script>
```

- `widget.js` es siempre la última versión (caché de 5 minutos); `widget-X.Y.Z.js` es una copia inmutable de cada versión, para que un sitio no cambie sin querer. Al publicar una versión nueva: subir `VERSION` en `widget.js`, copiarlo a `widget-X.Y.Z.js` y actualizar la declaración de accesibilidad.
- Atributos opcionales en el `<script>`: `data-posicion="izquierda"`, `data-color="#101F3D"`, `data-camara="no"`.
- Pruebas del widget (Playwright + axe-core) en `herramientas/pruebas/widget`.
- Comparación con overlays y hardware de apoyo: https://winclus.com/comparar
- Guía de uso para personas (winclus.com/guia, PDF en winclus.com/guia-winclus.pdf) y manual para entidades (winclus.com/manual, PDF en winclus.com/manual-winclus.pdf)
- Presentación (winclus.com/presentacion), hoja de una página (winclus.com/una-pagina) y guion con objeciones en `docs/guion-presentacion.md`
- Guía de integración (CSP, web component, React/Vue, WordPress, Drupal, GOV.CO, IA, idiomas): https://winclus.com/integrar
- Declaración de accesibilidad: https://winclus.com/accesibilidad · Datos personales: https://winclus.com/privacidad
- Winclus Audit (escáner de un sitio con informe y borrador de declaración): `node herramientas/pruebas/widget/auditar.js https://sitio`
- Plugin de WordPress y módulo de Drupal en `integraciones/`.

## Ejecutar desde el código

```
py -3.9 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\pythonw.exe run_app.py
```

Construir el ejecutable y el ZIP de distribución:

```
.venv\Scripts\python.exe -m PyInstaller --noconfirm build.spec
.venv\Scripts\python.exe herramientas\empaquetar.py
```

La web está en `web/` (HTML estático) y los recursos gráficos se regeneran con `herramientas\generar_recursos.py`.

## Licencia

Apache 2.0. Winclus nace de [Project Gameface](https://github.com/google/project-gameface) de Google, que no patrocina ni respalda este proyecto. Ver `LICENSE` y `NOTICE`.

Winclus es una herramienta de accesibilidad; no es un dispositivo médico.
