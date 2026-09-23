// GET /api/entorno → lo que el panel de cliente (panel.html) necesita para hablar con Supabase desde el navegador:
// la URL del proyecto y la clave publicable (que es pública por diseño; los datos los protege la seguridad por filas).
const { cors, json } = require("./_comun.js");

module.exports = async (req, res) => {
  cors(res, "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return json(res, 503, { error: "El panel de cliente todavía no está configurado en este servidor." });
  return json(res, 200, { url: process.env.SUPABASE_URL, clave: process.env.SUPABASE_ANON_KEY }, "public, max-age=300");
};
