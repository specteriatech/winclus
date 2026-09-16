// Comprueba que el botón y el panel del widget siguen dentro de la pantalla con cada
// ajuste activo (guardado en localStorage, como le pasa a una persona real), y que la
// cabecera fija del sitio no se descoloca. Requiere: npm i playwright && npx playwright install chromium
// Uso: node prueba_posicion.js
const { chromium } = require("playwright");
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
const VISTA = { width: 1280, height: 800 };

// Cada caso: ajustes guardados antes de cargar la página
const CASOS = [
  ["sin ajustes", {}],
  ["oscuro", { oscuro: true }],
  ["contraste", { contraste: true }],
  ["oscuro + contraste", { oscuro: true, contraste: true }],
  ["calma", { calma: true }],
  ["daltonismo protan", { dalton: "protan" }],
  ["oscuro + daltonismo", { oscuro: true, dalton: "deutan" }],
  ["texto 200 %", { texto: 200 }],
  ["enlaces", { enlaces: true }],
  ["animaciones", { animaciones: true }],
  ["dislexia", { dislexia: true }],
  ["sin imágenes", { sinimg: true }],
  ["máscara", { mascara: true }],
  ["guía", { guia: true }],
  ["modo fácil", { facil: true }],
  ["lupa de pantalla ×2", { lupa_pantalla: true, lupa_pantalla_zoom: 2 }],
  ["todo a la vez", { oscuro: true, contraste: true, calma: true, dalton: "tritan", texto: 150, enlaces: true, dislexia: true, mascara: true, guia: true }],
];

function dentro(r, v) { return r && r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= v.width + 0.5 && r.bottom <= v.height + 0.5; }
function fmt(r) { return r ? Math.round(r.left) + "," + Math.round(r.top) + " " + Math.round(r.width) + "×" + Math.round(r.height) : "-"; }

(async () => {
  const navegador = await chromium.launch();
  let fallos = 0;
  for (const [nombre, ajustes] of CASOS) {
    const ctx = await navegador.newContext({ viewport: VISTA });
    await ctx.addInitScript((a) => { localStorage.setItem("winclus.ajustes", JSON.stringify(a)); }, ajustes);
    const page = await ctx.newPage();
    const errores = [];
    page.on("pageerror", (e) => errores.push(String(e)));
    await page.goto(PAGINA);
    await page.waitForFunction(() => window.Winclus && Winclus.caja.querySelector(".wcl-btn"));
    await page.waitForTimeout(150);
    const rect = (sel) => page.evaluate((s) => { const e = Winclus.caja.querySelector(s) || document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }, sel);

    const boton = await rect(".wcl-btn");
    await page.evaluate(() => Winclus.abrir());
    await page.waitForTimeout(150);
    const panel = await rect(".wcl-panel");
    const panelVisible = await page.evaluate(() => { const p = Winclus.caja.querySelector(".wcl-panel"); const cs = getComputedStyle(p); return cs.display !== "none" && cs.visibility !== "hidden"; });
    await page.evaluate(() => Winclus.cerrar());

    // la cabecera fija del sitio debe seguir arriba tras hacer scroll
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(100);
    const cabecera = await rect("#cabecera");
    const scrollX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

    const problemas = [];
    if (!dentro(boton, VISTA)) problemas.push("botón fuera de pantalla " + fmt(boton));
    if (!panelVisible || !dentro(panel, VISTA)) problemas.push("panel fuera de pantalla o invisible " + fmt(panel));
    if (!ajustes.lupa_pantalla) {   // la lupa escala el body a propósito: no se le pide esto
      if (!cabecera || Math.abs(cabecera.top) > 0.5 || cabecera.width < VISTA.width - 20) problemas.push("cabecera fija del sitio descolocada " + fmt(cabecera));
      if (scrollX) problemas.push("scroll horizontal");
    }
    if (errores.length) problemas.push("errores JS: " + errores.join(" | "));
    fallos += problemas.length ? 1 : 0;
    console.log((problemas.length ? "MAL " : "OK  ") + nombre + (problemas.length ? " -> " + problemas.join("; ") : "  (botón " + fmt(boton) + ", panel " + fmt(panel) + ")"));
    await ctx.close();
  }

  // Cambiar el modo oscuro desde el panel (camino en vivo) y volver a cargar (camino guardado)
  {
    const ctx = await navegador.newContext({ viewport: VISTA });
    const page = await ctx.newPage();
    await page.goto(PAGINA);
    await page.waitForFunction(() => window.Winclus);
    await page.evaluate(() => Winclus.abrir());
    const clicado = await page.evaluate(() => {
      const filas = Array.from(Winclus.caja.querySelectorAll(".wcl-panel [role=switch]"));
      const s = filas.find((b) => /oscuro/i.test((b.getAttribute("aria-label") || "") + (b.parentElement && b.parentElement.textContent || "")));
      if (!s) return false; s.click(); return true;
    });
    await page.waitForTimeout(150);
    const r1 = await page.evaluate(() => { const r = Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
    const oscuroGuardado = await page.evaluate(() => JSON.parse(localStorage.getItem("winclus.ajustes") || "{}").oscuro);
    await page.reload();
    await page.waitForFunction(() => window.Winclus && Winclus.caja.querySelector(".wcl-btn"));
    await page.waitForTimeout(150);
    const r2 = await page.evaluate(() => { const r = Winclus.caja.querySelector(".wcl-btn").getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; });
    const bien = clicado && oscuroGuardado === true && dentro(r1, VISTA) && dentro(r2, VISTA);
    fallos += bien ? 0 : 1;
    console.log((bien ? "OK  " : "MAL ") + "interruptor de modo oscuro en vivo y tras recargar (botón " + fmt(r1) + " / " + fmt(r2) + ", guardado=" + oscuroGuardado + ", interruptor encontrado=" + clicado + ")");
    await ctx.close();
  }

  await navegador.close();
  console.log(fallos ? fallos + " caso(s) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
