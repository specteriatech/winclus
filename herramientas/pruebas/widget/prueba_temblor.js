// Temblor con el ratón de siempre (0.6.17): «Ayudarme a pulsar con el ratón». Con clics REALES del ratón
// (page.mouse, isTrusted): si el clic cae al lado de un botón, se pulsa ese; si hay dos cerca, se pregunta cuál;
// un segundo clic en el mismo sitio al momento no cuenta; un clic que ya cae en algo pulsable, lejos de todo o en
// algo con su propio manejador no se toca; los clics que no vienen del ratón (la página, la cámara) tampoco.
// Uso: node prueba_temblor.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const pagina = path.join(__dirname, "pagina-temblor.html");
  fs.writeFileSync(pagina, `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Temblor</title>
<style>body{margin:0;font:16px sans-serif}button{position:absolute;width:120px;height:40px}#solo{left:100px;top:100px}#a{left:400px;top:100px}#b{left:400px;top:160px}
#tarjeta{position:absolute;left:100px;top:300px;width:200px;height:80px;background:#eee;cursor:pointer}</style></head><body>
<button id="solo">Pagar</button><button id="a">Aceptar</button><button id="b">Borrar</button><div id="tarjeta">Tarjeta</div>
<script>window.cuenta={};document.addEventListener("click",function(e){var i=e.target.id;if(i)cuenta[i]=(cuenta[i]||0)+1;});</script>
<script src="${"file:///" + path.join(__dirname, "../../../web/widget.js").replace(/\\/g, "/")}"></script></body></html>`);
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 900, height: 600 } });
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("file:///" + pagina.replace(/\\/g, "/"));
  await page.waitForFunction(() => window.Winclus);
  const cuenta = () => page.evaluate(() => Object.assign({}, window.cuenta));
  const reset = () => page.evaluate(() => { window.cuenta = {}; });
  const espera = (ms) => page.waitForTimeout(ms);

  // Apagado: un clic al lado del botón no hace nada (como siempre)
  await page.mouse.click(160, 155); await espera(100);
  comprobar(!(await cuenta()).solo, "con la ayuda apagada, un clic al lado del botón no lo pulsa (como siempre)");

  await page.evaluate(() => { Winclus.ajustes.raton_temblor = true; });
  await reset(); await espera(700);
  // 15 px por debajo de «Pagar» (que acaba en y=140)
  await page.mouse.click(160, 155); await espera(150);
  let c = await cuenta();
  comprobar(c.solo === 1, "con la ayuda encendida, un clic que cae 15 px al lado de «Pagar» pulsa «Pagar»", JSON.stringify(c));

  // Entre «Aceptar» (100-140) y «Borrar» (160-200): pregunta cuál
  await reset(); await espera(700);
  await page.mouse.click(460, 150); await espera(200);
  const lista = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-elegir"); return e && e.style.display === "block" ? [...e.querySelectorAll("button")].map((b) => b.textContent) : null; });
  comprobar(lista && lista.some((t) => /Aceptar/.test(t)) && lista.some((t) => /Borrar/.test(t)) && !(await cuenta()).a && !(await cuenta()).b, "si cae entre dos botones, pregunta «¿Cuál de estos?» y no pulsa ninguno", JSON.stringify(lista));
  await page.evaluate(() => [...Winclus.caja.querySelectorAll(".wcl-elegir button")].find((b) => /Borrar/.test(b.textContent)).click());
  c = await cuenta();
  comprobar(c.b === 1 && !c.a, "y al elegir «Borrar» pulsa «Borrar»", JSON.stringify(c));

  // Encima del botón: no se toca; el segundo clic al momento no cuenta; pasado el tiempo, sí
  await reset(); await espera(700);
  await page.mouse.click(160, 120); await espera(120); await page.mouse.click(162, 121); await espera(100);
  c = await cuenta();
  comprobar(c.solo === 1, "dos clics seguidos sin querer sobre «Pagar» cuentan como uno", JSON.stringify(c));
  await espera(700); await page.mouse.click(160, 120); await espera(100);
  comprobar((await cuenta()).solo === 2, "pasado el tiempo, el siguiente clic sí cuenta");

  // Lejos de todo: nada
  await reset(); await espera(700);
  await page.mouse.click(800, 500); await espera(150);
  const nadaLista = await page.evaluate(() => { const e = Winclus.caja.querySelector(".wcl-elegir"); return !e || e.style.display !== "block"; });
  comprobar(Object.keys(await cuenta()).length === 0 && nadaLista, "un clic lejos de todo no pulsa nada ni pregunta");

  // Algo con su propio manejador (cursor: pointer) no se secuestra aunque haya un botón cerca
  await reset(); await espera(700);
  await page.mouse.click(150, 310); await espera(150);
  c = await cuenta();
  comprobar(c.tarjeta === 1 && !c.solo, "un clic en algo que la página ya hace pulsable (cursor de mano) se respeta", JSON.stringify(c));

  // Clics que no vienen del ratón (la propia página, la cámara de Winclus): nunca se filtran
  await reset();
  await page.evaluate(() => { const b = document.getElementById("solo"); b.click(); b.click(); });
  comprobar((await cuenta()).solo === 2, "dos clics de la página (no del ratón) cuentan los dos: solo se filtra el ratón real");

  // Con palabras, desde la caja «Dímelo»
  await page.evaluate(() => { Winclus.ajustes.raton_temblor = false; Winclus.abrir(); const i = Winclus.caja.getElementById("wcl-que"); i.value = "me tiembla la mano"; i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
  const g = await page.evaluate(() => ({ on: Winclus.ajustes.raton_temblor, lista: [...Winclus.caja.querySelectorAll(".wcl-activo li")].map((l) => l.textContent).join("|") }));
  comprobar(g.on === true, "decir «me tiembla la mano» en la caja lo enciende", JSON.stringify(g));
  const ui = await page.evaluate(() => { Winclus.vistaCompleta(true); Winclus.caja.getElementById("wcl-tab-clics").click(); const s = Winclus.caja.getElementById("wcl-raton_temblor"); return { sw: !!s, ayuda: !!(s && s.getAttribute("aria-describedby")) }; });
  comprobar(ui.sw && ui.ayuda, "el interruptor está en la pestaña Clics, con su ayuda");

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); try { fs.unlinkSync(pagina); } catch (e) {}
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
