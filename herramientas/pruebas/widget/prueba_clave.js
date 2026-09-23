// Clave de sitio (0.8.2): data-clave → el cargador pide /api/config y pasa la configuración al widget; el widget manda /api/uso al salir.
// La API se simula con page.route (no hace falta servidor de Winclus). Uso: node prueba_clave.js
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
  const abrir = async (nombre, extra, config, opciones) => {
    fs.writeFileSync(path.join(__dirname, nombre), base.replace('src="/widget.js"', 'src="/widget.js"' + (extra || "")));
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
    const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
    const pedidos = { config: [], uso: [] };
    await page.route("**/api/config**", async (route) => {
      pedidos.config.push(route.request().url());
      if (opciones && opciones.sinRespuesta) return route.abort();
      await route.fulfill({ status: config ? 200 : 404, contentType: "application/json", body: JSON.stringify(config || { error: "no" }) });
    });
    await page.route("**/api/uso**", async (route) => {
      pedidos.uso.push({ url: route.request().url(), cuerpo: route.request().postData() });
      await route.fulfill({ status: 204, body: "" });
    });
    await page.goto("http://127.0.0.1:8765/pruebas/" + nombre);
    await page.waitForFunction(() => window.Winclus, null, { timeout: 20000 });
    return { page, ctx, errores, pedidos };
  };
  const cab = (page) => page.evaluate(() => ({ cab: Winclus.caja.querySelector(".wcl-cab").textContent.trim().replace(/\s+/g, " "), logo: !!Winclus.caja.querySelector(".wcl-cab .wcl-logo-sitio"), visibles: [...Winclus.caja.querySelectorAll(".wcl-tabs button")].filter((b) => !b.hidden).map((b) => b.textContent.trim()), acerca: Winclus.caja.querySelector(".wcl-panel").textContent.includes("cifras de uso anónimas") }));

  // 1. con clave y configuración: marca, pestañas ocultas y color
  let { page, ctx, errores, pedidos } = await abrir("pagina-prueba-clave1.html", ' data-clave="abc123def456"', { nombre: "Alcaldía Clave", logo: "/img/logo.png", ocultar: "cara,escribir", color: "#123456" });
  let c = await cab(page);
  comprobar(pedidos.config.length === 1 && /api\/config\?clave=abc123def456$/.test(pedidos.config[0]), "el cargador pide /api/config con la clave", pedidos.config[0]);
  comprobar(errores.length === 0 && /Alcaldía Clave/.test(c.cab) && c.logo && c.visibles.length === 5 && !c.visibles.includes("Cara"), "la configuración llega al widget: nombre, logo y pestañas ocultas", c.cab + " · " + c.visibles.join(","));
  const color = await page.evaluate(() => getComputedStyle(Winclus.caja.querySelector(".wcl-btn")).backgroundColor);
  comprobar(color === "rgb(18, 52, 86)", "el color del botón viene de la configuración", color);
  comprobar(c.acerca, "«Acerca de» dice que el sitio recibe cifras de uso anónimas");
  // uso: abrir el panel, tocar un interruptor, salir → un POST con solo números
  await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); Winclus.vistaCompleta(true); Winclus.caja.querySelector("#wcl-tab-ver").click(); Winclus.caja.querySelector("#wcl-contraste").click(); });
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(500);
  comprobar(pedidos.uso.length === 1 && /api\/uso\?clave=abc123def456$/.test(pedidos.uso[0].url), "al ocultarse la página manda un POST a /api/uso con la clave", pedidos.uso.map((u) => u.url).join(","));
  let cuerpo = {}; try { cuerpo = JSON.parse(pedidos.uso[0].cuerpo || "{}"); } catch (e) {}
  comprobar(cuerpo.eventos && cuerpo.eventos.abierto === 1 && cuerpo.eventos["panel:Alto contraste"] === 1 && Object.keys(cuerpo).sort().join(",") === "eventos,pagina,version", "el cuerpo lleva solo números por opción, la página y la versión: nada de identificadores", JSON.stringify(cuerpo));
  const claves = Object.keys(cuerpo.eventos || {});
  comprobar(claves.every((k) => typeof cuerpo.eventos[k] === "number") && !/correo|email|ip|nombre|user/i.test(JSON.stringify(cuerpo)), "ningún dato personal en lo enviado");
  await ctx.close();

  // 2. lo escrito en la línea manda sobre la configuración
  ({ page, ctx, errores, pedidos } = await abrir("pagina-prueba-clave2.html", ' data-clave="abc123def456" data-nombre="Del HTML"', { nombre: "Del servidor" }));
  c = await cab(page);
  comprobar(/Del HTML/.test(c.cab) && !/Del servidor/.test(c.cab), "data-nombre escrito en la línea manda sobre el del servidor", c.cab);
  await ctx.close();

  // 3. sin respuesta del servidor el panel sale igual (en menos de 3 s)
  const t0 = Date.now();
  ({ page, ctx, errores, pedidos } = await abrir("pagina-prueba-clave3.html", ' data-clave="abc123def456"', null, { sinRespuesta: true }));
  c = await cab(page);
  comprobar(errores.length === 0 && c.cab.startsWith("Winclus") && c.visibles.length === 7 && Date.now() - t0 < 12000, "sin respuesta de /api/config el panel sale como siempre y sin esperar mucho", (Date.now() - t0) + " ms");
  await ctx.close();

  // 4. sin clave: ni config ni uso
  ({ page, ctx, errores, pedidos } = await abrir("pagina-prueba-clave4.html", "", null));
  await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); });
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(400);
  c = await cab(page);
  comprobar(pedidos.config.length === 0 && pedidos.uso.length === 0 && !c.acerca, "sin data-clave no se pide configuración ni se manda uso, y «Acerca de» no lo menciona");
  await ctx.close();

  // 5. clave con caracteres raros: se ignora
  ({ page, ctx, errores, pedidos } = await abrir("pagina-prueba-clave5.html", ' data-clave="../x?y"', { nombre: "Nunca" }));
  c = await cab(page);
  comprobar(pedidos.config.length === 0 && !/Nunca/.test(c.cab), "una clave con caracteres no permitidos no se usa");
  await ctx.close();

  await nav.close();
  servidor.kill();
  for (let i = 1; i <= 5; i++) try { fs.unlinkSync(path.join(__dirname, "pagina-prueba-clave" + i + ".html")); } catch (e) {}
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
