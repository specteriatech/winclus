// Privacidad honesta: la primera activación de la cámara pide consentimiento (y no toca la cámara hasta
// aceptar), los textos de dictado y órdenes avisan de que la voz va a Google/Microsoft, y «Acerca de»
// ya no promete que todo se procesa en el navegador. Uso: node prueba_privacidad.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__camara = 0;
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => { window.__camara++; return Promise.reject(Object.assign(new Error("sin cámara en la prueba"), { name: "NotFoundError" })); };
  });
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => Winclus.abrir());
  await page.evaluate(() => Winclus.vistaCompleta(true));   // las pestañas salen con «Ver más opciones»
  await page.click("#wcl-tab-cara");

  // --- consentimiento ---
  await page.evaluate(() => Winclus.activarCamara());
  await page.waitForTimeout(300);
  const c1 = await page.evaluate(() => { const c = Winclus.caja.querySelector(".wcl-consent"); const a = c && c.querySelector("a"); return { hay: !!c, foco: (Winclus.caja.activeElement || document.activeElement) && (Winclus.caja.activeElement || document.activeElement).textContent, texto: c ? c.textContent : "", enlace: a ? a.href : "", camara: window.__camara, guardado: localStorage.getItem("winclus.consentimiento_camara") }; });
  comprobar(c1.hay && c1.camara === 0 && !c1.guardado, "la primera activación muestra el consentimiento sin tocar la cámara", "cámara pedida " + c1.camara + " veces");
  comprobar(/biométrico/.test(c1.texto) && /winclus\.com\/privacidad/.test(c1.enlace), "el consentimiento habla de dato biométrico y enlaza a la política", c1.enlace);
  comprobar(/Acepto/.test(c1.foco || ""), "el foco va al botón de aceptar", JSON.stringify(c1.foco));
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-consent button")).find((b) => /Ahora no/.test(b.textContent)).click(); });
  await page.waitForTimeout(100);
  const c2 = await page.evaluate(() => ({ hay: !!Winclus.caja.querySelector(".wcl-consent"), guardado: localStorage.getItem("winclus.consentimiento_camara") }));
  comprobar(!c2.hay && !c2.guardado, "«Ahora no» cierra el aviso y no guarda nada");
  await page.evaluate(() => Winclus.activarCamara());
  await page.waitForTimeout(100);
  await page.evaluate(() => { Array.from(Winclus.caja.querySelectorAll(".wcl-consent button")).find((b) => /Acepto/.test(b.textContent)).click(); });
  await page.waitForTimeout(1500);
  const c3 = await page.evaluate(() => ({ hay: !!Winclus.caja.querySelector(".wcl-consent"), guardado: JSON.parse(localStorage.getItem("winclus.consentimiento_camara") || "null"), camara: window.__camara, estado: Winclus.caja.getElementById("wcl-estado").textContent }));
  comprobar(!c3.hay && c3.guardado && c3.guardado.fecha && c3.guardado.version, "«Acepto» guarda fecha y versión del consentimiento", JSON.stringify(c3.guardado));
  comprobar(c3.camara >= 1 || /detector|descargar|cámara/i.test(c3.estado), "tras aceptar sí se intenta activar la cámara", "cámara pedida " + c3.camara + " veces; estado: " + c3.estado.slice(0, 80));
  await page.reload();
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { Winclus.abrir(); Winclus.activarCamara(); });
  await page.waitForTimeout(300);
  comprobar(!(await page.evaluate(() => !!Winclus.caja.querySelector(".wcl-consent"))), "con el consentimiento guardado no se vuelve a pedir");

  // --- textos ---
  const textos = await page.evaluate(() => ({
    dictado: Winclus.caja.getElementById("wcl-panel-escribir").textContent,
    ordenes: Winclus.caja.getElementById("wcl-panel-oir").textContent,
    acerca: Winclus.caja.getElementById("wcl-panel-mas").textContent,
  }));
  comprobar(/Google o Microsoft/.test(textos.dictado), "el dictado avisa de que la voz va a Google o Microsoft");
  comprobar(/Google o Microsoft/.test(textos.ordenes), "las órdenes por voz avisan igual");
  comprobar(!/todo se procesa en tu navegador/.test(textos.acerca) && /Google o Microsoft/.test(textos.acerca) && /Política de tratamiento/.test(textos.acerca), "«Acerca de» ya no promete «todo en tu navegador» y enlaza la política");

  // --- restablecer borra el consentimiento ---
  const antes = await page.evaluate(() => localStorage.getItem("winclus.consentimiento_camara"));
  await page.evaluate(() => { const b = Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas button")).find((x) => /Restablecer/.test(x.textContent)); if (b) b.click(); const si = Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas .wcl-confirma button")).find((x) => /^Sí/.test(x.textContent)); if (si) si.click(); });   // desde 0.6.2 pregunta antes de borrar
  await page.waitForTimeout(300);
  const despues = await page.evaluate(() => localStorage.getItem("winclus.consentimiento_camara"));
  comprobar(!!antes && !despues, "«Restablecer» borra el consentimiento guardado", "antes=" + !!antes + " después=" + !!despues);

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
