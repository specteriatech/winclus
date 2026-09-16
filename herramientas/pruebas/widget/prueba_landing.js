// winclus.com: la portada, la política de privacidad y la declaración de accesibilidad pasan axe-core
// (WCAG 2.1/2.2 AA), cargan el propio widget y se enlazan entre sí. Usa el servidor local.
// Uso: node prueba_landing.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  for (const ancho of [1280, 390]) {
    const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } });
    const page = await ctx.newPage();
    for (const ruta of ["/", "/privacidad.html", "/accesibilidad.html"]) {
      const errores = [];
      page.on("pageerror", (e) => errores.push(String(e)));
      await page.goto("http://127.0.0.1:8765" + ruta);
      await page.waitForFunction(() => window.Winclus, null, { timeout: 15000 }).catch(() => {});
      await page.addScriptTag({ content: AXE });
      const r = await page.evaluate(async () => {
        const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sel: v.nodes.slice(0, 3).map((x) => x.target.join(" ")) }));
      });
      const widget = await page.evaluate(() => !!(window.Winclus && Winclus.caja.querySelector(".wcl-btn")));
      const enlaces = await page.evaluate(() => Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href") || ""));
      const scrollX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      const nombre = ruta + " a " + ancho + " px";
      comprobar(r.length === 0, nombre + ": axe sin incumplimientos", r.map((v) => v.id + "×" + v.n + " " + v.sel.join(",")).join("; "));
      comprobar(widget, nombre + ": carga el widget");
      const aPriv = enlaces.some((h) => /privacidad/.test(h)), aAcc = enlaces.some((h) => /accesibilidad/.test(h));
      comprobar(ruta === "/" ? aPriv && aAcc : ruta === "/privacidad.html" ? aAcc : aPriv, nombre + ": enlaza las otras páginas legales");
      comprobar(!scrollX, nombre + ": sin scroll horizontal");
      comprobar(errores.length === 0, nombre + ": sin errores JS", errores.join(" | "));
    }
    await ctx.close();
  }
  await nav.close();
  servidor.kill();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
