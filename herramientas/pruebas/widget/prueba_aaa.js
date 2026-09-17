// Nivel AAA de las WCAG (hoja de ruta docs/hoja-ruta-aaa.md, 17-sep-2026): reglas AAA de axe sobre el panel
// (todas las pestañas, ajustes finos abiertos) y sobre todas las páginas del sitio; contraste 7:1 (1.4.6) de todo
// texto del panel; objetivos de 44×44 (2.5.5) en el panel y en enlaces y botones del sitio que no van en línea;
// confirmación en dos pasos en los botones que borran (3.3.6); colores propios y modo dislexia con párrafos a 1,5
// veces el interlineado y sin justificar (1.4.8); transcripciones de los vídeos (1.2.8); glosario enlazado desde
// todos los pies (3.1.4); «En pocas palabras» en las páginas técnicas (3.1.5); migas de pan (2.4.8).
// Uso: node prueba_aaa.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "../../..");
const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const TAGS = ["wcag2aaa", "wcag21aaa", "wcag22aaa"];
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.addScriptTag({ content: AXE });
  await page.evaluate(() => Winclus.abrir());

  // --- panel: axe AAA, contraste 7:1 y objetivos 44×44, pestaña por pestaña ---
  const viol = {}, con = {}, peq = {};
  for (const tab of ["inicio", "ver", "oir", "cara", "clics", "escribir", "mas"]) {
    await page.evaluate((t) => { Winclus.caja.getElementById("wcl-tab-" + t).click(); Winclus.caja.querySelectorAll(".wcl-panel details").forEach((d) => { d.open = true; }); Winclus.ajustes.colores = "propios"; Winclus.ajustes.modo_puntero = "ojos"; }, tab);
    await page.evaluate(() => { const r = Winclus.caja; r.querySelectorAll('[data-cuando]').forEach((g) => { g.style.display = ""; }); });   // todos los grupos a la vista, también los de otros modos
    const r = await page.evaluate(async (tags) => {
      const res = await axe.run(document.querySelector(".wcl-root"), { runOnly: { type: "tag", values: tags } });
      const v = res.violations.map((x) => x.id + ":" + x.nodes.length);
      function lum(c) { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); }; return [0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), m[3] === undefined ? 1 : m[3]]; }
      function fondo(e) { while (e && e !== document) { const b = getComputedStyle(e).backgroundColor; if (b && lum(b)[1] > 0) return b; e = e.parentNode instanceof ShadowRoot ? e.parentNode.host : e.parentElement; } return "rgb(255,255,255)"; }
      const bajos = [];
      Winclus.caja.querySelectorAll(".wcl-panel *").forEach((e) => {
        if (!e.getClientRects().length || e.disabled) return;
        if (!Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim())) return;
        const cs = getComputedStyle(e), [l1] = lum(cs.color), [l2] = lum(fondo(e)), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight) >= 700);
        if (ratio < (grande ? 4.5 : 7)) bajos.push(e.tagName.toLowerCase() + "." + String(e.className).split(" ")[0] + " " + cs.color + "/" + fondo(e) + "=" + ratio.toFixed(1));
      });
      const chicos = [];
      Winclus.caja.querySelectorAll(".wcl-panel button, .wcl-panel input, .wcl-panel summary, .wcl-panel textarea").forEach((b) => {
        const rc = b.getBoundingClientRect(); if (!rc.width || !rc.height) return;
        if (b.closest(".wcl-tec")) return;   // las teclas del teclado en pantalla se dimensionan con la altura elegida por la persona
        if (rc.width < 44 || rc.height < 44) chicos.push((b.id || b.className || b.tagName) + " " + Math.round(rc.width) + "×" + Math.round(rc.height));
      });
      return { v, bajos, chicos };
    }, TAGS);
    r.v.forEach((x) => { viol[tab + " " + x] = 1; }); r.bajos.forEach((x) => { con[x] = 1; }); r.chicos.forEach((x) => { peq[tab + " " + x] = 1; });
  }
  await page.evaluate(() => { Winclus.ajustes.colores = "no"; Winclus.ajustes.modo_puntero = "cabeza"; });
  comprobar(Object.keys(viol).length === 0, "reglas AAA de axe sobre el panel: sin violaciones", Object.keys(viol).join(", "));
  comprobar(Object.keys(con).length === 0, "1.4.6: todo el texto del panel tiene contraste 7:1 (4,5:1 si es grande)", Object.keys(con).slice(0, 6).join(" | "));
  comprobar(Object.keys(peq).length === 0, "2.5.5: todos los controles del panel miden al menos 44×44", Object.keys(peq).slice(0, 8).join(" | "));

  // --- 3.3.6: confirmación en dos pasos antes de borrar ---
  await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-mas").click(); Winclus.ajustes.texto = 150; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  const c1 = await page.evaluate(() => { const b = Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-big")).find((x) => /Restablecer todo/.test(x.textContent)); b.click(); const g = Winclus.caja.querySelector("#wcl-panel-mas .wcl-confirma"); return { texto: Winclus.ajustes.texto, pregunta: !!g, foco: g && Winclus.caja.activeElement && Winclus.caja.activeElement.textContent, botones: g ? Array.from(g.querySelectorAll("button")).map((x) => x.textContent) : [] }; });
  comprobar(c1.texto === 150 && c1.pregunta && /^No/.test(c1.foco || "") && c1.botones.length === 2, "«Restablecer todo» no borra a la primera: pregunta, con el foco en «No»", JSON.stringify(c1));
  const c2 = await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-confirma button")).find((x) => /^No/.test(x.textContent)).click(); return { texto: Winclus.ajustes.texto, pregunta: !!Winclus.caja.querySelector("#wcl-panel-mas .wcl-confirma"), vuelve: /Restablecer todo/.test((Winclus.caja.activeElement || {}).textContent || "") }; });
  comprobar(c2.texto === 150 && !c2.pregunta && c2.vuelve, "«No» deja todo como estaba y devuelve el foco al botón", JSON.stringify(c2));
  const c3 = await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-big")).find((x) => /Restablecer todo/.test(x.textContent)).click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-confirma button")).find((x) => /^Sí/.test(x.textContent)).click(); return Winclus.ajustes.texto; });
  comprobar(c3 === 100, "«Sí, borrar» sí restablece", String(c3));
  const otros = await page.evaluate(() => ["Olvidar la calibración", "Olvidar los clics", "Olvidar las palabras aprendidas"].map((t) => { const b = Array.from(Winclus.caja.querySelectorAll(".wcl-panel .wcl-big")).find((x) => x.textContent === t); if (!b) return t + ": no está"; const caja = b.parentNode; b.click(); const g = caja.querySelector(".wcl-confirma"); const ok = !!g; if (g) g.querySelector("button").click(); return ok ? "" : t + ": borra sin preguntar"; }).filter(Boolean));
  comprobar(otros.length === 0, "los otros tres botones que borran también preguntan", otros.join(" | "));

  // --- 1.4.8: colores propios y modo dislexia ---
  const col = await page.evaluate(() => { Winclus.caja.getElementById("wcl-tab-ver").click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver .wcl-opc button")).find((b) => /Amarillo sobre negro/.test(b.textContent)).click(); const cs = getComputedStyle(document.body); return { clase: document.documentElement.classList.contains("wcl-colores"), color: cs.color, fondo: cs.backgroundColor, fg: document.documentElement.style.getPropertyValue("--wcl-fg") }; });
  comprobar(col.clase && col.color === "rgb(255, 228, 92)" && col.fondo === "rgb(0, 0, 0)", "«Amarillo sobre negro» cambia texto y fondo de toda la página", JSON.stringify(col));
  const propios = await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver .wcl-opc button")).find((b) => /Los que yo elija/.test(b.textContent)).click(); const i = Winclus.caja.getElementById("wcl-color_fondo"); i.value = "#123456"; i.dispatchEvent(new Event("input", { bubbles: true })); return { visible: !!i.getClientRects().length, fondo: getComputedStyle(document.body).backgroundColor, guardado: JSON.parse(localStorage.getItem("winclus.ajustes")).color_fondo }; });
  comprobar(propios.visible && propios.fondo === "rgb(18, 52, 86)" && propios.guardado === "#123456", "«Los que yo elija» muestra los selectores y aplica y guarda el color", JSON.stringify(propios));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-ver .wcl-opc button")).find((b) => /Los del sitio/.test(b.textContent)).click(); });
  const dis = await page.evaluate(() => { Winclus.caja.getElementById("wcl-dislexia").click(); const p = document.querySelector("p"); const cs = getComputedStyle(p); return { lh: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize), mb: parseFloat(cs.marginBottom) / parseFloat(cs.lineHeight), align: cs.textAlign, ancho: parseFloat(cs.maxWidth) / parseFloat(cs.fontSize) }; });
  comprobar(dis.lh >= 1.5 && dis.mb >= 1.5 && /left|start/.test(dis.align) && dis.ancho <= 80, "modo dislexia: interlineado 1,5, párrafos a 1,5 veces el interlineado, sin justificar, renglón ≤ 80 caracteres", JSON.stringify(dis));
  await page.evaluate(() => Winclus.caja.getElementById("wcl-dislexia").click());

  // --- sitio: axe AAA, objetivos, glosario, migas, «En pocas palabras», transcripciones ---
  const paginas = fs.readdirSync(path.join(RAIZ, "web")).filter((f) => /\.html$/.test(f) && !/widget-demo/.test(f));
  const malas = [], sinGlosario = [], sinMigas = [], chicosSitio = [];
  for (const f of paginas) {
    await page.goto("file:///" + path.join(RAIZ, "web", f).replace(/\\/g, "/"));
    await page.addScriptTag({ content: AXE });
    const r = await page.evaluate(async (tags) => {
      const res = await axe.run(document, { runOnly: { type: "tag", values: tags }, exclude: [[".wcl-root"]] });
      const chicos = Array.from(document.querySelectorAll("a[href], button")).filter((b) => { if (b.closest(".wcl-root")) return false; const cs = getComputedStyle(b); if (cs.display === "inline") return false; /* los enlaces dentro de un texto están exentos (excepción «en línea» del criterio) */ const rc = b.getBoundingClientRect(); return rc.width && rc.height && (rc.width < 44 || rc.height < 44); }).map((b) => (b.textContent.trim() || b.getAttribute("aria-label") || "?").slice(0, 30) + " " + Math.round(b.getBoundingClientRect().width) + "×" + Math.round(b.getBoundingClientRect().height));
      return { v: res.violations.map((x) => x.id + ":" + x.nodes.length), chicos, glosario: !!document.querySelector('footer a[href="glosario"], .pie a[href="glosario"], .nota a[href="glosario"]'), migas: !!document.querySelector('nav.migas [aria-current="page"]') };
    }, TAGS);
    if (r.v.length) malas.push(f + ": " + r.v.join(", "));
    if (!r.glosario) sinGlosario.push(f);
    if (!r.migas && !/^(index|presentacion|evidencia|glosario)\.html$/.test(f)) sinMigas.push(f);
    if (r.chicos.length) chicosSitio.push(f + ": " + r.chicos.slice(0, 4).join(" | "));
  }
  comprobar(malas.length === 0, "reglas AAA de axe sobre las " + paginas.length + " páginas del sitio (contraste 7:1 incluido): sin violaciones", malas.join(" || "));
  comprobar(chicosSitio.length === 0, "2.5.5: enlaces y botones del sitio que no van en línea miden al menos 44 px", chicosSitio.join(" || "));
  comprobar(sinGlosario.length === 0, "3.1.4: el glosario está enlazado desde el pie de todas las páginas", sinGlosario.join(", "));
  comprobar(sinMigas.length === 0, "2.4.8: las páginas interiores llevan migas de pan con aria-current", sinMigas.join(", "));
  const glos = fs.readFileSync(path.join(RAIZ, "web/glosario.html"), "utf8");
  comprobar(["WCAG", "CSP", "SRI", "ARIA", "LSC", "NVDA", "PDF", "MinTIC", "NTC 5854", "ARASAAC"].every((t) => glos.includes(t)), "3.1.4: el glosario explica las siglas usadas en el sitio");
  const facil = ["integrar", "manual", "cumplimiento", "accesibilidad", "privacidad"].filter((p) => !/class="facil"><h2>En pocas palabras/.test(fs.readFileSync(path.join(RAIZ, "web", p + ".html"), "utf8")));
  comprobar(facil.length === 0, "3.1.5: las páginas técnicas y legales empiezan con «En pocas palabras»", facil.join(", "));
  const demo = fs.readFileSync(path.join(RAIZ, "web/demo.html"), "utf8");
  comprobar((demo.match(/class="transcripcion"/g) || []).length === 4 && /El marco azul recorre/.test(demo), "1.2.8: los cuatro vídeos de la demostración llevan transcripción en texto", String((demo.match(/class="transcripcion"/g) || []).length));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
