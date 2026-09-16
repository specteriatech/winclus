// Perfil por enlace (sin cuentas ni servidores): «Copiar enlace con mi perfil» genera una URL con #winclus=…;
// al abrirla en otro navegador se importan ajustes, frases y palabras, y el enlace se limpia; un enlace roto
// no rompe nada. Uso: node prueba_perfil_enlace.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];   // NAVEGADOR=firefox|webkit para otros motores
const path = require("path");

const PAGINA = "file:///" + path.resolve(__dirname, "pagina-prueba.html").replace(/\\/g, "/");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  const nav = await chromium.launch();
  let ctx = await nav.newContext({ permissions: (process.env.NAVEGADOR && process.env.NAVEGADOR !== "chromium") ? [] : ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(() => { localStorage.setItem("winclus.ajustes", JSON.stringify({ texto: 150, contraste: true, voz_activa: false })); localStorage.setItem("winclus.frases", JSON.stringify(["Hola desde el enlace", "Necesito ayuda"])); });
  await ctx.addInitScript(() => { if (!/AppleWebKit/.test(navigator.userAgent) || /Chrome/.test(navigator.userAgent)) return; Object.defineProperty(navigator, "clipboard", { value: { writeText: (t) => { window.__portapapeles = t; return Promise.resolve(); }, readText: () => Promise.resolve(window.__portapapeles || "") } }); });   // WebKit de Playwright no da portapapeles: uno simulado
  let page = await ctx.newPage();
  await page.goto(PAGINA);
  await page.waitForFunction(() => window.Winclus);
  await page.evaluate(() => { Winclus.abrir(); Array.from(Winclus.caja.querySelectorAll("#wcl-panel-mas button")).find((b) => /Copiar enlace/.test(b.textContent)).click(); });
  await page.waitForTimeout(300);
  const enlace = await page.evaluate(() => navigator.clipboard.readText());
  comprobar(/#winclus=[A-Za-z0-9_-]+$/.test(enlace) && enlace.indexOf("pagina-prueba.html#winclus=") > 0, "el botón copia un enlace con #winclus=…", enlace.slice(0, 60) + "… (" + enlace.length + " caracteres)");
  await ctx.close();

  // otro navegador (contexto limpio) abre el enlace
  ctx = await nav.newContext();
  page = await ctx.newPage();
  await page.goto(enlace);
  await page.waitForFunction(() => window.Winclus);
  await page.waitForTimeout(200);
  const imp = await page.evaluate(() => ({ texto: Winclus.ajustes.texto, contraste: Winclus.ajustes.contraste, frases: JSON.parse(localStorage.getItem("winclus.frases") || "[]"), guardado: JSON.parse(localStorage.getItem("winclus.ajustes") || "{}").texto, hash: location.hash, fs: document.documentElement.style.fontSize }));
  comprobar(imp.texto === 150 && imp.contraste === true && imp.guardado === 150, "en un navegador limpio se importan los ajustes y quedan guardados", JSON.stringify({ texto: imp.texto, contraste: imp.contraste }));
  comprobar(imp.frases[0] === "Hola desde el enlace", "las frases también viajan", JSON.stringify(imp.frases));
  comprobar(imp.hash === "" && imp.fs === "150%", "el enlace se limpia y los ajustes se aplican", JSON.stringify({ hash: imp.hash, fs: imp.fs }));
  await ctx.close();

  // enlace roto
  ctx = await nav.newContext();
  page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(PAGINA + "#winclus=esto-no-es-un-perfil");
  await page.waitForFunction(() => window.Winclus);
  await page.waitForTimeout(200);
  const roto = await page.evaluate(() => ({ texto: Winclus.ajustes.texto, aviso: Winclus.caja.querySelector(".wcl-vivo").textContent }));
  comprobar(roto.texto === 100 && errores.length === 0 && /no traía un perfil/.test(roto.aviso), "un enlace roto avisa y no rompe nada", JSON.stringify(roto) + " " + errores.join("|"));
  await ctx.close();

  await nav.close();
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
