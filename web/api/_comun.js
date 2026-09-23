// Lo que comparten las funciones de winclus.com/api: cliente de Supabase con la clave de servicio (solo en el
// servidor), CORS para que el widget pueda llamar desde cualquier sitio, y respuestas JSON.
const { createClient } = require("@supabase/supabase-js");

let cliente = null;
function supabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return null;
  if (!cliente) cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return cliente;
}
function cors(res, metodos) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", metodos || "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}
function json(res, estado, cuerpo, cache) {
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache || "no-store");
  res.end(JSON.stringify(cuerpo));
}
// El cuerpo puede llegar ya analizado (Vercel) o como texto/Blob (sendBeacon)
async function cuerpoJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch (e) { return null; } }
  return new Promise((resolve) => {
    let d = ""; req.on("data", (c) => { d += c; if (d.length > 20000) req.destroy(); }); req.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } }); req.on("error", () => resolve(null));
  });
}
const CLAVE_OK = /^[A-Za-z0-9_-]{6,64}$/;
module.exports = { supabase, cors, json, cuerpoJson, CLAVE_OK };
