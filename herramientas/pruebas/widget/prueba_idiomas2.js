// Idiomas del panel (0.8.0 y 0.8.1): 16 idiomas con archivo (pt, fr, it, de, ca, nl, pl, ro, tr, ru, zh, ja, ko, ar, hi, id) además de es y en. Los diccionarios (web/idiomas/xx.json) cubren
// todas las claves de DICC.en; el cargador los trae antes que el widget según el lang de la página (o data-ui); el panel
// sale traducido (pestañas, títulos, ayudas, situaciones) sin que se cuele español; una página en un idioma sin
// diccionario sale en español. Usa el servidor local (fetch no funciona sobre file://). Uso: node prueba_idiomas2.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const WEB = path.resolve(__dirname, "../../../web");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  // 1. los archivos cubren todas las claves del diccionario inglés
  const src = fs.readFileSync(path.join(WEB, "winclus-widget.js"), "utf8");
  const en = new Function("return " + src.match(/var DICC = \{\n    en: (\{[\s\S]*?\n    \})\n  \};/)[1])();
  const claves = Object.keys(en);
  // por idioma: cómo se dicen «Ver mejor» y «¿Qué te cuesta?» (se leen del propio archivo, aquí solo se comprueba que existen y salen)
  const CODIGOS = ["pt", "fr", "it", "de", "ca", "nl", "pl", "ro", "tr", "ru", "zh", "ja", "ko", "ar", "hi", "id"];
  const IDIOMAS = {};
  for (const l of CODIGOS) { const d = JSON.parse(fs.readFileSync(path.join(WEB, "idiomas", l + ".json"), "utf8")); IDIOMAS[l] = [d["Ver mejor"], d["¿Qué te cuesta?"]]; }
  for (const l of Object.keys(IDIOMAS)) {
    const d = JSON.parse(fs.readFileSync(path.join(WEB, "idiomas", l + ".json"), "utf8"));
    const faltan = claves.filter((k) => !(k in d)), vacias = Object.keys(d).filter((k) => !String(d[k]).trim());
    // en otro alfabeto, una traducción idéntica a la clave es una clave sin traducir (en pt, it o ca «Alto contraste» puede ser igual)
    const iguales = ["ru", "zh", "ja", "ko", "ar", "hi"].includes(l) ? Object.keys(d).filter((k) => d[k] === k && k.trim().length > 4) : [];
    comprobar(faltan.length === 0 && vacias.length === 0 && Object.keys(d).length === claves.length && iguales.length === 0 && IDIOMAS[l][0] !== "Ver mejor" && IDIOMAS[l][1] !== "¿Qué te cuesta?", "idiomas/" + l + ".json cubre las " + claves.length + " claves del panel, sin huecos ni claves sin traducir", faltan.length + " faltan, " + vacias.length + " vacías, " + iguales.length + " iguales " + iguales.slice(0, 3).join(" | "));
  }

  const base = fs.readFileSync(path.join(__dirname, "pagina-prueba.html"), "utf8").replace('src="../../../web/widget.js"', 'src="/widget.js"');
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const esp = /[ñ¿¡]|\b(cuánto|cómo|también|pulsa|botón|ratón|cámara|activado|enlaces|ojos|cabeza|puntero|pantalla|sitio|lectura|hacer|arriba|quitar|cerrar)\b/i;   // palabras que no existen en los otros idiomas
  const espCa = /[ñ¿¡]|\b(cuánto|cómo|también|pulsa|botón|ratón|cámara|activado|enlaces|ojos|cabeza|puntero|sitio|hacer|quitar|cerrar)\b/i;   // el catalán comparte «pantalla», «lectura» y «arriba» (arribar)
  const fugaDe = (l) => (l === "ca" ? espCa : esp);
  const leer = async (lang, extra) => {
    const nombre = "pagina-prueba-" + lang + ".html";
    fs.writeFileSync(path.join(__dirname, nombre), base.replace('<html lang="es">', '<html lang="' + lang + '">').replace('src="/widget.js"', 'src="/widget.js"' + (extra || "")));
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
    const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
    await page.goto("http://127.0.0.1:8765/pruebas/" + nombre);
    await page.waitForFunction(() => window.Winclus, null, { timeout: 20000 });
    await page.evaluate(() => { localStorage.setItem("winclus.visto", "1"); Winclus.abrir(); Winclus.vistaCompleta(true); });
    const r = await page.evaluate(() => {
      const c = Winclus.caja, t = (s) => [...c.querySelectorAll(s)].map((e) => e.textContent.trim());
      return { tabs: t(".wcl-tabs button"), h2: t(".wcl-panel h2").map((x) => x.replace(/🔊.*$/, "").trim()), situ: t(".wcl-situ button").map((x) => x.split("\n")[0].trim()), ayudas: t(".wcl-panel .wcl-ayuda, .wcl-panel .wcl-intro, .wcl-panel label, .wcl-panel .wcl-opc button, .wcl-panel .wcl-big, .wcl-panel summary"), lang: (c.querySelector(".wcl-root") || c.host).getAttribute("lang"), dir: (c.querySelector(".wcl-root") || c.host).getAttribute("dir"), idiomas: Object.keys(window.WinclusIdiomas || {}) };
    });
    await ctx.close();
    try { fs.unlinkSync(path.join(__dirname, nombre)); } catch (e) {}
    return Object.assign(r, { errores });
  };
  for (const l of Object.keys(IDIOMAS)) {
    const r = await leer(l);
    const fugas = r.ayudas.concat(r.h2, r.situ).filter((x) => fugaDe(l).test(x.replace(/Centro de Relevo|Lengua de Señas|winclus\.com\/privacidad|Colombiana|MinTIC|ARASAAC|Wikcionario/g, "")));
    comprobar(r.idiomas.includes(l) && r.lang === l, l + ": el cargador trae idiomas/" + l + ".json y el panel se marca con ese idioma", JSON.stringify(r.idiomas) + " lang=" + r.lang);
    comprobar(r.h2.includes(IDIOMAS[l][0]) && r.h2.includes(IDIOMAS[l][1]), l + ": los títulos del panel salen traducidos", r.h2.slice(0, 4).join(" | "));
    comprobar(fugas.length === 0, l + ": no se cuela español en nombres, ayudas, intros ni situaciones", fugas.slice(0, 6).join(" | "));
    comprobar(r.errores.length === 0, l + ": sin errores de JavaScript", r.errores.join(" | "));
    comprobar(l === "ar" ? r.dir === "rtl" : r.dir !== "rtl", l + (l === "ar" ? ": el panel se voltea de derecha a izquierda (dir=rtl)" : ": el panel va de izquierda a derecha"), "dir=" + r.dir);
  }
  // data-ui manda sobre lang; y un idioma sin diccionario sale en español
  const ui = await leer("de", ' data-ui="it"');
  comprobar(ui.h2.includes("Vedere meglio") && ui.lang === "it", "data-ui=\"it\" manda sobre lang=\"de\"", ui.h2[1] + " lang=" + ui.lang);
  const sin = await leer("sw");
  comprobar(sin.h2.includes("Ver mejor") && sin.lang === "es" && sin.errores.length === 0, "un idioma sin diccionario (sw) sale en español, sin error", sin.h2[1] + " lang=" + sin.lang + " " + sin.errores.join("|"));

  await nav.close(); servidor.kill();
  console.log(fallos ? "\n" + fallos + " comprobación(es) fallida(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
