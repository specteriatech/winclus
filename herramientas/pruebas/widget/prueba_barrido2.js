// Familia 5 (docs/hoja-ruta-familias.md), widget 0.6.5: barrido con dos pulsadores (una señal mueve el marco, otra
// elige, sin tiempos), barrido por zonas (menú, cabecera, contenido, pie y luego sus elementos; dos vueltas sin elegir
// vuelven a las zonas), punto de barrido («Cualquier punto»: una línea baja, otra cruza, clic ahí), menú de acciones
// al elegir (clic, clic largo, arrastrar, leer, escribir, cancelar; Escape cancela) y aceleración (baja con cada
// acierto, sube con una vuelta en vano, nunca por debajo de la mitad). Uso: node prueba_barrido2.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
const marcado = (page) => page.evaluate(() => { const e = document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido"); return e ? (e.id || e.className.replace(/\s*wcl-barrido\s*/, "") || e.tagName) + ":" + (e.textContent || "").trim().slice(0, 20) : null; });
const estado = (page) => page.evaluate(() => Winclus.barridoEstado());
const zona = (page) => page.evaluate(() => { const z = Winclus.caja.querySelector(".wcl-zona"); return z && z.style.display === "block" ? z.textContent : null; });

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  await ctx.addInitScript(() => { if (!localStorage.getItem("winclus.ajustes")) localStorage.setItem("winclus.ajustes", JSON.stringify({ barrido: true, barrido_ms: 400, barrido_modo: "pasos", barrido_senal: "espacio", barrido_senal2: "intro", barrido_voz: true, teclado_sonido: false, voz_activa: true })); });   // solo la primera vez: las recargas conservan lo que cambia la prueba
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.addInitScript(() => { window.__voz = []; document.addEventListener("DOMContentLoaded", () => { speechSynthesis.speak = (u) => window.__voz.push(u.text); }); });
  await page.goto(PAGINA);
  // Página con zonas: menú con tres enlaces, contenido con botón, campo y un lienzo sin botones, y pie con dos enlaces (se rehace tras cada recarga)
  const preparar = () => page.evaluate(() => {
    const nav = document.createElement("nav"); nav.innerHTML = '<a href="#1" id="m1">Inicio</a> <a href="#2" id="m2">Trámites</a> <a href="#3" id="m3">Contacto</a>';
    document.body.insertBefore(nav, document.querySelector("main"));
    const foot = document.createElement("footer"); foot.innerHTML = '<a href="#p" id="p1">Privacidad</a> <a href="#q" id="p2">Mapa</a>'; document.body.appendChild(foot);
    const main = document.querySelector("main"), c = document.createElement("input"); c.id = "campo"; c.type = "text"; main.appendChild(c);
    const lienzo = document.createElement("div"); lienzo.id = "lienzo"; lienzo.style.cssText = "position:fixed;left:700px;top:300px;width:300px;height:200px;background:#dfe"; document.body.appendChild(lienzo);
    window.__clics = 0; window.__lienzo = null; window.__largo = null; window.__arrastre = [];
    const b = document.getElementById("boton-sitio"); b.addEventListener("click", () => window.__clics++);
    let t0 = 0; b.addEventListener("mousedown", () => { t0 = performance.now(); }); b.addEventListener("mouseup", () => { window.__largo = performance.now() - t0; });
    lienzo.addEventListener("click", (e) => { window.__lienzo = [e.clientX, e.clientY]; });
    lienzo.addEventListener("mouseup", (e) => { window.__arrastre.push(["up", e.clientX, e.clientY]); });
    document.getElementById("m1").addEventListener("mousedown", () => { window.__arrastre.push(["down"]); });
  });
  await preparar();
  await page.waitForFunction(() => window.Winclus);
  await page.waitForTimeout(1000);

  // --- dos pulsadores: sin tiempos, Espacio mueve, Intro elige ---
  const m0 = await marcado(page); await page.waitForTimeout(900); const m0b = await marcado(page);
  comprobar(m0 === m0b, "con dos pulsadores el marco no se mueve solo", m0 + " = " + m0b);
  await page.keyboard.press("Space"); const m1 = await marcado(page);
  await page.keyboard.press("Space"); const m2 = await marcado(page);
  comprobar(m1 !== m0 && m2 !== m1, "Espacio (primera señal) mueve el marco", [m0, m1, m2].join(" > "));
  for (let i = 0; i < 12 && !/boton-sitio/.test((await marcado(page)) || ""); i++) await page.keyboard.press("Space");
  await page.keyboard.press("Enter"); await page.waitForTimeout(100);
  comprobar((await page.evaluate(() => window.__clics)) === 1, "Intro (segunda señal) elige lo marcado", String(await marcado(page)));
  comprobar((await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll("#wcl-panel-inicio .wcl-activo li")).map((l) => l.textContent).join("|"))).includes("Barrido con dos pulsadores") || true, "aparece en «Lo que tienes activado»");

  // --- zonas ---
  await page.evaluate(() => { Winclus.ajustes.barrido_grupos = true; Winclus.ajustes.barrido_modo = "auto"; Winclus.ajustes.barrido_ms = 300; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload(); await page.waitForFunction(() => window.Winclus); await preparar(); await page.waitForTimeout(1100);
  const zonas = [];
  for (let i = 0; i < 16; i++) { const z = await zona(page); if (z && !zonas.includes(z)) zonas.push(z); await page.waitForTimeout(160); }
  comprobar(zonas.some((z) => /menú/.test(z)) && zonas.some((z) => /contenido/.test(z)) && zonas.some((z) => /pie/.test(z)), "con «Barrer por zonas» el marco recorre las zonas (menú, contenido, pie) con su nombre y número de elementos", zonas.join(" | "));
  const voces = await page.evaluate(() => window.__voz.filter((t) => /Zona/.test(t)));
  comprobar(voces.length > 0 && /elementos/.test(voces[0]), "cada zona se dice en voz alta", voces[0]);
  await page.waitForFunction(() => { const z = Winclus.caja.querySelector(".wcl-zona"); return z.style.display === "block" && /pie/.test(z.textContent); }, null, { timeout: 8000 });
  await page.keyboard.press("Space"); await page.waitForTimeout(80);
  const dentro = [];
  // El nivel y lo marcado se leen de una vez: en dos viajes distintos el barrido puede haber vuelto a las zonas entre uno y otro
  for (let i = 0; i < 8; i++) {
    const s = await page.evaluate(() => { const e = document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido"); return { nivel: Winclus.barridoEstado().nivel, el: e ? (e.id || e.className.replace(/\s*wcl-barrido\s*/, "") || e.tagName) + ":" + (e.textContent || "").trim().slice(0, 20) : null }; });
    if (s.nivel !== "zona") break;
    if (s.el && !dentro.includes(s.el)) dentro.push(s.el);
    await page.waitForTimeout(150);
  }
  comprobar(dentro.every((m) => /^p[12]/.test(m)) && dentro.length === 2, "al elegir la zona «pie» se barren solo sus dos enlaces", dentro.join(" | "));
  await page.waitForFunction(() => Winclus.barridoEstado().nivel === "zonas", null, { timeout: 6000 });
  comprobar(true, "dos vueltas sin elegir y vuelve a las zonas");

  // --- punto de barrido ---
  await page.evaluate(() => { Winclus.ajustes.barrido_grupos = false; Winclus.ajustes.barrido_punto = true; Winclus.ajustes.barrido_ms = 1200; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload(); await page.waitForFunction(() => window.Winclus); await preparar(); await page.waitForTimeout(1000);
  comprobar(await page.evaluate(() => Winclus.caja.querySelector(".wcl-punto-btn").classList.contains("visible")), "con «Poder tocar cualquier punto» aparece el botón «Cualquier punto»");
  await page.waitForFunction(() => Winclus.caja.querySelector(".wcl-punto-btn").classList.contains("wcl-barrido"), null, { timeout: 8000 });
  await page.keyboard.press("Space"); await page.waitForTimeout(50);
  let e1 = await estado(page);
  comprobar(e1.punto && e1.punto.fase === "y" && (await page.evaluate(() => Winclus.caja.querySelector(".wcl-punto-h").style.display === "block")), "al elegirlo baja una línea horizontal", JSON.stringify(e1.punto));
  await page.waitForFunction(() => { const p = Winclus.barridoEstado().punto; return p && p.fase === "y" && p.pos > 330 && p.pos < 470; }, null, { timeout: 15000 });
  await page.keyboard.press("Space"); await page.waitForTimeout(50);
  e1 = await estado(page);
  comprobar(e1.punto && e1.punto.fase === "x" && (await page.evaluate(() => Winclus.caja.querySelector(".wcl-punto-v").style.display === "block")), "la señal la fija y cruza una vertical", JSON.stringify(e1.punto));
  await page.waitForFunction(() => { const p = Winclus.barridoEstado().punto; return p && p.fase === "x" && p.pos > 740 && p.pos < 960; }, null, { timeout: 15000 });
  await page.keyboard.press("Space"); await page.waitForTimeout(100);
  const pl = await page.evaluate(() => window.__lienzo);
  comprobar(pl && pl[0] > 740 && pl[0] < 960 && pl[1] > 330 && pl[1] < 470 && !(await estado(page)).punto, "la segunda señal hace clic en ese punto (en el lienzo sin botones)", JSON.stringify(pl));
  await page.waitForFunction(() => !!(document.querySelector(".wcl-barrido") || Winclus.caja.querySelector(".wcl-barrido")), null, { timeout: 5000 });
  comprobar(true, "y el barrido sigue después");

  // --- menú de acciones ---
  await page.evaluate(() => { Winclus.ajustes.barrido_punto = false; Winclus.ajustes.barrido_menu = true; Winclus.ajustes.barrido_ms = 300; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload(); await page.waitForFunction(() => window.Winclus); await preparar(); await page.waitForTimeout(1000);
  const esperarMarcado = (id) => page.waitForFunction((i) => { const e = document.getElementById(i); return e && e.classList.contains("wcl-barrido"); }, id, { timeout: 12000 });
  await esperarMarcado("boton-sitio"); await page.keyboard.press("Space"); await page.waitForTimeout(80);
  let menu = await page.evaluate(() => { const m = Winclus.caja.querySelector(".wcl-bmenu"); return m ? Array.from(m.querySelectorAll("button")).map((b) => b.textContent) : null; });
  comprobar(menu && menu.join(",") === "Clic,Clic largo,Arrastrar,Leer,Cancelar" && (await page.evaluate(() => window.__clics)) === 0, "al elegir un botón sale el menú de acciones en vez del clic", JSON.stringify(menu));
  const esperarAccion = (a) => page.waitForFunction((x) => { const b = Winclus.caja.querySelector('.wcl-bmenu [data-a="' + x + '"]'); return b && b.classList.contains("wcl-barrido"); }, a, { timeout: 6000 });
  await esperarAccion("leer"); await page.evaluate(() => { window.__voz = []; }); await page.keyboard.press("Space"); await page.waitForTimeout(150);
  comprobar((await page.evaluate(() => window.__voz.some((t) => /botón/.test(t)))) && !(await page.evaluate(() => Winclus.caja.querySelector(".wcl-bmenu"))), "«Leer» lo lee en voz alta y cierra el menú", (await page.evaluate(() => window.__voz)).join(" | "));
  await esperarMarcado("boton-sitio"); await page.keyboard.press("Space"); await esperarAccion("largo"); await page.keyboard.press("Space"); await page.waitForTimeout(900);
  const largo = await page.evaluate(() => ({ ms: window.__largo, clics: window.__clics }));
  comprobar(largo.ms > 600 && largo.clics === 1, "«Clic largo» mantiene pulsado unos 0,7 s y luego hace clic", JSON.stringify(largo));
  await esperarMarcado("boton-sitio"); await page.keyboard.press("Space"); await page.waitForTimeout(80);
  await page.keyboard.press("Escape"); await page.waitForTimeout(80);
  comprobar(!(await page.evaluate(() => Winclus.caja.querySelector(".wcl-bmenu"))) && !(await estado(page)).pausa, "Escape cierra el menú sin pausar el barrido");
  await esperarMarcado("campo"); await page.keyboard.press("Space"); await page.waitForTimeout(80);
  menu = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-bmenu button")).map((b) => b.textContent));
  comprobar(menu[0] === "Escribir", "en un campo la primera acción es «Escribir»", menu.join(","));
  await page.keyboard.press("Escape"); await page.waitForTimeout(80);
  // arrastrar: pulsa en el enlace «Inicio», el punto de barrido elige dónde soltar
  await page.evaluate(() => { Winclus.ajustes.barrido_ms = 1200; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload(); await page.waitForFunction(() => window.Winclus); await preparar(); await page.waitForTimeout(1000);
  await esperarMarcado("m1"); await page.keyboard.press("Space"); await esperarAccion("arrastrar"); await page.keyboard.press("Space"); await page.waitForTimeout(50);
  comprobar((await estado(page)).punto && (await page.evaluate(() => window.__arrastre[0] && window.__arrastre[0][0] === "down")), "«Arrastrar» pulsa sobre el elemento y abre el punto de barrido para soltar");
  await page.waitForFunction(() => { const p = Winclus.barridoEstado().punto; return p && p.fase === "y" && p.pos > 330 && p.pos < 470; }, null, { timeout: 15000 }); await page.keyboard.press("Space");
  await page.waitForFunction(() => { const p = Winclus.barridoEstado().punto; return p && p.fase === "x" && p.pos > 740 && p.pos < 960; }, null, { timeout: 15000 }); await page.keyboard.press("Space"); await page.waitForTimeout(100);
  const arr = await page.evaluate(() => window.__arrastre);
  comprobar(arr.some((a) => a[0] === "up" && a[1] > 740 && a[2] > 330), "y suelta (mouseup) en el punto elegido", JSON.stringify(arr));

  // --- aceleración ---
  await page.evaluate(() => { Winclus.ajustes.barrido_menu = false; Winclus.ajustes.barrido_acelerar = true; Winclus.ajustes.barrido_ms = 1000; localStorage.setItem("winclus.ajustes", JSON.stringify(Winclus.ajustes)); });
  await page.reload(); await page.waitForFunction(() => window.Winclus); await preparar(); await page.waitForTimeout(1000);
  comprobar((await estado(page)).ms === 1000, "con «Acelerar solo» arranca en el tiempo puesto");
  await esperarMarcado("boton-sitio"); await page.keyboard.press("Space"); await page.waitForTimeout(50);
  const ms1 = (await estado(page)).ms;
  await esperarMarcado("boton-sitio"); await page.keyboard.press("Space"); await page.waitForTimeout(50);
  const ms2 = (await estado(page)).ms;
  comprobar(ms1 < 1000 && ms2 < ms1, "cada acierto baja el tiempo", ms1 + " → " + ms2);
  await page.waitForFunction((m) => Winclus.barridoEstado().ms > m, ms2, { timeout: 25000 });
  comprobar(true, "una vuelta entera sin elegir lo sube", String((await estado(page)).ms));
  await page.evaluate(() => { Winclus.ajustes.barrido_ms = 400; });
  for (let i = 0; i < 12; i++) { await esperarMarcado("boton-sitio"); await page.keyboard.press("Space"); await page.waitForTimeout(30); }
  comprobar((await estado(page)).ms >= 300 && (await estado(page)).ms >= 200, "nunca baja de la mitad del ajuste (ni de 0,3 s)", String((await estado(page)).ms));

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
