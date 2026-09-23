// POST /api/uso?clave=…  ← el widget, al salir de la página, con { version, pagina, eventos: { abierto: 1, "panel:Alto contraste": 2 } }
// Suma las cifras al día de hoy del sitio de esa clave. No guarda IP, ni navegador, ni página, ni nada por persona.
const { supabase, cors, json, cuerpoJson, CLAVE_OK } = require("./_comun.js");

module.exports = async (req, res) => {
  cors(res, "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") return json(res, 405, { error: "Solo POST" });
  const clave = String((req.query && req.query.clave) || "");
  if (!CLAVE_OK.test(clave)) return json(res, 400, { error: "Clave no válida" });
  const cuerpo = await cuerpoJson(req);
  const eventos = cuerpo && cuerpo.eventos && typeof cuerpo.eventos === "object" ? cuerpo.eventos : null;
  if (!eventos) return json(res, 400, { error: "Faltan los eventos" });
  const limpio = {};
  let total = 0;
  for (const k of Object.keys(eventos).slice(0, 80)) { const n = Math.min(1000, Math.max(0, parseInt(eventos[k], 10) || 0)); if (n) { limpio[String(k).slice(0, 60)] = n; total += n; } }
  if (!total) return json(res, 204, {});
  const sb = supabase();
  if (!sb) return json(res, 503, { error: "Servidor sin configurar" });
  const { error } = await sb.rpc("sumar_uso", { p_clave: clave, p_eventos: limpio });
  if (error) return json(res, 500, { error: "No se pudo guardar" });
  return json(res, 204, {});
};
