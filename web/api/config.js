// GET /api/config?clave=…  → la configuración del panel de ese sitio (logo, nombre, color, posición, pestañas ocultas…),
// que el cargador pasa al widget como si fueran atributos data-*. Se cachea 5 minutos en el navegador y en el borde.
const { supabase, cors, json, CLAVE_OK } = require("./_comun.js");

const CAMPOS = ["logo", "nombre", "color", "posicion", "ocultar", "camara", "idioma", "contacto", "arreglos", "traducir", "describir", "explicar"];
module.exports = async (req, res) => {
  cors(res, "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  const clave = String((req.query && req.query.clave) || "");
  if (!CLAVE_OK.test(clave)) return json(res, 400, { error: "Clave no válida" });
  const sb = supabase();
  if (!sb) return json(res, 503, { error: "Servidor sin configurar" });
  const { data, error } = await sb.from("sitios").select("config, nombre, dominio").eq("clave", clave).maybeSingle();
  if (error) return json(res, 500, { error: "No se pudo leer" });
  if (!data) return json(res, 404, { error: "Clave desconocida" });
  const c = data.config || {}, salida = {};
  for (const k of CAMPOS) if (c[k] != null && c[k] !== "") salida[k] = String(c[k]).slice(0, 300);
  if (!salida.nombre && c.marca && data.nombre) salida.nombre = data.nombre;
  return json(res, 200, salida, "public, max-age=300, s-maxage=300");
};
