/* Winclus como Web Component: <winclus-widget posicion="izquierda" camara="no" idioma="es-CO" relevo="no" explicar="https://…"></winclus-widget>
 * Sirve para React, Vue, Angular, Svelte o HTML plano: el elemento carga widget.js (o widget-X.Y.Z.js) del mismo
 * origen que este archivo con los atributos como data-*. Licencia Apache 2.0. */
(function () {
  if (window.customElements && !window.customElements.get("winclus-widget")) {
    var ORIGEN = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/\/[^\/]*$/, "") : "https://winclus.com";
    var NONCE = document.currentScript && document.currentScript.nonce;
    var WinclusWidget = function () { return Reflect.construct(HTMLElement, [], WinclusWidget); };
    WinclusWidget.prototype = Object.create(HTMLElement.prototype);
    WinclusWidget.prototype.constructor = WinclusWidget;
    WinclusWidget.prototype.connectedCallback = function () {
      if (window.Winclus || document.querySelector("script[data-winclus]")) return;   // una sola vez por página
      var s = document.createElement("script");
      s.src = ORIGEN + "/" + (this.getAttribute("version") ? "widget-" + this.getAttribute("version") + ".js" : "widget.js");
      s.async = true; s.setAttribute("data-winclus", "1"); if (NONCE) s.nonce = NONCE;
      ["posicion", "color", "camara", "idioma", "relevo", "explicar"].forEach(function (a) { var v = this.getAttribute(a); if (v != null) s.dataset[a] = v; }, this);
      this.style.display = "none";
      document.head.appendChild(s);
    };
    window.customElements.define("winclus-widget", WinclusWidget);
  }
})();
