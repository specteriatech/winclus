// Capítulo 3 del Anexo 1 de la Resolución 1519 (3.3, documentos PDF): verifica los PDF que publica winclus.com
// leyendo su estructura interna con pdf.js. Lo que el anexo pide y una máquina puede ver: etiquetado, idioma,
// título, estructura por encabezados sin saltos de nivel, listas bien formadas, texto alternativo en TODAS las
// figuras, texto real (no escaneado), índice navegable y que la seguridad no impida los lectores de pantalla.
// Lo que no puede ver (contraste, orden de lectura, instrucciones solo visuales, artefactos) se dice como
// revisión humana. Uso: node prueba_documentos.mjs
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(AQUI, "../../../web");
let fallos = 0;
function comprobar(bien, nombre, detalle) { fallos += bien ? 0 : 1; console.log((bien ? "OK  " : "MAL ") + nombre + (detalle ? "  (" + detalle + ")" : "")); }

const pdfs = fs.readdirSync(WEB).filter((f) => f.endsWith(".pdf"));
comprobar(pdfs.length > 0, "winclus.com publica " + pdfs.length + " PDF: " + pdfs.join(", "));
for (const f of pdfs) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(WEB, f))), verbosity: 0 }).promise;
  const meta = await doc.getMetadata(), marca = await doc.getMarkInfo(), permisos = await doc.getPermissions(), indice = await doc.getOutline();
  const roles = {}, titulos = [], figurasSinAlt = [], listasMal = []; let texto = 0;
  const recorrer = (n, pag) => {
    if (!n) return;
    if (n.role) {
      roles[n.role] = (roles[n.role] || 0) + 1;
      const h = /^H(\d)$/.exec(n.role); if (h) titulos.push(+h[1]);
      if (n.role === "Figure" && !(n.alt && n.alt.trim())) figurasSinAlt.push(pag);
      if (n.role === "L" && !(n.children || []).some((c) => c.role === "LI")) listasMal.push(pag);
    }
    (n.children || []).forEach((c) => recorrer(c, pag));
  };
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    recorrer(await p.getStructTree(), i);
    const t = await p.getTextContent(); texto += t.items.reduce((s, x) => s + (x.str || "").trim().length, 0);
  }
  const saltos = titulos.filter((n, i) => i > 0 && n > titulos[i - 1] + 1);
  comprobar(marca && marca.Marked === true && roles.Document > 0, f + ": etiquetado (PDF con estructura para lectores de pantalla)", JSON.stringify(marca));
  comprobar(/^es\b/i.test(meta.info.Language || ""), f + ": idioma principal declarado", meta.info.Language);
  comprobar(!!(meta.info.Title && meta.info.Title.trim().length > 4), f + ": título del documento en sus propiedades", meta.info.Title);
  comprobar(titulos[0] === 1 && titulos.filter((n) => n === 1).length === 1 && saltos.length === 0, f + ": estructura por encabezados, con un solo H1 y sin saltar niveles", titulos.length + " encabezados; saltos: " + saltos.length);
  comprobar(listasMal.length === 0, f + ": las listas están etiquetadas como listas con sus elementos", (roles.L || 0) + " listas");
  comprobar(figurasSinAlt.length === 0, f + ": todas las figuras tienen texto alternativo", (roles.Figure || 0) + " figuras" + (figurasSinAlt.length ? "; sin alt en págs. " + [...new Set(figurasSinAlt)].join(",") : ""));
  comprobar(texto > 200 * doc.numPages * 0.3, f + ": el texto es texto de verdad, no una imagen escaneada", texto + " caracteres en " + doc.numPages + " páginas");
  comprobar(!!(indice && indice.length), f + ": índice navegable (marcadores)");
  comprobar(permisos === null || permisos.includes(pdfjs.PermissionFlag.COPY_FOR_ACCESSIBILITY), f + ": la seguridad no impide la lectura con lectores de pantalla", permisos === null ? "sin restricciones" : JSON.stringify(permisos));
  const campos = (await doc.getFieldObjects()) || {};
  const sinNombre = Object.values(campos).flat().filter((c) => !(c.name && c.name.trim()));
  comprobar(sinNombre.length === 0, f + ": los campos de formulario están identificados", Object.keys(campos).length ? Object.keys(campos).length + " campos" : "no tiene campos: no aplica");
}
console.log("REVISIÓN HUMANA (capítulo 3.3): contraste de texto e imágenes (se hereda de la página HTML de origen, que pasa axe a 7:1), orden de lectura, instrucciones que no dependan solo de lo visual y elementos decorativos como artefactos.");
console.log(fallos ? fallos + " comprobación(es) MAL" : "todo bien");
process.exit(fallos ? 1 : 0);
