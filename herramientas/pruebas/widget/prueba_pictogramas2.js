// Familia 4 (docs/hoja-ruta-familias.md), widget 0.6.6: vocabulario nuclear por colores («Palabras»), frases bien
// dichas (conjugación del primer verbo y género y número de los adjetivos, con «Cuando hablo de mí»), historial
// («Lo que más dices»), búsqueda en ARASAAC (simulada con page.route), tableros propios (crear, palabra, dibujo de
// ARASAAC, foto reducida, quitar, compartir por archivo y por enlace, en el perfil .winclus) y el tablero con dos
// pulsadores y con el puntero de la cara. Uso: node prueba_pictogramas2.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }
// PNG de 4×4 píxeles (rojo) para la foto
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP8z4AKmBhGBSAAAJj8AQ9nEbPgAAAAAElFTkSuQmCC", "base64");

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const page = await ctx.newPage();
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.route(/api\.arasaac\.org\/api\/pictograms\/es\/search\//, (ruta) => {
    const palabra = decodeURIComponent(ruta.request().url().split("/search/")[1]);
    const lista = palabra === "perro" ? [{ _id: 2451, keywords: [{ keyword: "perro" }] }, { _id: 2452, keywords: [{ keyword: "perrito" }] }] : [];
    ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lista) });
  });
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { window.__voz = []; speechSynthesis.speak = (u) => window.__voz.push(u.text); });
  const abrir = () => page.evaluate(() => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-oir button")).find((b) => /pictogramas/i.test(b.textContent)).click(); });
  const vista = (n) => page.evaluate((v) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .vistas button")).find((b) => b.textContent === v).click(); }, n);
  const cat = (n) => page.evaluate((c) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).find((b) => b.textContent === c).click(); }, n);
  const toca = (n) => page.evaluate((x) => { const b = Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).find((y) => y.getAttribute("aria-label") === x); if (!b) return false; b.click(); return true; }, n);
  const accion = (n) => page.evaluate((x) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .acciones button")).find((b) => b.textContent === x).click(); }, n);
  const herr = (n) => page.evaluate((x) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .herr button")).find((b) => b.textContent === x).click(); }, n);
  const dicha = () => page.evaluate(() => { const d = Winclus.caja.querySelector(".wcl-pictos .frase .dicha"); return d ? d.textContent.replace(/^→ /, "") : null; });
  await abrir(); await page.waitForTimeout(150);

  // --- vistas y vocabulario nuclear ---
  let r = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .vistas button")).map((b) => b.textContent));
  comprobar(r.join(",") === "Temas,Palabras,Míos,Buscar", "el tablero tiene cuatro vistas: Temas, Palabras, Míos y Buscar", r.join(","));
  await vista("Palabras");
  r = await page.evaluate(() => ({ cats: Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).map((b) => b.textContent + ":" + b.className), n: Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto").length, color: Winclus.caja.querySelector(".wcl-pictos .rejilla .picto").className, total: Object.values(JSON.parse(JSON.stringify(Winclus.caja.querySelectorAll ? {} : {}))).length }));
  comprobar(r.cats.length === 8 && r.cats[0] === "Personas:c-amarillo" && r.cats[1] === "Acciones:c-verde" && r.n >= 30 && /c-amarillo/.test(r.color), "«Palabras»: ocho grupos gramaticales con color (personas amarillo, acciones verde…) y sus pictogramas", r.cats.join(" | ") + " · " + r.n);
  r = await page.evaluate(() => { let n = 0; ["Personas", "Acciones", "Cómo es", "Cosas", "Lugares", "Tiempo", "Preguntas y enlaces", "Sociales"].forEach((c) => { Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).find((b) => b.textContent === c).click(); n += Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto").length; }); return n; });
  comprobar(r >= 300, "el vocabulario nuclear tiene más de 300 palabras", String(r));

  // --- frases bien dichas ---
  const casos = [[["yo", "querer", "comer"], "yo quiero comer"], [["ella", "estar", "cansado"], "ella está cansada"], [["no", "querer", "dormir"], "no quiero dormir"], [["mamá", "venir", "mañana"], "mamá viene mañana"], [["yo", "gustar", "música"], "me gusta música"], [["nosotros", "estar", "cansado"], "nosotros estamos cansados"], [["querer", "agua"], "quiero agua"], [["él", "tener", "dolor", "cabeza"], "él tiene dolor cabeza"], [["yo", "poder", "ir", "casa"], "yo puedo ir casa"], [["ellos", "jugar", "parque"], "ellos juegan parque"]];
  r = await page.evaluate((cs) => cs.filter((c) => Winclus.pulir(c[0]) !== c[1]).map((c) => c[0].join(" ") + "→" + Winclus.pulir(c[0])), casos);
  comprobar(r.length === 0, "Winclus.pulir() conjuga el primer verbo según el sujeto y concuerda los adjetivos (10 frases)", r.join(" | "));
  await page.evaluate(() => { Winclus.ajustes.caa_genero = "f"; });
  r = await page.evaluate(() => [Winclus.pulir(["yo", "estar", "contento"]), Winclus.pulir(["yo", "estar", "triste"])]);
  comprobar(r[0] === "yo estoy contenta" && r[1] === "yo estoy triste", "con «Cuando hablo de mí: en femenino», «contento» pasa a «contenta» y «triste» no cambia", r.join(" | "));
  await page.evaluate(() => { Winclus.ajustes.caa_genero = "n"; });
  await cat("Personas"); await toca("yo"); await cat("Acciones"); await toca("querer"); await toca("comer");
  r = await dicha();
  comprobar(r === "yo quiero comer", "en la tira de la frase se ve cómo se dirá («yo quiero comer»)", String(r));
  await page.evaluate(() => { window.__voz = []; }); await accion("Decir");
  r = await page.evaluate(() => window.__voz);
  comprobar(r.includes("yo quiero comer"), "«Decir» dice la frase bien dicha", r.join(" | "));
  await page.evaluate(() => { Winclus.ajustes.caa_gramatica = false; }); await accion("Borrar último"); await page.evaluate(() => { window.__voz = []; }); await toca("comer"); await accion("Decir");
  r = await page.evaluate(() => window.__voz);
  comprobar(r.includes("yo querer comer"), "con «Frases bien dichas» apagado se dice tal cual", r.join(" | "));
  await page.evaluate(() => { Winclus.ajustes.caa_gramatica = true; });

  // --- historial: lo que más se dice ---
  await accion("Decir"); await accion("Borrar todo"); await cat("Sociales"); await toca("hola"); await accion("Decir"); await accion("Borrar todo");
  r = await page.evaluate(() => ({ et: (Winclus.caja.querySelector(".wcl-pictos .sig .et") || {}).textContent, rec: Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .sig .reciente")).map((b) => b.textContent), guardado: JSON.parse(localStorage.getItem("winclus.pictos_historial")) }));
  comprobar(/Lo que más dices/.test(r.et) && r.rec[0] === "yo quiero comer" && r.rec.includes("hola") && r.guardado["yo quiero comer"] === 2, "sin frase, salen primero las frases más dichas (historial guardado)", JSON.stringify(r).slice(0, 200));
  await page.evaluate(() => { window.__voz = []; Winclus.caja.querySelector(".wcl-pictos .sig .reciente").click(); });
  comprobar((await page.evaluate(() => window.__voz))[0] === "yo quiero comer", "tocar una frase del historial la dice");

  // --- buscar en ARASAAC ---
  await vista("Buscar");
  await page.evaluate(() => { const i = Winclus.caja.querySelector(".wcl-pictos .herr input"); i.value = "perro"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  await page.waitForFunction(() => Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto").length === 2, null, { timeout: 5000 });
  r = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).map((b) => b.getAttribute("aria-label") + ":" + (b.querySelector("img") || {}).src));
  comprobar(/^perro:.*\/2451\/2451_300\.png$/.test(r[0]) && /^perrito:/.test(r[1]), "«Buscar» pide a ARASAAC y muestra los dibujos encontrados", r.join(" | "));
  await toca("perrito");
  r = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .frase .elegido b")).map((b) => b.textContent));
  comprobar(r.join(",") === "perrito", "un dibujo encontrado se añade a la frase", r.join(","));
  await accion("Borrar todo");

  // --- tableros propios ---
  await vista("Míos");
  r = await page.evaluate(() => (Winclus.caja.querySelector(".wcl-pictos .rejilla .aviso") || {}).textContent);
  comprobar(/no tienes tableros/.test(r || ""), "«Míos» explica cómo empezar cuando no hay tableros", r);
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-pictos .herr input[placeholder="Nombre del tablero nuevo"]').value = "Mi casa"; }); await herr("Crear tablero");
  await page.evaluate(() => { Winclus.caja.querySelector('.wcl-pictos .herr input[placeholder="Palabra sin dibujo"]').value = "mi cama"; }); await herr("Añadir palabra");
  await herr("Añadir dibujo de ARASAAC");
  r = await page.evaluate(() => ({ vista: Winclus.caja.querySelector(".wcl-pictos .vistas [aria-selected=true]").textContent, aviso: (Winclus.caja.querySelector(".wcl-pictos .rejilla .aviso") || {}).textContent }));
  comprobar(r.vista === "Buscar" && /añadirlo a «Mi casa»/.test(r.aviso), "«Añadir dibujo de ARASAAC» lleva al buscador en modo añadir", JSON.stringify(r));
  await page.evaluate(() => { const i = Winclus.caja.querySelector(".wcl-pictos .herr input"); i.value = "perro"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  await page.waitForFunction(() => Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto").length === 2, null, { timeout: 5000 });
  await toca("perro");
  r = await page.evaluate(() => ({ vista: Winclus.caja.querySelector(".wcl-pictos .vistas [aria-selected=true]").textContent, cats: Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .cats button")).map((b) => b.textContent), items: Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).map((b) => b.getAttribute("aria-label")), guardado: JSON.parse(localStorage.getItem("winclus.tableros")) }));
  comprobar(r.vista === "Míos" && r.cats.join() === "Mi casa" && r.items.join() === "mi cama,perro" && r.guardado[0].items[1][1] === 2451, "el tablero «Mi casa» tiene la palabra y el dibujo de ARASAAC, y se guarda", JSON.stringify(r).slice(0, 200));
  const foto = path.join(__dirname, "_foto_tmp.png"); fs.writeFileSync(foto, PNG);
  const entradaFoto = await page.evaluateHandle(() => Winclus.caja.querySelector('.wcl-pictos .herr input[type=file][accept="image/*"]'));
  await entradaFoto.asElement().setInputFiles(foto);
  await page.waitForFunction(() => Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto").length === 3, null, { timeout: 5000 });
  r = await page.evaluate(() => { const t = JSON.parse(localStorage.getItem("winclus.tableros"))[0].items[2]; return { nombre: t[0], foto: /^data:image\/jpeg;base64,/.test(t[2]), tam: t[2].length, img: !!Winclus.caja.querySelector(".wcl-pictos .rejilla .picto img.foto") }; });
  comprobar(r.nombre === "foto tmp" && r.foto && r.tam < 20000 && r.img, "una foto se reduce y se guarda dentro del tablero como JPEG pequeño", JSON.stringify(r));
  fs.unlinkSync(foto);
  await toca("mi cama");
  r = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .frase .elegido b")).map((b) => b.textContent));
  comprobar(r.join() === "mi cama", "los dibujos del tablero propio se usan en la frase", r.join());
  await accion("Borrar todo");
  await herr("Quitar dibujos"); await toca("mi cama");
  r = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).map((b) => b.getAttribute("aria-label")));
  comprobar(r.join() === "perro,foto tmp", "«Quitar dibujos» y tocar uno lo quita", r.join());
  await herr("Dejar de quitar");
  // compartir: archivo (y enlace solo sin fotos)
  await page.evaluate(() => { const t = Winclus.tableros()[0]; t.items = t.items.filter((p) => !p[2]); localStorage.setItem("winclus.tableros", JSON.stringify(Winclus.tableros())); });
  const [descarga] = await Promise.all([page.waitForEvent("download"), herr("Compartir tablero")]);
  const archivo = JSON.parse(fs.readFileSync(await descarga.path(), "utf8"));
  comprobar(archivo.nombre === "Mi casa" && archivo.items.length === 1 && archivo.items[0][1] === 2451 && /Mi casa\.tablero\.json$/.test(descarga.suggestedFilename()), "«Compartir tablero» guarda un archivo .tablero.json", descarga.suggestedFilename());
  const b64 = Buffer.from(JSON.stringify({ winclus_tablero: "x", nombre: "Del cole", items: [["pintar", 2380, ""], ["recreo", 0, ""]] }), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const pagina2 = await ctx.newPage(); await pagina2.addInitScript(() => localStorage.removeItem("winclus.tableros"));
  await pagina2.goto(PAGINA + "#winclus-tablero=" + b64); await pagina2.waitForFunction(() => window.Winclus); await pagina2.waitForTimeout(300);
  r = await pagina2.evaluate(() => ({ t: Winclus.tableros().map((t) => t.nombre + ":" + t.items.length), hash: location.hash }));
  comprobar(r.t.includes("Del cole:2") && !/winclus-tablero/.test(r.hash), "un enlace con tablero lo carga en otro navegador y el enlace se limpia", JSON.stringify(r));
  await pagina2.close();
  // el perfil .winclus lleva los tableros
  const [perfilD] = await Promise.all([page.waitForEvent("download"), page.evaluate(() => { Winclus.abrir(); Winclus.caja.getElementById("wcl-tab-mas").click(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-big")).find((b) => /Guardar mis ajustes en un archivo/.test(b.textContent)).click(); })]);
  const perfil = JSON.parse(fs.readFileSync(await perfilD.path(), "utf8"));
  comprobar(Array.isArray(perfil.tableros) && perfil.tableros[0].nombre === "Mi casa", "el archivo de perfil .winclus incluye los tableros propios");

  // --- el tablero con dos pulsadores y con el puntero de la cara ---
  await page.evaluate(() => { Winclus.cerrar(); Winclus.ajustes.barrido = true; Winclus.ajustes.barrido_modo = "pasos"; Winclus.ajustes.barrido_senal = "espacio"; Winclus.ajustes.barrido_senal2 = "intro"; Winclus.caja.getElementById("wcl-barrido").click(); Winclus.caja.getElementById("wcl-barrido").click(); });
  await abrir(); await vista("Temas"); await cat("Básico"); await accion("Borrar todo"); await page.waitForTimeout(100);
  for (let i = 0; i < 40 && !(await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-pictos .rejilla .picto.wcl-barrido"); return e && e.getAttribute("aria-label") === "hola"; })); i++) await page.keyboard.press("Space");
  await page.keyboard.press("Enter"); await page.waitForTimeout(100);
  r = await page.evaluate(() => Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .frase .elegido b")).map((b) => b.textContent));
  comprobar(r.join() === "hola", "con dos pulsadores, Espacio recorre el tablero e Intro elige el dibujo", r.join());
  await page.evaluate(() => { Winclus.ajustes.barrido = false; Winclus.caja.getElementById("wcl-barrido").click(); Winclus.caja.getElementById("wcl-barrido").click(); });
  r = await page.evaluate(() => { const b = Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .rejilla .picto")).find((x) => x.getAttribute("aria-label") === "gracias"), q = b.getBoundingClientRect(); Winclus.mover(q.left + q.width / 2, q.top + q.height / 2); Winclus.clic(); return Array.from(Winclus.caja.querySelectorAll(".wcl-pictos .frase .elegido b")).map((x) => x.textContent); });
  comprobar(r.join() === "hola,gracias", "el clic del puntero facial (por mirada o cabeza) sobre un dibujo lo añade", r.join());

  comprobar(errores.length === 0, "sin errores JS", errores.join(" | "));
  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
