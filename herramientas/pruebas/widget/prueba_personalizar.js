// Panel con la marca del sitio (0.8.2): data-logo y data-nombre en la cabecera, data-ocultar quita pestañas.
// Usa el servidor local. Uso: node prueba_personalizar.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const base = fs.readFileSync(path.join(__dirname, "pagina-prueba.html"), "utf8").replace('src="../../../web/widget.js"', 'src="/widget.js"');
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const abrir = async (nombre, extra, lang) => {
    fs.writeFileSync(path.join(__dirname, nombre), base.replace('src="/widget.js"', 'src="/widget.js"' + (extra || "")).replace('<html lang="es">', '<html lang="' + (lang || "es") + '">'));
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
    const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
    await page.goto("http://127.0.0.1:8765/pruebas/" + nombre);
    await page.waitForFunction(() => window.Winclus, null, { timeout: 20000 });
    await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); Winclus.vistaCompleta(true); });
    return { page, ctx, errores };
  };
  const estado = (page) => page.evaluate(() => {
    const c = Winclus.caja;
    const botones = [...c.querySelectorAll(".wcl-tabs button")];
    return {
      cab: c.querySelector(".wcl-cab").textContent.trim().replace(/\s+/g, " "),
      logoSitio: !!c.querySelector(".wcl-cab .wcl-logo-sitio"), logoWinclus: !!c.querySelector(".wcl-cab svg"),
      visibles: botones.filter((b) => !b.hidden).map((b) => b.textContent.trim()), ocultos: botones.filter((b) => b.hidden).map((b) => b.id.replace("wcl-tab-", "")),
      activa: (c.querySelector(".wcl-tab.activa") || {}).id, panelesOcultosVisibles: [...c.querySelectorAll(".wcl-tab.activa")].map((e) => e.id).filter((id) => /cara|escribir/.test(id) && botones.find((b) => b.id === id.replace("panel", "tab")) && botones.find((b) => b.id === id.replace("panel", "tab")).hidden),
    };
  });

  // 1. sin atributos: como siempre
  let { page, ctx, errores } = await abrir("pagina-prueba-perso0.html", "");
  let e = await estado(page);
  comprobar(errores.length === 0 && e.cab.startsWith("Winclus") && !e.logoSitio && e.logoWinclus && e.visibles.length === 7 && e.ocultos.length === 0, "sin atributos: cabecera «Winclus», logo de Winclus y siete pestañas", e.cab + " · " + e.visibles.join(","));
  await ctx.close();

  // 2. logo y nombre
  ({ page, ctx, errores } = await abrir("pagina-prueba-perso1.html", ' data-logo="/img/logo.png" data-nombre="Alcaldía de Prueba"'));
  e = await estado(page);
  comprobar(errores.length === 0 && e.logoSitio && !e.logoWinclus && /Alcaldía de Prueba/.test(e.cab) && /con Winclus/.test(e.cab), "data-logo y data-nombre: el logo de la entidad y «Alcaldía de Prueba · con Winclus» en la cabecera", e.cab);
  const alt = await page.evaluate(() => Winclus.caja.querySelector(".wcl-cab img").getAttribute("alt"));
  comprobar(alt === "", "el logo del sitio es decorativo (alt vacío): el nombre ya lo dice");
  await ctx.close();

  // 3. nombre con inglés: «with Winclus»
  ({ page, ctx, errores } = await abrir("pagina-prueba-perso2.html", ' data-nombre="City Hall"', "en"));
  e = await estado(page);
  comprobar(errores.length === 0 && /City Hall/.test(e.cab) && /with Winclus/.test(e.cab), "en inglés la cabecera dice «with Winclus»", e.cab);
  await ctx.close();

  // 4. ocultar pestañas
  ({ page, ctx, errores } = await abrir("pagina-prueba-perso3.html", ' data-ocultar="cara, escribir"'));
  e = await estado(page);
  comprobar(errores.length === 0 && e.visibles.length === 5 && !e.visibles.includes("Cara") && !e.visibles.includes("Escribir") && e.ocultos.sort().join(",") === "cara,escribir", "data-ocultar=\"cara, escribir\": cinco pestañas visibles y esas dos ocultas", e.visibles.join(",") + " | ocultas " + e.ocultos.join(","));
  // elegirTab a una oculta no la enseña
  await page.evaluate(() => { Winclus.caja.querySelector("#wcl-tab-oir").click(); });
  await page.evaluate(() => { Winclus.caja.querySelector("#wcl-tab-cara").click(); });
  e = await estado(page);
  comprobar(e.activa === "wcl-panel-oir", "pulsar la pestaña oculta (por código) no la abre: sigue en Oír", e.activa);
  // flechas del teclado saltan las ocultas: desde Clics, → va a Más (no a Escribir)
  await page.evaluate(() => { Winclus.caja.querySelector("#wcl-tab-clics").click(); Winclus.caja.querySelector("#wcl-tab-clics").focus(); });
  await page.keyboard.press("ArrowRight");
  e = await estado(page);
  comprobar(e.activa === "wcl-panel-mas", "flecha derecha desde Clics salta Escribir y va a Más", e.activa);
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  e = await estado(page);
  comprobar(e.activa === "wcl-panel-oir", "flecha izquierda dos veces: Clics y luego Oír, sin pasar por Cara", e.activa);
  // «¿Qué te cuesta?»: las opciones que llevan a Cara no rompen nada
  await page.evaluate(() => { Winclus.caja.querySelector("#wcl-tab-inicio").click(); });
  const situ = await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-situ button")].map((b) => b.textContent.split("\n")[0].trim()));
  await page.evaluate(() => { const b = [...Winclus.caja.querySelectorAll(".wcl-situ button")].find((b) => /ratón|mouse/i.test(b.textContent)); if (b) b.click(); });
  await page.waitForTimeout(300);
  e = await estado(page);
  comprobar(errores.length === 0 && e.panelesOcultosVisibles.length === 0, "elegir «No puedo usar el ratón» con Cara oculta no abre la pestaña oculta ni da error", (e.activa || "") + " · " + errores.join(" | "));
  comprobar(situ.length > 5, "«¿Qué te cuesta?» sigue con sus opciones", situ.length + " opciones");
  await ctx.close();

  // 5. inicio y mas no se pueden ocultar
  ({ page, ctx, errores } = await abrir("pagina-prueba-perso4.html", ' data-ocultar="inicio,mas,ver"'));
  e = await estado(page);
  comprobar(errores.length === 0 && e.visibles.includes("Inicio") && e.visibles.includes("Más") && !e.visibles.includes("Ver"), "data-ocultar=\"inicio,mas,ver\": Inicio y Más salen igual, Ver se oculta", e.visibles.join(","));
  await ctx.close();

  await nav.close();
  servidor.kill();
  for (let i = 0; i < 5; i++) try { fs.unlinkSync(path.join(__dirname, "pagina-prueba-perso" + i + ".html")); } catch (e) {}
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
