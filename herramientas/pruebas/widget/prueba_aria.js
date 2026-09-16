// ARIA del panel: pestañas con el patrón Tabs (flechas, una sola tabulable, aria-controls), botones −/+
// con etiqueta propia y valor descrito, avisos en una región live, estado de cámara sin repeticiones,
// calibración como diálogo modal. Uso: node prueba_aria.js
const { chromium } = require("playwright");
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem("winclus.ajustes", JSON.stringify({ voz_activa: false })));
  const page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  await page.waitForTimeout(150);

  // --- pestañas ---
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).map((b) => ({ id: b.id, sel: b.getAttribute("aria-selected"), tab: b.tabIndex, ctrl: b.getAttribute("aria-controls"), panelOk: !!document.getElementById(b.getAttribute("aria-controls") || "") })));
  comprobar(tabs.length === 6 && tabs.filter((t) => t.tab === 0).length === 1 && tabs.every((t) => t.panelOk), "una sola pestaña tabulable y todas con aria-controls válido", JSON.stringify(tabs.map((t) => t.tab)));
  comprobar(tabs.find((t) => t.sel === "true").tab === 0, "la tabulable es la seleccionada");
  await page.focus('[role="tab"][aria-selected="true"]');
  const antes = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(80);
  const despues = await page.evaluate(() => ({ foco: document.activeElement.id, sel: document.activeElement.getAttribute("aria-selected"), visible: getComputedStyle(document.getElementById(document.activeElement.getAttribute("aria-controls"))).display !== "none" }));
  comprobar(despues.foco !== antes && despues.sel === "true" && despues.visible, "flecha derecha cambia de pestaña, la selecciona y muestra su panel", antes + " -> " + despues.foco);
  await page.keyboard.press("End");
  const fin = await page.evaluate(() => document.activeElement.id);
  await page.keyboard.press("Home");
  const inicio = await page.evaluate(() => document.activeElement.id);
  comprobar(fin === "wcl-tab-mas" && inicio === "wcl-tab-ver", "Fin e Inicio van a los extremos", fin + " / " + inicio);
  await page.keyboard.press("ArrowLeft");
  comprobar((await page.evaluate(() => document.activeElement.id)) === "wcl-tab-mas", "flecha izquierda da la vuelta");

  // --- botones − / + ---
  const mm = await page.evaluate(() => { const b = document.querySelectorAll("#wcl-panel-ver .wcl-mm button"); const d = document.getElementById(b[0].getAttribute("aria-describedby")); return { menos: b[0].getAttribute("aria-label"), mas: b[1].getAttribute("aria-label"), valor: d && d.textContent }; });
  comprobar(/^Reducir: Tamaño del texto/.test(mm.menos) && /^Aumentar: Tamaño del texto/.test(mm.mas) && mm.valor === "100 %", "−/+ dicen qué cambian y describen el valor", JSON.stringify(mm));

  // --- voz ---
  const voz = await page.evaluate(() => { const s = document.getElementById("wcl-voz-nombre"); return s && s.getAttribute("aria-live"); });
  comprobar(voz === "polite", "el nombre de la voz es una región live");

  // --- avisos ---
  await page.evaluate(() => Winclus.cerrar());
  await page.evaluate(() => { Winclus.mover(300, 400); Winclus.clic(); });
  await page.waitForTimeout(200);
  const vivo = await page.evaluate(() => { const v = document.querySelector(".wcl-vivo"); const r = v.getBoundingClientRect(); return { texto: v.textContent, live: v.getAttribute("aria-live"), role: v.getAttribute("role"), oculto: r.width <= 1 && r.height <= 1, ariaHidden: v.getAttribute("aria-hidden") }; });
  comprobar(vivo.live === "polite" && vivo.role === "status" && vivo.oculto && !vivo.ariaHidden, "hay una región live oculta visualmente para los avisos", JSON.stringify(vivo));
  comprobar(/Clic|Ahí|no hay/i.test(vivo.texto), "el aviso del clic llega a la región live", JSON.stringify(vivo.texto));

  // --- estado de la cámara: no se repite ---
  const repite = await page.evaluate(() => { const e = document.getElementById("wcl-estado"); let n = 0; const o = new MutationObserver(() => n++); o.observe(e, { childList: true, characterData: true, subtree: true }); return new Promise((res) => { setTimeout(() => { o.disconnect(); res(n); }, 100); }); });
  comprobar(repite === 0, "la región de estado no se toca si el texto no cambia");

  // --- calibración ---
  const calib = await page.evaluate(() => { const c = document.querySelector(".wcl-calib"); return { role: c.getAttribute("role"), modal: c.getAttribute("aria-modal"), label: c.getAttribute("aria-label") }; });
  comprobar(calib.role === "dialog" && calib.modal === "true" && !!calib.label, "la calibración es un diálogo modal con nombre", JSON.stringify(calib));

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
