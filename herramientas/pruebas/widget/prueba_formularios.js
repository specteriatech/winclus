// Ayuda en formularios: al entrar en un campo dice «Campo N de M: etiqueta, obligatorio»; al enviar con errores
// los explica en lenguaje claro y lleva el foco al primero; deja pegar aunque el sitio lo bloquee (onpaste y
// preventDefault). Uso: node prueba_formularios.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-formulario.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, permissions: (process.env.NAVEGADOR && process.env.NAVEGADOR !== "chromium") ? [] : ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(() => localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false })));
  const page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);

  // --- dónde estoy ---
  await page.focus("#correo");
  await page.waitForTimeout(80);
  let aviso = await page.evaluate(() => Winclus.caja.querySelector(".wcl-vivo").textContent);
  comprobar(/Campo 2 de 4: Correo electrónico, obligatorio/.test(aviso), "al entrar en un campo dice cuál es, cuántos hay y si es obligatorio", aviso);
  await page.focus("#ciudad");
  await page.waitForTimeout(80);
  aviso = await page.evaluate(() => Winclus.caja.querySelector(".wcl-vivo").textContent);
  comprobar(/Campo 4 de 4: Ciudad$/.test(aviso), "los desplegables también cuentan", aviso);

  // --- errores en lenguaje claro ---
  await page.fill("#nombre", "Al");
  await page.fill("#cedula", "abc");
  await page.click("#enviar");
  await page.waitForTimeout(200);
  const err = await page.evaluate(() => { const s = Winclus.caja.querySelector(".wcl-sonido"); return { visible: getComputedStyle(s).display !== "none", texto: s.textContent, foco: document.activeElement.id }; });
  comprobar(err.visible && /3 cosas por corregir/.test(err.texto), "al enviar con errores los cuenta", err.texto);
  comprobar(/«Nombre completo» necesita al menos 3 caracteres; llevas 2/.test(err.texto), "explica el mínimo de caracteres con lo que llevas");
  comprobar(/Falta rellenar «Correo electrónico»/.test(err.texto), "explica el campo vacío obligatorio");
  comprobar(/«Cédula»: solo números, entre 6 y 10/.test(err.texto), "usa el title del sitio para el patrón");
  comprobar(err.foco === "nombre", "el foco va al primer campo con error", err.foco);
  await page.fill("#correo", "pepe");
  await page.click("#enviar");
  await page.waitForTimeout(200);
  const err2 = await page.evaluate(() => Winclus.caja.querySelector(".wcl-sonido").textContent);
  comprobar(/tiene que ser un correo, por ejemplo nombre@ejemplo.com/.test(err2), "explica un correo mal escrito", err2);

  // --- errores que marca el propio sitio con aria-invalid ---
  await page.evaluate(() => { const c = document.getElementById("cedula"); const d = document.createElement("span"); d.id = "e-cedula"; d.textContent = "La cédula no existe"; c.after(d); c.setAttribute("aria-describedby", "e-cedula"); c.setAttribute("aria-invalid", "true"); });
  await page.waitForTimeout(100);
  aviso = await page.evaluate(() => Winclus.caja.querySelector(".wcl-vivo").textContent);
  comprobar(/Revisa «Cédula»: La cédula no existe/.test(aviso), "aria-invalid del sitio se anuncia con su explicación", aviso);

  // --- pegar siempre permitido --- (WebKit de Playwright no da acceso al portapapeles: ahí no se prueba)
  const sinPortapapeles = process.env.NAVEGADOR === "webkit";
  if (!sinPortapapeles) {
  await page.evaluate(() => navigator.clipboard.writeText("pegado"));
  await page.fill("#correo", "");
  await page.focus("#correo");
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(100);
  const v1 = await page.$eval("#correo", (e) => e.value);
  comprobar(v1 === "pegado", "se puede pegar en un campo con onpaste=\"return false\"", JSON.stringify(v1));
  await page.fill("#cedula", "");
  await page.focus("#cedula");
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(100);
  const v2 = await page.$eval("#cedula", (e) => e.value);
  comprobar(v2 === "pegado", "se puede pegar aunque un manejador del sitio haga preventDefault", JSON.stringify(v2));
  }

  // --- apagado ---
  await page.evaluate(() => { Winclus.ajustes.formularios = false; });
  await page.fill("#cedula", "");
  await page.focus("#cedula");
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(100);
  comprobar((await page.$eval("#cedula", (e) => e.value)) === "", "con la ayuda apagada el sitio vuelve a mandar");

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
