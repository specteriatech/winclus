// Genera los PDF de la guía para personas y del manual para entidades a partir de sus páginas HTML,
// con Chromium: web/guia-winclus.pdf y web/manual-winclus.pdf. Uso: node pdf.js
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const RAIZ = path.resolve(__dirname, "../../..");
(async () => {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor.js")], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  const nav = await chromium.launch();
  const page = await nav.newPage();
  for (const [ruta, salida, titulo] of [["/guia.html", "guia-winclus.pdf", "Guía de uso de Winclus"], ["/manual.html", "manual-winclus.pdf", "Manual de uso para entidades · Winclus"]]) {
    await page.goto("http://127.0.0.1:8765" + ruta, { waitUntil: "networkidle" });
    await page.evaluate(() => { const w = document.querySelector(".wcl-root"); if (w) w.remove(); });   // el widget no va en el PDF
    await page.emulateMedia({ media: "print" });
    const destino = path.join(RAIZ, "web", salida);
    // tagged: PDF etiquetado (estructura para lectores de pantalla, PDF/UA); outline: índice navegable. Lo exige la Resolución 1519 para documentos.
    await page.pdf({ path: destino, format: "A4", printBackground: true, tagged: true, outline: true, margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" }, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: `<div style="font-size:9px;color:#4A5670;width:100%;text-align:center;font-family:Segoe UI,sans-serif">${titulo} · winclus.com · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>` });
    console.log(salida + " " + Math.round(fs.statSync(destino).size / 1024) + " KB");
  }
  await nav.close();
  servidor.kill();
})();
