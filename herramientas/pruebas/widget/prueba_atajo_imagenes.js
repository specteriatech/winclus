// 0.6.18: Alt+Mayúsculas+W abre y cierra el panel desde cualquier sitio; «Guardar lo escrito» de los subtítulos en
// vivo descarga un .txt con la hora de cada frase; y las imágenes sin texto alternativo: el lector dice que el sitio
// no las describió y da la mejor pista de la página (pie de foto, enlace, nombre del archivo) sin inventar nada, y
// con data-describir pide la descripción al servicio del sitio. Uso: node prueba_atajo_imagenes.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const pagina = path.join(__dirname, "pagina-imagenes.html");
  const widget = "file:///" + path.join(__dirname, "../../../web/widget.js").replace(/\\/g, "/");
  fs.writeFileSync(pagina, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Imágenes</title></head><body><main><h1>Noticias</h1>
<img id="con" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Mapa de la ciudad">
<img id="deco" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">
<figure><img id="fig" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><figcaption>El alcalde inaugura el parque</figcaption></figure>
<a href="#"><img id="enl" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="> Ver el programa</a>
<img id="arch" src="https://sitio.test/fotos/rueda-de-prensa_alcaldia_20260921.jpg">
<img id="nada" src="https://sitio.test/IMG_4521.jpg">
</main><script src="${widget}" data-describir="https://servicio.test/describir"></script></body></html>`);
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ acceptDownloads: true });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  const pedidas = [];
  await page.route("https://sitio.test/**", (r) => r.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from("R0lGODlhAQABAAAAACw=", "base64") }));
  await page.route("https://servicio.test/describir", (r) => { pedidas.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ texto: "Varias personas en una rueda de prensa" }) }); });
  await page.goto("file:///" + pagina.replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);

  // --- Alt+Mayúsculas+W ---
  await page.keyboard.press("Alt+Shift+KeyW"); await page.waitForTimeout(150);
  let a = await page.evaluate(() => ({ abierto: Winclus.caja.querySelector(".wcl-panel").classList.contains("abierto"), foco: (Winclus.caja.activeElement || {}).dataset && Winclus.caja.activeElement.dataset.situ, atajo: Winclus.caja.querySelector(".wcl-btn").getAttribute("aria-keyshortcuts") }));
  comprobar(a.abierto && a.foco === "veo" && a.atajo === "Alt+Shift+W", "Alt+Mayúsculas+W abre el panel con el foco en la primera opción (y el botón lo anuncia)", JSON.stringify(a));
  await page.keyboard.press("Alt+Shift+KeyW"); await page.waitForTimeout(150);
  comprobar(await page.evaluate(() => !Winclus.caja.querySelector(".wcl-panel").classList.contains("abierto")), "y otra vez lo cierra");

  // --- imágenes ---
  const d = (id) => page.evaluate((i) => Winclus.describirImagen(document.getElementById(i)), id);
  comprobar(/^Imagen: Mapa de la ciudad/.test(await d("con")), "con alt: dice el alt", await d("con"));
  comprobar(/Imagen decorativa/.test(await d("deco")), "con alt vacío: «Imagen decorativa»", await d("deco"));
  const fig = await d("fig");
  comprobar(/sin descripción del sitio/.test(fig) && /Pista: El alcalde inaugura el parque/.test(fig), "sin alt dentro de una figura: dice que el sitio no la describió y da el pie de foto como pista", fig);
  comprobar(/Pista: Ver el programa/.test(await d("enl")), "sin alt dentro de un enlace: la pista es el texto del enlace", await d("enl"));
  const arch = await d("arch");
  comprobar(/Pista: rueda de prensa alcaldia/.test(arch), "sin alt ni texto cerca: la pista sale del nombre del archivo (sin números)", arch);
  const nada = await d("nada");
  comprobar(/sin descripción del sitio/.test(nada) && !/Pista/.test(nada), "si el nombre del archivo no dice nada (IMG_4521), no se inventa pista", nada);
  await page.waitForTimeout(300);
  comprobar(pedidas.length >= 1 && pedidas.some((p) => /^https:\/\/sitio\.test\/fotos\/rueda-de-prensa/.test(p.imagen)) && pedidas.every((p) => typeof p.contexto === "string" && p.idioma),
    "con data-describir, se pide la descripción al servicio del sitio (imagen, contexto e idioma)", pedidas.map((p) => p.imagen.split("/").pop()).join(", "));
  comprobar(/^Imagen: Varias personas en una rueda de prensa/.test(await d("arch")), "y cuando responde, el lector dice esa descripción", await d("arch"));
  const antes = pedidas.length; await d("arch"); await d("arch"); await page.waitForTimeout(200);
  comprobar(pedidas.length === antes, "la descripción se guarda: no se vuelve a pedir");

  // --- guardar la transcripción ---
  await page.evaluate(() => { Winclus.abrir(); Winclus.vistaCompleta(true); Winclus.caja.getElementById("wcl-tab-oir").click(); });
  const oculto = await page.evaluate(() => getComputedStyle(Winclus.caja.getElementById("wcl-guardar-sub")).display);
  await page.evaluate(() => { Winclus.anotarSub("Buenos días, soy la doctora"); Winclus.anotarSub("¿Cómo se encuentra hoy?"); });
  const visible = await page.evaluate(() => getComputedStyle(Winclus.caja.getElementById("wcl-guardar-sub")).display);
  comprobar(oculto === "none" && visible !== "none", "«Guardar lo escrito» aparece cuando hay subtítulos que guardar", oculto + " → " + visible);
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => Winclus.caja.getElementById("wcl-guardar-sub").click())]);
  const texto = fs.readFileSync(await descarga.path(), "utf8");
  comprobar(/\.txt$/.test(descarga.suggestedFilename()) && /\[\d\d:\d\d:\d\d\] Buenos días, soy la doctora/.test(texto) && /¿Cómo se encuentra hoy\?/.test(texto),
    "se descarga un .txt con cada frase y su hora", descarga.suggestedFilename());

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); try { fs.unlinkSync(pagina); } catch (e) {}
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
