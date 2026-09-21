// «Abrir los documentos PDF aquí» (0.6.18): con el interruptor, un enlace a un PDF del mismo sitio se abre en la
// lectura limpia con su texto (pdf.js servido desde winclus.com), su título y las herramientas de siempre; sin el
// interruptor, o si el PDF es de otro sitio, el enlace hace lo de siempre; un PDF escaneado (solo imagen) se dice
// que no tiene texto. Uso: node prueba_pdf.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch();
  // Un PDF «escaneado»: solo una imagen, sin una letra de texto
  const p0 = await nav.newPage();
  await p0.setContent('<canvas id="c" width="600" height="300"></canvas><script>const x=document.getElementById("c").getContext("2d");x.fillStyle="#333";x.fillRect(40,40,520,30);x.fillRect(40,100,400,30);</script>');
  await p0.pdf({ path: path.join(__dirname, "escaneado.pdf") }); await p0.close();
  fs.writeFileSync(path.join(__dirname, "pagina-pdf.html"), '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Trámites</title></head><body><main><h1>Trámites</h1>' +
    '<p><a id="man" href="/manual-winclus.pdf">Manual para entidades (PDF)</a></p><p><a id="otro" href="http://localhost:8765/guia-winclus.pdf">Guía en otro sitio (PDF)</a></p>' +
    '<p><a id="esc" href="/pruebas/escaneado.pdf">Formulario escaneado (PDF)</a></p></main><script src="/widget.js"></script>' +
    '<script>window.__nav=[];window.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a){window.__nav.push({id:a.id,prevenido:e.defaultPrevented});e.preventDefault();}});</script></body></html>');
  const ctx = await nav.newContext();
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("http://127.0.0.1:8765/pruebas/pagina-pdf.html");
  await page.waitForFunction(() => window.Winclus);
  const pulsar = async (id) => { await page.click("#" + id); await page.waitForTimeout(200); return page.evaluate(() => window.__nav[window.__nav.length - 1]); };

  let n = await pulsar("man");
  comprobar(n && !n.prevenido && !(await page.evaluate(() => !!Winclus.caja.querySelector(".wcl-limpia"))), "con el interruptor apagado, el enlace al PDF hace lo de siempre", JSON.stringify(n));

  await page.evaluate(() => { Winclus.ajustes.pdf_lectura = true; });
  n = await pulsar("man");
  await page.waitForFunction(() => !!Winclus.caja.querySelector(".wcl-limpia"), null, { timeout: 30000 }).catch(() => {});
  const l = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-limpia"); return e && { etiqueta: e.getAttribute("aria-label"), titulo: e.querySelector(".wcl-limpia-barra b").textContent, texto: e.querySelector(".wcl-limpia-texto").textContent.length, audit: /Winclus Audit/.test(e.textContent), h1: (e.querySelector(".wcl-limpia-texto h1") || {}).textContent, leer: !!e.querySelector('[data-a="leer"]'), facil: !!e.querySelector('[data-a="facil"]') }; });
  comprobar(n && n.prevenido, "con el interruptor, el enlace a un PDF del sitio no navega", JSON.stringify(n));
  comprobar(l && /Manual de uso para entidades/.test(l.titulo) && /Manual de uso para entidades/.test(l.h1 || "") && l.texto > 3000 && l.audit, "el PDF se abre en la lectura limpia con su título y su texto", l && JSON.stringify({ titulo: l.titulo, caracteres: l.texto }));
  comprobar(l && l.leer && l.facil && /Documento/.test(l.etiqueta), "con las herramientas de siempre: leer en voz alta y explicar en fácil", l && l.etiqueta);
  await page.evaluate(() => { const b = Winclus.caja.querySelector('.wcl-limpia [data-a="cerrar"]'); if (b) b.click(); });

  n = await pulsar("otro");
  comprobar(n && !n.prevenido, "un PDF de otro sitio se abre como siempre (el navegador no deja leerlo desde aquí)", JSON.stringify(n));

  n = await pulsar("esc");
  await page.waitForTimeout(3000);
  const esc = await page.evaluate(() => ({ limpia: !!Winclus.caja.querySelector(".wcl-limpia"), aviso: Winclus.caja.textContent.includes("imagen escaneada") }));
  comprobar(n && n.prevenido && !esc.limpia && esc.aviso, "un PDF escaneado (solo imagen) no se abre vacío: se dice que no tiene texto", JSON.stringify(esc));

  const ui = await page.evaluate(() => { Winclus.ajustes.pdf_lectura = false; Winclus.abrir(); Winclus.vistaCompleta(true); Winclus.caja.getElementById("wcl-tab-ver").click(); const s = Winclus.caja.getElementById("wcl-pdf_lectura"); const i = Winclus.caja.getElementById("wcl-que"); i.value = "quiero leer los pdf"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return { sw: !!s, ayuda: !!(s && s.getAttribute("aria-describedby")), on: Winclus.ajustes.pdf_lectura }; });
  comprobar(ui.sw && ui.ayuda && ui.on, "el interruptor está en la pestaña Ver con su ayuda, y «quiero leer los pdf» lo enciende", JSON.stringify(ui));

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); servidor.kill();
  for (const f of ["escaneado.pdf", "pagina-pdf.html"]) try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {}
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
