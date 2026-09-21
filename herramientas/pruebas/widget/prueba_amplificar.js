// Subir el volumen y aclarar la voz (0.6.17), para la hipoacusia. Se mide el sonido de verdad a la salida de la
// cadena de Winclus (Web Audio), con tonos generados aquí: al 300 % sale unas 3 veces más fuerte; al 400 % con un
// tono fuerte, el limitador impide que se rompa; «Voz más clara» quita los graves (un tono de 60 Hz baja) y deja la
// voz (un tono de 2,5 kHz no baja). Un audio de OTRO dominio sin CORS no se toca (si se tocara, sonaría en
// silencio) y se avisa. «Volver a como estaba» lo quita. Uso: node prueba_amplificar.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

// WAV mono de 16 bits: un tono de la frecuencia y amplitud dadas
function tono(archivo, hz, amplitud, segundos) {
  const tasa = 44100, n = tasa * segundos, datos = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) datos.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / tasa) * amplitud * 32767), i * 2);
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0); cab.writeUInt32LE(36 + datos.length, 4); cab.write("WAVE", 8); cab.write("fmt ", 12); cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22); cab.writeUInt32LE(tasa, 24); cab.writeUInt32LE(tasa * 2, 28); cab.writeUInt16LE(2, 32); cab.writeUInt16LE(16, 34);
  cab.write("data", 36); cab.writeUInt32LE(datos.length, 40);
  fs.writeFileSync(path.join(__dirname, archivo), Buffer.concat([cab, datos]));
}

(async () => {
  tono("tono-1k.wav", 1000, 0.1, 4); tono("tono-1k-fuerte.wav", 1000, 0.3, 4); tono("tono-60.wav", 60, 0.1, 4); tono("tono-2k5.wav", 2500, 0.1, 4);
  fs.writeFileSync(path.join(__dirname, "pagina-audio.html"), '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Audio</title></head><body><main><h1>Audio</h1>' +
    '<audio id="a" src="/pruebas/tono-1k.wav" loop></audio><audio id="f" src="/pruebas/tono-1k-fuerte.wav" loop></audio>' +
    '<audio id="g" src="/pruebas/tono-60.wav" loop></audio><audio id="v" src="/pruebas/tono-2k5.wav" loop></audio>' +
    '<audio id="otro" src="http://localhost:8765/pruebas/tono-1k.wav" loop></audio></main><script src="/widget.js"></script></body></html>');
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 700));
  const nav = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await nav.newPage();
  await page.addInitScript({ path: path.join(__dirname, "voz-simulada.js") });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto("http://127.0.0.1:8765/pruebas/pagina-audio.html");
  await page.waitForFunction(() => window.Winclus);

  // Nivel medio de salida de un medio durante 0,6 s, con el ajuste dado
  const medir = (id, amplificar, vozClara) => page.evaluate(async ([i, amp, vc]) => {
    Winclus.ajustes.amplificar = amp; Winclus.ajustes.voz_clara = vc;
    const m = document.getElementById(i); document.querySelectorAll("audio").forEach((x) => { if (x !== m) x.pause(); });
    await m.play(); Winclus.abrir(); Winclus.cerrar();   // cualquier refresco; lo que aplica es el «play»
    m.dispatchEvent(new Event("play"));
    await new Promise((r) => setTimeout(r, 300));
    let s = 0, n = 0, pico = 0;
    for (let k = 0; k < 12; k++) { const v = Winclus.nivelAmplificado(m); if (v != null) { s += v; n++; pico = Math.max(pico, v); } await new Promise((r) => setTimeout(r, 50)); }
    return n ? { rms: s / n, pico } : null;
  }, [id, amplificar, vozClara]);

  // Hace falta que la cadena exista: la primera vez se crea al reproducir con algo activado
  const base = await medir("a", 101, false);
  const a100 = await medir("a", 100, false), a300 = await medir("a", 300, false);
  comprobar(a100 && a300 && a100.rms > 0.05, "el audio pasa por la cadena de Winclus y suena", JSON.stringify({ base, a100 }));
  const r = a300.rms / a100.rms;
  comprobar(r > 2.6 && r < 3.3, "al 300 % sale unas tres veces más fuerte", r.toFixed(2) + "×");
  for (const id of ["f", "g", "v"]) await medir(id, 101, false);   // que cada audio pase ya por la cadena
  const f100 = await medir("f", 100, false), f400 = await medir("f", 400, false);
  comprobar(f400.rms > f100.rms * 1.3 && f400.rms < 0.62, "al 400 % con un sonido fuerte, el limitador impide que se rompa (no llega a 4×)", (f400.rms / f100.rms).toFixed(2) + "× · rms " + f400.rms.toFixed(3));
  const g0 = await medir("g", 100, false), g1 = await medir("g", 100, true);
  const v0 = await medir("v", 100, false), v1 = await medir("v", 100, true);
  comprobar(g1.rms < g0.rms * 0.35, "«Voz más clara» quita los graves (un tono de 60 Hz baja mucho)", (g1.rms / g0.rms).toFixed(2) + "×");
  comprobar(v1.rms > v0.rms * 1.5, "y realza la voz (un tono de 2,5 kHz sube)", (v1.rms / v0.rms).toFixed(2) + "×");

  // Un audio de otro dominio sin CORS: no se toca (sonaría en silencio) y se avisa
  const otro = await page.evaluate(async () => {
    Winclus.ajustes.amplificar = 300; const m = document.getElementById("otro"); await m.play().catch(() => {}); m.dispatchEvent(new Event("play"));
    await new Promise((r) => setTimeout(r, 300));
    return { cadena: Winclus.nivelAmplificado(m), suena: !m.paused && !m.muted, aviso: Winclus.caja.textContent.includes("viene de otro sitio") };
  });
  comprobar(otro.cadena === null && otro.suena && otro.aviso, "un audio de otro sitio sin CORS no se toca, sigue sonando y se avisa de que no se puede subir", JSON.stringify(otro));

  // Panel: los controles, «Lo que tienes activado» y «Volver a como estaba»
  const ui = await page.evaluate(() => {
    Winclus.abrir(); Winclus.vistaCompleta(true); Winclus.caja.getElementById("wcl-tab-oir").click();
    const sw = Winclus.caja.getElementById("wcl-voz_clara"), paso = Winclus.caja.getElementById("wcl-l-amplificar") || Winclus.caja.querySelector('[id*="amplificar"]');
    Winclus.ajustes.amplificar = 250; Winclus.ajustes.voz_clara = true; Winclus.caja.getElementById("wcl-tab-inicio").click();
    Winclus.cerrar(); Winclus.abrir();
    const lista = Array.from(Winclus.caja.querySelectorAll(".wcl-activo li")).map((l) => l.textContent);
    Winclus.caja.getElementById("wcl-como-estaba").click();
    return { sw: !!sw, paso: !!paso, ayuda: !!(sw && sw.getAttribute("aria-describedby")), lista, despues: [Winclus.ajustes.amplificar, Winclus.ajustes.voz_clara] };
  });
  comprobar(ui.sw && ui.paso && ui.ayuda, "en la pestaña Oír están «Subir el volumen por encima de lo normal» y «Voz más clara», con su ayuda");
  comprobar(ui.lista.some((t) => /Volumen subido al 250/.test(t)) && ui.lista.some((t) => /Voz más clara/.test(t)), "«Lo que tienes activado» lo dice", ui.lista.join(" | "));
  comprobar(ui.despues[0] === 100 && ui.despues[1] === false, "«Volver a como estaba» lo quita", JSON.stringify(ui.despues));

  comprobar(errores.length === 0, "sin errores de JavaScript", errores.slice(0, 2).join(" | "));
  await nav.close(); servidor.kill();
  for (const f of ["tono-1k.wav", "tono-1k-fuerte.wav", "tono-60.wav", "tono-2k5.wav", "pagina-audio.html"]) try { fs.unlinkSync(path.join(__dirname, f)); } catch (e) {}
  console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
  process.exit(fallos ? 1 : 0);
})();
