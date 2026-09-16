// Capturas de pantalla para la guía de uso (web/guia.html): una por situación, con el widget en marcha sobre la
// página de demostración (demo.html), servida por servidor.js. Salen en web/img/guia/*.png. Uso: node capturas.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "../../..");
const SALIDA = path.join(RAIZ, "web/img/guia");
const DEMO = "http://127.0.0.1:8765/demo.html";
const VISTA = { width: 1100, height: 680 };

const abrirTab = (page, tab) => page.evaluate((t) => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-" + t).click(); }, tab);
const verEnPanel = (page, texto) => page.evaluate((re) => {
  const e = Array.from(Winclus.caja.querySelectorAll(".wcl-panel label, .wcl-panel h2, .wcl-panel button, .wcl-panel span, .wcl-panel p, .wcl-panel .wcl-estado")).find((x) => new RegExp(re).test(x.textContent) && x.getClientRects().length);
  if (!e) return "no encontrado";
  let s = e.parentElement; while (s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight)) s = s.parentElement;
  if (s) s.scrollTop += e.getBoundingClientRect().top - s.getBoundingClientRect().top - 84; else e.scrollIntoView({ block: "center" });
  return (s ? s.className : "sin scroller") + " · " + e.tagName + " " + e.textContent.slice(0, 40);
}, texto).then((r) => console.log("  panel → " + r));
const botonPanel = (page, panel, texto) => page.evaluate(([p, re]) => { Array.from(Winclus.caja.querySelectorAll("#wcl-panel-" + p + " button")).find((b) => new RegExp(re, "i").test(b.textContent)).click(); }, [panel, texto]);

async function captura(nombre, ajustes, pasos) {
  if (process.env.SOLO && process.env.SOLO.split(",").indexOf(nombre) < 0) return;
  const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await nav.newContext({ viewport: VISTA, deviceScaleFactor: 1.5 });
  await ctx.addInitScript((a) => localStorage.setItem("winclus.ajustes", JSON.stringify(a)), Object.assign({ voz_activa: false, teclado_sonido: false }, ajustes));
  await ctx.addInitScript(() => { document.addEventListener("DOMContentLoaded", () => { speechSynthesis.speak = (u) => { if (u.onend) setTimeout(() => u.onend(), 50); }; }); });
  const page = await ctx.newPage();
  await page.goto(DEMO, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => document.getElementById("t-sede").scrollIntoView({ block: "start" }));
  await page.waitForTimeout(500);
  await pasos(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SALIDA, nombre + ".png") });
  await nav.close();
  console.log(nombre + ".png");
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  try {
    await captura("cara", {}, async (page) => {
      await abrirTab(page, "cara");
      await page.evaluate(() => { const r = document.getElementById("ver-requisitos").getBoundingClientRect(); Winclus.mover(r.left + 30, r.top + 8); });
    });
    await captura("pulsador", { barrido: true, barrido_ms: 900, barrido_senal: "espacio" }, async (page) => {
      await page.waitForFunction(() => document.getElementById("enviar").classList.contains("wcl-barrido") || document.getElementById("ver-requisitos").classList.contains("wcl-barrido"), null, { timeout: 30000 });
    });
    await captura("voz", {}, async (page) => {
      await page.evaluate(() => Winclus.orden("números"));
      await page.waitForTimeout(300);
    });
    await captura("escribir", {}, async (page) => {
      await page.focus("#nombre");
      await page.evaluate(() => Winclus.teclado());
      await page.waitForTimeout(300);
      for (const l of ["m", "a", "r"]) await page.locator(".wcl-tec button").filter({ hasText: new RegExp("^" + l + "$") }).first().click();
      await page.waitForTimeout(300);
    });
    await captura("hablar", {}, async (page) => {
      await abrirTab(page, "oir");
      await botonPanel(page, "oir", "pictogramas");
      await page.waitForTimeout(1500);
      const toca = async (cat, n) => { await page.evaluate((c) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).find((b) => b.textContent === c).click(); }, cat); await page.waitForTimeout(600); await page.evaluate((x) => { const p = Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).find((b) => b.textContent.trim() === x); if (p) p.click(); }, n); await page.waitForTimeout(400); };
      await toca("Personas", "yo"); await toca("Acciones", "necesito"); await toca("Básico", "ayuda");
      await page.waitForTimeout(1500);
    });
    await captura("ver", { texto: 150, contraste: true, cursor_grande: true }, async (page) => {
      await abrirTab(page, "ver");
      await verEnPanel(page, "Tamaño del texto");
    });
    await captura("colores", { dalton: "protan" }, async (page) => {
      await abrirTab(page, "ver");
      await verEnPanel(page, "Corrección de color");
    });
    await captura("ciego", { lector: true }, async (page) => {
      await page.mouse.click(700, 250);
      await page.keyboard.press("h"); await page.keyboard.press("h");
      await page.waitForTimeout(300);
      await abrirTab(page, "oir");
      await verEnPanel(page, "Lector de pantalla");
    });
    await captura("oir", { alertas_sonido: true, subtitulos: true }, async (page) => {
      await abrirTab(page, "oir");
      await verEnPanel(page, "Avisar en pantalla");
      await page.evaluate(() => document.getElementById("sonar").click());
      await page.waitForTimeout(500);
    });
    await captura("leer", { dislexia: true }, async (page) => {
      await abrirTab(page, "ver");
      await botonPanel(page, "ver", "Lectura limpia");
      await page.waitForTimeout(800);
    });
    await captura("entender", {}, async (page) => {
      await abrirTab(page, "ver");
      await botonPanel(page, "ver", "Lectura limpia");
      await page.waitForTimeout(800);
      const antes = await page.evaluate(() => Winclus.caja.querySelector(".wcl-limpia-texto").textContent);
      await page.evaluate(() => Winclus.caja.querySelector('[data-a="facil"]').click());
      await page.waitForFunction((a) => Winclus.caja.querySelector(".wcl-limpia-texto").textContent !== a, antes, { timeout: 25000 });
      await page.waitForTimeout(500);
    });
    await captura("formulario", {}, async (page) => {
      await page.evaluate(() => document.getElementById("formulario").scrollIntoView({ block: "center" }));
      await page.fill("#nombre", "Ma");
      await page.fill("#correo", "sinarroba");
      await page.click("#enviar");
      await page.waitForTimeout(600);
    });
    await captura("calma", { calma: true, animaciones: true, volumen_max: 60 }, async (page) => {
      await abrirTab(page, "ver");
      await verEnPanel(page, "Modo calma");
    });
    await captura("mayores", { facil: true }, async (page) => {
      await page.evaluate(() => Winclus.abrir());
    });
  } finally { servidor.kill(); }
})();
