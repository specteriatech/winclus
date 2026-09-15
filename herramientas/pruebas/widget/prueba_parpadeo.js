const fs = require("fs");
const src = fs.readFileSync(__dirname + "/parpadeo_extraido.js", "utf8");
const casos = JSON.parse(fs.readFileSync(__dirname + "/series.json", "utf8"));
const CAM_W = 640, CAM_H = 480;
// landmarks falsos: apertura = alto/ancho del ojo; ancho fijo 0.1 (64 px), alto = apertura*ancho
function lmDe(aDer, aIzq) {
  const lm = []; for (let i = 0; i < 478; i++) lm.push({ x: 0, y: 0 });
  lm[33] = { x: 0.3, y: 0.5 }; lm[133] = { x: 0.4, y: 0.5 }; lm[159] = { x: 0.35, y: 0.5 - aDer * 0.1 * 640 / 480 / 2 }; lm[145] = { x: 0.35, y: 0.5 + aDer * 0.1 * 640 / 480 / 2 };
  lm[362] = { x: 0.6, y: 0.5 }; lm[263] = { x: 0.7, y: 0.5 }; lm[386] = { x: 0.65, y: 0.5 - aIzq * 0.1 * 640 / 480 / 2 }; lm[374] = { x: 0.65, y: 0.5 + aIzq * 0.1 * 640 / 480 / 2 };
  return lm;
}
let ok = 0;
for (const c of casos) {
  const parpadeo = new Function("CAM_W", "CAM_H", src + "; return parpadeo;")(640, 480);
  const eventos = []; let t = 0; const dt = c.ms / 1000 / c.frames.length;
  const paso = (aD, aI, bD, bI) => { parpadeo.procesar(lmDe(aD, aI), { eyeBlinkRight: bD, eyeBlinkLeft: bI }, c.umbral, 200, t); const e = parpadeo.tomarEvento(); if (e) eventos.push(e + "@" + Math.round(t * 1000)); };
  for (let i = 0; i < 80; i++) { paso(c.base[0], c.base[1], 0.05, 0.06); t += 0.045; }
  const t0 = t;
  for (const f of c.frames) { paso(f[0] * c.base[0], f[1] * c.base[1], f[2], f[3]); t += dt; }
  for (let i = 0; i < 30; i++) { paso(c.base[0], c.base[1], 0.05, 0.06); t += 0.045; }
  const clic = eventos.some(e => e.startsWith("clic")), largo = eventos.some(e => e.startsWith("largo"));
  const esperadoLargo = c.ms >= 1200;
  const bien = clic && largo === esperadoLargo; ok += bien;
  console.log((bien ? "OK  " : "MAL ") + c.ms + " ms (app: " + c.resultado + ") -> eventos " + eventos.map(e => e.replace("@", " a ")).join(", ") + " | último episodio: " + (parpadeo.ultimoEpisodio ? parpadeo.ultimoEpisodio.ms + " ms " + parpadeo.ultimoEpisodio.resultado : "-"));
}
// parpadeo involuntario: 150 ms a 0.66 (no debe hacer clic) y voluntario 240 ms a 0.55
for (const [ms, prof, esperado] of [[150, 0.66, false], [240, 0.55, true], [120, 0.30, false], [300, 0.45, true]]) {
  const parpadeo = new Function("CAM_W", "CAM_H", src + "; return parpadeo;")(640, 480); const ev = []; let t = 0;
  const paso = (r) => { parpadeo.procesar(lmDe(r * 0.35, r * 0.33), { eyeBlinkRight: 0.05, eyeBlinkLeft: 0.06 }, 0.62, 200, t); const e = parpadeo.tomarEvento(); if (e) ev.push(e); };
  for (let i = 0; i < 80; i++) { paso(1); t += 0.045; }
  const n = Math.round(ms / 45); for (let i = 0; i < n; i++) { paso(prof); t += 0.045; }
  for (let i = 0; i < 20; i++) { paso(1); t += 0.045; }
  const clic = ev.includes("clic"); console.log((clic === esperado ? "OK  " : "MAL ") + "cierre sintético " + ms + " ms a " + prof + " -> " + (clic ? "clic" : "nada") + " (esperado " + (esperado ? "clic" : "nada") + ")");
}
console.log(ok + "/" + casos.length + " series reales bien");
