/*!
 * Winclus · cargador del widget de accesibilidad · https://winclus.com · Licencia Apache 2.0
 *
 *   <script src="https://winclus.com/widget.js" async></script>
 *
 * Este archivo pesa unos 3 KB y no frena la página: el widget completo (winclus-widget.min.js, minificado) se
 * trae cuando la página ya se pintó, o antes si esta persona ya usa Winclus (tiene ajustes guardados, dejó la
 * cámara encendida o llega con su perfil en el enlace). Los atributos data-* del <script> pasan tal cual al widget.
 * Para leer el código completo: https://winclus.com/winclus-widget.js
 */
(function () {
  "use strict";
  if (window.Winclus || window.WinclusCargador) return;
  var VERSION = "0.7.0";
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
