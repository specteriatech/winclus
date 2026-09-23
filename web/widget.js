/*!
 * Winclus · cargador del widget de accesibilidad · https://winclus.com · Licencia Apache 2.0
 *
 *   <script src="https://winclus.com/widget.js" async></script>
 *
 * Este archivo pesa unos 3 KB y no frena la página: el widget completo (winclus-widget.min.js, minificado) se
 * trae cuando la página ya se pintó, o antes si esta persona ya usa Winclus (tiene ajustes guardados, dejó la
 * cámara encendida o llega con su perfil en el enlace). Los atributos data-* del <script> pasan tal cual al widget.
 * Si la página está en un idioma distinto de español o inglés, trae antes el diccionario del panel (idiomas/xx.json:
 * portugués, francés, italiano, alemán, catalán, neerlandés, polaco, rumano, turco, ruso, chino, japonés, coreano,
 * árabe, hindi e indonesio de fábrica; un sitio puede poner el suyo junto a este archivo).
 * Con data-clave="…" (plan Entidad) la configuración del panel se toma de winclus.com y el sitio recibe cifras de uso anónimas.
 * Para leer el código completo: https://winclus.com/winclus-widget.js
 */
(function () {
  "use strict";
  if (window.Winclus || window.WinclusCargador) return;
  var VERSION = "0.8.2";
  var script = document.currentScript || (function () { var s = document.querySelectorAll('script[src*="widget.js"]'); return s[s.length - 1] || null; })();
  var ORIGEN = (script && script.src) ? script.src.replace(/\/[^\/]*$/, "") : "https://winclus.com";
  var ARCHIVO = (script && script.dataset && script.dataset.completo) || "winclus-widget.min.js";   // data-completo="winclus-widget.js" para depurar con el código legible
  var pedido = false, abrirAlCargar = false;
  function cargar() {
    if (pedido || window.Winclus) return;
    pedido = true;
    var s = document.createElement("script");
    s.src = ORIGEN + "/" + ARCHIVO; s.async = true;
    if (script && script.nonce) s.nonce = script.nonce;
    if (script && script.dataset) for (var k in script.dataset) if (k !== "completo") s.dataset[k] = script.dataset[k];
    s.setAttribute("data-winclus", "1");
    s.onload = function () { if (abrirAlCargar && window.Winclus) window.Winclus.abrir(); };
    (document.head || document.documentElement).appendChild(s);
  }
  // Quien ya usa Winclus no espera: ajustes guardados, cámara que sigue encendida o perfil en el enlace
  function yaLoUsa() {
    try { if (localStorage.getItem("winclus.ajustes") || localStorage.getItem("winclus.camara_seguir") || localStorage.getItem("winclus.visto")) return true; } catch (e) {}
    return /[#&]winclus(-tablero)?=/.test(location.hash || "");
  }
  // Idioma del panel: el diccionario se pide antes que el widget, que lo lee de window.WinclusIdiomas al arrancar
  var IDIOMA = (((script && script.dataset && script.dataset.ui) || document.documentElement.lang || "es").split("-")[0] || "es").toLowerCase();
  var conIdioma = function (f) {
    if (IDIOMA === "es" || IDIOMA === "en" || (window.WinclusIdiomas && window.WinclusIdiomas[IDIOMA]) || !window.fetch || !/^[a-z]{2,3}$/.test(IDIOMA)) { f(); return; }
    var listo = false, seguir = function () { if (!listo) { listo = true; f(); } };
    setTimeout(seguir, 2500);   // sin diccionario a tiempo, el panel sale en español
    fetch(ORIGEN + "/idiomas/" + IDIOMA + ".json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && typeof d === "object") { window.WinclusIdiomas = window.WinclusIdiomas || {}; window.WinclusIdiomas[IDIOMA] = Object.assign(d, window.WinclusIdiomas[IDIOMA] || {}); }
      seguir();
    }, seguir);
  };
  // Clave de sitio (plan Entidad): la configuración del panel (logo, nombre, color, posición, pestañas ocultas) se pide a
  // winclus.com y pasa al widget como si fueran data-*; y las cifras de uso anónimas de la visita van a /api/uso.
  var CLAVE = (script && script.dataset && script.dataset.clave) || "";
  var conConfig = function (f) {
    if (!CLAVE || !window.fetch || !/^[A-Za-z0-9_-]{6,64}$/.test(CLAVE)) { f(); return; }
    if (script && script.dataset && !script.dataset.uso) script.dataset.uso = ORIGEN + "/api/uso?clave=" + CLAVE;
    var listo = false, seguir = function () { if (!listo) { listo = true; f(); } };
    setTimeout(seguir, 2000);   // sin respuesta a tiempo, el panel sale con lo que diga el HTML
    fetch(ORIGEN + "/api/config?clave=" + CLAVE).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
      if (c && typeof c === "object" && script && script.dataset) ["logo", "nombre", "color", "posicion", "ocultar", "camara", "idioma", "contacto", "arreglos", "traducir", "describir", "explicar"].forEach(function (k) { if (c[k] != null && c[k] !== "" && !script.dataset[k]) script.dataset[k] = String(c[k]); });
      seguir();
    }, seguir);
  };
  var cargarSinIdioma = cargar;
  cargar = function () { if (pedido || window.Winclus) return; conConfig(function () { conIdioma(cargarSinIdioma); }); };
  function cuandoQuieto() {
    if (window.requestIdleCallback) window.requestIdleCallback(cargar, { timeout: 1500 }); else setTimeout(cargar, 300);
  }
  if (yaLoUsa()) cargar();
  else if (document.readyState === "complete") cuandoQuieto();
  else window.addEventListener("load", cuandoQuieto);
  // Alt+Mayúsculas+W abre el panel aunque el widget todavía no haya llegado
  document.addEventListener("keydown", function (e) {
    if (e.altKey && e.shiftKey && !e.ctrlKey && e.code === "KeyW" && !window.Winclus) { e.preventDefault(); abrirAlCargar = true; cargar(); }
  }, true);
  window.addEventListener("hashchange", function () { if (/[#&]winclus(-tablero)?=/.test(location.hash || "")) cargar(); });
  window.WinclusCargador = { version: VERSION, cargar: cargar, origen: ORIGEN, archivo: ARCHIVO };
})();
