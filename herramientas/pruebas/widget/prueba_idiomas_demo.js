// Página «El panel en 18 idiomas» (web/idiomas.html): un selector con los 18 idiomas del panel, cada uno con su
// nombre en su propia lengua; al elegir uno la página se recarga con data-ui, el cargador trae el diccionario y el panel
// se abre solo en ese idioma (en árabe volteado); el idioma elegido queda marcado y la línea de instalación lo lleva.
// Usa el servidor local (fetch no funciona sobre file://). Uso: node prueba_idiomas_demo.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const WEB = path.resolve(__dirname, "../../../web");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const html = fs.readFileSync(path.join(WEB, "idiomas.html"), "utf8");
  const codigos = [...html.matchAll(/\["([a-z]{2})", "/g)].map((m) => m[1]);
  const archivos = fs.readdirSync(path.join(WEB, "idiomas")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, 2));
  comprobar(codigos.length === 18 && archivos.every((c) => codigos.includes(c)) && codigos.includes("es") && codigos.includes("en"), "la página lista los 18 idiomas: es, en y los 16 con archivo", codigos.join(","));
  for (const [f, texto] of [["index.html", 'href="idiomas"'], ["integrar.html", 'href="idiomas"'], ["mapa-del-sitio.html", 'href="idiomas"'], ["sitemap.xml", "winclus.com/idiomas<"]]) {
    comprobar(fs.readFileSync(path.join(WEB, f), "utf8").includes(texto), f + " enlaza a la página de idiomas");
  }

  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const abrir = async (ruta) => {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
    const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
    await page.goto("http://127.0.0.1:8765" + ruta);
    await page.waitForFunction(() => window.Winclus, null, { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector(".wcl-panel.abierto") || (window.Winclus.caja && window.Winclus.caja.querySelector(".wcl-panel.abierto")), null, { timeout: 8000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const c = Winclus.caja, t = (s) => [...c.querySelectorAll(s)].map((e) => e.textContent.trim());
      const raiz = c.querySelector(".wcl-root") || c.host;
      return { abierto: !!c.querySelector(".wcl-panel.abierto"), tabs: t(".wcl-tabs button"), lang: raiz.getAttribute("lang"), dir: raiz.getAttribute("dir"),
        marcado: (document.querySelector(".idiomas a[aria-current]") || {}).getAttribute && document.querySelector(".idiomas a[aria-current]").getAttribute("href"),
        botones: [...document.querySelectorAll(".idiomas a")].map((a) => [a.getAttribute("href"), a.lang, a.firstChild.textContent.trim()]),
        linea: document.getElementById("linea").textContent, ahora: document.getElementById("nombreAhora").textContent, titulo: document.title, htmlLang: document.documentElement.lang };
    });
    await ctx.close();
    return { r, errores };
  };

  // 1. sin parámetro: español, panel abierto solo, línea sin data-ui
  let { r, errores } = await abrir("/idiomas.html");
  comprobar(errores.length === 0, "idiomas.html carga sin errores de JavaScript", errores.join(" | "));
  comprobar(r.abierto && r.lang === "es" && r.tabs.includes("Ver"), "sin elegir nada el panel se abre solo y sale en español", r.tabs.join(","));
  comprobar(/idiomas(\.html)?$/.test(r.marcado) && !/data-ui/.test(r.linea) && /español/.test(r.ahora), "el español queda marcado y la línea de instalación no lleva data-ui", r.linea);
  comprobar(r.botones.length === 18 && r.botones.every((b) => b[1] && b[2]) && r.botones.some((b) => b[2] === "日本語" && b[1] === "ja") && r.botones.some((b) => b[2] === "العربية" && b[1] === "ar"), "18 botones, cada uno con su nombre en su lengua y su lang", r.botones.length + " botones");
  comprobar(r.htmlLang === "es", "la página sigue declarando lang=es (el texto de la página es español; solo cambia el panel)");

  // 2. japonés: el panel en japonés, la página en español, marcado y línea con data-ui
  ({ r, errores } = await abrir("/idiomas.html?ui=ja"));
  comprobar(errores.length === 0 && r.abierto && r.lang === "ja" && r.tabs.every((x) => !/^(Ver|Oír|Puntero|Clics|Escribir|Más)$/.test(x)) && /[぀-ヿ一-鿿]/.test(r.tabs.join("")), "?ui=ja: el panel se abre en japonés", r.tabs.join(","));
  comprobar(/idiomas(\.html)?\?ui=ja$/.test(r.marcado) && /data-ui="ja"/.test(r.linea) && /japonés/.test(r.ahora) && /japonés/.test(r.titulo), "el japonés queda marcado, el aviso y el título lo dicen y la línea lleva data-ui=\"ja\"", r.linea);

  // 3. árabe: volteado de derecha a izquierda
  ({ r, errores } = await abrir("/idiomas.html?ui=ar"));
  comprobar(errores.length === 0 && r.abierto && r.lang === "ar" && r.dir === "rtl" && /[؀-ۿ]/.test(r.tabs.join("")), "?ui=ar: el panel sale en árabe y volteado (dir=rtl)", r.tabs.join(","));

  // 4. inglés (dentro del widget) y un código que no existe (cae a español sin romperse)
  ({ r, errores } = await abrir("/idiomas.html?ui=en"));
  comprobar(errores.length === 0 && r.abierto && r.lang === "en" && r.tabs.includes("See"), "?ui=en: el panel sale en inglés", r.tabs.join(","));
  ({ r, errores } = await abrir("/idiomas.html?ui=xx"));
  comprobar(errores.length === 0 && r.abierto && r.lang === "es" && /idiomas(\.html)?$/.test(r.marcado) && /español/.test(r.ahora), "?ui=xx (idioma que no existe): sale en español y marca el español", r.ahora);

  // 5. pulsar un botón del selector lleva al idioma (navegación real)
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8765/idiomas.html");
  await page.click('.idiomas a[lang="pt"]');
  await page.waitForFunction(() => window.Winclus && /ui=pt/.test(location.search), null, { timeout: 20000 });
  await page.waitForFunction(() => window.Winclus.caja.querySelector(".wcl-panel.abierto"), null, { timeout: 8000 }).catch(() => {});
  const pt = await page.evaluate(() => ({ tabs: [...Winclus.caja.querySelectorAll(".wcl-tabs button")].map((e) => e.textContent.trim()), lang: (Winclus.caja.querySelector(".wcl-root") || Winclus.caja.host).getAttribute("lang") }));
  const dicPt = JSON.parse(fs.readFileSync(path.join(WEB, "idiomas", "pt.json"), "utf8"));
  comprobar(pt.lang === "pt" && pt.tabs.includes(dicPt["Oír"]) && pt.tabs.includes(dicPt["Más"]), "pulsar «Português» recarga con ?ui=pt y el panel sale en portugués", pt.tabs.join(","));
  await ctx.close();

  await nav.close();
  servidor.kill();
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
