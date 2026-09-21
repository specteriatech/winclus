// Winclus Audit: analiza cuatro páginas locales (la portada de winclus.com, una página con fallos a propósito, una con
// CAPTCHA invisible y otra con reCAPTCHA dibujado desde JavaScript) y comprueba el informe y el borrador de declaración.
// Uso: node prueba_auditar.js
const { spawn, spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const mala = path.join(__dirname, "pagina-mala.html");
  fs.writeFileSync(mala, '<!doctype html><html><head><title></title></head><body><img src="x.png"><p style="color:#bbb;background:#fff">Texto flojo</p><input type="text"><a href="#">aquí</a><video src="v.mp4"></video>' +
    // CAPTCHA con casilla, CAPTCHA de imagen casero y una sesión que se cierra sola a los 15 minutos
    '<div class="g-recaptcha" data-sitekey="prueba"></div><img src="captcha.php?n=1" alt="captcha"><p>Su sesión expirará en 15 minutos.</p>' +
    '<script>setTimeout(function () { location.href = "/salir?sesion=expirada"; }, 15 * 60 * 1000);</script></body></html>');
  // Página limpia de barreras de tiempo: CAPTCHA invisible y un temporizador largo que NO cierra nada (no debe marcarse)
  const invisible = path.join(__dirname, "pagina-invisible.html");
  fs.writeFileSync(invisible, '<!doctype html><html lang="es"><head><title>Formulario</title></head><body><main><h1>Formulario</h1><form><label for="c">Correo</label><input id="c" type="email">' +
    '<div class="g-recaptcha" data-sitekey="prueba" data-size="invisible"></div><button>Enviar</button></form></main>' +
    '<script>setInterval(function () { document.title = "Formulario"; }, 60000);</script></body></html>');
  // reCAPTCHA con casilla dibujado desde JavaScript, sin .g-recaptcha: solo el iframe de Google (aquí vacío). No puede pasar por invisible
  const porJs = path.join(__dirname, "pagina-recaptcha-js.html");
  fs.writeFileSync(porJs, '<!doctype html><html lang="es"><head><title>Contacto</title></head><body><main><h1>Contacto</h1><div id="otro"><iframe title="reCAPTCHA" src="about:blank#recaptcha/api2/anchor?k=x&size=normal"></iframe></div></main></body></html>');
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const salida = fs.mkdtempSync(path.join(os.tmpdir(), "winclus-audit-"));
  const r = spawnSync(process.execPath, [path.join(__dirname, "auditar.js"), "http://127.0.0.1:8765/", "http://127.0.0.1:8765/pruebas/pagina-mala.html", "http://127.0.0.1:8765/pruebas/pagina-invisible.html", "http://127.0.0.1:8765/pruebas/pagina-recaptcha-js.html", "--salida", salida, "--entidad", "Alcaldía de Prueba"], { encoding: "utf8", timeout: 480000 });
  servidor.kill();
  try { fs.unlinkSync(mala); fs.unlinkSync(invisible); fs.unlinkSync(porJs); } catch (e) {}
  comprobar(r.status === 0, "el escáner termina bien", (r.stdout || "").trim().split("\n").slice(-3).join(" | ") + (r.stderr ? " ERR " + r.stderr.slice(0, 200) : ""));
  const informe = fs.existsSync(path.join(salida, "informe.html")) ? fs.readFileSync(path.join(salida, "informe.html"), "utf8") : "";
  const decl = fs.existsSync(path.join(salida, "declaracion.html")) ? fs.readFileSync(path.join(salida, "declaracion.html"), "utf8") : "";
  const json = fs.existsSync(path.join(salida, "resultados.json")) ? JSON.parse(fs.readFileSync(path.join(salida, "resultados.json"), "utf8")) : [];
  comprobar(informe.length > 2000 && decl.length > 1000 && json.length === 4, "genera informe.html, declaracion.html y resultados.json");
  const portada = json[0], malaR = json[1];
  comprobar(portada && portada.paginas.every((p) => p.ok && p.violaciones.length === 0), "la portada de winclus.com sale limpia", portada ? portada.paginas.map((p) => p.vista + ":" + p.violaciones.length).join(", ") : "");
  const ids = malaR ? malaR.paginas[0].violaciones.map((v) => v.id) : [];
  comprobar(ids.includes("image-alt") && ids.includes("document-title") && ids.includes("html-has-lang") && ids.includes("label") && ids.includes("color-contrast"), "la página mala cae en alt, título, idioma, etiqueta y contraste", ids.join(", "));
  const extras = malaR ? malaR.extra.map((x) => x.id) : [];
  comprobar(extras.includes("video-caption") && extras.includes("declaracion") && extras.includes("skip-link"), "las comprobaciones de la Res. 1519 detectan vídeo sin subtítulos, sin declaración y sin «ir al contenido»", extras.join(", "));
  comprobar(/CC1 Alternativa texto para elementos no textuales/.test(informe) && /CC5 Contraste de color suficiente/.test(informe) && /Cómo seguir/.test(informe) && /No constituye certificación/.test(informe),
    "el informe agrupa por criterio de la Res. 1519 y avisa de sus límites");
  // Los números tienen que ser los del Anexo 1, no unos propios: si se desplazan, el informe miente
  comprobar(/CC3 Guion para solo vídeo y solo audio/.test(informe) && /CC10 Permitir saltar bloques/.test(informe) &&
    /CC26 Enlaces adecuados/.test(informe) && /CC32 Manejable por teclado/.test(informe) && !/CC3 Contenido con estructura/.test(informe),
    "cada CC lleva el nombre que tiene en el Anexo 1 de la Resolución 1519");
  // Ningún hallazgo puede llevar un criterio que no sea uno de los del Anexo 1 (antes había «CC15 Declaración» y «CC8 Saltar bloques»)
  const oficiales = new Set([...fs.readFileSync(path.join(__dirname, "auditar.js"), "utf8").matchAll(/^\s+"((?:CC\d+|Declaración)[^"]+)": \[/gm)].map((m) => m[1]));
  const todos = json.flatMap((x) => x.extra || []);
  const raros = todos.filter((x) => !oficiales.has(x.criterio)).map((x) => x.id + " → " + x.criterio);
  comprobar(oficiales.size === 33 && todos.length > 0 && raros.length === 0 && !/CC15 Declaración|CC8 Saltar bloques/.test(informe),
    "cada hallazgo lleva el número y el nombre oficial de su criterio (" + oficiales.size + " criterios)", raros.join(" | "));
  // CAPTCHA y tiempo de sesión (CC1, CC29, CC19)
  const de = (r, id) => (r ? r.extra : []).filter((x) => x.id === id);
  const cap = de(malaR, "captcha")[0], img = de(malaR, "captcha-imagen")[0], ses = de(malaR, "tiempo-sesion")[0];
  comprobar(cap && cap.impact === "serious" && /reCAPTCHA/.test(cap.help) && cap.criterio === "CC1 Alternativa texto para elementos no textuales" && /otra vía/.test(cap.detalle),
    "un CAPTCHA con casilla se marca como barrera seria en CC1 y dice cómo quitarlo", cap && cap.help);
  comprobar(img && img.impact === "critical" && img.criterio === "CC29 Imágenes de texto", "un CAPTCHA de imagen con letras se marca como crítico en CC29", img && img.help);
  comprobar(ses && ses.impact === "serious" && /15 min/.test(ses.help) && ses.criterio === "CC19 Permitir control de eventos temporizados" && /20 segundos/.test(ses.detalle),
    "un temporizador que cierra la sesión a los 15 min se marca en CC19 con lo que exige la WCAG 2.2.1", ses && ses.help);
  const invR = json[2];
  const capInv = de(invR, "captcha")[0];
  comprobar(capInv && capInv.impact === "minor" && /invisible/.test(capInv.help) && !de(invR, "tiempo-sesion").length,
    "un CAPTCHA invisible solo se señala para revisar, y un temporizador que no cierra nada no se marca", JSON.stringify((invR ? invR.extra : []).map((x) => x.id)));
  const capJs = de(json[3], "captcha")[0];
  comprobar(capJs && capJs.impact === "serious", "un reCAPTCHA con casilla dibujado desde JavaScript (sin .g-recaptcha) no pasa por invisible", capJs && capJs.help);
  comprobar(!de(portada, "captcha").length && !de(portada, "tiempo-sesion").length, "la portada de winclus.com no da falsos positivos de CAPTCHA ni de tiempo");
  comprobar(/CAPTCHA y tiempo de sesión en trámites/.test(informe), "la revisión manual pide probar un trámite completo (lo que hay tras iniciar sesión)");
  comprobar(/Alcaldía de Prueba/.test(decl) && /Resolución 1519 de 2020/.test(decl) && /cumple parcialmente/.test(decl) && /\[correo de contacto\]/.test(decl), "el borrador de declaración lleva la entidad, la norma, el estado y los huecos por rellenar");
  fs.rmSync(salida, { recursive: true, force: true });
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
