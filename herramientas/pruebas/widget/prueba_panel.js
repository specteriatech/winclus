// Panel de cliente (web/panel.html) con /api/entorno simulado. Uso: node prueba_panel.js
const chromium = require("playwright")[process.env.NAVEGADOR || "chromium"];
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

(async () => {
  // los límites del panel y del esquema SQL son los mismos
  const sql = fs.readFileSync(path.resolve(__dirname, "../../../servidor/esquema.sql"), "utf8");
  const html = fs.readFileSync(path.resolve(__dirname, "../../../web/panel.html"), "utf8");
  const deSql = {}; [...sql.matchAll(/when '(\w+)' then '(\{[^}]+\})'::jsonb/g)].forEach((m) => { deSql[m[1]] = JSON.parse(m[2]); });
  deSql.gratis = JSON.parse(sql.match(/else '(\{[^}]+\})'::jsonb/)[1]);
  const deJs = new Function("return " + html.match(/var LIMITES = (\{.*?\});\n/)[1])();
  comprobar(Object.keys(deJs).every((p) => JSON.stringify(deSql[p]) === JSON.stringify(deJs[p])) && Object.keys(deSql).length === 4, "los límites por plan del panel coinciden con los del esquema SQL", JSON.stringify(deJs));
  comprobar(/enable row level security/.test(sql) && (sql.match(/enable row level security/g) || []).length >= 8 && /create policy/.test(sql), "el esquema activa la seguridad por filas en todas las tablas");

  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  // 1. sin servidor
  let page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
  let errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.route("**/api/entorno", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "no" }) }));
  await page.goto("http://127.0.0.1:8765/panel.html");
  await page.waitForFunction(() => !document.getElementById("sinServidor").hidden, null, { timeout: 5000 });
  const sin = await page.evaluate(() => ({ login: document.getElementById("login").hidden, app: document.getElementById("app").hidden, texto: document.getElementById("sinServidor").textContent }));
  comprobar(errores.length === 0 && sin.login && sin.app && /no está conectado/.test(sin.texto), "sin servidor configurado lo dice y no muestra el acceso");
  await page.close();

  // 2. con servidor (Supabase simulado: solo la parte de entrar)
  page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
  errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.route("**/api/entorno", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://simulado.supabase.co", clave: "sb_publishable_prueba" }) }));
  let otp = null;
  await page.route("https://simulado.supabase.co/**", async (route) => {
    const u = route.request().url();
    if (/\/auth\/v1\/otp/.test(u)) { otp = JSON.parse(route.request().postData()); return route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("http://127.0.0.1:8765/panel.html");
  await page.waitForFunction(() => !document.getElementById("login").hidden, null, { timeout: 8000 });
  await page.fill("#correo", "prueba@entidad.gov.co");
  await page.click("#fLogin button");
  await page.waitForFunction(() => /Abre el correo/.test(document.getElementById("estadoLogin").textContent), null, { timeout: 8000 });
  comprobar(otp && otp.email === "prueba@entidad.gov.co" && !("password" in otp), "pide el enlace de acceso al correo (OTP) sin contraseña", JSON.stringify(otp).slice(0, 120));
  comprobar(errores.length === 0, "sin errores JS al entrar", errores.join(" | "));
  // pestañas del sitio: patrón Tabs
  const tabs = await page.evaluate(() => { const b = [...document.querySelectorAll('#tabs [role=tab]')]; WinclusPanel.elegirTab("monitor"); return { n: b.length, sel: b.filter((x) => x.getAttribute("aria-selected") === "true").map((x) => x.dataset.t), paneles: b.map((x) => document.getElementById(x.getAttribute("aria-controls")) ? 1 : 0), oculto: document.getElementById("t-resumen").hidden, visible: !document.getElementById("t-monitor").hidden }; });
  comprobar(tabs.n === 5 && tabs.sel.join() === "monitor" && tabs.paneles.every(Boolean) && tabs.oculto && tabs.visible, "cinco pestañas con aria-controls y una sola seleccionada", JSON.stringify(tabs));
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }); return r.violations.map((v) => v.id + "×" + v.nodes.length); });
  comprobar(axe.length === 0, "axe sin incumplimientos en el panel", axe.join(", "));
  await nav.close();
  servidor.kill();
  console.log(fallos ? "\n" + fallos + " fallo(s)" : "\nTodo bien");
  process.exit(fallos ? 1 : 0);
})();
