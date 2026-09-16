// Pasa axe-core (WCAG 2.1 AA) sobre el propio widget: cada pestaña del panel, el teclado en
// pantalla, el modo fácil y el botón de pausa. Requiere: npm i (playwright y axe-core) y
// npx playwright install chromium. Uso: node prueba_axe.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");
const fs = require("fs");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function correr(page, nombre) {
  const r = await page.evaluate(async () => {
    const res = await axe.run(document.querySelector(".wcl-root"), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
    // revisados: cuántos elementos pasaron alguna regla; si es ~0, axe no entró en el shadow root y la prueba no vale
    return { revisados: res.passes.reduce((s, p) => s + p.nodes.length, 0), v: res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodos: v.nodes.map((n) => ({ sel: n.target.join(" "), msg: (n.any.concat(n.all, n.none)[0] || {}).message || "" })) })) };
  }).then((x) => { x.v.revisados = x.revisados; return x.v; });
  const n = r.reduce((s, v) => s + v.nodos.length, 0), pocos = r.revisados < 10;
  if (pocos) r.push({ id: "axe-no-reviso", impact: "critical", help: "axe revisó muy pocos elementos (" + r.revisados + "): no entró en el widget", nodos: [{ sel: ".wcl-root", msg: "" }] });
  console.log((n || pocos ? "MAL " : "OK  ") + nombre + ": " + r.length + " regla(s) incumplida(s), " + n + " elemento(s), " + r.revisados + " revisados");
  for (const v of r) {
    console.log("   [" + v.impact + "] " + v.id + ": " + v.help);
    for (const nd of v.nodos.slice(0, 6)) console.log("      " + nd.sel + (nd.msg ? "  -> " + nd.msg.replace(/\s+/g, " ").slice(0, 160) : ""));
    if (v.nodos.length > 6) console.log("      … y " + (v.nodos.length - 6) + " más");
  }
  return r;
}

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.addScriptTag({ content: AXE });
  const todo = [];
  await page.evaluate(() => Winclus.abrir());
  for (const tab of ["ver", "oir", "cara", "clics", "escribir", "mas"]) {
    await page.click("#wcl-tab-" + tab);
    await page.waitForTimeout(100);
    todo.push(...await correr(page, "pestaña " + tab));
  }
  await page.evaluate(() => Winclus.cerrar());
  await page.evaluate(() => Winclus.teclado());
  await page.waitForTimeout(150);
  todo.push(...await correr(page, "teclado en pantalla"));
  await page.evaluate(() => { const t = Array.from(Winclus.caja.querySelectorAll(".wcl-tec button")).find((b) => b.textContent === "Frases"); if (t) t.click(); });
  await page.waitForTimeout(150);
  todo.push(...await correr(page, "teclado, capa Frases"));
  await page.evaluate(() => Winclus.teclado());
  await page.evaluate(() => { Winclus.ajustes.facil = true; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload();
  await page.waitForFunction(() => window.Winclus);
  await page.addScriptTag({ content: AXE });
  await page.evaluate(() => Winclus.abrir());
  await page.waitForTimeout(150);
  todo.push(...await correr(page, "modo fácil"));
  // Contraste de lo que axe no mira: componentes sin texto (interruptores, bordes, foco) y el botón Pausar,
  // que solo se ve con la cámara activa. Fórmula de luminancia relativa de WCAG; mínimo 3:1 (1.4.11) o 4,5:1 (texto).
  await page.evaluate(() => { Winclus.ajustes.facil = false; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload();
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { const p = Winclus.caja.querySelector(".wcl-pausa"); p.style.display = "block"; Winclus.abrir(); });
  await page.click("#wcl-tab-ver");
  await page.waitForTimeout(100);
  const manual = await page.evaluate(() => {
    function lum(c) { const m = c.match(/\d+(\.\d+)?/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => v / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
    function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    function fondo(e) { while (e && e !== document.documentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return "rgb(255, 255, 255)"; }
    const cs = (sel) => getComputedStyle(Winclus.caja.querySelector(sel));
    const sw = Winclus.caja.querySelector(".wcl-sw"), swOn = Winclus.caja.querySelector('.wcl-sw[aria-checked="true"]') || sw;
    const pausa = Winclus.caja.querySelector(".wcl-pausa"), tecla = null;
    const casos = [
      ["Pausar: texto sobre fondo", cs(".wcl-pausa").color, cs(".wcl-pausa").backgroundColor, 4.5],
      ["interruptor apagado sobre el panel", cs(".wcl-sw").backgroundColor, fondo(sw.parentElement), 3],
      ["interruptor encendido sobre el panel", (() => { swOn.setAttribute("aria-checked", "true"); const c = getComputedStyle(swOn).backgroundColor; return c; })(), fondo(swOn.parentElement), 3],
      ["borde de los botones − / +", cs(".wcl-mm button").borderTopColor, fondo(Winclus.caja.querySelector(".wcl-mm button").parentElement), 3],
      ["borde de las opciones", cs(".wcl-opc button").borderTopColor, fondo(Winclus.caja.querySelector(".wcl-opc button").parentElement), 3],
      ["foco del botón flotante (anillo)", "rgb(47, 79, 216)", "rgb(255, 255, 255)", 3],
      ["texto del aviso de estado", cs(".wcl-estado").color, fondo(Winclus.caja.querySelector(".wcl-estado")), 4.5],
    ];
    return casos.map(([n, a, b, min]) => ({ n, a, b, r: ratio(a, b), min }));
  });
  let malManual = 0;
  for (const c of manual) { const ok = c.r >= c.min; malManual += ok ? 0 : 1; console.log((ok ? "OK  " : "MAL ") + c.n + ": " + c.r.toFixed(2) + ":1 (mínimo " + c.min + ")"); }
  await page.evaluate(() => Winclus.teclado());
  await page.waitForTimeout(150);
  const teclado = await page.evaluate(() => {
    function lum(c) { const m = c.match(/\d+(\.\d+)?/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => v / 255).map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
    function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    const t = getComputedStyle(Winclus.caja.querySelector(".wcl-tec .fila:not(.sug) button")), fondo = getComputedStyle(Winclus.caja.querySelector(".wcl-tec")).backgroundColor;
    return [{ n: "borde de las teclas sobre el teclado", r: ratio(t.borderTopColor, fondo), min: 3 }, { n: "texto de las teclas", r: ratio(t.color, t.backgroundColor), min: 4.5 }];
  });
  for (const c of teclado) { const ok = c.r >= c.min; malManual += ok ? 0 : 1; console.log((ok ? "OK  " : "MAL ") + c.n + ": " + c.r.toFixed(2) + ":1 (mínimo " + c.min + ")"); }
  await nav.close();
  const ids = {};
  if (malManual) ids["contraste-manual"] = malManual;
  for (const v of todo) ids[v.id] = (ids[v.id] || 0) + v.nodos.length;
  const contraste = ids["color-contrast"] || 0;
  console.log("resumen: " + JSON.stringify(ids));
  console.log(contraste ? contraste + " elemento(s) sin contraste suficiente" : "contraste: todo bien");
  process.exit(Object.keys(ids).length ? 1 : 0);
})();
