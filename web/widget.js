/*!
 * Winclus · widget de accesibilidad para páginas web · https://winclus.com
 * Licencia Apache 2.0
 *
 * Cómo añadirlo a una página (una sola línea, antes de </body>):
 *   <script src="https://winclus.com/widget.js" async></script>
 *
 * Opciones (atributos del <script>):
 *   data-posicion="izquierda"   botón a la izquierda (por defecto, derecha)
 *   data-color="#101F3D"        color del botón
 *   data-camara="no"            ocultar el control con la cámara (solo panel de accesibilidad)
 *
 * Hace dentro de la página lo mismo que la aplicación Winclus para Windows:
 * puntero con la cabeza o con los ojos (directo, híbrido o palanca, con
 * calibración en la página y calibración invisible que aprende de cada
 * clic), clic por parpadeo, boca, cejas o permanencia, menú de clics con los
 * ojos cerrados 1,2 s, arrastrar, rueda, lupa, imán a los botones, teclado
 * en pantalla con sugerencias, frases con voz, dictado, órdenes por voz,
 * avisos y perfiles exportables. Todo se procesa en el navegador.
 */
(function () {
  "use strict";
  if (window.Winclus) return;

  var script = document.currentScript;
  var opciones = {
    posicion: (script && script.dataset.posicion) || "derecha",
    color: (script && script.dataset.color) || "#101F3D",
    camara: !(script && script.dataset.camara === "no")
  };
  var ORIGEN = (script && script.src) ? script.src.replace(/\/[^\/]*$/, "") : "https://winclus.com";
  // El detector de caras (MediaPipe Tasks Vision, Apache 2.0) y el modelo se sirven
  // desde el mismo sitio que este archivo; jsDelivr y Google quedan de respaldo.
  var FUENTES_MP = [
    { base: ORIGEN + "/mediapipe", modelo: ORIGEN + "/mediapipe/face_landmarker.task" },
    { base: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35", modelo: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" }
  ];
  var VERSION = "0.2.0";
  var CAM_W = 640, CAM_H = 480;
  var raiz = document.documentElement;
  var LADO = opciones.posicion === "izquierda" ? "left" : "right";

  // ------------------------------------------------------------ ajustes --
  // Mismas claves y valores por defecto que cursor.json de la aplicación.
  var POR_DEFECTO = {
    texto: 100, contraste: false, oscuro: false, enlaces: false, guia: false, animaciones: false, lectura: false,
    voz_activa: true, voz_nombre: "", voz_velocidad: 0, voz_eco: false,
    modo_puntero: "cabeza", ojos_modo: "directo",
    velocidad: 20, suavizado: 8, aceleracion: false,
    ojos_velocidad: 50, ojos_zona_muerta: 4, ojos_vertical: 150, ojos_suavizado: 6,
    ojos_fijacion_px: 60, ojos_persistencia_ms: 150,
    hibrido_cabeza: 40, hibrido_salto_px: 150, hibrido_pausa_ms: 250,
    lupa_activa: true, lupa_zoom: 3, lupa_tiempo_max_s: 8,
    iman_activo: true, iman_radio_px: 90, iman_cabeza: false, calib_invisible: true,
    modo_clic: "parpadeo", parpadeo_ms: 200, parpadeo_umbral: 0.62,
    quieto_ms: 1100, quieto_radio_px: 40, quieto_anillo: true, hold_ms: 250,
    gestos: { jawOpen: "rueda_abajo", browInnerUp: "rueda_arriba", mouthRight: "derecho", mouthLeft: "nada",
              mouthPucker: "nada", mouthSmile: "nada", mouthRollLower: "nada" },
    gestos_umbral: 50,
    avisos_visuales: true, avisos_sonido: false,
    teclado_altura: 32, teclado_posicion: "abajo", teclado_prediccion: true, teclado_sonido: true,
    camara_ver: true, dwell: false,
    dalton: "no", calma: false, dislexia: false, sinimg: false, mascara: false, lector: false, facil: false,
    lupa_pantalla: false, lupa_pantalla_zoom: 2
  };
  var CLAVE = "winclus.ajustes";
  var ajustes = JSON.parse(JSON.stringify(POR_DEFECTO));
  // Nunca se sustituye el objeto «ajustes» (ni «ajustes.gestos»): los controles del panel guardan su referencia
  function fusionarAjustes(g) {
    for (var k in g) if (k in ajustes) {
      if (k === "gestos") { if (g[k] && typeof g[k] === "object") for (var s in g[k]) if (s in ajustes.gestos) ajustes.gestos[s] = g[k][s]; }
      else ajustes[k] = g[k];
    }
  }
  function cargarAjustes() {
    try {
      var g = JSON.parse(localStorage.getItem(CLAVE));
      if (!g) return;
      fusionarAjustes(g);
      if (g.dwell && g.modo_clic == null) ajustes.modo_clic = "quieto";   // ajuste de la versión 0.1
    } catch (e) {}
  }
  cargarAjustes();
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch (e) {} }
  function leerJSON(clave, defecto) { try { var v = JSON.parse(localStorage.getItem(clave)); return v == null ? defecto : v; } catch (e) { return defecto; } }
  function escribirJSON(clave, valor) { try { if (valor == null) localStorage.removeItem(clave); else localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {} }

  // -------------------------------------------------------------- estilo --
  var LOGO = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 22 34 78" stroke="#2F4FD8" stroke-width="20" stroke-linecap="round"/><path d="M42 30 62 82" stroke="#1AA89A" stroke-width="18" stroke-linecap="round"/><path d="M80 52 72 76" stroke="#34C26B" stroke-width="15" stroke-linecap="round"/><circle cx="76" cy="30" r="10" fill="#6B4FC2"/></svg>';
  var css = ''
    + '.wcl-root{position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;font:15px/1.45 "Segoe UI",system-ui,sans-serif;color:#101F3D}'
    + '.wcl-root *{box-sizing:border-box}'
    + '.wcl-btn{position:fixed;bottom:22px;' + LADO + ':22px;z-index:2147483010;width:60px;height:60px;border-radius:50%;border:0;background:' + opciones.color + ';box-shadow:0 8px 24px rgba(16,31,61,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}'
    + '.wcl-btn svg{width:34px;height:34px}.wcl-btn:focus-visible{outline:3px solid #F2B705;outline-offset:3px}'
    + '.wcl-pausa{position:fixed;bottom:30px;' + LADO + ':92px;z-index:2147483010;display:none;min-height:44px;padding:8px 16px;border-radius:999px;border:0;background:#1AA89A;color:#fff;font:700 15px "Segoe UI",system-ui,sans-serif;box-shadow:0 6px 18px rgba(16,31,61,.3);cursor:pointer}'
    + '.wcl-pausa.en-pausa{background:#F2B705;color:#101F3D}'
    + '.wcl-pausa{max-width:calc(100vw - 120px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '@media (max-width:480px){.wcl-panel{left:8px;right:8px;width:auto;max-width:none;bottom:88px;max-height:calc(100vh - 100px);border-radius:16px}'
    + '.wcl-tabs{top:60px}.wcl-tabs button{font-size:11.5px;min-height:38px}.wcl-cab{padding:10px 12px}.wcl-sec{padding:10px 12px}.wcl-fila{gap:6px}.wcl-mm button{width:36px}'
    + '.wcl-tec button{font-size:17px;text-overflow:clip;padding:0 1px}.wcl-tec button.esp{font-size:11px;white-space:normal;line-height:1.05}.wcl-tec button.pred{font-size:14px}.wcl-tec{padding:4px;gap:4px}.wcl-tec .fila{gap:4px}'
    + '.wcl-btn{width:52px;height:52px;bottom:16px;' + LADO + ':16px}.wcl-btn svg{width:30px;height:30px}.wcl-pausa{bottom:22px;' + LADO + ':78px;font-size:13px;padding:6px 12px;min-height:40px}}'
    + '.wcl-panel{position:fixed;bottom:92px;' + LADO + ':22px;z-index:2147483011;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);overflow:auto;background:#fff;color:#101F3D;border-radius:18px;box-shadow:0 18px 60px rgba(16,31,61,.28);display:none}'
    + '.wcl-panel.abierto{display:block}'
    + '.wcl-cab{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#101F3D;color:#fff;border-radius:18px 18px 0 0;position:sticky;top:0;z-index:2}'
    + '.wcl-cab svg{width:26px;height:26px}.wcl-cab b{flex:1;font-size:16px}.wcl-cab button{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;width:40px;height:40px;border-radius:8px}.wcl-cab button:hover{background:rgba(255,255,255,.15)}'
    + '.wcl-tabs{display:flex;background:#E8ECF3;position:sticky;top:64px;z-index:2}.wcl-tabs button{flex:1;min-height:42px;border:0;background:transparent;font:600 13px "Segoe UI",system-ui,sans-serif;color:#5A6784;cursor:pointer;border-bottom:3px solid transparent}.wcl-tabs button[aria-selected="true"]{color:#2F4FD8;border-bottom-color:#2F4FD8;background:#fff}'
    + '.wcl-tab{display:none}.wcl-tab.activa{display:block}'
    + '.wcl-sec{padding:12px 16px;border-bottom:1px solid #E3E8F0}.wcl-sec h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5A6784}'
    + '.wcl-fila{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0}.wcl-fila>label,.wcl-fila>span:first-child{flex:1}'
    + '.wcl-sw{position:relative;width:46px;height:26px;border-radius:999px;background:#C8D0DC;border:0;cursor:pointer;flex:none;padding:0}.wcl-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}.wcl-sw[aria-checked="true"]{background:#1AA89A}.wcl-sw[aria-checked="true"]::after{left:23px}.wcl-sw:focus-visible{outline:3px solid #F2B705;outline-offset:2px}'
    + '.wcl-mm{display:flex;gap:6px;align-items:center}.wcl-mm button{width:40px;height:36px;border-radius:10px;border:1px solid #C8D0DC;background:#fff;font-size:18px;cursor:pointer;color:#101F3D}.wcl-mm span{min-width:52px;text-align:center;font-weight:600;font-size:14px}'
    + '.wcl-opc{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 6px}.wcl-opc button{min-height:36px;padding:0 12px;border-radius:10px;border:1px solid #C8D0DC;background:#fff;color:#101F3D;font:600 13px "Segoe UI",system-ui,sans-serif;cursor:pointer}.wcl-opc button[aria-pressed="true"]{background:#2F4FD8;border-color:#2F4FD8;color:#fff}'
    + '.wcl-sel{width:100%;min-height:38px;border-radius:10px;border:1px solid #C8D0DC;padding:0 8px;font:14px "Segoe UI",system-ui,sans-serif;background:#fff;color:#101F3D}'
    + '.wcl-estado{font-size:13px;color:#5A6784;min-height:18px;padding:2px 0}'
    + '.wcl-big{width:100%;min-height:46px;border-radius:12px;border:0;background:#34C26B;color:#101F3D;font-weight:700;font-size:15px;cursor:pointer;margin:4px 0}.wcl-big.rojo{background:#F2B705}.wcl-big.suave{background:#E8F7F3}.wcl-big.azul{background:#2F4FD8;color:#fff}'
    + '.wcl-pie{padding:12px 16px;font-size:13px;color:#5A6784}.wcl-pie a{color:#2F4FD8}'
    + '.wcl-area{width:100%;min-height:120px;border-radius:10px;border:1px solid #C8D0DC;padding:8px;font:14px "Segoe UI",system-ui,sans-serif;resize:vertical}'
    + '.wcl-cam-vista{position:relative;width:100%;aspect-ratio:4/3;background:#101F3D;border-radius:12px;overflow:hidden;display:none}.wcl-cam-vista canvas{width:100%;height:100%;display:block}'
    + '.wcl-cursor{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2F4FD8;background:rgba(47,79,216,.18);z-index:2147483020;pointer-events:none;display:none}'
    + '.wcl-cursor::after{content:"";position:absolute;left:11px;top:11px;width:6px;height:6px;border-radius:50%;background:#2F4FD8}'
    + '.wcl-cursor.clic{background:rgba(52,194,107,.5);border-color:#34C26B}.wcl-cursor.arrastre{border-color:#F2B705;background:rgba(242,183,5,.3)}'
    + '.wcl-anillo{position:absolute;left:-9px;top:-9px;width:46px;height:46px;pointer-events:none;display:none}'
    + '.wcl-aviso{position:fixed;left:0;top:0;z-index:2147483021;pointer-events:none;display:none;padding:6px 12px;border-radius:999px;background:#101F3D;color:#fff;font:700 14px "Segoe UI",system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);white-space:nowrap;transform:translate(24px,24px)}.wcl-aviso.ambar{background:#F2B705;color:#101F3D}'
    + '.wcl-guia{position:fixed;left:0;right:0;height:38px;margin-top:-19px;background:rgba(242,183,5,.18);border-top:2px solid #F2B705;border-bottom:2px solid #F2B705;pointer-events:none;z-index:2147482999;display:none}'
    + '.wcl-video{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px}'
    + '.wcl-menu{position:fixed;z-index:2147483015;display:none;pointer-events:none}.wcl-menu svg{display:block;overflow:visible}.wcl-menu path,.wcl-menu circle{fill:#fff;stroke:#C8D0DC;stroke-width:2}.wcl-menu .hov{fill:#2F4FD8;stroke:#2F4FD8}.wcl-menu text{font:700 13px "Segoe UI",system-ui,sans-serif;fill:#101F3D;text-anchor:middle;dominant-baseline:middle;pointer-events:none}.wcl-menu .hov+text{fill:#fff}.wcl-menu .centro text{fill:#5A6784;font-weight:400}'
    + '.wcl-tec{position:fixed;left:0;right:0;z-index:2147483012;display:none;background:#F3F5F9;border-top:2px solid #C8D0DC;padding:6px;user-select:none;-webkit-user-select:none}.wcl-tec.arriba{border-top:0;border-bottom:2px solid #C8D0DC}.wcl-tec.visible{display:flex;flex-direction:column;gap:6px}'
    + '.wcl-tec .fila{display:flex;gap:6px;flex:1;min-height:0}.wcl-tec .fila.sug{flex:.75}'
    + '.wcl-tec button{flex:1 1 0;min-width:0;border-radius:10px;border:1px solid #C8D0DC;background:#fff;color:#101F3D;font:22px "Segoe UI",system-ui,sans-serif;cursor:pointer;padding:0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.wcl-tec button.esp{background:#E8ECF3;font-size:15px;font-weight:700}.wcl-tec button.pred{color:#2F4FD8;font-weight:700;font-size:17px;background:#F3F5F9;border-color:#F3F5F9}.wcl-tec button.pred:empty{visibility:hidden}'
    + '.wcl-tec button.frase{font-size:14px;white-space:normal;line-height:1.15}'
    + '.wcl-tec button.activa{background:#DCE4FA;border:3px solid #2F4FD8}.wcl-tec button.fija{background:#2F4FD8;color:#fff}.wcl-tec button.hover{background:#DCE4FA;border:3px solid #2F4FD8}.wcl-tec button.destello{background:#2F4FD8;color:#fff}'
    + '.wcl-tec .texto{font:14px "Segoe UI",system-ui,sans-serif;color:#5A6784;padding:0 4px;min-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.wcl-calib{position:fixed;inset:0;z-index:2147483030;background:#1B2422;color:#F1ECE2;display:none;font:18px "Segoe UI",system-ui,sans-serif}.wcl-calib.visible{display:block}'
    + '.wcl-calib .punto{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#F0B455;box-shadow:0 0 0 6px rgba(240,180,85,.3)}.wcl-calib .punto.grande{width:68px;height:68px;margin:-34px 0 0 -34px}'
    + '.wcl-calib .txt{position:absolute;left:0;right:0;top:12%;text-align:center;padding:0 24px;font-size:22px}.wcl-calib .cancelar{position:absolute;right:16px;top:16px;min-height:44px;padding:0 16px;border-radius:10px;border:1px solid #F1ECE2;background:transparent;color:#F1ECE2;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    + 'html.wcl-oscuro img,html.wcl-oscuro video,html.wcl-oscuro .wcl-root{filter:invert(1) hue-rotate(180deg)}'
    + 'html.wcl-enlaces a{outline:3px solid #F2B705!important;outline-offset:2px;text-decoration:underline!important;background:rgba(242,183,5,.18)!important}'
    + 'html.wcl-anim *{animation-play-state:paused!important;transition:none!important;scroll-behavior:auto!important}'
    + 'html.wcl-lupa body{transition:transform .25s}'
    + '.wcl-leyendo{outline:3px solid #1AA89A!important;outline-offset:2px}'
    + '.wcl-iman{outline:3px solid #1AA89A!important;outline-offset:2px}';
  var estilo = document.createElement("style"); estilo.textContent = css; (document.head || raiz).appendChild(estilo);

  // ----------------------------------------------------------------- DOM --
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function q(sel, base) { return (base || panel).querySelector(sel); }
  // Todo lo del widget cuelga de un contenedor fuera de <body>: así la lupa
  // puede agrandar el <body> sin que el panel, el puntero y el teclado se muevan.
  var cont = el("div", { "class": "wcl-root", "lang": "es" });
  var boton = el("button", { "class": "wcl-btn", "aria-label": "Abrir accesibilidad Winclus", "aria-expanded": "false", "type": "button" }, LOGO);
  var btnPausa = el("button", { "class": "wcl-pausa", "type": "button", "aria-label": "Pausar el puntero" }, "Pausar");
  var panel = el("div", { "class": "wcl-panel", "role": "dialog", "aria-label": "Accesibilidad Winclus" });
  var cursor = el("div", { "class": "wcl-cursor", "aria-hidden": "true" }, '<svg class="wcl-anillo" viewBox="0 0 46 46"><circle cx="23" cy="23" r="20" fill="none" stroke="rgba(52,194,107,.3)" stroke-width="5"/><circle class="prog" cx="23" cy="23" r="20" fill="none" stroke="#34C26B" stroke-width="5" stroke-dasharray="125.7" stroke-dashoffset="125.7" transform="rotate(-90 23 23)"/></svg>');
  var aviso = el("div", { "class": "wcl-aviso", "aria-hidden": "true" });
  var guia = el("div", { "class": "wcl-guia", "aria-hidden": "true" });
  var menuEl = el("div", { "class": "wcl-menu", "aria-hidden": "true" });
  var tecEl = el("div", { "class": "wcl-tec", "role": "group", "aria-label": "Teclado en pantalla Winclus" });
  var calibEl = el("div", { "class": "wcl-calib", "role": "dialog", "aria-label": "Calibración de los ojos" });
  var refrescos = [];   // funciones que ponen cada control según «ajustes»

  // Controles del panel. Todos se manejan con botones grandes (nada de
  // arrastrar deslizadores), como en la aplicación.
  function filaSw(clave, etiqueta, alCambiar) {
    var id = "wcl-" + clave;
    var f = el("div", { "class": "wcl-fila" });
    f.appendChild(el("label", { "for": id }, etiqueta));
    var s = el("button", { "class": "wcl-sw", "role": "switch", "aria-checked": "false", "id": id, "type": "button" });
    f.appendChild(s);
    s.addEventListener("click", function () {
      ajustes[clave] = !ajustes[clave]; s.setAttribute("aria-checked", ajustes[clave] ? "true" : "false"); guardar();
      if (alCambiar) alCambiar(ajustes[clave]);
    });
    refrescos.push(function () { s.setAttribute("aria-checked", ajustes[clave] ? "true" : "false"); });
    return f;
  }
  function filaPaso(clave, etiqueta, min, max, paso, formato, alCambiar) {
    var f = el("div", { "class": "wcl-fila" }, '<span id="wcl-l-' + clave + '">' + etiqueta + '</span><div class="wcl-mm" role="group" aria-labelledby="wcl-l-' + clave + '"><button type="button" aria-label="Menos">−</button><span aria-live="polite"></span><button type="button" aria-label="Más">+</button></div>');
    var b = f.querySelectorAll("button"), v = f.querySelector("span[aria-live]");
    function poner(n) {
      n = Math.round(Math.min(max, Math.max(min, n)) / paso) * paso;
      n = +n.toFixed(4);
      ajustes[clave] = n; v.textContent = formato ? formato(n) : String(n); guardar();
      if (alCambiar) alCambiar(n);
    }
    b[0].addEventListener("click", function () { poner(ajustes[clave] - paso); });
    b[1].addEventListener("click", function () { poner(ajustes[clave] + paso); });
    refrescos.push(function () { v.textContent = formato ? formato(ajustes[clave]) : String(ajustes[clave]); });
    return f;
  }
  function filaOpc(clave, etiqueta, lista, alCambiar, objeto) {
    var w = el("div");
    if (etiqueta) w.appendChild(el("div", { "class": "wcl-estado" }, etiqueta));
    var g = el("div", { "class": "wcl-opc", "role": "group", "aria-label": etiqueta || clave });
    var botones = [];
    function valor() { return objeto ? objeto[clave] : ajustes[clave]; }
    lista.forEach(function (o) {
      var b = el("button", { "type": "button", "aria-pressed": "false" }, o[1]);
      b.addEventListener("click", function () {
        if (objeto) objeto[clave] = o[0]; else ajustes[clave] = o[0];
        guardar(); pintar(); if (alCambiar) alCambiar(o[0]);
      });
      botones.push([o[0], b]); g.appendChild(b);
    });
    function pintar() { botones.forEach(function (p) { p[1].setAttribute("aria-pressed", p[0] === valor() ? "true" : "false"); }); }
    refrescos.push(pintar);
    w.appendChild(g);
    return w;
  }
  function seccion(titulo) { return el("div", { "class": "wcl-sec" }, titulo ? "<h4>" + titulo + "</h4>" : ""); }
  function botonGrande(texto, clase, alPulsar) {
    var b = el("button", { "type": "button", "class": "wcl-big " + (clase || "") }, texto);
    b.addEventListener("click", alPulsar);
    return b;
  }
  function pct(n) { return n + " %"; }
  function ms(n) { return n + " ms"; }
  function px(n) { return n + " px"; }

  // --------------------------------------------------------------- voz --
  var leyendo = null, colaVoz = [];
  function vocesEs() {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf("es") === 0; });
  }
  function decirVoz(texto, interrumpir, forzar) {
    if (!("speechSynthesis" in window) || !texto) return;
    if (!ajustes.voz_activa && !forzar) return;
    if (interrumpir !== false) window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = "es";
    var voces = vocesEs(), v = null;
    if (ajustes.voz_nombre) for (var i = 0; i < voces.length; i++) if (voces[i].name === ajustes.voz_nombre) v = voces[i];
    if (!v && voces.length) v = voces[0];
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = Math.pow(1.18, ajustes.voz_velocidad || 0);
    window.speechSynthesis.speak(u);
  }
  function callar() { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); if (leyendo) { leyendo.classList.remove("wcl-leyendo"); leyendo = null; } }
  function leerElemento(elm) {
    if (!elm || (elm.closest && elm.closest(".wcl-root") && !elm.closest(".wcl-limpia-texto"))) return;
    var bloque = elm.closest("p,h1,h2,h3,h4,h5,h6,li,td,th,a,button,label,figcaption,blockquote,summary,dd,dt,input,textarea") || elm;
    if (leyendo) leyendo.classList.remove("wcl-leyendo");
    leyendo = bloque; bloque.classList.add("wcl-leyendo");
    var t = bloque.value != null && bloque.tagName !== "BUTTON" ? (bloque.value || bloque.placeholder || "") : (bloque.innerText || bloque.textContent || "");
    decirVoz(t.trim().slice(0, 2000), true, true);
  }
  function leerPagina() {
    var m = document.querySelector("main,article,[role=main]") || document.body;
    var texto = (m.innerText || "").replace(/\s+/g, " ").trim().slice(0, 15000);
    decirVoz(texto || "La página no tiene texto que leer.", true, true);
  }
  // Con el ratón de verdad: leer lo que se pulsa (los clics del puntero virtual lo hacen desde clic())
  document.addEventListener("click", function (e) { if (ajustes.lectura && e.isTrusted && !e.target.closest(".wcl-root")) leerElemento(e.target); }, true);

  // ------------------------------------------------------------ sonido --
  var audioCtx = null;
  function pitido(hz, msDur) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = hz || 1000; g.gain.value = 0.08;
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (msDur || 40) / 1000);
    } catch (e) {}
  }
  var avisoHasta = 0;
  function avisar(texto, ambar) {
    if (ajustes.avisos_visuales) {
      aviso.textContent = texto; aviso.classList.toggle("ambar", !!ambar); aviso.style.display = "block";
      aviso.style.transform = "translate(" + Math.min(P.x, window.innerWidth - 220) + "px," + Math.min(P.y + 24, window.innerHeight - 40) + "px)";
      avisoHasta = performance.now() + 900;
      setTimeout(function () { if (performance.now() >= avisoHasta) aviso.style.display = "none"; }, 950);
    }
    if (ajustes.avisos_sonido) pitido(1000, 40);
  }

  // =================================================== detección de cara ==
  var P = { x: window.innerWidth / 2, y: window.innerHeight / 2 };   // puntero virtual
  var camaraActiva = false, pausado = false, video = null, flujo = null, landmarker = null;
  var det = { cara: false, t: 0, lm: null, bs: null, track: null, mirada: null, rasgos: null, relacion: 1, iris: null };
  var historialRasgos = [];   // [(t, rasgos, relacion)] últimos 1,5 s, para la calibración invisible
  var anclaParpadeo = null, baseAvisada = false;   // dónde estaba el puntero al empezar a cerrar los ojos

  function forma(nombre) { return det.bs && det.bs[nombre] != null ? det.bs[nombre] : 0; }

  // --- parpadeo (detectors/parpadeo.py) ---------------------------------
  var OJO_DER = [159, 145, 33, 133], OJO_IZQ = [386, 374, 362, 263];
  var PB = { N: 400, PERCENTIL: 60, MIN_BASE: 45, RESPALDO: 0.2, TOLERANCIA: 0.30, HISTERESIS: 0.12, HUECO: 0.09,
             INICIO: 0.15, FIN: 0.20, LARGO_MS: 1200, MAX_MS: 4000 };
  function dist(a, b) { return Math.hypot((a.x - b.x) * CAM_W, (a.y - b.y) * CAM_H); }
  function aperturaOjo(lm, p) {
    var ancho = dist(lm[p[2]], lm[p[3]]);
    return ancho < 1e-6 ? 0 : dist(lm[p[0]], lm[p[1]]) / ancho;
  }
  function percentil(arr, p) {
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var k = (s.length - 1) * p / 100, i = Math.floor(k), f = k - i;
    return s[i + 1] != null ? s[i] + (s[i + 1] - s[i]) * f : s[i];
  }
  var parpadeo = {
    bufDer: [], bufIzq: [], base: null, cerradosDesde: null, clicEmitido: false, largoEmitido: false, evento: null,
    tAnterior: null, cierreInicio: null, cierreFin: 0, cierreFlags: [false, false],
    episodioDesde: null, episodioMin: [9, 9], episodioAmbosMs: 0, episodioProfundo: false, ultimoEpisodio: null,
    estado: { relacion: 1, cerrados: false, cerradosMs: 0, listo: false, base: [0, 0], apertura: [0, 0] },
    reiniciar: function () { this.bufDer = []; this.bufIzq = []; this.base = null; this.cerradosDesde = null; this.evento = null; this.episodioDesde = null;
      this.cierreInicio = null; this.cierreFin = 0; this.cierreFlags = [false, false]; this.clicEmitido = false; this.largoEmitido = false; this.tAnterior = null; this.ultimoEpisodio = null;
      this.estado = { relacion: 1, cerrados: false, cerradosMs: 0, listo: false, base: [0, 0], apertura: [0, 0] }; },
    procesar: function (lm, bs, umbral, minMs, ahora) {
      var aDer = aperturaOjo(lm, OJO_DER), aIzq = aperturaOjo(lm, OJO_IZQ);
      var bsDer = bs ? bs.eyeBlinkRight : null, bsIzq = bs ? bs.eyeBlinkLeft : null;
      var tAnterior = this.tAnterior; this.tAnterior = ahora;
      var listo = this.bufDer.length >= PB.MIN_BASE;
      var enCierre = this.cerradosDesde !== null;
      var umbralEf = umbral + (enCierre ? PB.HISTERESIS : 0);
      var bDer = 0, bIzq = 0, rDer, rIzq, cDer, cIzq;
      if (listo) {
        if (!this.base) this.base = [percentil(this.bufDer, PB.PERCENTIL), percentil(this.bufIzq, PB.PERCENTIL)];
        bDer = this.base[0]; bIzq = this.base[1];
        rDer = bDer > 1e-6 ? aDer / bDer : 1; rIzq = bIzq > 1e-6 ? aIzq / bIzq : 1;
        if (bsDer != null) { rDer = Math.min(rDer, 1 - bsDer); rIzq = Math.min(rIzq, 1 - bsIzq); }
        cDer = rDer < umbralEf + PB.TOLERANCIA; cIzq = rIzq < umbralEf + PB.TOLERANCIA;
      } else {
        rDer = aDer / PB.RESPALDO; rIzq = aIzq / PB.RESPALDO;
        cDer = aDer < PB.RESPALDO; cIzq = aIzq < PB.RESPALDO;
      }
      var rMejor = Math.min(rDer, rIzq);
      var cerrados = cDer && cIzq && rMejor < umbralEf;
      var cierreEterno = enCierre && (ahora - this.cerradosDesde) * 1000 > PB.MAX_MS;
      if (!listo || !cerrados || cierreEterno) {
        this.bufDer.push(aDer); this.bufIzq.push(aIzq);
        if (this.bufDer.length > PB.N) { this.bufDer.shift(); this.bufIzq.shift(); }
        if (this.bufDer.length >= PB.MIN_BASE) { this.base = [percentil(this.bufDer, PB.PERCENTIL), percentil(this.bufIzq, PB.PERCENTIL)]; listo = true; }
      }
      // Episodio: desde que el mejor ojo empieza a cerrarse hasta que se abre
      var enEpisodio = this.episodioDesde !== null;
      if (rMejor < umbral + (enEpisodio ? PB.FIN : PB.INICIO)) {
        if (!enEpisodio) {
          this.episodioDesde = (tAnterior !== null && ahora - tAnterior > 0 && ahora - tAnterior < 0.2) ? (tAnterior + ahora) / 2 : ahora;
          this.episodioMin = [rDer, rIzq]; this.episodioAmbosMs = 0; this.episodioProfundo = false; this.clicEmitido = false;
        }
        this.episodioMin[0] = Math.min(this.episodioMin[0], rDer); this.episodioMin[1] = Math.min(this.episodioMin[1], rIzq);
        if (rMejor < umbralEf) this.episodioProfundo = true;
        var episodioMs = Math.round((ahora - this.episodioDesde) * 1000);
        if (this.episodioProfundo && !this.clicEmitido && episodioMs >= minMs && Math.max(rDer, rIzq) < umbral + PB.TOLERANCIA) {
          this.clicEmitido = true; this.evento = "clic"; this.episodioAmbosMs = Math.max(this.episodioAmbosMs, minMs);
        }
      } else if (enEpisodio) {
        var totalMs = Math.round((ahora - this.episodioDesde) * 1000), m = this.episodioMin, res;
        if (this.episodioAmbosMs >= minMs) res = "clic";
        else if (this.episodioAmbosMs > 0) res = "corto: " + this.episodioAmbosMs + " ms (hacen falta " + minMs + ")";
        else if (m[0] >= umbral + PB.TOLERANCIA) res = "guiño: el derecho se quedó abierto";
        else if (m[1] >= umbral + PB.TOLERANCIA) res = "guiño: el izquierdo se quedó abierto";
        else res = "no se cerraron bastante (" + Math.min(m[0], m[1]).toFixed(2) + ", hace falta menos de " + umbral.toFixed(2) + ")";
        if (totalMs >= 60 && totalMs <= PB.MAX_MS) this.ultimoEpisodio = { ms: totalMs, resultado: res, t: ahora };
        this.episodioDesde = null;
      }
      var cerradosMs = 0;
      if (cerrados) {
        if (this.cerradosDesde === null) {
          if (this.cierreInicio !== null && ahora - this.cierreFin < PB.HUECO) {
            this.cerradosDesde = this.cierreInicio; this.clicEmitido = this.cierreFlags[0]; this.largoEmitido = this.cierreFlags[1];
          } else {
            this.cerradosDesde = (tAnterior !== null && ahora - tAnterior > 0 && ahora - tAnterior < 0.2) ? (tAnterior + ahora) / 2 : ahora;
            this.largoEmitido = false;
          }
          this.cierreInicio = null;
        }
        cerradosMs = Math.round((ahora - this.cerradosDesde) * 1000);
        this.episodioAmbosMs = Math.max(this.episodioAmbosMs, cerradosMs);
        if (!this.clicEmitido && cerradosMs >= minMs) { this.clicEmitido = true; this.evento = "clic"; }
        if (!this.largoEmitido && cerradosMs >= PB.LARGO_MS) { this.largoEmitido = true; this.evento = "largo"; }
      } else if (this.cerradosDesde !== null) {
        this.cierreInicio = this.cerradosDesde; this.cierreFin = ahora; this.cierreFlags = [this.clicEmitido, this.largoEmitido];
        this.cerradosDesde = null;
      }
      this.estado = { relacion: rMejor, cerrados: cerrados, cerradosMs: cerradosMs, listo: listo, base: [bDer, bIzq], apertura: [aDer, aIzq] };
    },
    tomarEvento: function () { var e = this.evento; this.evento = null; return e; },
    ojosAbiertos: function (margen) { return this.estado.relacion >= (margen || 0.7); }
  };
  // Para fiarse del iris basta con que los ojos no estén cerrándose: hay personas
  // (o sonrisas) con los ojos entrecerrados en reposo, alrededor del 65-70 %.
  function ojosParaMirar() { return !parpadeo.estado.cerrados && parpadeo.estado.relacion >= 0.5; }

  // --- mirada por iris (detectors/mirada.py) -----------------------------
  var IRIS_DER = [468, 469, 470, 471, 472], IRIS_IZQ = [473, 474, 475, 476, 477];
  var CONT_DER = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  var CONT_IZQ = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
  var N_RASGOS = 15;
  function medirOjo(lm, iris, esq, parp, cont) {
    var ix = 0, iy = 0, i;
    for (i = 0; i < iris.length; i++) { ix += lm[iris[i]].x; iy += lm[iris[i]].y; }
    ix = ix / iris.length * CAM_W; iy = iy / iris.length * CAM_H;
    var cx = 0, cy = 0;
    for (i = 0; i < cont.length; i++) { cx += lm[cont[i]].x; cy += lm[cont[i]].y; }
    cx = cx / cont.length * CAM_W; cy = cy / cont.length * CAM_H;
    var anchoOjo = dist(lm[esq[0]], lm[esq[1]]);
    if (anchoOjo < 1e-6) return null;
    var py = (lm[parp[0]].y + lm[parp[1]].y) / 2 * CAM_H;
    var apertura = dist(lm[parp[0]], lm[parp[1]]) / anchoOjo;
    return [(ix - cx) / anchoOjo, (iy - cy) / anchoOjo, (iy - py) / anchoOjo, apertura, ix, iy];
  }
  function calcularMirada(lm, bs) {
    if (!lm || lm.length < 478) { det.mirada = null; det.rasgos = null; return; }
    var der = medirOjo(lm, IRIS_DER, [33, 133], [159, 145], CONT_DER);
    var izq = medirOjo(lm, IRIS_IZQ, [362, 263], [386, 374], CONT_IZQ);
    if (!der && !izq) { det.mirada = null; det.rasgos = null; return; }
    der = der || izq; izq = izq || der;
    var gx = (der[0] + izq[0]) / 2, gy = (der[1] + izq[1]) / 2, bx = 0, by = 0;
    if (bs) {
      bx = ((bs.eyeLookInLeft - bs.eyeLookOutLeft) + (bs.eyeLookOutRight - bs.eyeLookInRight)) / 2;
      by = ((bs.eyeLookDownLeft - bs.eyeLookUpLeft) + (bs.eyeLookDownRight - bs.eyeLookUpRight)) / 2;
    }
    det.mirada = [gx, gy];
    det.rasgos = [der[0], der[1], der[2], izq[0], izq[1], izq[2], bx, by, gx * gx, gy * gy, gx * gy, der[3], izq[3], gx * gx * gx, gy * gy * gy];
    det.iris = [[der[4], der[5]], [izq[4], izq[5]]];
  }

  // --- filtros (utils/filtro.py) -------------------------------------------
  function OneEuro(minCutoff, beta, dCutoff) { this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff || 1; this.reiniciar(); }
  OneEuro.prototype.reiniciar = function () { this.xPrev = null; this.dxPrev = 0; this.tPrev = null; };
  OneEuro.prototype.alpha = function (cutoff, dt) { var tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); };
  OneEuro.prototype.filtrar = function (x, t) {
    if (this.xPrev === null) { this.xPrev = x; this.tPrev = t; return x; }
    var dt = Math.max(1e-3, t - this.tPrev); this.tPrev = t;
    var dx = (x - this.xPrev) / dt, ad = this.alpha(this.dCutoff, dt);
    var dxHat = ad * dx + (1 - ad) * this.dxPrev;
    var a = this.alpha(this.minCutoff + this.beta * Math.abs(dxHat), dt);
    var xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat; this.dxPrev = dxHat; return xHat;
  };
  function Fijacion() { this.reiniciar(); }
  Fijacion.prototype.reiniciar = function () { this.punto = null; this.fueraDesde = null; this.moviendo = false; };
  Fijacion.prototype.actualizar = function (x, y, radio, persistS, radioSalto, t) {
    var paso = 0.25;
    if (!this.punto) { this.punto = [x, y]; return this.punto; }
    var fx = this.punto[0], fy = this.punto[1], d = Math.hypot(x - fx, y - fy);
    if (d >= radioSalto) { this.punto = [x, y]; this.fueraDesde = null; this.moviendo = false; }
    else if (this.moviendo) {
      if (d <= 6) { this.punto = [x, y]; this.moviendo = false; } else this.punto = [fx + paso * (x - fx), fy + paso * (y - fy)];
    } else if (d > radio) {
      if (this.fueraDesde === null) this.fueraDesde = t;
      else if (t - this.fueraDesde >= persistS) { this.moviendo = true; this.fueraDesde = null; this.punto = [fx + paso * (x - fx), fy + paso * (y - fy)]; }
    } else this.fueraDesde = null;
    return this.punto;
  };
  Fijacion.prototype.fijarEn = function (x, y) { this.punto = [x, y]; this.fueraDesde = null; this.moviendo = false; };

  // --- calibración: regresión ridge (detectors/calibracion.py) -------------
  var LAMBDAS = [0.05, 0.15, 0.5, 1.5, 5.0], PESO_FIJOS = 8;
  function resolver(A, b) {   // sistema lineal por eliminación de Gauss con pivote
    var n = b.length, i, j, k, M = [];
    for (i = 0; i < n; i++) M.push(A[i].concat([b[i]]));
    for (i = 0; i < n; i++) {
      var p = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      var tmp = M[i]; M[i] = M[p]; M[p] = tmp;
      if (Math.abs(M[i][i]) < 1e-12) M[i][i] = 1e-12;
      for (k = i + 1; k < n; k++) { var f = M[k][i] / M[i][i]; for (j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) { var s = M[i][n]; for (j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return x;
  }
  function filaX(r, media, desv) { var x = [1]; for (var i = 0; i < r.length; i++) x.push((r[i] - media[i]) / desv[i]); return x; }
  function ridge(X, y, lam, pesos) {
    var n = X[0].length, A = [], b = new Array(n).fill(0), i, j, k;
    for (i = 0; i < n; i++) { A.push(new Array(n).fill(0)); A[i][i] = i === 0 ? 0 : lam; }
    for (k = 0; k < X.length; k++) {
      var w = pesos ? pesos[k] : 1, xk = X[k];
      for (i = 0; i < n; i++) { var wi = w * xk[i]; b[i] += wi * y[k]; for (j = 0; j < n; j++) A[i][j] += wi * xk[j]; }
    }
    return resolver(A, b);
  }
  function prodEscalar(x, c) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * c[i]; return s; }
  function mediana(a) { if (!a.length) return 0; var s = a.slice().sort(function (p, q) { return p - q; }); var m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function errorLoo(X, Pt, pesos, nFijos, lam) {
    var errores = [];
    for (var i = 0; i < nFijos; i++) {
      var Xm = [], px = [], py = [], pw = [];
      for (var k = 0; k < X.length; k++) if (k !== i) { Xm.push(X[k]); px.push(Pt[k][0]); py.push(Pt[k][1]); pw.push(pesos[k]); }
      var cx = ridge(Xm, px, lam, pw), cy = ridge(Xm, py, lam, pw);
      errores.push(Math.hypot(prodEscalar(X[i], cx) - Pt[i][0], prodEscalar(X[i], cy) - Pt[i][1]));
    }
    return errores;
  }
  // puntosFijos: [[x,y]], rasgosFijos: [rasgos]; extra: muestras sueltas con peso propio
  function ajustarModelo(puntosFijos, rasgosFijos, puntosExtra, rasgosExtra, pesosExtra, lamFija) {
    var Pf = puntosFijos.slice(), Rf = rasgosFijos.slice(), descartados = [], i, j, k;
    var Pe = puntosExtra || [], Re = rasgosExtra || [], We = pesosExtra || Pe.map(function () { return 1; });
    var media, desv, X, Pt, pesos, lam, errores, errMed;
    var candidatos = lamFija ? [lamFija] : LAMBDAS;
    for (var ronda = 0; ronda < 4; ronda++) {
      Pt = Pf.concat(Pe); var Rt = Rf.concat(Re);
      pesos = Pf.map(function () { return PESO_FIJOS; }).concat(We);
      media = new Array(N_RASGOS).fill(0); desv = new Array(N_RASGOS).fill(0);
      for (k = 0; k < Rt.length; k++) for (i = 0; i < N_RASGOS; i++) media[i] += Rt[k][i] / Rt.length;
      for (k = 0; k < Rt.length; k++) for (i = 0; i < N_RASGOS; i++) desv[i] += (Rt[k][i] - media[i]) * (Rt[k][i] - media[i]) / Rt.length;
      for (i = 0; i < N_RASGOS; i++) { desv[i] = Math.sqrt(desv[i]); if (desv[i] < 1e-9) desv[i] = 1; }
      X = Rt.map(function (r) { return filaX(r, media, desv); });
      var nFijos = Pf.length, mejor = null;
      for (j = 0; j < candidatos.length; j++) {
        var e = (nFijos >= 4 && candidatos.length > 1) ? errorLoo(X, Pt, pesos, nFijos, candidatos[j]) : [0];
        var med = mediana(e);
        if (!mejor || med < mejor[0]) mejor = [med, candidatos[j], e];
      }
      errMed = mejor[0]; lam = mejor[1]; errores = mejor[2];
      if (nFijos > 6 && descartados.length < 3) {
        var peor = 0; for (i = 1; i < errores.length; i++) if (errores[i] > errores[peor]) peor = i;
        if (errores[peor] > Math.max(2.5 * errMed, 150)) { descartados.push(Pf[peor]); Pf.splice(peor, 1); Rf.splice(peor, 1); continue; }
      }
      break;
    }
    var cx = ridge(X, Pt.map(function (p) { return p[0]; }), lam, pesos);
    var cy = ridge(X, Pt.map(function (p) { return p[1]; }), lam, pesos);
    return { media: media, desv: desv, coef_x: cx, coef_y: cy, monitor: [0, 0, window.innerWidth, window.innerHeight],
             puntos: Pf, lambda: lam, n_muestras: Pt.length, descartados: descartados, error_px: Math.round(errMed), sesgo: [0, 0] };
  }
  function predecir(modelo, rasgos, sinSesgo) {
    var fx = filaX(rasgos, modelo.media, modelo.desv);
    var x = prodEscalar(fx, modelo.coef_x) + (modelo.sesgo && !sinSesgo ? modelo.sesgo[0] : 0);
    var y = prodEscalar(fx, modelo.coef_y) + (modelo.sesgo && !sinSesgo ? modelo.sesgo[1] : 0);
    // El modelo se hizo con un tamaño de ventana; si cambió, se escala
    var m = modelo.monitor, ex = window.innerWidth / (m[2] - m[0] || 1), ey = window.innerHeight / (m[3] - m[1] || 1);
    x *= ex; y *= ey;
    if (sinSesgo) return [x, y];   // crudo, sin recortar (para recentrar)
    return [Math.min(Math.max(x, 0), window.innerWidth - 1), Math.min(Math.max(y, 0), window.innerHeight - 1)];
  }
  function modeloValido(m) { return !!(m && m.coef_x && m.coef_y && m.coef_x.length === N_RASGOS + 1 && m.coef_y.length === N_RASGOS + 1 && m.media && m.media.length === N_RASGOS && m.desv && m.desv.length === N_RASGOS && m.monitor && m.monitor.length === 4); }
  var calibracion = leerJSON("winclus.calibracion", null);
  if (!modeloValido(calibracion)) calibracion = null;
  var ojosCentro = leerJSON("winclus.ojos_centro", null);

  // --- cámara y MediaPipe ---------------------------------------------------
  var estadoEl = null, btnActivar = null, ultimoAviso = 0, ultimoT = -1;
  function decir(t) { if (estadoEl) estadoEl.textContent = t; }
  function decirSuave(t) { var a = performance.now(); if (a - ultimoAviso > 1500) { ultimoAviso = a; decir(t); } }
  function cargarDetectorDe(fuente) {
    return import(fuente.base + "/vision_bundle.mjs").then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(fuente.base + "/wasm").then(function (fs) {
        return mp.FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: fuente.modelo, delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false
        });
      });
    });
  }
  function cargarDetector() {
    if (landmarker) return Promise.resolve();
    var errores = [];
    function intentar(i) {
      if (i >= FUENTES_MP.length) return Promise.reject(new Error("No se pudo descargar el detector de caras (" + errores.join(" · ") + ")"));
      return cargarDetectorDe(FUENTES_MP[i]).then(function (lm) { landmarker = lm; }, function (e) {
        errores.push(FUENTES_MP[i].base.replace(/^https?:\/\//, "").split("/")[0] + ": " + (e && e.message ? e.message : e));
        return intentar(i + 1);
      });
    }
    return intentar(0);
  }
  function vistaCamara(ver) { var v = q(".wcl-cam-vista"); if (v) v.style.display = ver ? "block" : "none"; }
  function activarCamara() {
    if (!opciones.camara || !btnActivar) return;
    if (camaraActiva) { desactivarCamara(); return; }
    btnActivar.disabled = true; decir("Cargando el detector de cara (unos segundos la primera vez)…");
    cargarDetector().then(function () {
      decir("Detector listo. Pidiendo permiso para la cámara…");
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Este navegador no da acceso a la cámara. Hace falta una página https (o localhost).");
      return navigator.mediaDevices.getUserMedia({ video: { width: CAM_W, height: CAM_H, facingMode: "user" }, audio: false }).catch(function (e) {
        var n = e && e.name;
        throw new Error(n === "NotAllowedError" ? "No hay permiso para la cámara. Pulsa el candado de la barra de direcciones y permite la cámara."
          : n === "NotFoundError" ? "No se encontró ninguna cámara." : n === "NotReadableError" ? "Otra aplicación está usando la cámara." : (e && e.message ? e.message : e));
      });
    }).then(function (f) {
      flujo = f;
      if (!video) { video = el("video", { "class": "wcl-video", "playsinline": "", "muted": "", "autoplay": "" }); cont.appendChild(video); }
      video.muted = true; video.playsInline = true;   // sin esto play() puede fallar si no hubo un clic real antes
      video.srcObject = f;
      return video.play();
    }).then(function () {
      camaraActiva = true; pausado = false;
      parpadeo.reiniciar(); reiniciarPuntero();
      btnActivar.textContent = "Desactivar cámara"; btnActivar.classList.add("rojo"); btnActivar.disabled = false;
      btnPausa.style.display = "block"; pintarPausa();
      cursor.style.display = "block"; mover(window.innerWidth / 2, window.innerHeight / 2);
      vistaCamara(ajustes.camara_ver);
      decir("Cámara activa. Mira al centro un momento mientras aprende cómo son tus ojos abiertos.");
      avisar("Activado");
      if (ajustes.modo_puntero === "ojos" && ajustes.ojos_modo !== "palanca" && !calibracion) {
        decir("Para mover el puntero con los ojos hay que calibrar una vez: en 3 segundos empieza la calibración (unos 40 s).");
        setTimeout(function () { if (camaraActiva && !calibracion && !calibrando) { abrir(false); empezarCalibracion(false); } }, 3000);
      }
      generacion++; requestAnimationFrame(bucle.bind(null, generacion));
    }).catch(function (err) {
      if (btnActivar) btnActivar.disabled = false;
      decir("No se pudo activar: " + (err && err.message ? err.message : err));
    });
  }
  var generacion = 0;
  function desactivarCamara() {
    camaraActiva = false; pausado = false; pintarPausa();
    if (calibrando) cerrarCalibracion();
    if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; }
    if (video) video.srcObject = null;
    cursor.style.display = "none"; btnPausa.style.display = "none";
    cerrarMenu(); cerrarLupa(); soltarArrastre(); ocultarTeclado();   // las órdenes por voz siguen: no dependen de la cámara
    historialRasgos = []; anclaParpadeo = null; det.cara = false; det.track = null; det.rasgos = null; det.mirada = null;
    vistaCamara(false);
    if (btnActivar) { btnActivar.textContent = "Activar cámara"; btnActivar.classList.remove("rojo"); }
    decir("Cámara apagada.");
  }
  function bucle(gen) {
    if (!camaraActiva || gen !== generacion) return;
    var t = performance.now();
    if (video.readyState >= 2 && t !== ultimoT) {
      ultimoT = t;
      var r = null;
      try { r = landmarker.detectForVideo(video, t); } catch (e) {}
      if (r && r.faceLandmarks && r.faceLandmarks.length) procesarCara(r, t / 1000);
      else { if (det.cara) { bufTrack = []; delayCount = 0; trackUltimo = null; ultimaVel = null; } det.cara = false; det.track = null; det.rasgos = null; det.mirada = null; decirSuave("No veo tu cara. Ponte frente a la cámara con luz de frente."); }
    }
    try { vuelta(t / 1000); } catch (e) { if (window.console) console.warn("Winclus:", e); }
    if (ajustes.camara_ver && panel.classList.contains("abierto")) dibujarCamara();
    requestAnimationFrame(bucle.bind(null, gen));
  }
  function procesarCara(r, tS) {
    var lm = r.faceLandmarks[0], bs = {};
    var cats = r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
    if (cats) for (var i = 0; i < cats.length; i++) bs[cats[i].categoryName] = cats[i].score;
    det.cara = true; det.t = tS; det.lm = lm; det.bs = cats ? bs : null;
    // La aplicación espeja la imagen: mover la cabeza a la derecha lleva el puntero a la derecha
    det.track = [(1 - lm[8].x) * CAM_W, lm[8].y * CAM_H];
    parpadeo.procesar(lm, det.bs, ajustes.parpadeo_umbral, ajustes.parpadeo_ms, tS);
    // Al cerrar los ojos la cabeza y las cejas se mueven un poco y el puntero se
    // desvía: el clic se hace donde estaba el puntero al EMPEZAR a cerrarlos
    if (parpadeo.episodioDesde !== null) { if (!anclaParpadeo) anclaParpadeo = [P.x, P.y]; } else anclaParpadeo = null;
    det.relacion = parpadeo.estado.relacion;
    calcularMirada(lm, det.bs);
    if (det.rasgos) {
      historialRasgos.push([tS, det.rasgos, det.relacion]);
      while (historialRasgos.length && tS - historialRasgos[0][0] > 1.5) historialRasgos.shift();
    }
    if (!parpadeo.estado.listo) { decirSuave("Aprendiendo tus ojos abiertos… (" + parpadeo.bufDer.length + "/" + PB.MIN_BASE + ")"); baseAvisada = false; }
    else if (!baseAvisada) { baseAvisada = true; ultimoAviso = 0; decirSuave("Listo. Mueve la cabeza para mover el puntero y cierra los ojos medio segundo para hacer clic."); }
    else if (parpadeo.ultimoEpisodio && tS - parpadeo.ultimoEpisodio.t < 0.1) decirSuave("Ojos cerrados " + parpadeo.ultimoEpisodio.ms + " ms: " + parpadeo.ultimoEpisodio.resultado);
  }
  function dibujarCamara() {
    var lienzo = q(".wcl-cam-vista canvas"); if (!lienzo || !video) return;
    var c = lienzo.getContext("2d"), w = lienzo.width, h = lienzo.height;
    c.save(); c.translate(w, 0); c.scale(-1, 1); c.drawImage(video, 0, 0, w, h); c.restore();
    if (det.cara && det.lm) {
      var n = det.lm[1];
      c.fillStyle = "#F2B705"; c.beginPath(); c.arc((1 - n.x) * w, n.y * h, 5, 0, 6.3); c.fill();
      if (det.iris) det.iris.forEach(function (p) { c.strokeStyle = "#34C26B"; c.lineWidth = 2; c.beginPath(); c.arc(w - p[0] / CAM_W * w, p[1] / CAM_H * h, 4, 0, 6.3); c.stroke(); });
      c.fillStyle = "rgba(16,31,61,.7)"; c.fillRect(0, h - 22, w, 22); c.fillStyle = "#fff"; c.font = "12px system-ui";
      c.fillText("ojos " + Math.round(det.relacion * 100) + " %" + (parpadeo.estado.cerrados ? " · cerrados " + parpadeo.estado.cerradosMs + " ms" : ""), 6, h - 7);
    }
  }

  // ============================================================ puntero ==
  // controllers/mouse_controller.py: cabeza (velocidad), ojos directo, híbrido y palanca
  var bufTrack = [], prevX = 0, prevY = 0, delayCount = 0, kernel = null;
  var filtroDirecto = [new OneEuro(1, 0.004), new OneEuro(1, 0.004)], fijador = new Fijacion(), fijacion = null;
  var rasgosMuestras = [], rasgosUltimo = null, congeladoHasta = 0, ultimoSalto = 0, ultimoSaltoPunto = null, cabezaDesdeSalto = [0, 0];
  var miradaMuestras = [], centrandoPalanca = null, calibrando = false, trackUltimo = null, ultimaVel = null, miradaUltima = null;
  var SEL_CLICABLE = 'a[href],button,input,select,textarea,summary,label,[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=option],[role=switch],[onclick],[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable="true"]';

  function kernelHamming(n) {   // np.hamming(2n)[:n], normalizado
    var M = 2 * n, k = [], s = 0, i;
    for (i = 0; i < n; i++) { var v = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (M - 1)); k.push(v); s += v; }
    for (i = 0; i < n; i++) k[i] /= s;
    return k;
  }
  function reiniciarPuntero() {
    bufTrack = []; delayCount = 0; rasgosMuestras = []; rasgosUltimo = null; miradaMuestras = []; trackUltimo = null; ultimaVel = null; miradaUltima = null;
    filtroDirecto[0].reiniciar(); filtroDirecto[1].reiniciar(); fijador.reiniciar(); fijacion = null;
    ultimoSaltoPunto = null; cabezaDesdeSalto = [0, 0];
  }
  var ultimoHover = null, ultimoMovX = -1, ultimoMovY = -1;
  function mover(x, y) {
    if (!isFinite(x) || !isFinite(y)) return;
    P.x = Math.max(0, Math.min(window.innerWidth - 1, x));
    P.y = Math.max(0, Math.min(window.innerHeight - 1, y));
    cursor.style.transform = "translate(" + P.x + "px," + P.y + "px)";
    if (ajustes.guia) guia.style.top = P.y + "px";
    if (ajustes.mascara) actualizarMascara(P.y);
    if (ajustes.lupa_pantalla) seguirLupaPantalla(P.x, P.y);
  }
  function moverRel(dx, dy) { mover(P.x + dx, P.y + dy); }
  function congelar(s) { congeladoHasta = performance.now() / 1000 + s; fijacion = null; fijador.reiniciar(); }
  function bajoPuntero(x, y) {
    var e = document.elementFromPoint(x == null ? P.x : x, y == null ? P.y : y);
    return e && e.closest && e.closest(".wcl-root") ? null : e;
  }
  function avisarHover() {   // que la página vea pasar el puntero (menús que se abren al pasar, etc.)
    if (Math.abs(P.x - ultimoMovX) < 1 && Math.abs(P.y - ultimoMovY) < 1) return;
    ultimoMovX = P.x; ultimoMovY = P.y;
    var e = bajoPuntero(); if (!e) return;
    var extra = { bubbles: true, cancelable: true, clientX: P.x, clientY: P.y, view: window, buttons: arrastrando ? 1 : 0 };
    if (e !== ultimoHover) {
      if (ultimoHover) { try { ultimoHover.dispatchEvent(new MouseEvent("mouseout", extra)); ultimoHover.dispatchEvent(new PointerEvent("pointerout", extra)); } catch (x) {} }
      try { e.dispatchEvent(new PointerEvent("pointerover", extra)); e.dispatchEvent(new MouseEvent("mouseover", extra)); } catch (x) {}
      ultimoHover = e;
    }
    try { e.dispatchEvent(new PointerEvent("pointermove", extra)); e.dispatchEvent(new MouseEvent("mousemove", extra)); } catch (x) {}
  }

  function velocidadCabeza() {
    if (!det.track) return null;
    var n = Math.max(2, Math.min(30, ajustes.suavizado | 0));
    if (!kernel || kernel.length !== n) { kernel = kernelHamming(n); bufTrack = []; delayCount = 0; }
    // Cada fotograma de la cámara cuenta una vez aunque este bucle vaya a 60-144 Hz
    if (det.track === trackUltimo) return ultimaVel;
    trackUltimo = det.track;
    bufTrack.push(det.track); while (bufTrack.length > n) bufTrack.shift();
    var sx = 0, sy = 0, off = n - bufTrack.length;
    for (var i = 0; i < bufTrack.length; i++) { sx += kernel[i + off] * bufTrack[i][0]; sy += kernel[i + off] * bufTrack[i][1]; }
    if (!isFinite(sx) || !isFinite(sy)) { bufTrack = []; delayCount = 0; ultimaVel = null; return null; }
    var vx = sx - prevX, vy = sy - prevY; prevX = sx; prevY = sy;
    delayCount++; ultimaVel = null;
    if (delayCount < n + 12) return null;   // en espera hasta que el suavizado se llena
    var spd = ajustes.velocidad;
    vx *= spd; vy *= spd;
    if (ajustes.aceleracion) { vx *= acel(vx); vy *= acel(vy); }
    ultimaVel = [vx, vy];
    return ultimaVel;
  }
  function acel(v) { return 0.6 + 1.2 / (1 + Math.exp(-(Math.abs(v) - 3))); }

  function miradaFiltrada(tS) {
    if (!calibracion || !det.rasgos || !ojosParaMirar()) return null;   // parpadeo o sin cara: se queda donde está
    if (parpadeo.episodioDesde !== null) return null;   // mientras los ojos se cierran o se abren, el iris no vale: el puntero no se mueve
    if (det.rasgos === rasgosUltimo) return null;
    rasgosUltimo = det.rasgos;
    rasgosMuestras.push(det.rasgos); if (rasgosMuestras.length > 5) rasgosMuestras.shift();
    var med = [];
    for (var i = 0; i < N_RASGOS; i++) med.push(mediana(rasgosMuestras.map(function (r) { return r[i]; })));
    var p = predecir(calibracion, med);
    var suav = Math.max(1, ajustes.ojos_suavizado | 0), corte = 3 / Math.pow(suav, 0.8);
    filtroDirecto[0].minCutoff = corte; filtroDirecto[1].minCutoff = corte; filtroDirecto[0].beta = 0.003; filtroDirecto[1].beta = 0.003;
    return [filtroDirecto[0].filtrar(p[0], tS), filtroDirecto[1].filtrar(p[1], tS)];
  }
  function moverDirecto(tS) {
    var p = miradaFiltrada(tS); if (!p) return;
    var radio = ajustes.ojos_fijacion_px, persist = ajustes.ojos_persistencia_ms / 1000;
    fijacion = fijador.actualizar(p[0], p[1], radio, persist, Math.max(3 * radio, 250), tS);
    mover(fijacion[0], fijacion[1]);
  }
  function moverHibrido(tS) {
    var vel = velocidadCabeza(), factor = ajustes.hibrido_cabeza / 100;
    var vx = vel ? vel[0] * factor : 0, vy = vel ? vel[1] * factor : 0;
    var cabezaQuieta = Math.hypot(vx, vy) < 0.6;
    var p = miradaFiltrada(tS);
    if (p) {
      var radio = ajustes.ojos_fijacion_px;
      fijacion = fijador.actualizar(p[0], p[1], radio, ajustes.ojos_persistencia_ms / 1000, Math.max(3 * radio, 250), tS);
      var salta = fijacion && !fijador.moviendo && (ultimoSaltoPunto === null ||
        (cabezaQuieta && Math.hypot(fijacion[0] - ultimoSaltoPunto[0], fijacion[1] - ultimoSaltoPunto[1]) >= ajustes.hibrido_salto_px));
      if (salta) { ultimoSalto = tS; ultimoSaltoPunto = fijacion.slice(); cabezaDesdeSalto = [0, 0]; mover(fijacion[0], fijacion[1]); return; }
    }
    if (!vel || (vx === 0 && vy === 0)) return;
    if (tS - ultimoSalto < ajustes.hibrido_pausa_ms / 1000) return;
    moverRel(vx, vy); cabezaDesdeSalto[0] += vx; cabezaDesdeSalto[1] += vy;
  }
  function afinadoConCabeza() { return Math.hypot(cabezaDesdeSalto[0], cabezaDesdeSalto[1]) >= 12; }
  function moverPalanca(tS) {
    if (!det.mirada) { miradaMuestras = []; return; }
    if (!ojosCentro) {   // sin centro: se toma de lo que se mira el primer segundo y medio
      centrandoPalanca = centrandoPalanca || []; if (det.mirada !== miradaUltima) { miradaUltima = det.mirada; centrandoPalanca.push(det.mirada); }
      decirSuave("Mira al centro de la pantalla: tomando el punto de reposo… " + centrandoPalanca.length + "/45");
      if (centrandoPalanca.length >= 45) { fijarCentroPalanca(centrandoPalanca); centrandoPalanca = null; }
      return;
    }
    var n = Math.max(1, ajustes.ojos_suavizado | 0);
    if (det.mirada !== miradaUltima) { miradaUltima = det.mirada; miradaMuestras.push(det.mirada); while (miradaMuestras.length > n) miradaMuestras.shift(); }
    if (!miradaMuestras.length) return;
    var gx = 0, gy = 0; miradaMuestras.forEach(function (m) { gx += m[0] / miradaMuestras.length; gy += m[1] / miradaMuestras.length; });
    var zona = ajustes.ojos_zona_muerta / 100, gan = ajustes.ojos_velocidad * 2, vert = ajustes.ojos_vertical / 100;
    function palanca(d) { var m = Math.abs(d) - zona; return m <= 0 ? 0 : Math.sign(d) * m * gan; }
    var vx = palanca(gx - ojosCentro[0]), vy = palanca(gy - ojosCentro[1]) * vert;
    vx = Math.max(-30, Math.min(30, vx)); vy = Math.max(-30, Math.min(30, vy));
    if (vx || vy) moverRel(vx, vy);
  }
  function fijarCentroPalanca(muestras) {
    ojosCentro = [mediana(muestras.map(function (m) { return m[0]; })), mediana(muestras.map(function (m) { return m[1]; }))];
    escribirJSON("winclus.ojos_centro", ojosCentro); decir("Punto de reposo de la palanca guardado."); avisar("Centrado");
  }

  function modoEfectivo() {
    if (ajustes.modo_puntero !== "ojos") return "cabeza";
    if (ajustes.ojos_modo === "palanca") return "palanca";
    return calibracion ? ajustes.ojos_modo : "cabeza";
  }
  function vuelta(tS) {
    if (calibrando) { tickCalibracion(tS); return; }
    if (!pausado) {
      var modo = modoEfectivo(), congelado = tS < congeladoHasta;
      if (modo === "directo") { if (!congelado) moverDirecto(tS); }
      else if (modo === "hibrido") { if (!congelado) moverHibrido(tS); }
      else if (modo === "palanca") { if (!congelado) moverPalanca(tS); }
      else { var v = velocidadCabeza(); if (v && !congelado && (v[0] || v[1])) moverRel(v[0], v[1]); }   // congelado: se calcula pero no se aplica, para que al descongelar no salte
      if (modo !== "cabeza" && modo !== "hibrido" && det.track) velocidadCabeza();   // el búfer de cabeza al día para cambiar de modo sin salto
    }
    tickClics(tS);
    if (!pausado) { tickIman(tS); tickMenu(tS); tickTeclado(); avisarHover(); }
    cursor.style.opacity = pausado ? ".35" : "";
  }

  // --------------------------------------------------------------- imán --
  // src/iman.py: puntero quieto 0,3 s cerca de un control → se pega a él
  var imanQuietoDesde = 0, imanX = 0, imanY = 0, imanHecho = false, imanEl = null;
  function esClicable(e) { return !!(e && e.closest && e.closest(SEL_CLICABLE)); }
  function tickIman(tS) {
    var modo = modoEfectivo();
    if (!ajustes.iman_activo || (modo === "cabeza" && !ajustes.iman_cabeza) || lupa || menuVisible || tecladoContiene(P.x, P.y) || arrastrando) return;
    if (Math.abs(P.x - imanX) > 6 || Math.abs(P.y - imanY) > 6) { imanX = P.x; imanY = P.y; imanQuietoDesde = tS; imanHecho = false; return; }
    if (imanHecho || tS - imanQuietoDesde < 0.3) return;
    imanHecho = true;
    var e = bajoPuntero();
    if (!e || esClicable(e) || (e.closest && e.closest(".wcl-root"))) return;
    var r = ajustes.iman_radio_px, mejor = null, lista = document.querySelectorAll(SEL_CLICABLE);
    for (var i = 0; i < lista.length; i++) {
      var c = lista[i]; if (c.closest(".wcl-root")) continue;
      var b = c.getBoundingClientRect();
      if (!b.width || !b.height || b.width > 520 || b.height > 320) continue;
      if (b.right < 0 || b.bottom < 0 || b.left > window.innerWidth || b.top > window.innerHeight) continue;
      var nx = Math.max(b.left + 4, Math.min(b.right - 4, P.x)), ny = Math.max(b.top + 4, Math.min(b.bottom - 4, P.y));
      var d = Math.hypot(nx - P.x, ny - P.y);
      if (d <= r && (!mejor || d < mejor.d)) mejor = { d: d, x: nx, y: ny, el: c };
    }
    if (!mejor) return;
    var real = document.elementFromPoint(mejor.x, mejor.y);
    if (!real || !(mejor.el === real || mejor.el.contains(real) || real.contains(mejor.el))) return;   // hay algo encima
    congelar(0.3); mover(mejor.x, mejor.y); fijador.fijarEn(mejor.x, mejor.y); fijacion = [mejor.x, mejor.y];
    if (ultimoSaltoPunto) ultimoSaltoPunto = [mejor.x, mejor.y];
    imanX = P.x; imanY = P.y;
    if (imanEl) imanEl.classList.remove("wcl-iman");
    imanEl = mejor.el; imanEl.classList.add("wcl-iman"); setTimeout(function () { if (imanEl) imanEl.classList.remove("wcl-iman"); }, 900);
    avisar(nombreDe(mejor.el));
  }
  function nombreDe(e) {
    var t = e.getAttribute("aria-label") || e.getAttribute("title") || e.value || e.placeholder || e.innerText || e.alt || e.tagName.toLowerCase();
    t = String(t).replace(/\s+/g, " ").trim(); return t.length > 28 ? t.slice(0, 27) + "…" : t;
  }

  // --------------------------------------------------------------- clics --
  // controllers/clics.py + keybinder.py: parpadeo, boca, cejas, quieto, gestos extra, menú, arrastre, lupa
  var arrastrando = false, arrastreEl = null, ultimoClic = 0, lupa = null, lupaDesde = 0;
  var qAncla = null, qDesde = 0, qYaClic = false, qArmado = false, qProgreso = 0;
  var gestoEstado = {};
  var ACCIONES = [["nada", "Nada"], ["clic", "Clic"], ["derecho", "Clic derecho"], ["doble", "Doble clic"], ["rueda_abajo", "Bajar"], ["rueda_arriba", "Subir"],
                  ["menu", "Menú de clics"], ["pausa", "Pausar / seguir"], ["teclado", "Teclado"], ["recentrar", "Recentrar"], ["leer", "Leer en voz alta"]];
  var GESTOS = [["jawOpen", "Abrir la boca"], ["browInnerUp", "Subir las cejas"], ["mouthRight", "Boca a la derecha"], ["mouthLeft", "Boca a la izquierda"],
                ["mouthPucker", "Fruncir los labios"], ["mouthSmile", "Sonreír"], ["mouthRollLower", "Meter el labio de abajo"]];
  function valorGesto(nombre) { return nombre === "mouthSmile" ? (forma("mouthSmileLeft") + forma("mouthSmileRight")) / 2 : forma(nombre); }

  function tickClics(tS) {
    if (!det.cara) return;
    var evento = parpadeo.tomarEvento();
    if (pausado) { if (evento === "largo") reanudar(); return; }
    // El gesto vale donde estaba el puntero al empezar a cerrar los ojos (si no se fue lejos: entonces es que se estaba moviendo a propósito)
    if (evento && anclaParpadeo && !menuVisible && !arrastrando && Math.hypot(P.x - anclaParpadeo[0], P.y - anclaParpadeo[1]) < 80) { congelar(0.4); mover(anclaParpadeo[0], anclaParpadeo[1]); }
    if (evento === "largo") {
      cerrarLupa(); reiniciarQuieto();
      if (sobrePausar()) { pausar(); return; }
      if (menuVisible) cerrarMenu(); else abrirMenu();
      return;
    }
    if (lupa && tS - lupaDesde > ajustes.lupa_tiempo_max_s) cerrarLupa();
    tickGestos(tS);
    if (ajustes.modo_clic === "parpadeo") { if (evento === "clic") clic(); }
    else if (ajustes.modo_clic === "quieto") tickQuieto(tS);
  }
  function tickGestos(tS) {
    var umbral = ajustes.gestos_umbral / 100;
    for (var i = 0; i < GESTOS.length; i++) {
      var g = GESTOS[i][0], accion = ajustes.gestos[g] || "nada";
      if (ajustes.modo_clic === "boca" && g === "jawOpen") accion = "clic";
      if (ajustes.modo_clic === "cejas" && g === "browInnerUp") accion = "clic";
      if (accion === "nada") continue;
      var v = valorGesto(g), s = gestoEstado[g] || (gestoEstado[g] = { activo: false, desde: 0, sujeto: false });
      if (!s.activo && v > umbral) {
        s.activo = true; s.desde = tS; s.sujeto = false;
        if (accion === "clic") clic();
        else if (accion !== "rueda_abajo" && accion !== "rueda_arriba") accionGesto(accion);
      } else if (s.activo && v < umbral - 0.1) {
        s.activo = false;
        if (s.sujeto) { s.sujeto = false; soltarArrastre(); }
      } else if (s.activo) {
        if (accion === "clic" && !s.sujeto && !arrastrando && (tS - s.desde) * 1000 >= ajustes.hold_ms) { s.sujeto = true; empezarArrastre(); }
        if ((accion === "rueda_abajo" || accion === "rueda_arriba") && tS - s.desde > 0.15) rueda(accion === "rueda_abajo" ? 6 : -6, false);
      }
    }
  }
  function accionGesto(accion) {
    if (accion === "derecho") clicDerecho();
    else if (accion === "doble") dobleClic();
    else if (accion === "menu") { if (menuVisible) cerrarMenu(); else abrirMenu(); }
    else if (accion === "pausa") pausar();
    else if (accion === "teclado") alternarTeclado();
    else if (accion === "recentrar") recentrar();
    else if (accion === "leer") leerElemento(bajoPuntero());
  }
  function clic() {
    if (sobrePausar()) { avisar("Cierra los ojos 1,2 s para pausar", true); return; }
    if (menuVisible) { elegirOpcion(opcionEn(P.x, P.y)); return; }
    if (arrastrando) { soltarArrastre(); return; }
    if (tecladoContiene(P.x, P.y)) { pulsarTeclaEn(P.x, P.y); return; }
    if (lupaCorresponde()) {
      if (!lupa) { abrirLupa(); return; }
      var rasgosLupa = lupa.rasgos; cerrarLupa(); congelar(0.35);
      pulsar(); anotarClic(P.x, P.y, "lupa", rasgosLupa, ajustes.modo_clic === "parpadeo");
      return;
    }
    pulsar(); anotarClicPuntero(ajustes.modo_clic === "parpadeo");
  }
  function despachar(e, tipos, extra) {
    var base = { bubbles: true, cancelable: true, clientX: P.x, clientY: P.y, screenX: P.x, screenY: P.y, view: window, button: 0, buttons: 1 };
    if (extra) for (var k in extra) base[k] = extra[k];
    tipos.forEach(function (t) {
      try { e.dispatchEvent(/^pointer/.test(t) ? new PointerEvent(t, base) : new MouseEvent(t, base)); } catch (x) {}
    });
  }
  function pulsar() {
    ultimoClic = performance.now();
    cursor.classList.add("clic"); setTimeout(function () { cursor.classList.remove("clic"); }, 220);
    var e = document.elementFromPoint(P.x, P.y); if (!e) return;
    if (e.closest(".wcl-root")) {   // controles del propio widget
      if (e.closest(".wcl-limpia-texto")) { leerElemento(e); avisar("Leyendo"); return; }
      var b = e.closest("button,a,textarea");
      if (b && b.tagName === "TEXTAREA") { try { b.focus({ preventScroll: true }); } catch (x) {} objetivoTexto = b; avisar("Escribir aquí"); }
      else if (b) { try { b.click(); } catch (x) {} avisar("Clic"); }
      return;
    }
    var inter = e.closest(SEL_CLICABLE), el2 = inter || e;
    if (el2.focus) try { el2.focus({ preventScroll: true }); } catch (x) {}
    if (ajustes.lectura && !inter) { leerElemento(e); avisar("Leyendo"); return; }
    if (el2.tagName === "SELECT") {   // el menú nativo no se puede abrir: se pasa a la opción siguiente
      el2.selectedIndex = (el2.selectedIndex + 1) % el2.options.length;
      el2.dispatchEvent(new Event("input", { bubbles: true })); el2.dispatchEvent(new Event("change", { bubbles: true }));
      avisar(el2.options[el2.selectedIndex].text); return;
    }
    despachar(el2, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
    avisar("Clic");
  }
  function clicDerecho() {
    var e = bajoPuntero(); if (!e) return;
    despachar(e, ["pointerdown", "mousedown", "pointerup", "mouseup", "contextmenu"], { button: 2, buttons: 2 });
    avisar("Clic derecho");
  }
  function dobleClic() {
    var e = bajoPuntero(); if (!e) return;
    var inter = e.closest(SEL_CLICABLE) || e;
    despachar(inter, ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick"], { detail: 2 });
    avisar("Doble clic");
  }
  function empezarArrastre() {
    var e = bajoPuntero(); if (!e) return;
    arrastreEl = e; arrastrando = true; cursor.classList.add("arrastre");
    despachar(e, ["pointerdown", "mousedown"]);
    avisar("Arrastrando: clic para soltar", true);
  }
  function soltarArrastre() {
    if (!arrastrando) return;
    arrastrando = false; cursor.classList.remove("arrastre");
    var e = bajoPuntero() || arrastreEl;
    if (e) despachar(e, ["pointerup", "mouseup"], { buttons: 0 });
    if (arrastreEl && arrastreEl !== e) despachar(arrastreEl, ["pointerup", "mouseup"], { buttons: 0 });
    arrastreEl = null; avisar("Soltado");
  }
  function desplazable(e) {
    while (e && e !== document.body && e !== raiz) {
      var cs = getComputedStyle(e);
      if (e.scrollHeight > e.clientHeight + 2 && /(auto|scroll)/.test(cs.overflowY)) return e;
      e = e.parentElement;
    }
    return null;
  }
  function rueda(cantidad, suave, x, y) {
    var e = bajoPuntero(x, y), d = desplazable(e);
    var op = { top: cantidad, behavior: suave ? "smooth" : "auto" };
    if (d) d.scrollBy(op); else window.scrollBy(op);
  }

  // clic por permanencia
  function reiniciarQuieto() { qAncla = null; qYaClic = false; qArmado = false; qProgreso = 0; pintarAnillo(); }
  function tickQuieto(tS) {
    var radio = ajustes.quieto_radio_px, espera = ajustes.quieto_ms / 1000;
    if (!qAncla) { qAncla = [P.x, P.y]; qDesde = tS; qYaClic = true; qProgreso = 0; return; }
    if (Math.hypot(P.x - qAncla[0], P.y - qAncla[1]) > radio) { qAncla = [P.x, P.y]; qDesde = tS; qYaClic = false; qArmado = true; qProgreso = 0; pintarAnillo(); return; }
    if (qYaClic || !qArmado) { qProgreso = 0; pintarAnillo(); return; }
    qProgreso = Math.min(1, (tS - qDesde) / espera); pintarAnillo();
    if (qProgreso >= 1) { qYaClic = true; clic(); }
  }
  function pintarAnillo() {
    var a = cursor.querySelector(".wcl-anillo");
    var ver = ajustes.modo_clic === "quieto" && ajustes.quieto_anillo && qAncla && !qYaClic && qArmado && qProgreso > 0.05;
    a.style.display = ver ? "block" : "none";
    if (ver) a.querySelector(".prog").setAttribute("stroke-dashoffset", String(125.7 * (1 - qProgreso)));
  }

  // ---------------------------------------------------------------- lupa --
  // gui/lupa.py: en modo directo el primer gesto agranda la página alrededor del puntero y el segundo pulsa
  function lupaCorresponde() { return modoEfectivo() === "directo" && ajustes.lupa_activa && !ajustes.lupa_pantalla && !tecladoContiene(P.x, P.y) && !menuVisible; }
  function abrirLupa() {
    var b = document.body, r = b.getBoundingClientRect(), trfPrevio = b.style.transform, orgPrevio = b.style.transformOrigin;
    b.style.transformOrigin = (P.x - r.left) + "px " + (P.y - r.top) + "px";
    raiz.classList.add("wcl-lupa");
    b.style.transform = "scale(" + ajustes.lupa_zoom + ")";
    lupa = { rasgos: det.rasgos ? det.rasgos.slice() : null, trf: trfPrevio, org: orgPrevio }; lupaDesde = performance.now() / 1000;
    reiniciarQuieto(); qAncla = [P.x, P.y]; qDesde = lupaDesde; qArmado = true; qYaClic = false;
    avisar("Lupa: mira y vuelve a hacer el gesto");
  }
  function cerrarLupa() {
    if (!lupa) return;
    var l = lupa; lupa = null; document.body.style.transform = l.trf || ""; document.body.style.transformOrigin = l.org || "";
    setTimeout(function () { raiz.classList.remove("wcl-lupa"); }, 300);
  }

  // --------------------------------------------------------------- pausa --
  function sobrePausar() {
    if (btnPausa.style.display === "none") return false;
    var b = btnPausa.getBoundingClientRect();
    return P.x >= b.left && P.x <= b.right && P.y >= b.top && P.y <= b.bottom;
  }
  function pintarPausa() {
    btnPausa.textContent = pausado ? (window.innerWidth < 600 ? "En pausa · ojos 1,2 s" : "En pausa · ojos cerrados 1,2 s para seguir") : "Pausar";
    btnPausa.classList.toggle("en-pausa", pausado);
    btnPausa.setAttribute("aria-label", pausado ? "Reanudar el puntero" : "Pausar el puntero");
  }
  function pausar() {
    if (pausado) { reanudar(); return; }
    pausado = true; cerrarMenu(); cerrarLupa(); soltarArrastre(); reiniciarQuieto();
    pintarPausa(); avisar("En pausa", true); decir("Puntero en pausa. Cierra los ojos 1,2 segundos para seguir.");
  }
  function reanudar() { pausado = false; reiniciarPuntero(); reiniciarQuieto(); pintarPausa(); avisar("Activado"); decir("Puntero activo."); }
  btnPausa.addEventListener("click", function (e) { if (e.isTrusted) pausar(); });

  // ------------------------------------------------------- menú de clics --
  // gui/menu_clics.py: anillo de 8 sectores alrededor del puntero
  var RE = 170, RI = 58, RE_MAX = 170, menuVisible = false, menuCentro = [0, 0], menuAncla = null, menuDesde = 0, menuSectores = [], menuHover = null;
  function opcionesMenu() {
    var puedeRecentrar = modoEfectivo() === "directo" || modoEfectivo() === "hibrido";
    return [["derecho", "Clic derecho"], ["doble", "Doble clic"], arrastrando ? ["soltar", "Soltar"] : ["arrastrar", "Arrastrar"], ["teclado", "Teclado"],
            ["leer", "Leer aquí"], ["rueda_abajo", "Rueda abajo"], puedeRecentrar ? ["recentrar", "Recentrar"] : ["pausar", "Pausar"], ["rueda_arriba", "Rueda arriba"]];
  }
  function polar(r, gradosTk) { var a = gradosTk * Math.PI / 180; return [RE + 6 + r * Math.cos(a), RE + 6 - r * Math.sin(a)]; }
  function mostrarMenu(x, y) {
    // En pantallas estrechas el anillo se encoge para caber entero
    RE = Math.max(110, Math.min(RE_MAX, Math.floor(Math.min(window.innerWidth, window.innerHeight) / 2) - 10));
    RI = RE >= 150 ? 58 : 46;
    var lado = 2 * (RE + 6), m = lado / 2;
    var cx = Math.min(Math.max(x, m), window.innerWidth - m), cy = Math.min(Math.max(y, m), window.innerHeight - m);
    menuCentro = [cx, cy]; menuSectores = opcionesMenu();
    var n = menuSectores.length, paso = 360 / n, s = '<svg width="' + lado + '" height="' + lado + '" viewBox="0 0 ' + lado + ' ' + lado + '">';
    for (var i = 0; i < n; i++) {
      var a1 = 90 - (i + 0.5) * paso, a2 = a1 + paso;
      var p1 = polar(RE, a1), p2 = polar(RE, a2), p3 = polar(RI, a2), p4 = polar(RI, a1), pt = polar((RE + RI) / 2 + 6, a1 + paso / 2);
      s += '<g data-i="' + i + '"><path d="M' + p1[0] + ' ' + p1[1] + ' A' + RE + ' ' + RE + ' 0 0 0 ' + p2[0] + ' ' + p2[1] + ' L' + p3[0] + ' ' + p3[1] + ' A' + RI + ' ' + RI + ' 0 0 1 ' + p4[0] + ' ' + p4[1] + ' Z"/>';
      var palabras = menuSectores[i][1].split(" ");
      s += '<text x="' + pt[0] + '" y="' + (pt[1] - (palabras.length - 1) * 8) + '">' + palabras.map(function (w, k) { return '<tspan x="' + pt[0] + '" dy="' + (k ? 16 : 0) + '">' + w + '</tspan>'; }).join("") + '</text></g>';
    }
    s += '<g class="centro" data-i="c"><circle cx="' + m + '" cy="' + m + '" r="' + RI + '"/><text x="' + m + '" y="' + m + '">Cerrar</text></g></svg>';
    menuEl.innerHTML = s; menuEl.style.left = (cx - m) + "px"; menuEl.style.top = (cy - m) + "px"; menuEl.style.display = "block";
    menuVisible = true; menuHover = null; menuDesde = performance.now() / 1000;
  }
  function opcionEn(x, y) {
    var d = Math.hypot(x - menuCentro[0], y - menuCentro[1]);
    if (d > RE) return null;
    if (d < RI) return "cerrar";
    var ang = (Math.atan2(-(y - menuCentro[1]), x - menuCentro[0]) * 180 / Math.PI + 360) % 360, paso = 360 / menuSectores.length;
    var k = Math.floor(((90 + paso / 2 - ang + 360) % 360) / paso);
    return menuSectores[Math.min(k, menuSectores.length - 1)][0];
  }
  function tickMenu(tS) {
    if (!menuVisible) return;
    var clave = opcionEn(P.x, P.y), idx = clave === null ? null : (clave === "cerrar" ? "c" : String(menuSectores.findIndex(function (o) { return o[0] === clave; })));
    if (idx !== menuHover) {
      menuHover = idx; menuDesde = tS;
      var gs = menuEl.querySelectorAll("g");
      for (var i = 0; i < gs.length; i++) gs[i].firstChild.classList.toggle("hov", gs[i].getAttribute("data-i") === idx);
    }
    if (tS - menuDesde > 10) { cerrarMenu(); avisar("Menú cerrado"); }
  }
  function abrirMenu() { menuAncla = [P.x, P.y]; mostrarMenu(P.x, P.y); reiniciarQuieto(); }
  function cerrarMenu() { if (!menuVisible) return; menuVisible = false; menuEl.style.display = "none"; reiniciarQuieto(); }
  function irAlAncla() { if (menuAncla) { congelar(0.4); mover(menuAncla[0], menuAncla[1]); } }
  function elegirOpcion(clave) {
    if (clave === "rueda_arriba" || clave === "rueda_abajo") {
      menuEl.style.display = "none"; rueda(clave === "rueda_abajo" ? 300 : -300, true, menuAncla[0], menuAncla[1]);
      avisar(clave === "rueda_abajo" ? "Rueda abajo" : "Rueda arriba"); mostrarMenu(menuAncla[0], menuAncla[1]); reiniciarQuieto(); return;
    }
    cerrarMenu();
    if (clave === "derecho") { irAlAncla(); clicDerecho(); }
    else if (clave === "doble") { irAlAncla(); dobleClic(); }
    else if (clave === "arrastrar") { irAlAncla(); empezarArrastre(); }
    else if (clave === "soltar") { irAlAncla(); soltarArrastre(); }
    else if (clave === "teclado") alternarTeclado();
    else if (clave === "leer") { irAlAncla(); leerElemento(bajoPuntero(menuAncla[0], menuAncla[1])); }
    else if (clave === "recentrar") recentrar();
    else if (clave === "pausar") pausar();
  }

  // ======================================================== escribir ==
  // gui/teclado_pantalla.py + prediccion.py + frases.py + voz: teclado en pantalla
  // con sugerencias, capa de frases, «Decir», dictado y órdenes por voz.
  var FRASES_DEFECTO = ["Sí", "No", "Gracias", "Necesito ayuda", "Tengo sed", "Tengo hambre", "Tengo dolor", "Quiero ir al baño",
                        "Tengo frío", "Tengo calor", "Estoy cansado", "Quiero descansar", "Llama a mi familia", "Espera un momento", "No entiendo", "Hasta luego"];
  var frases = leerJSON("winclus.frases", null) || FRASES_DEFECTO.slice();
  var aprendidas = leerJSON("winclus.palabras", {});
  var diccionario = null, cargandoDic = false;   // [[claveSinAcento, palabra, peso]] ordenado por clave
  var EXCLUIDAS_TEC = /^(puta|puto|mierda|joder|coño|cabr[oó]n|gilipollas|polla|cojones|carajo|pendej[oa]|zorra|maric[oó]n|verga|pinche|culo|follar|hostia|imb[eé]cil|idiota|est[uú]pid[oa]|bastardo|perra|capullo|tetas)s?$/i;

  function sinAcentos(t) { return t.toLowerCase().replace(/ñ/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(//g, "ñ"); }
  function cargarDiccionario() {
    if (diccionario || cargandoDic) return;
    cargandoDic = true;
    fetch(ORIGEN + "/palabras-es.txt").then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }).then(function (txt) {
      var lista = txt.split(/\r?\n/).filter(Boolean), n = lista.length;
      diccionario = lista.map(function (w, i) { return [sinAcentos(w), w, n - i]; });
      for (var p in aprendidas) diccionario.push([sinAcentos(p), p, 20000 * aprendidas[p]]);
      diccionario.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
      cargandoDic = false; refrescarSugerencias();
    });
  }
  function sugerir(prefijo, n) {
    if (!prefijo || !diccionario) return [];
    var clave = sinAcentos(prefijo), lo = 0, hi = diccionario.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (diccionario[m][0] < clave) lo = m + 1; else hi = m; }
    var cand = [], limite = 4000;
    for (var i = lo; i < diccionario.length && diccionario[i][0].indexOf(clave) === 0 && limite-- > 0; i++) cand.push(diccionario[i]);
    cand.sort(function (a, b) { return b[2] - a[2]; });
    var salida = [];
    for (i = 0; i < cand.length && salida.length < n; i++) {
      var w = cand[i][1];
      if (EXCLUIDAS_TEC.test(w)) continue;
      if (prefijo.length > 1 && prefijo === prefijo.toUpperCase()) w = w.toUpperCase();
      else if (prefijo[0] === prefijo[0].toUpperCase() && prefijo[0] !== prefijo[0].toLowerCase()) w = w[0].toUpperCase() + w.slice(1);
      if (w.toLowerCase() === prefijo.toLowerCase() && cand.length > 1) continue;
      if (salida.indexOf(w) < 0) salida.push(w);
    }
    return salida;
  }
  function aprender(palabra) {
    palabra = palabra.trim(); if (palabra.length < 3 || !/^[a-záéíóúüñ]+$/i.test(palabra)) return;
    palabra = palabra === palabra.toUpperCase() ? palabra : palabra.toLowerCase();
    aprendidas[palabra] = (aprendidas[palabra] || 0) + 1; escribirJSON("winclus.palabras", aprendidas);
    if (diccionario) {
      var clave = sinAcentos(palabra), i;
      for (i = 0; i < diccionario.length; i++) if (diccionario[i][1] === palabra) { diccionario[i][2] += 20000; return; }
      diccionario.push([clave, palabra, 20000]); diccionario.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    }
  }

  // Capas. Cada tecla: cadena (escribe ese texto) o [etiqueta, tipo, valor, ancho]
  var K_BORRAR = ["Borrar", "tecla", "backspace", 1.6], K_INTRO = ["Intro", "tecla", "enter", 1.6], K_IZQ = ["←", "tecla", "left", 1], K_DER = ["→", "tecla", "right", 1];
  var K_MAS = ["Más", "capa", "mas", 1.2], K_CERRAR = ["Ocultar", "cerrar", null, 1.5], K_ESPACIO = ["Espacio", "texto", " ", 5];
  var K_ABC = ["abc", "capa", "abc", 1.5], K_NUM = ["123", "capa", "123", 1.5], K_ACENTOS = ["áé", "capa", "acentos", 1.2];
  var K_DECIR = ["Decir", "decir", null, 1.3], K_FRASES = ["Frases", "capa", "frases", 1.3], K_DICTAR = ["Dictar", "dictar", null, 1.3];
  var FILA_ABAJO = [K_NUM, K_ACENTOS, K_ESPACIO, K_IZQ, K_DER, K_DECIR, K_FRASES, K_DICTAR, K_MAS, K_CERRAR];
  var CAPAS = {
    abc: ["qwertyuiop".split("").concat([K_BORRAR]), "asdfghjklñ".split("").concat([K_INTRO]), [["Mayús", "mayus", null, 1.3]].concat("zxcvbnm,.".split(""), ["?"]), FILA_ABAJO],
    ABC: ["QWERTYUIOP".split("").concat([K_BORRAR]), "ASDFGHJKLÑ".split("").concat([K_INTRO]), [["Mayús", "mayus", null, 1.3]].concat("ZXCVBNM;:".split(""), ["!"]), FILA_ABAJO],
    "123": ["1234567890".split("").concat([K_BORRAR]), "@#€$%&-+()".split("").concat([K_INTRO]), "!¿?¡\"':;/*".split(""), [K_ABC, K_ACENTOS, K_ESPACIO, K_IZQ, K_DER, K_DECIR, K_FRASES, K_DICTAR, K_MAS, K_CERRAR]],
    acentos: ["áéíóúüñ¿¡«".split("").concat([K_BORRAR]), "ÁÉÍÓÚÜÑ»ªº".split("").concat([K_INTRO]), "çÇ~^`´¨·=_".split(""), [K_ABC, K_NUM, K_ESPACIO, K_IZQ, K_DER, K_DECIR, K_FRASES, K_DICTAR, K_MAS, K_CERRAR]],
    mas: [
      [["Esc", "tecla", "escape", 1], ["Tab", "tecla", "tab", 1], ["Supr", "tecla", "delete", 1], ["Inicio", "tecla", "home", 1], ["Fin", "tecla", "end", 1], ["↑", "tecla", "up", 1], ["↓", "tecla", "down", 1], ["Seleccionar todo", "orden", "todo", 1.6], K_BORRAR],
      [["Copiar", "orden", "copiar", 1], ["Pegar", "orden", "pegar", 1], ["Cortar", "orden", "cortar", 1], ["Deshacer", "orden", "deshacer", 1], ["Rehacer", "orden", "rehacer", 1], ["Buscar en la página", "orden", "buscar", 1.6], ["Siguiente campo", "orden", "siguiente", 1.4], K_INTRO],
      [["RePág", "orden", "repag", 1], ["AvPág", "orden", "avpag", 1], ["Arriba del todo", "orden", "arriba", 1.3], ["Abajo del todo", "orden", "abajo", 1.3], ["Atrás", "orden", "atras", 1], ["Adelante", "orden", "adelante", 1], ["Recargar", "orden", "recargar", 1], ["Zoom +", "orden", "zoommas", 1], ["Zoom −", "orden", "zoommenos", 1]],
      [K_ABC, K_NUM, K_ESPACIO, K_IZQ, K_DER, ["Menú de clics", "orden", "menu", 1.4], ["Leer la página", "orden", "leerpagina", 1.4], ["Callar", "callar", null, 1], K_CERRAR]
    ]
  };
  var tecVisible = false, capa = "abc", bloqMayus = false, palabra = "", frase = "", sugerencias = [], teclas = [], tecHover = null, objetivoTexto = null;
  var tecTextoEl = null;

  // Dónde se escribe: el último campo de la página que tuvo el foco
  document.addEventListener("focusin", function (e) { if (esEditable(e.target)) objetivoTexto = e.target; });
  function esEditable(e) {
    if (!e || !e.closest || e.closest(".wcl-tec")) return false;
    if (e.isContentEditable) return true;
    if (e.tagName === "TEXTAREA") return !e.disabled && !e.readOnly;
    if (e.tagName === "INPUT") return !e.disabled && !e.readOnly && !/^(button|submit|reset|checkbox|radio|file|range|color|image|hidden)$/i.test(e.type || "text");
    return false;
  }
  function campo() {
    if (objetivoTexto && document.contains(objetivoTexto) && esEditable(objetivoTexto)) return objetivoTexto;
    var a = document.activeElement; return esEditable(a) ? (objetivoTexto = a) : null;
  }
  function enfocar(c) { try { c.focus({ preventScroll: true }); } catch (e) {} }
  function fijarValor(c, valor, pos) {   // compatible con React y compañía
    var proto = c.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var d = Object.getOwnPropertyDescriptor(proto, "value");
    if (d && d.set) d.set.call(c, valor); else c.value = valor;
    try { c.setSelectionRange(pos, pos); } catch (e) {}
    c.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function insertarTexto(texto) {
    var c = campo();
    if (!c) { avisar("Pulsa primero en un campo de texto", true); return false; }
    enfocar(c);
    if (c.isContentEditable) { if (!document.execCommand("insertText", false, texto)) c.textContent += texto; return true; }
    var v = c.value, s = c.selectionStart == null ? v.length : c.selectionStart, f = c.selectionEnd == null ? v.length : c.selectionEnd;
    fijarValor(c, v.slice(0, s) + texto + v.slice(f), s + texto.length);
    return true;
  }
  function borrarAtras() {
    var c = campo(); if (!c) return;
    enfocar(c);
    if (c.isContentEditable) { document.execCommand("delete"); return; }
    var v = c.value, s = c.selectionStart == null ? v.length : c.selectionStart, f = c.selectionEnd == null ? v.length : c.selectionEnd;
    if (s === f && s > 0) s--;
    fijarValor(c, v.slice(0, s) + v.slice(f), s);
  }
  function teclaEspecial(nombre) {
    var c = campo();
    if (nombre === "enter") {
      if (c && c.tagName === "TEXTAREA") { insertarTexto("\n"); return; }
      if (c && c.isContentEditable) { document.execCommand("insertParagraph"); return; }
      var obj = c || document.activeElement || document.body;
      var ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      var seguir = obj.dispatchEvent(ev);
      obj.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      if (seguir && c && c.form) { if (c.form.requestSubmit) c.form.requestSubmit(); else c.form.submit(); }
      return;
    }
    if (nombre === "backspace") { borrarAtras(); return; }
    if (nombre === "tab") { siguienteCampo(1); return; }
    if (nombre === "escape") { ocultarTeclado(); return; }
    if (!c) { if (nombre === "up") rueda(-120, true); if (nombre === "down") rueda(120, true); if (nombre === "home") window.scrollTo({ top: 0, behavior: "smooth" }); if (nombre === "end") window.scrollTo({ top: raiz.scrollHeight, behavior: "smooth" }); return; }
    enfocar(c);
    if (c.isContentEditable) {
      var sel = window.getSelection();
      if (nombre === "left") sel.modify("move", "backward", "character"); else if (nombre === "right") sel.modify("move", "forward", "character");
      else if (nombre === "up") sel.modify("move", "backward", "line"); else if (nombre === "down") sel.modify("move", "forward", "line");
      else if (nombre === "home") sel.modify("move", "backward", "lineboundary"); else if (nombre === "end") sel.modify("move", "forward", "lineboundary");
      else if (nombre === "delete") document.execCommand("forwardDelete");
      return;
    }
    var v = c.value, s = c.selectionStart == null ? v.length : c.selectionStart, f = c.selectionEnd == null ? v.length : c.selectionEnd;
    if (nombre === "left") s = Math.max(0, s - 1); else if (nombre === "right") s = Math.min(v.length, f + 1);
    else if (nombre === "home") s = v.lastIndexOf("\n", s - 1) + 1; else if (nombre === "end") { var e2 = v.indexOf("\n", f); s = e2 < 0 ? v.length : e2; }
    else if (nombre === "up" || nombre === "down") { var lineas = v.slice(0, s).split("\n"), col = lineas[lineas.length - 1].length, todas = v.split("\n"), li = lineas.length - 1 + (nombre === "up" ? -1 : 1); if (li < 0 || li >= todas.length) return; s = 0; for (var i = 0; i < li; i++) s += todas[i].length + 1; s += Math.min(col, todas[li].length); }
    else if (nombre === "delete") { if (s === f && f < v.length) f++; fijarValor(c, v.slice(0, s) + v.slice(f), s); return; }
    try { c.setSelectionRange(s, s); } catch (e) {}
  }
  function siguienteCampo(dir) {
    var lista = Array.prototype.filter.call(document.querySelectorAll(SEL_CLICABLE), function (e) { return !e.closest(".wcl-root") && e.tabIndex >= 0 && e.getBoundingClientRect().width > 0; });
    var i = lista.indexOf(document.activeElement), sig = lista[(i + dir + lista.length) % lista.length];
    if (sig) { enfocar(sig); sig.scrollIntoView({ block: "center", behavior: "smooth" }); if (esEditable(sig)) objetivoTexto = sig; avisar(nombreDe(sig)); }
  }
  function orden(nombre) {
    var c = campo();
    if (nombre === "copiar" || nombre === "cortar") {
      var sel = c && !c.isContentEditable ? c.value.slice(c.selectionStart, c.selectionEnd) : String(window.getSelection());
      if (!sel && c && !c.isContentEditable) sel = c.value;
      if (sel && navigator.clipboard) navigator.clipboard.writeText(sel).then(function () { avisar(nombre === "copiar" ? "Copiado" : "Cortado"); }, function () { avisar("No se pudo copiar", true); });
      if (nombre === "cortar" && c) { enfocar(c); if (c.isContentEditable) document.execCommand("delete"); else if (c.selectionStart !== c.selectionEnd) fijarValor(c, c.value.slice(0, c.selectionStart) + c.value.slice(c.selectionEnd), c.selectionStart); else fijarValor(c, "", 0); }
    } else if (nombre === "pegar") {
      if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(function (t) { if (t) { insertarTexto(t); avisar("Pegado"); } }, function () { avisar("El navegador no deja leer el portapapeles", true); });
    } else if (nombre === "deshacer" || nombre === "rehacer") { if (c) { enfocar(c); document.execCommand(nombre === "deshacer" ? "undo" : "redo"); } }
    else if (nombre === "todo") { if (c) { enfocar(c); if (c.isContentEditable) document.execCommand("selectAll"); else c.select(); } else document.execCommand("selectAll"); }
    else if (nombre === "buscar") { var b = document.querySelector('input[type=search],input[name*=busc i],input[name*=search i],input[placeholder*=busc i],input[placeholder*=search i]'); if (b) { enfocar(b); objetivoTexto = b; b.scrollIntoView({ block: "center" }); avisar("Buscar"); } else avisar("La página no tiene buscador", true); }
    else if (nombre === "siguiente") siguienteCampo(1);
    else if (nombre === "repag") rueda(-window.innerHeight * 0.8, true); else if (nombre === "avpag") rueda(window.innerHeight * 0.8, true);
    else if (nombre === "arriba") window.scrollTo({ top: 0, behavior: "smooth" }); else if (nombre === "abajo") window.scrollTo({ top: raiz.scrollHeight, behavior: "smooth" });
    else if (nombre === "atras") history.back(); else if (nombre === "adelante") history.forward(); else if (nombre === "recargar") location.reload();
    else if (nombre === "zoommas") { ajustes.texto = Math.min(200, ajustes.texto + 10); aplicarTexto(); guardar(); }
    else if (nombre === "zoommenos") { ajustes.texto = Math.max(80, ajustes.texto - 10); aplicarTexto(); guardar(); }
    else if (nombre === "menu") { ocultarTeclado(); abrirMenu(); }
    else if (nombre === "leerpagina") leerPagina();
  }

  // --- dibujo del teclado ------------------------------------------------
  function pantallaEstrecha() { return window.innerWidth < 600; }
  function filasCapa(c) {
    if (c !== "frases") {
      var filas = CAPAS[c];
      // En pantallas estrechas la fila de abajo se parte en dos para que las teclas con texto quepan
      if (pantallaEstrecha() && filas[filas.length - 1] === FILA_ABAJO) {
        return filas.slice(0, -1).concat([[K_NUM, K_ACENTOS, K_ESPACIO, K_IZQ, K_DER, K_CERRAR], [K_DECIR, K_FRASES, K_DICTAR, K_MAS]]);
      }
      if (pantallaEstrecha() && c !== "mas" && c !== "abc" && c !== "ABC") {
        var ultima = filas[filas.length - 1];
        return filas.slice(0, -1).concat([[ultima[0], ultima[1], K_ESPACIO, K_IZQ, K_DER, K_CERRAR], [K_DECIR, K_FRASES, K_DICTAR, K_MAS]]);
      }
      return filas;
    }
    var filas = [], i;
    for (i = 0; i < frases.length; i += 4) filas.push(frases.slice(i, i + 4).map(function (f) { return [f, "frase", f, 1]; }));
    if (!filas.length) filas.push([["(Añade frases en la pestaña Escribir)", "frase", "", 1]]);
    filas.push([K_ABC, ["Callar", "callar", null, 1.3], K_DECIR, K_CERRAR]);
    return filas;
  }
  var ETIQUETA_CORTA = { backspace: "⌫", enter: "⏎", left: "←", right: "→" };
  function defTecla(d) {
    if (typeof d === "string") return { etiqueta: d, tipo: "texto", valor: d, ancho: 1 };
    var t = { etiqueta: d[0], tipo: d[1], valor: d[2], ancho: d[3] };
    if (pantallaEstrecha()) {   // en el móvil no caben las palabras en las teclas especiales
      if (t.tipo === "tecla" && ETIQUETA_CORTA[t.valor]) t.etiqueta = ETIQUETA_CORTA[t.valor];
      else if (t.tipo === "mayus") t.etiqueta = "⇧";
      else if (t.tipo === "cerrar") t.etiqueta = "✕";
    }
    return t;
  }
  function dibujarTeclado() {
    tecEl.innerHTML = ""; teclas = []; tecHover = null;
    tecEl.classList.toggle("arriba", ajustes.teclado_posicion === "arriba");
    tecEl.style.top = ajustes.teclado_posicion === "arriba" ? "0" : ""; tecEl.style.bottom = ajustes.teclado_posicion === "arriba" ? "" : "0";
    tecEl.style.height = (pantallaEstrecha() ? Math.max(ajustes.teclado_altura, 42) : ajustes.teclado_altura) + "vh";   // en el móvil las teclas necesitan más alto
    tecTextoEl = el("div", { "class": "texto", "aria-live": "polite" }); tecEl.appendChild(tecTextoEl);
    if (ajustes.teclado_prediccion && capa !== "frases") {
      var fs = el("div", { "class": "fila sug" });
      for (var i = 0; i < 5; i++) { var b = el("button", { "type": "button", "class": "pred", "tabindex": "-1" }); b.dataset.i = i; fs.appendChild(b); teclas.push({ tipo: "pred", el: b, indice: i, valor: "" }); }
      tecEl.appendChild(fs);
      cargarDiccionario();
    }
    filasCapa(capa).forEach(function (fila) {
      var f = el("div", { "class": "fila" });
      fila.forEach(function (d) {
        var t = defTecla(d), b = el("button", { "type": "button", "tabindex": "-1" }, t.etiqueta.replace(/</g, "&lt;"));
        b.style.flexGrow = t.ancho; if (t.tipo !== "texto") b.classList.add("esp"); if (t.tipo === "frase") b.classList.add("frase");
        if ((t.tipo === "mayus" && (capa === "ABC" || bloqMayus)) || (t.tipo === "capa" && t.valor === capa)) b.classList.add("activa");
        if (t.tipo === "mayus" && bloqMayus) b.classList.add("fija");
        if (t.tipo === "dictar" && dictando) b.classList.add("fija");
        t.el = b; teclas.push(t); f.appendChild(b);
      });
      tecEl.appendChild(f);
    });
    // Con el ratón de verdad también funciona; mousedown no roba el foco al campo
    tecEl.onmousedown = function (e) { e.preventDefault(); };
    tecEl.onclick = function (e) { if (!e.isTrusted) return; var b = e.target.closest("button"); if (b) { var t = teclaDe(b); if (t) pulsarTecla(t); } };
    refrescarSugerencias(); pintarTexto();
  }
  function teclaDe(b) { for (var i = 0; i < teclas.length; i++) if (teclas[i].el === b) return teclas[i]; return null; }
  function pintarTexto() { if (tecTextoEl) tecTextoEl.textContent = frase ? "Escrito: " + frase.slice(-80) : (campo() ? "Escribiendo en: " + nombreDe(campo()) : "Pulsa en un campo de la página para escribir en él, o escribe y pulsa «Decir»."); }
  function refrescarSugerencias() {
    sugerencias = ajustes.teclado_prediccion ? sugerir(palabra, 5) : [];
    teclas.forEach(function (t) { if (t.tipo === "pred") { t.valor = sugerencias[t.indice] || ""; t.el.textContent = t.valor; } });
  }
  function mostrarTeclado() { tecVisible = true; dibujarTeclado(); tecEl.classList.add("visible"); avisar("Teclado"); }
  function ocultarTeclado() { if (!tecVisible) return; tecVisible = false; tecEl.classList.remove("visible"); pararDictado(); }
  function alternarTeclado() { if (tecVisible) ocultarTeclado(); else mostrarTeclado(); }
  function tecladoContiene(x, y) { if (!tecVisible) return false; var r = tecEl.getBoundingClientRect(); return x >= r.left && x < r.right && y >= r.top && y < r.bottom; }
  function teclaEn(x, y) {
    var e = document.elementFromPoint(x, y), b = e && e.closest && e.closest(".wcl-tec button");
    var t = b ? teclaDe(b) : null; return t && !(t.tipo === "pred" && !t.valor) ? t : null;
  }
  function tickTeclado() {
    if (!tecVisible) return;
    var t = tecladoContiene(P.x, P.y) ? teclaEn(P.x, P.y) : null;
    if (t === tecHover) return;
    if (tecHover) tecHover.el.classList.remove("hover");
    tecHover = t; if (t) t.el.classList.add("hover");
  }
  function pulsarTeclaEn(x, y) { var t = teclaEn(x, y); if (t) pulsarTecla(t); else avisar("Ahí no hay tecla", true); }
  function pulsarTecla(t) {
    if (ajustes.teclado_sonido) pitido(880, 25);
    t.el.classList.add("destello"); setTimeout(function () { t.el.classList.remove("destello"); }, 130);
    var tipo = t.tipo, valor = t.valor;
    if (tipo === "texto") escribir(valor);
    else if (tipo === "pred") completar(valor);
    else if (tipo === "tecla") {
      teclaEspecial(valor);
      if (valor === "backspace") { palabra = palabra.slice(0, -1); frase = frase.slice(0, -1); }
      else { terminarPalabra(valor === "enter"); if (valor === "enter") frase = ""; }
      refrescarSugerencias(); pintarTexto();
    }
    else if (tipo === "orden") { orden(valor); terminarPalabra(false); refrescarSugerencias(); }
    else if (tipo === "mayus") { if (capa === "ABC") { if (bloqMayus) { bloqMayus = false; capa = "abc"; } else bloqMayus = true; } else { capa = "ABC"; bloqMayus = false; } dibujarTeclado(); }
    else if (tipo === "capa") { capa = valor; bloqMayus = false; dibujarTeclado(); }
    else if (tipo === "cerrar") ocultarTeclado();
    else if (tipo === "decir") { if (frase.trim()) { decirVoz(frase, true, true); frase = ""; pintarTexto(); } else decirVoz("No hay nada escrito", true, true); }
    else if (tipo === "frase") { if (valor) decirVoz(valor, true, true); }
    else if (tipo === "callar") callar();
    else if (tipo === "dictar") alternarDictado();
  }
  function escribir(texto) {
    insertarTexto(texto); frase += texto;
    if (/^[a-záéíóúüñ]$/i.test(texto)) palabra += texto; else terminarPalabra(true);
    if (capa === "ABC" && !bloqMayus) { capa = "abc"; dibujarTeclado(); return; }
    refrescarSugerencias(); pintarTexto();
  }
  function completar(p) {
    if (!p) return;
    var resto = p.toLowerCase().indexOf(palabra.toLowerCase()) === 0 ? p.slice(palabra.length) : p;
    insertarTexto(resto + " "); aprender(p); frase += resto + " ";
    if (ajustes.voz_eco) decirVoz(p, false);
    palabra = ""; refrescarSugerencias(); pintarTexto();
    if (capa === "ABC" && !bloqMayus) { capa = "abc"; dibujarTeclado(); }
  }
  function terminarPalabra(aprende) {
    if (aprende && palabra) aprender(palabra);
    if (palabra && ajustes.voz_eco) decirVoz(palabra, false);
    palabra = "";
  }

  // --- dictado y órdenes por voz (Web Speech API) ---------------------------
  var Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition, dictando = false, rec = null, escuchando = false, recOrdenes = null;
  function alternarDictado() { if (dictando) pararDictado(); else empezarDictado(); }
  function empezarDictado() {
    if (!Reconocedor) { avisar("Este navegador no dicta (usa Chrome o Edge)", true); return; }
    try {
      rec = new Reconocedor(); rec.lang = "es-ES"; rec.continuous = true; rec.interimResults = false;
      rec.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { var t = e.results[i][0].transcript.trim(); if (t) { insertarTexto((frase && !/\s$/.test(frase) ? " " : "") + t); frase += t + " "; pintarTexto(); } } };
      rec.onend = function () { if (dictando) { try { rec.start(); } catch (x) {} } };
      rec.onerror = function (e) { if (e.error === "not-allowed") { avisar("Sin permiso para el micrófono", true); pararDictado(); } };
      rec.start(); dictando = true; avisar("Dictando… habla"); if (tecVisible) dibujarTeclado();
    } catch (e) { avisar("No se pudo empezar el dictado", true); }
  }
  function pararDictado() { if (!dictando) return; dictando = false; try { rec.stop(); } catch (e) {} if (tecVisible) dibujarTeclado(); avisar("Dictado parado"); }

  // Órdenes habladas: «baja», «sube», «clic», «pulsa contacto», «escribe hola», «lee», «teclado», «menú», «pausa»…
  function empezarEscucha() {
    if (!Reconocedor) { decir("Este navegador no reconoce la voz (usa Chrome o Edge)."); return; }
    if (escuchando) return;
    recOrdenes = new Reconocedor(); recOrdenes.lang = "es-ES"; recOrdenes.continuous = true; recOrdenes.interimResults = false;
    recOrdenes.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) ejecutarOrden(e.results[i][0].transcript); };
    recOrdenes.onend = function () { if (escuchando) { try { recOrdenes.start(); } catch (x) {} } };
    recOrdenes.onerror = function (e) { if (e.error === "not-allowed") { decir("Sin permiso para el micrófono."); pararEscucha(); } };
    try { recOrdenes.start(); escuchando = true; avisar("Escuchando órdenes"); } catch (e) {}
    refrescos.forEach(function (f) { f(); });
  }
  function pararEscucha() { if (!escuchando) return; escuchando = false; try { recOrdenes.stop(); } catch (e) {} refrescos.forEach(function (f) { f(); }); }
  function ejecutarOrden(texto) {
    var t = sinAcentos(texto.trim()), m;
    var ok = function (msg) { avisar(msg); decir("Orden: " + texto); };
    if (/^(baja|abajo|bajar)( un poco| mas)?$/.test(t)) { rueda(300, true); ok("Bajar"); }
    else if (/^(sube|arriba|subir)( un poco| mas)?$/.test(t)) { rueda(-300, true); ok("Subir"); }
    else if (/^(arriba|inicio) del todo$|^al principio$/.test(t)) { window.scrollTo({ top: 0, behavior: "smooth" }); ok("Arriba del todo"); }
    else if (/^(abajo|fin) del todo$|^al final$/.test(t)) { window.scrollTo({ top: raiz.scrollHeight, behavior: "smooth" }); ok("Abajo del todo"); }
    else if (/^(clic|click|pulsa|pulsar|dale)$/.test(t)) { pulsar(); }
    else if (/^(clic|click) derecho$/.test(t)) { clicDerecho(); }
    else if (/^doble (clic|click)$/.test(t)) { dobleClic(); }
    else if ((m = /^(pulsa|pulsar|abre|abrir|ve a|ir a|entra en) (.+)$/.exec(t))) { pulsarPorTexto(m[2]) ? ok("Pulsar «" + m[2] + "»") : avisar("No encuentro «" + m[2] + "»", true); }
    else if ((m = /^(escribe|escribir|pon) (.+)$/.exec(t))) { insertarTexto(texto.trim().replace(/^\S+\s+/, "")); ok("Escribir"); }
    else if (/^(borra|borrar) (todo|el campo)$/.test(t)) { var c = campo(); if (c) { fijarValor(c, "", 0); ok("Borrado"); } }
    else if (/^(borra|borrar)( una letra)?$/.test(t)) { borrarAtras(); ok("Borrar"); }
    else if (/^(borra|borrar) (la )?palabra$/.test(t)) { var c2 = campo(); if (c2 && !c2.isContentEditable) { var v = c2.value.replace(/\s*\S+\s*$/, ""); fijarValor(c2, v, v.length); ok("Palabra borrada"); } }
    else if (/^(intro|enter|enviar|aceptar)$/.test(t)) { teclaEspecial("enter"); ok("Intro"); }
    else if (/^siguiente( campo)?$/.test(t)) { siguienteCampo(1); } else if (/^anterior( campo)?$/.test(t)) { siguienteCampo(-1); }
    else if (/^(lee|leer|lee esto|lee aqui)$/.test(t)) { leerElemento(bajoPuntero()); ok("Leer"); }
    else if (/^(lee|leer) la pagina$/.test(t)) { leerPagina(); ok("Leer la página"); }
    else if (/^(para|calla|callate|silencio|stop)$/.test(t)) { callar(); avisar("Callar"); }
    else if (/^(teclado|abre el teclado|cierra el teclado)$/.test(t)) { alternarTeclado(); }
    else if (/^(menu|menu de clics)$/.test(t)) { if (menuVisible) cerrarMenu(); else abrirMenu(); }
    else if (/^(pausa|pausar|para el puntero)$/.test(t)) { if (!pausado) pausar(); }
    else if (/^(sigue|seguir|continua|reanudar|activar)$/.test(t)) { if (pausado) reanudar(); }
    else if (/^(atras|volver|vuelve)$/.test(t)) { history.back(); } else if (/^(adelante)$/.test(t)) { history.forward(); }
    else if (/^(mas grande|texto mas grande|agranda)$/.test(t)) { orden("zoommas"); ok("Texto más grande"); }
    else if (/^(mas pequeno|texto mas pequeno|reduce)$/.test(t)) { orden("zoommenos"); ok("Texto más pequeño"); }
    else if (/^(centro|centrar|recentrar)$/.test(t)) { recentrar(); }
    else if (/^(ayuda|que puedo decir)$/.test(t)) { decirVoz("Puedes decir: baja, sube, clic, pulsa y el nombre de un enlace, escribe y el texto, borra, intro, lee, lee la página, calla, teclado, menú, pausa, sigue, atrás, más grande.", true, true); }
    else if ((m = /^(di|dice|decir) (.+)$/.exec(t))) { decirVoz(texto.trim().replace(/^\S+\s+/, ""), true, true); }
    else avisar("No entendí: " + texto, true);
  }
  function pulsarPorTexto(buscado) {
    buscado = sinAcentos(buscado); var lista = document.querySelectorAll(SEL_CLICABLE), mejor = null, mejorPunt = 0;
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i]; if (e.closest(".wcl-root") || !e.getBoundingClientRect().width) continue;
      var n = sinAcentos(nombreDe(e)), p = n === buscado ? 3 : n.indexOf(buscado) === 0 ? 2 : n.indexOf(buscado) >= 0 ? 1 : 0;
      if (p > mejorPunt) { mejorPunt = p; mejor = e; }
    }
    if (!mejor) return false;
    mejor.scrollIntoView({ block: "center" });
    var b = mejor.getBoundingClientRect(); mover(b.left + b.width / 2, b.top + b.height / 2); congelar(0.5);
    if (esEditable(mejor)) { enfocar(mejor); objetivoTexto = mejor; } else despachar(mejor, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
    return true;
  }

  // ===================================================== calibración ==
  // gui/calibracion.py: 13 puntos fijos (centro + rejilla 4×3) y comprobación
  // con 4 puntos que no entran en el ajuste. Cada punto: 1,2 s para llegar y
  // 0,9 s midiendo con los ojos abiertos.
  var ESPERA_MS = 1200, MEDIDA_MS = 900, MARGEN_C = 0.08;
  var calib = null;
  function rejillaCalibracion() {
    var xs = [MARGEN_C, 0.36, 0.64, 1 - MARGEN_C], ys = [MARGEN_C, 0.5, 1 - MARGEN_C], p = [[0.5, 0.5]];
    ys.forEach(function (y) { xs.forEach(function (x) { if (!(x === 0.5 && y === 0.5)) p.push([x, y]); }); });
    return p.map(function (q) { return [q[0] * window.innerWidth, q[1] * window.innerHeight]; });
  }
  function puntosComprobacion() { return [[0.28, 0.30], [0.72, 0.30], [0.28, 0.70], [0.72, 0.70]].map(function (q) { return [q[0] * window.innerWidth, q[1] * window.innerHeight]; }); }
  function empezarCalibracion(soloRecentrar) {
    if (!camaraActiva) { decir("Activa primero la cámara."); return; }
    cerrarMenu(); cerrarLupa(); ocultarTeclado(); soltarArrastre();
    calib = { fase: "puntos", puntos: soloRecentrar ? [[window.innerWidth / 2, window.innerHeight / 2]] : rejillaCalibracion(), i: -1, tInicio: 0, muestras: [],
              rasgosFijos: [], puntosHechos: [], comprob: null, recentrar: !!soloRecentrar, tFin: 0 };
    calibEl.innerHTML = '<div class="txt">' + (soloRecentrar ? "Mira el punto del centro sin mover la cabeza." : "Mira cada punto naranja hasta que desaparezca. No muevas la cabeza, solo los ojos.") + '</div><div class="punto"></div><button type="button" class="cancelar">Cancelar (o tecla Esc)</button>';
    calibEl.querySelector(".cancelar").addEventListener("click", cancelarCalibracion);
    calibEl.classList.add("visible"); calibrando = true; cursor.style.display = "none";
    siguientePunto(performance.now() / 1000);
  }
  function siguientePunto(tS) {
    calib.i++; calib.muestras = []; calib.tInicio = tS;
    var lista = calib.fase === "comprobar" ? calib.comprob.puntos : calib.puntos;
    if (calib.i >= lista.length) { terminarFase(); return; }
    var p = lista[calib.i], pe = calibEl.querySelector(".punto");
    pe.style.left = p[0] + "px"; pe.style.top = p[1] + "px"; pe.classList.add("grande");
  }
  function tickCalibracion(tS) {
    if (!calib) return;
    parpadeo.tomarEvento();   // los cierres largos no cancelan: hay personas que cierran los ojos más de 1,2 s sin querer (medido el 15-sep-2026)
    if (calib.fase === "fin") { if (tS >= calib.tFin) cerrarCalibracion(); return; }
    var pe = calibEl.querySelector(".punto"), desde = (tS - calib.tInicio) * 1000;
    if (desde < ESPERA_MS) { if (desde > ESPERA_MS * 0.6) pe.classList.remove("grande"); return; }
    if (desde < ESPERA_MS + MEDIDA_MS) {
      if (det.rasgos && ojosParaMirar() && det.rasgos !== calib.ultimo) { calib.ultimo = det.rasgos; calib.muestras.push(det.rasgos); }
      return;
    }
    // Si en los primeros cuatro puntos no se pudo medir nada, no tiene sentido seguir 30 s más
    if (calib.fase === "puntos" && calib.i === 3 && !calib.puntosHechos.length && calib.muestras.length < 5) {
      calibEl.querySelector(".txt").textContent = "No consigo medir tus ojos (abiertos al " + Math.round(parpadeo.estado.relacion * 100) + " %). Acércate a la cámara, con luz de frente y sin gafas oscuras, e inténtalo otra vez.";
      calib.fase = "fin"; calib.tFin = tS + 4; return;
    }
    var lista = calib.fase === "comprobar" ? calib.comprob.puntos : calib.puntos, p = lista[calib.i];
    if (calib.muestras.length >= 5) {
      var med = []; for (var i = 0; i < N_RASGOS; i++) med.push(mediana(calib.muestras.map(function (r) { return r[i]; })));
      if (calib.fase === "comprobar") { var q = predecir(calib.comprob.modelo, med); calib.comprob.errores.push(Math.hypot(q[0] - p[0], q[1] - p[1])); }
      else { calib.rasgosFijos.push(med); calib.puntosHechos.push(p); }
    }
    siguientePunto(tS);
  }
  function terminarFase() {
    var txt = calibEl.querySelector(".txt");
    if (calib.recentrar) {
      if (!calib.rasgosFijos.length || !calibracion) { txt.textContent = "No se pudo medir: mantén los ojos abiertos mirando el punto."; }
      else {
        var raw = predecir(calibracion, calib.rasgosFijos[0], true), m = calibracion.monitor;
        var ex = window.innerWidth / (m[2] - m[0]), ey = window.innerHeight / (m[3] - m[1]);
        calibracion.sesgo = [(window.innerWidth / 2 - raw[0]) / ex, (window.innerHeight / 2 - raw[1]) / ey];
        escribirJSON("winclus.calibracion", calibracion);
        txt.textContent = "Centro corregido (" + Math.round(window.innerWidth / 2 - raw[0]) + ", " + Math.round(window.innerHeight / 2 - raw[1]) + " px).";
      }
      calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 1.5; return;
    }
    if (calib.fase === "puntos") {
      if (calib.puntosHechos.length < 6) { txt.textContent = "Faltaron puntos (" + calib.puntosHechos.length + " de " + calib.puntos.length + "): hay que mantener los ojos abiertos mirando cada punto. Inténtalo otra vez con más luz de frente."; calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 4; return; }
      var modelo = ajustarModelo(calib.puntosHechos, calib.rasgosFijos);
      modelo.datos = { puntos: calib.puntosHechos, rasgos: calib.rasgosFijos, ancho: window.innerWidth, alto: window.innerHeight };
      calib.comprob = { modelo: modelo, puntos: puntosComprobacion(), errores: [] };
      calib.fase = "comprobar"; calib.i = -1; txt.textContent = "Comprobando: mira estos cuatro puntos.";
      siguientePunto(performance.now() / 1000); return;
    }
    if (calib.fase === "comprobar") {
      var mod = calib.comprob.modelo, err = calib.comprob.errores.length ? Math.round(mediana(calib.comprob.errores)) : null;
      mod.error_real_px = err; mod.origen = "calibracion"; mod.fecha = new Date().toISOString();
      calibracion = mod; escribirJSON("winclus.calibracion", mod); reiniciarPuntero();
      txt.textContent = "Calibración guardada. Error real: " + (err === null ? "sin medir" : "unos " + err + " px") + (err !== null && err > 150 ? ". Es alto: prueba con más luz, más cerca de la cámara, o usa el modo híbrido o la lupa." : ".");
      decirVoz("Calibración lista", true); calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 3.5;
      refrescos.forEach(function (f) { f(); });
    }
  }
  function cancelarCalibracion() { if (!calib) return; calibEl.querySelector(".txt").textContent = "Calibración cancelada."; calib.fase = "fin"; calib.tFin = performance.now() / 1000 + 0.8; if (!camaraActiva) cerrarCalibracion(); }
  function cerrarCalibracion() { calib = null; calibrando = false; calibEl.classList.remove("visible"); if (camaraActiva) cursor.style.display = "block"; reiniciarPuntero(); refrescos.forEach(function (f) { f(); }); }
  function recentrar() { if (!calibracion) { avisar("Primero calibra los ojos", true); return; } empezarCalibracion(true); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && calibrando) cancelarCalibracion(); });

  // --- calibración invisible (detectors/aprendizaje.py) ------------------
  // Cada clic hecho con la cabeza (o afinado con ella) es una muestra:
  // rasgos de los ojos justo antes del clic → punto de la pantalla.
  var clicsAprendidos = leerJSON("winclus.clics", []), clicsNuevos = 0, ultimoAjusteClics = 0;
  function anotarClicPuntero(porParpadeo) {
    var modo = modoEfectivo(), fuente;
    if (modo === "cabeza") fuente = "cabeza"; else if (modo === "palanca") fuente = "palanca";
    else if (modo === "hibrido" && afinadoConCabeza()) fuente = "hibrido"; else return;
    anotarClic(P.x, P.y, fuente, null, porParpadeo);
  }
  function anotarClic(x, y, fuente, rasgosDados, porParpadeo) {
    if (!ajustes.calib_invisible) return;
    var r = rasgosDados;
    if (!r) {
      var t = det.t, a = porParpadeo ? 0.9 : 0.5, b = porParpadeo ? 0.35 : 0.05, sel = [];
      for (var i = 0; i < historialRasgos.length; i++) { var h = historialRasgos[i]; if (h[0] >= t - a && h[0] <= t - b && h[2] >= 0.7) sel.push(h[1]); }
      if (sel.length < 4) return;
      for (var j = 0; j < 6; j++) { var col = sel.map(function (s) { return s[j]; }), m = col.reduce(function (p, q) { return p + q; }, 0) / col.length; var v = col.reduce(function (p, q) { return p + (q - m) * (q - m); }, 0) / col.length; if (Math.sqrt(v) > 0.10) return; }
      r = []; for (j = 0; j < N_RASGOS; j++) r.push(mediana(sel.map(function (s) { return s[j]; })));
    }
    clicsAprendidos.push({ x: x / window.innerWidth, y: y / window.innerHeight, r: r, f: fuente, t: Date.now() });
    if (clicsAprendidos.length > 400) clicsAprendidos.splice(0, clicsAprendidos.length - 400);
    escribirJSON("winclus.clics", clicsAprendidos); clicsNuevos++;
    if (clicsNuevos >= (calibracion ? 10 : 5) && Date.now() - ultimoAjusteClics > 120000) setTimeout(function () { ajustarConClics(false); refrescarEstadoAprendizaje(); }, 0);
    refrescarEstadoAprendizaje();
  }
  function ajustarConClics(forzado) {
    clicsNuevos = 0; ultimoAjusteClics = Date.now();
    var n = clicsAprendidos.length, valido = !!calibracion, minimo = valido ? 12 : 30;
    if (n < minimo) return "Aprendiendo: " + n + " de " + minimo + " clics.";
    var W = window.innerWidth, H = window.innerHeight;
    var P_ = clicsAprendidos.map(function (c) { return [c.x * W, c.y * H]; }), R_ = clicsAprendidos.map(function (c) { return c.r; });
    var xs = P_.map(function (p) { return p[0]; }), ys = P_.map(function (p) { return p[1]; });
    if (!valido && ((Math.max.apply(null, xs) - Math.min.apply(null, xs)) / W < 0.30 || (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / H < 0.30)) return "Hacen falta clics más repartidos por la página.";
    var pesos = P_.map(function (p, i) { var edad = n - 1 - i; return edad < 40 ? 8 : edad < 80 ? 4 : edad < 120 ? 2 : 1; });
    // Prueba: uno de cada dos entre los últimos n/4·2
    var k = 2 * Math.floor(n / 4), test = {}, i;
    for (i = n - k; i < n; i += 2) test[i] = true;
    var Ptr = [], Rtr = [], Wtr = [], Pte = [], Rte = [];
    for (i = 0; i < n; i++) { if (test[i]) { Pte.push(P_[i]); Rte.push(R_[i]); } else { Ptr.push(P_[i]); Rtr.push(R_[i]); Wtr.push(pesos[i]); } }
    var base = calibracion && calibracion.datos ? calibracion.datos : null, Pb = [], Rb = [];
    if (base) { Pb = base.puntos.map(function (p) { return [p[0] * W / base.ancho, p[1] * H / base.alto]; }); Rb = base.rasgos; }
    function errorDe(m, Pp, Rr) { return mediana(Pp.map(function (p, j) { var q = predecir(m, Rr[j]); return Math.hypot(q[0] - p[0], q[1] - p[1]); })); }
    var mejor = null;
    LAMBDAS.forEach(function (lam) { var m = ajustarModelo(Pb, Rb, Ptr, Rtr, Wtr, lam); var e = Pte.length ? errorDe(m, Pte, Rte) : m.error_px; if (!mejor || e < mejor[0]) mejor = [e, lam]; });
    var err = mejor[0];
    if (!valido && err > 200) return "Todavía no acierta bastante (" + Math.round(err) + " px). Sigue haciendo clics.";
    if (valido && !forzado) {
      var errActual = Pte.length ? errorDe(calibracion, Pte, Rte) : 1e9;
      if (err > 150 || err >= errActual) return "La calibración actual sigue siendo mejor (" + Math.round(errActual) + " px frente a " + Math.round(err) + ").";
    }
    var modelo = ajustarModelo(Pb, Rb, P_, R_, pesos, mejor[1]);
    modelo.datos = base; modelo.origen = base ? "clics+calibracion" : "clics"; modelo.error_real_px = Math.round(err); modelo.fecha = new Date().toISOString();
    calibracion = modelo; escribirJSON("winclus.calibracion", modelo); reiniciarPuntero();
    avisar(base ? "Calibración afinada con tus clics" : "Ojos calibrados con tus clics");
    return "Ajustada con " + n + " clics (error " + Math.round(err) + " px).";
  }
  function estadoAprendizaje() {
    var n = clicsAprendidos.length;
    if (!ajustes.calib_invisible) return "Desactivada.";
    if (!calibracion) return n < 30 ? "Aprendiendo: " + n + " de 30 clics. Usa el puntero con la cabeza y haz clic por toda la página; con 30 calibrará los ojos sola." : n + " clics guardados.";
    return n + " clics guardados. " + (calibracion.origen === "clics" ? "Aprendida de tus clics." : calibracion.origen === "clics+calibracion" ? "Afinada con tus clics." : "");
  }
  var estadoAprEl = null;
  function refrescarEstadoAprendizaje() { if (estadoAprEl) estadoAprEl.textContent = estadoAprendizaje(); }

  // =============================================================== panel ==
  panel.innerHTML = '<div class="wcl-cab">' + LOGO + '<b>Winclus</b><button type="button" aria-label="Cerrar">×</button></div>';
  var TABS = [["ver", "Ver"], ["oir", "Oír"], ["cara", "Puntero"], ["clics", "Clics"], ["escribir", "Escribir"], ["mas", "Más"]];
  var tabsEl = el("div", { "class": "wcl-tabs", "role": "tablist" }), tabs = {};
  TABS.forEach(function (t) {
    var b = el("button", { "type": "button", "role": "tab", "aria-selected": "false", "id": "wcl-tab-" + t[0] }, t[1]);
    b.addEventListener("click", function () { elegirTab(t[0]); });
    tabsEl.appendChild(b);
    tabs[t[0]] = el("div", { "class": "wcl-tab", "role": "tabpanel", "aria-labelledby": "wcl-tab-" + t[0] });
  });
  panel.appendChild(tabsEl);
  function elegirTab(nombre) {
    TABS.forEach(function (t) { tabs[t[0]].classList.toggle("activa", t[0] === nombre); q("#wcl-tab-" + t[0]).setAttribute("aria-selected", t[0] === nombre ? "true" : "false"); });
    try { sessionStorage.setItem("winclus.tab", nombre); } catch (e) {}
  }
  function grupo(cuando) { var g = el("div"); g.dataset.cuando = cuando; return g; }

  // --- Ver mejor ---
  var s = seccion("Ver mejor");
  s.appendChild(filaPaso("texto", "Tamaño del texto", 80, 200, 10, pct, aplicarTexto));
  s.appendChild(filaSw("contraste", "Alto contraste", aplicarClases));
  s.appendChild(filaSw("oscuro", "Modo oscuro", aplicarClases));
  s.appendChild(filaSw("enlaces", "Resaltar enlaces", aplicarClases));
  s.appendChild(filaSw("guia", "Guía de lectura", aplicarClases));
  s.appendChild(filaSw("animaciones", "Pausar animaciones", aplicarClases));
  tabs.ver.appendChild(s);

  // --- Oír ---
  s = seccion("Escuchar");
  s.appendChild(filaSw("lectura", "Leer en voz alta lo que se pulsa"));
  s.appendChild(botonGrande("Leer la página", "suave", leerPagina));
  s.appendChild(botonGrande("Callar", "suave", callar));
  tabs.oir.appendChild(s);
  s = seccion("Voz");
  s.appendChild(filaSw("voz_activa", "Voz activada (Decir y frases)"));
  var fVoz = el("div", { "class": "wcl-fila" }, '<span id="wcl-l-voz">Voz</span><div class="wcl-mm" role="group" aria-labelledby="wcl-l-voz"><button type="button" aria-label="Voz anterior">−</button><span style="min-width:120px;font-size:12px"></span><button type="button" aria-label="Voz siguiente">+</button></div>');
  var bv = fVoz.querySelectorAll("button"), vv = fVoz.querySelector("span[style]");
  function cambiarVoz(d) { var vs = vocesEs(); if (!vs.length) return; var i = vs.findIndex(function (v) { return v.name === ajustes.voz_nombre; }); i = (i + d + vs.length) % vs.length; ajustes.voz_nombre = vs[i].name; guardar(); pintarVoz(); }
  function pintarVoz() { var vs = vocesEs(); var v = vs.find(function (x) { return x.name === ajustes.voz_nombre; }) || vs[0]; vv.textContent = v ? v.name.replace(/Microsoft |Google |Desktop| - .*$/g, "") : "sin voces en español"; }
  bv[0].addEventListener("click", function () { cambiarVoz(-1); }); bv[1].addEventListener("click", function () { cambiarVoz(1); });
  refrescos.push(pintarVoz); if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = pintarVoz;
  s.appendChild(fVoz);
  s.appendChild(filaPaso("voz_velocidad", "Velocidad de la voz", -5, 5, 1, function (n) { return n > 0 ? "+" + n : String(n); }));
  s.appendChild(filaSw("voz_eco", "Leer cada palabra al escribirla"));
  s.appendChild(botonGrande("Probar la voz", "suave", function () { decirVoz("Hola, soy la voz de Winclus.", true, true); }));
  tabs.oir.appendChild(s);
  s = seccion("Frases para decir");
  s.appendChild(el("div", { "class": "wcl-estado" }, "Una por línea (hasta 16). Aparecen en la tecla «Frases» del teclado."));
  var areaFrases = el("textarea", { "class": "wcl-area", "aria-label": "Frases para decir" }); areaFrases.value = frases.join("\n");
  s.appendChild(areaFrases);
  s.appendChild(botonGrande("Guardar frases", "", function () {
    var limpias = []; areaFrases.value.split("\n").forEach(function (f) { f = f.replace(/\s+/g, " ").trim(); if (f && limpias.indexOf(f) < 0 && limpias.length < 16) limpias.push(f); });
    frases = limpias; escribirJSON("winclus.frases", frases); areaFrases.value = frases.join("\n"); avisar("Frases guardadas"); if (tecVisible && capa === "frases") dibujarTeclado();
  }));
  s.appendChild(botonGrande("Volver a las de ejemplo", "suave", function () { frases = FRASES_DEFECTO.slice(); escribirJSON("winclus.frases", null); areaFrases.value = frases.join("\n"); }));
  tabs.oir.appendChild(s);
  s = seccion("Órdenes por voz");
  s.appendChild(el("div", { "class": "wcl-estado" }, "Di «baja», «sube», «clic», «pulsa» y el nombre de un enlace, «escribe» y el texto, «lee», «teclado», «menú», «pausa», «sigue», «ayuda»…"));
  var btnEscucha = botonGrande("Escuchar órdenes", "azul", function () { if (escuchando) pararEscucha(); else empezarEscucha(); });
  refrescos.push(function () { btnEscucha.textContent = escuchando ? "Dejar de escuchar" : "Escuchar órdenes"; btnEscucha.classList.toggle("rojo", escuchando); });
  s.appendChild(btnEscucha);
  tabs.oir.appendChild(s);

  // --- Puntero (cara) ---
  s = seccion("Usar con la cara");
  if (opciones.camara) {
    estadoEl = el("div", { "class": "wcl-estado", "id": "wcl-estado", "aria-live": "polite" }, "Mueve el puntero con la cabeza o con los ojos y haz clic con un gesto. La cámara se procesa aquí mismo: nada sale de tu equipo.");
    s.appendChild(estadoEl);
    btnActivar = botonGrande("Activar cámara", "", activarCamara); s.appendChild(btnActivar);
    var vista = el("div", { "class": "wcl-cam-vista" }, '<canvas width="320" height="240" aria-label="Vista de la cámara"></canvas>'); s.appendChild(vista);
    s.appendChild(filaSw("camara_ver", "Ver la cámara", function (v) { vistaCamara(v && camaraActiva); }));
    // Lectura en vivo del detector, para diagnosticar el parpadeo sin adivinar
    var diag = el("div", { "class": "wcl-estado", "style": "font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap" }); s.appendChild(diag);
    setInterval(function () {
      if (!camaraActiva) { diag.textContent = ""; return; }
      var e = parpadeo.estado, bs = det.bs || {};
      diag.textContent = (det.cara ? "Cara: sí" : "Cara: NO") + " · modo " + modoEfectivo() + (pausado ? " · EN PAUSA" : "")
        + "\nOjos abiertos: " + Math.round(e.relacion * 100) + " % (" + (e.listo ? "referencia lista" : "aprendiendo " + parpadeo.bufDer.length + "/" + PB.MIN_BASE) + ")"
        + "\nApertura der/izq: " + e.apertura[0].toFixed(3) + " / " + e.apertura[1].toFixed(3) + " · normal " + e.base[0].toFixed(3) + " / " + e.base[1].toFixed(3)
        + "\nParpadeo MediaPipe der/izq: " + (bs.eyeBlinkRight || 0).toFixed(2) + " / " + (bs.eyeBlinkLeft || 0).toFixed(2)
        + "\nCerrados: " + (e.cerrados ? e.cerradosMs + " ms" : "no") + " · umbral " + ajustes.parpadeo_umbral + " · mínimo " + ajustes.parpadeo_ms + " ms"
        + (parpadeo.ultimoEpisodio ? "\nÚltimo cierre: " + parpadeo.ultimoEpisodio.ms + " ms → " + parpadeo.ultimoEpisodio.resultado : "");
    }, 250);
    tabs.cara.appendChild(s);

    s = seccion("Cómo se mueve el puntero");
    // Al elegir los ojos sin calibración, se calibra en el acto (en la aplicación la
    // calibración ya estaba guardada; aquí hay que hacerla una vez por navegador)
    function alElegirOjos() {
      reiniciarPuntero();
      if (ajustes.modo_puntero !== "ojos" || ajustes.ojos_modo === "palanca" || calibracion) return;
      if (!camaraActiva) { decir("Para usar los ojos: activa la cámara y pulsa «Calibrar los ojos». Hasta entonces el puntero va con la cabeza."); return; }
      decir("Sin calibrar todavía: empieza la calibración (unos 40 s)."); abrir(false); empezarCalibracion(false);
    }
    s.appendChild(filaOpc("modo_puntero", "", [["cabeza", "Con la cabeza"], ["ojos", "Con los ojos"]], alElegirOjos));
    var gOjos = grupo("ojos");
    gOjos.appendChild(filaOpc("ojos_modo", "Modo de ojos", [["directo", "Directo"], ["hibrido", "Híbrido"], ["palanca", "Palanca"]], alElegirOjos));
    var estadoCalib = el("div", { "class": "wcl-estado" });
    refrescos.push(function () {
      estadoCalib.textContent = calibracion ? "Ojos calibrados" + (calibracion.error_real_px != null ? " (error unos " + calibracion.error_real_px + " px)" : "") + (calibracion.origen === "clics" ? ", aprendida de tus clics" : calibracion.origen === "clics+calibracion" ? ", afinada con tus clics" : "") + "." : "Sin calibrar: mientras tanto el puntero irá con la cabeza (o calibra con 30 clics, ver abajo).";
    });
    var gCalib = grupo("directo hibrido");
    gCalib.appendChild(estadoCalib);
    gCalib.appendChild(botonGrande("Calibrar los ojos (unos 40 s)", "azul", function () { abrir(false); empezarCalibracion(false); }));
    gCalib.appendChild(botonGrande("Recentrar (mirar al centro 2 s)", "suave", function () { abrir(false); recentrar(); }));
    gCalib.appendChild(botonGrande("Olvidar la calibración", "suave", function () { calibracion = null; escribirJSON("winclus.calibracion", null); reiniciarPuntero(); refrescos.forEach(function (f) { f(); }); }));
    gCalib.appendChild(filaPaso("ojos_suavizado", "Suavizado de la mirada", 1, 30, 1));
    gCalib.appendChild(filaPaso("ojos_fijacion_px", "Zona quieta alrededor", 20, 150, 10, px));
    gOjos.appendChild(gCalib);
    var gHib = grupo("hibrido");
    gHib.appendChild(el("div", { "class": "wcl-estado" }, "Híbrido: la mirada salta a la zona y la cabeza afina."));
    gHib.appendChild(filaPaso("hibrido_cabeza", "Afinar con la cabeza", 10, 100, 10, pct));
    gHib.appendChild(filaPaso("hibrido_salto_px", "Salto mínimo", 50, 400, 25, px));
    gOjos.appendChild(gHib);
    var gPal = grupo("palanca");
    gPal.appendChild(el("div", { "class": "wcl-estado" }, "Palanca: mirar a un lado empuja el puntero hacia allí; volver al centro lo para."));
    gPal.appendChild(botonGrande("Centrar (mira al centro)", "suave", function () { ojosCentro = null; centrandoPalanca = null; escribirJSON("winclus.ojos_centro", null); }));
    gPal.appendChild(filaPaso("ojos_velocidad", "Velocidad", 10, 100, 10));
    gPal.appendChild(filaPaso("ojos_zona_muerta", "Zona muerta", 0, 15, 1, pct));
    gPal.appendChild(filaPaso("ojos_vertical", "Ganancia vertical", 50, 300, 25, pct));
    gOjos.appendChild(gPal);
    var gLupa = grupo("directo");
    gLupa.appendChild(filaSw("lupa_activa", "Lupa: el primer gesto agranda, el segundo pulsa"));
    gLupa.appendChild(filaPaso("lupa_zoom", "Aumento de la lupa", 2, 4, 1, function (n) { return "×" + n; }));
    gOjos.appendChild(gLupa);
    s.appendChild(gOjos);
    var gCab = grupo("cabeza hibrido");
    gCab.appendChild(filaPaso("velocidad", "Velocidad con la cabeza", 5, 60, 5));
    gCab.appendChild(filaPaso("suavizado", "Suavizado de la cabeza", 2, 20, 1));
    gCab.appendChild(filaSw("aceleracion", "Aceleración"));
    s.appendChild(gCab);
    tabs.cara.appendChild(s);

    s = seccion("Imán a los botones");
    s.appendChild(el("div", { "class": "wcl-estado" }, "Si el puntero se queda quieto cerca de un botón o enlace, se pega a él."));
    s.appendChild(filaSw("iman_activo", "Imán activado"));
    s.appendChild(filaPaso("iman_radio_px", "Alcance", 30, 200, 10, px));
    s.appendChild(filaSw("iman_cabeza", "También con la cabeza"));
    tabs.cara.appendChild(s);

    s = seccion("Calibración invisible");
    s.appendChild(el("div", { "class": "wcl-estado" }, "Aprende de cada clic que haces con la cabeza y calibra los ojos sola."));
    s.appendChild(filaSw("calib_invisible", "Aprender de mis clics", refrescarEstadoAprendizaje));
    estadoAprEl = el("div", { "class": "wcl-estado", "aria-live": "polite" }); s.appendChild(estadoAprEl); refrescos.push(refrescarEstadoAprendizaje);
    s.appendChild(botonGrande("Ajustar ahora", "suave", function () { estadoAprEl.textContent = ajustarConClics(true) || estadoAprendizaje(); refrescos.forEach(function (f) { f(); }); }));
    s.appendChild(botonGrande("Olvidar los clics", "suave", function () { clicsAprendidos = []; escribirJSON("winclus.clics", null); refrescarEstadoAprendizaje(); }));
    tabs.cara.appendChild(s);
  } else {
    s.appendChild(el("div", { "class": "wcl-estado" }, "El control con la cámara está desactivado en esta página."));
    tabs.cara.appendChild(s);
  }

  // --- Clics ---
  s = seccion("Cómo se hace clic");
  s.appendChild(filaOpc("modo_clic", "", [["parpadeo", "Parpadeo"], ["boca", "Abrir la boca"], ["cejas", "Subir las cejas"], ["quieto", "Quedarse quieto"]], reiniciarQuieto));
  var gParp = grupo("parpadeo");
  gParp.appendChild(filaPaso("parpadeo_ms", "Cerrar los ojos al menos", 100, 800, 50, ms));
  var fCierre = el("div", { "class": "wcl-fila" }, '<span id="wcl-l-cierre">Cuánto hay que cerrarlos</span><div class="wcl-mm" role="group" aria-labelledby="wcl-l-cierre"><button type="button" aria-label="Menos">−</button><span aria-live="polite"></span><button type="button" aria-label="Más">+</button></div>');
  var bc = fCierre.querySelectorAll("button"), vc = fCierre.querySelector("span[aria-live]");
  function pintarCierre() { vc.textContent = Math.round((1 - ajustes.parpadeo_umbral) * 100) + " %"; }
  function cambiarCierre(d) { var c = Math.round((1 - ajustes.parpadeo_umbral) * 100) + d; c = Math.max(25, Math.min(65, c)); ajustes.parpadeo_umbral = +(1 - c / 100).toFixed(2); guardar(); pintarCierre(); }
  bc[0].addEventListener("click", function () { cambiarCierre(-5); }); bc[1].addEventListener("click", function () { cambiarCierre(5); });
  refrescos.push(pintarCierre); gParp.appendChild(fCierre);
  var estadoParp = el("div", { "class": "wcl-estado", "aria-live": "off" }); gParp.appendChild(estadoParp);
  setInterval(function () { if (!camaraActiva) { estadoParp.textContent = ""; return; } if (parpadeo.ultimoEpisodio) estadoParp.textContent = "Último cierre: " + parpadeo.ultimoEpisodio.ms + " ms → " + parpadeo.ultimoEpisodio.resultado; }, 300);
  s.appendChild(gParp);
  var gQ = grupo("quieto");
  gQ.appendChild(filaPaso("quieto_ms", "Tiempo quieto", 500, 3000, 100, ms));
  gQ.appendChild(filaPaso("quieto_radio_px", "Margen de movimiento", 20, 100, 10, px));
  gQ.appendChild(filaSw("quieto_anillo", "Mostrar el anillo que se llena"));
  s.appendChild(gQ);
  s.appendChild(el("div", { "class": "wcl-estado" }, "Con los ojos cerrados 1,2 s se abre el menú de clics (clic derecho, doble, arrastrar, rueda, teclado, leer, recentrar o pausar)."));
  tabs.clics.appendChild(s);
  s = seccion("Otras acciones con gestos");
  GESTOS.forEach(function (g) { s.appendChild(filaOpc(g[0], g[1], ACCIONES, null, ajustes.gestos)); });
  s.appendChild(filaPaso("gestos_umbral", "Sensibilidad de los gestos", 30, 80, 5, pct));
  s.appendChild(filaPaso("hold_ms", "Mantener el gesto para arrastrar", 150, 800, 50, ms));
  tabs.clics.appendChild(s);
  s = seccion("Avisos");
  s.appendChild(filaSw("avisos_visuales", "Etiqueta junto al puntero"));
  s.appendChild(filaSw("avisos_sonido", "Pitido al hacer clic"));
  tabs.clics.appendChild(s);

  // --- Escribir ---
  s = seccion("Teclado en pantalla");
  s.appendChild(el("div", { "class": "wcl-estado" }, "Pulsa en un campo de la página y escribe con el puntero. Tiene sugerencias de palabras, «Decir», «Frases» y «Dictar»."));
  s.appendChild(botonGrande("Mostrar / ocultar el teclado", "azul", alternarTeclado));
  s.appendChild(filaOpc("teclado_posicion", "Posición", [["abajo", "Abajo"], ["arriba", "Arriba"]], function () { if (tecVisible) dibujarTeclado(); }));
  s.appendChild(filaPaso("teclado_altura", "Altura", 20, 50, 2, pct, function () { if (tecVisible) dibujarTeclado(); }));
  s.appendChild(filaSw("teclado_prediccion", "Sugerir palabras", function () { if (tecVisible) dibujarTeclado(); }));
  s.appendChild(filaSw("teclado_sonido", "Sonido al pulsar"));
  s.appendChild(botonGrande("Olvidar las palabras aprendidas", "suave", function () { aprendidas = {}; escribirJSON("winclus.palabras", null); diccionario = null; cargarDiccionario(); avisar("Olvidadas"); }));
  tabs.escribir.appendChild(s);
  s = seccion("Dictado");
  s.appendChild(el("div", { "class": "wcl-estado" }, "Habla y se escribe en el campo elegido (Chrome o Edge)."));
  var btnDictar = botonGrande("Dictar", "azul", alternarDictado);
  refrescos.push(function () { btnDictar.textContent = dictando ? "Parar el dictado" : "Dictar"; btnDictar.classList.toggle("rojo", dictando); });
  s.appendChild(btnDictar);
  tabs.escribir.appendChild(s);

  // --- Más ---
  s = seccion("Perfil");
  s.appendChild(el("div", { "class": "wcl-estado" }, "Llévate tus ajustes, calibración, frases y palabras a otro navegador o página."));
  s.appendChild(botonGrande("Exportar perfil (.winclus)", "suave", function () {
    var perfil = { winclus: VERSION, ajustes: ajustes, calibracion: calibracion, ojos_centro: ojosCentro, frases: frases, palabras: aprendidas, clics: clicsAprendidos };
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(perfil)], { type: "application/json" })); a.download = "perfil.winclus"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }));
  var entrada = el("input", { "type": "file", "accept": ".winclus,.json", "style": "display:none" });
  entrada.addEventListener("change", function () {
    var f = entrada.files[0]; if (!f) return;
    f.text().then(function (t) {
      var p = JSON.parse(t); if (!p || !p.ajustes) throw new Error("no es un perfil");
      fusionarAjustes(p.ajustes); guardar(); if (modeloValido(p.calibracion)) { calibracion = p.calibracion; escribirJSON("winclus.calibracion", calibracion); }
      if (p.ojos_centro) { ojosCentro = p.ojos_centro; escribirJSON("winclus.ojos_centro", ojosCentro); }
      if (p.frases) { frases = p.frases; escribirJSON("winclus.frases", frases); areaFrases.value = frases.join("\n"); }
      if (p.palabras) { aprendidas = p.palabras; escribirJSON("winclus.palabras", aprendidas); diccionario = null; }
      if (p.clics) { clicsAprendidos = p.clics; escribirJSON("winclus.clics", clicsAprendidos); }
      aplicarTodo(); avisar("Perfil importado");
    }).catch(function () { avisar("No se pudo leer el perfil", true); });
    entrada.value = "";
  });
  s.appendChild(entrada);
  s.appendChild(botonGrande("Importar perfil", "suave", function () { entrada.click(); }));
  s.appendChild(botonGrande("Restablecer todo", "suave", function () {
    fusionarAjustes(JSON.parse(JSON.stringify(POR_DEFECTO))); guardar(); aplicarTodo(); avisar("Ajustes restablecidos");
  }));
  tabs.mas.appendChild(s);
  s = seccion("Acerca de");
  s.appendChild(el("div", { "class": "wcl-pie", "style": "padding:0" }, 'Winclus widget ' + VERSION + ', código abierto (Apache 2.0). Sin cuentas ni rastreo: todo se procesa en tu navegador.<br><br>¿Quieres controlar todo el ordenador con la cara? <a href="https://winclus.com/#contacto" target="_blank" rel="noopener">Comunícate con nosotros</a>.'));
  tabs.mas.appendChild(s);

  TABS.forEach(function (t) { panel.appendChild(tabs[t[0]]); });

  // ==================================== más necesidades: diez en total ==
  // 7) ceguera: lector de pantalla básico · 8) daltonismo: corrección de color ·
  // 9) epilepsia fotosensible y sensibilidad sensorial: modo calma ·
  // 10) discapacidad cognitiva y TDAH: lectura limpia, máscara de enfoque, modo fácil
  var css2 = ''
    + 'html.wcl-calma *,html.wcl-calma *::before,html.wcl-calma *::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'
    + 'html.wcl-dislexia body{letter-spacing:.05em;word-spacing:.16em;line-height:1.8}html.wcl-dislexia body p,html.wcl-dislexia body li{max-width:38em}'
    + 'html.wcl-sinimg body img,html.wcl-sinimg body video,html.wcl-sinimg body iframe,html.wcl-sinimg body picture,html.wcl-sinimg body canvas{opacity:.12!important}'
    + '.wcl-mascara{position:fixed;left:0;right:0;background:rgba(10,14,25,.62);pointer-events:none;z-index:2147482998;display:none}'
    + '.wcl-limpia{position:fixed;inset:0;z-index:2147483014;background:#FBF8F1;color:#1d1d1d;overflow:auto;font:20px/1.9 "Segoe UI",system-ui,sans-serif;letter-spacing:.02em}'
    + '.wcl-limpia-barra{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:10px 14px;background:#101F3D;color:#fff;z-index:1;flex-wrap:wrap}.wcl-limpia-barra b{flex:1;font-size:16px}'
    + '.wcl-limpia-barra button{min-height:44px;min-width:44px;padding:0 14px;border-radius:10px;border:0;background:#E8F7F3;color:#101F3D;font:700 15px "Segoe UI",system-ui,sans-serif;cursor:pointer}'
    + '.wcl-limpia-texto{max-width:36rem;margin:0 auto;padding:28px 20px 80px}.wcl-limpia-texto h1,.wcl-limpia-texto h2,.wcl-limpia-texto h3,.wcl-limpia-texto h4{line-height:1.3;margin:1.2em 0 .4em;color:#101F3D}.wcl-limpia-texto p{margin:0 0 1em}.wcl-limpia-texto figure{margin:1em 0}.wcl-limpia-texto img{max-width:100%;border-radius:10px}.wcl-limpia-texto figcaption{font-size:.8em;color:#555}'
    + '.wcl-facil{display:none;padding:12px 16px 16px}.wcl-facil .wcl-big{min-height:64px;font-size:19px;margin:6px 0}.wcl-panel.facil .wcl-tabs,.wcl-panel.facil .wcl-tab{display:none}.wcl-panel.facil .wcl-facil{display:block}'
    + 'html.wcl-lupap{overflow-x:hidden}html.wcl-lupap body{transition:none!important}'
    + '.wcl-lector{outline:4px solid #F2B705!important;outline-offset:3px;box-shadow:0 0 0 8px rgba(242,183,5,.25)!important}';
  var estilo2 = document.createElement("style"); estilo2.textContent = css2; (document.head || raiz).appendChild(estilo2);
  // Filtros de color (daltonización de Fidaner: M = I + E·(I − S), con la simulación de Machado 2009)
  var FILTROS = el("svg", { "style": "position:absolute;width:0;height:0", "aria-hidden": "true" },
    '<filter id="wcl-f-protan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0.479 0.477 0.044 0 0  0.597 -0.689 1.091 0 0  0 0 0 1 0"/></filter>'
    + '<filter id="wcl-f-deutan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0.163 0.725 0.112 0 0  0.455 -0.645 1.191 0 0  0 0 0 1 0"/></filter>'
    + '<filter id="wcl-f-tritan" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  -0.100 1.123 -0.022 0 0  -0.184 -0.638 1.821 0 0  0 0 0 1 0"/></filter>'
    + '<filter id="wcl-f-gris" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/></filter>');
  var mascaraArriba = el("div", { "class": "wcl-mascara", "aria-hidden": "true" }), mascaraAbajo = el("div", { "class": "wcl-mascara", "aria-hidden": "true" });
  function actualizarMascara(y) {
    if (!ajustes.mascara) return;
    var banda = 70;
    mascaraArriba.style.top = "0"; mascaraArriba.style.height = Math.max(0, y - banda) + "px";
    mascaraAbajo.style.top = (y + banda) + "px"; mascaraAbajo.style.bottom = "0"; mascaraAbajo.style.height = "";
  }
  document.addEventListener("mousemove", function (e) { if (ajustes.mascara && !camaraActiva) actualizarMascara(e.clientY); if (ajustes.lupa_pantalla && !camaraActiva) seguirLupaPantalla(e.clientX, e.clientY); });

  // --- lupa de pantalla (magnificador): toda la página agrandada alrededor del puntero ---
  // Como el punto bajo el puntero siempre es el contenido real, mover el puntero recorre la página
  // como una lupa de mano. Sustituye a un magnificador como MAGic dentro de la página.
  function seguirLupaPantalla(x, y) {
    var b = document.body;
    b.style.transformOrigin = (x - b.offsetLeft) + "px " + (y + window.scrollY - b.offsetTop) + "px";
  }
  function aplicarLupaPantalla() {
    var b = document.body;
    raiz.classList.toggle("wcl-lupap", !!ajustes.lupa_pantalla);
    if (ajustes.lupa_pantalla) { if (lupa) cerrarLupa(); seguirLupaPantalla(P.x, P.y); b.style.transform = "scale(" + ajustes.lupa_pantalla_zoom + ")"; }
    else if (!lupa) { b.style.transform = ""; b.style.transformOrigin = ""; }
  }

  // --- modo calma: nada que parpadee, se mueva solo o suene sin pedirlo -----
  var ultimaInteraccion = 0;
  ["pointerdown", "keydown", "touchstart"].forEach(function (t) { document.addEventListener(t, function () { ultimaInteraccion = performance.now(); }, true); });
  document.addEventListener("play", function (e) {
    if (!ajustes.calma || !e.target || !(e.target instanceof HTMLMediaElement)) return;
    if (performance.now() - ultimaInteraccion > 1500) { try { e.target.pause(); } catch (x) {} }   // reproducción automática, no pedida
  }, true);
  function congelarGifs(si) {
    document.querySelectorAll("body img").forEach(function (im) {
      if (si) {
        if (!/\.gif(\?|#|$)/i.test(im.currentSrc || im.src) || im.dataset.wclGif) return;
        try {
          var c = document.createElement("canvas"); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
          c.getContext("2d").drawImage(im, 0, 0); var quieto = c.toDataURL();
          im.dataset.wclGif = im.src; im.src = quieto;
        } catch (x) {}   // imagen de otro dominio: no se puede copiar, se deja
      } else if (im.dataset.wclGif) { im.src = im.dataset.wclGif; delete im.dataset.wclGif; }
    });
  }
  function aplicarCalma(si) {
    raiz.classList.toggle("wcl-calma", si);
    if (si) document.querySelectorAll("video,audio").forEach(function (m) { try { m.pause(); m.autoplay = false; m.removeAttribute("autoplay"); m.loop = false; } catch (x) {} });
    congelarGifs(si);
  }

  // --- lectura limpia: solo el texto de la página, grande y sin distracciones ---
  var limpiaEl = null, limpiaTam = 20;
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function visibleEl(e) { var r = e.getBoundingClientRect(); if (!r.width && !r.height) return false; var cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none"; }
  function lecturaLimpia() {
    if (limpiaEl) { cerrarLimpia(); return; }
    var m = document.querySelector("main,article,[role=main]") || document.body, partes = [];
    m.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,img,figcaption").forEach(function (e) {
      if (e.closest(".wcl-root,nav,header,footer,aside,[aria-hidden=true]") || !visibleEl(e)) return;
      if (e.tagName === "IMG") { if (e.alt && (e.naturalWidth > 80)) partes.push('<figure><img src="' + esc(e.currentSrc || e.src) + '" alt="' + esc(e.alt) + '"><figcaption>' + esc(e.alt) + '</figcaption></figure>'); return; }
      if (e.querySelector("p,li,h1,h2,h3,h4,blockquote")) return;   // contenedor: sus hijos ya se listan
      var t = (e.innerText || "").replace(/\s+/g, " ").trim(); if (!t) return;
      var tag = e.tagName === "LI" ? "p" : e.tagName.toLowerCase();
      partes.push("<" + tag + ">" + (e.tagName === "LI" ? "• " : "") + esc(t) + "</" + tag + ">");
    });
    limpiaEl = el("div", { "class": "wcl-limpia", "role": "dialog", "aria-label": "Lectura limpia" },
      '<div class="wcl-limpia-barra"><b>Lectura limpia</b><button type="button" data-a="leer">Leer en voz alta</button><button type="button" data-a="callar">Callar</button><button type="button" data-a="menos" aria-label="Texto más pequeño">A−</button><button type="button" data-a="mas" aria-label="Texto más grande">A+</button><button type="button" data-a="cerrar" aria-label="Cerrar la lectura limpia">✕ Cerrar</button></div>'
      + '<div class="wcl-limpia-texto">' + (partes.join("") || "<p>Esta página no tiene texto que mostrar.</p>") + "</div>");
    limpiaEl.style.fontSize = limpiaTam + "px";
    limpiaEl.addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      var a = b.dataset.a;
      if (a === "cerrar") cerrarLimpia();
      else if (a === "leer") decirVoz((limpiaEl.querySelector(".wcl-limpia-texto").innerText || "").slice(0, 15000), true, true);
      else if (a === "callar") callar();
      else { limpiaTam = Math.max(16, Math.min(34, limpiaTam + (a === "mas" ? 2 : -2))); limpiaEl.style.fontSize = limpiaTam + "px"; }
    });
    cont.appendChild(limpiaEl); abrir(false);
    try { limpiaEl.querySelector("button").focus(); } catch (x) {}
    refrescos.forEach(function (f) { f(); });
  }
  function cerrarLimpia() { if (!limpiaEl) return; callar(); limpiaEl.remove(); limpiaEl = null; refrescos.forEach(function (f) { f(); }); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && limpiaEl) cerrarLimpia(); });

  // --- lector de pantalla básico: leer la página con el teclado y voz ---------
  // Flechas ↓↑ recorren el contenido; h encabezados, l enlaces, b botones, f campos, i imágenes
  // (con Mayús, hacia atrás); Intro activa; Espacio repite; Esc calla; F1 o ? ayuda.
  var lectorIdx = -1, lectorEl = null, lectorLista = [];
  var SEL_LECTOR = "h1,h2,h3,h4,h5,h6,p,li,dt,dd,td,th,a[href],button,input,select,textarea,summary,label,figcaption,blockquote,img,[role=button],[role=link],[role=checkbox],[role=tab],[role=menuitem]";
  var BLOQUE_TEXTO = /^(P|H[1-6]|LI|DT|DD|TD|TH|BLOCKQUOTE|FIGCAPTION|LABEL)$/;
  function bloquesLector(filtro) {
    var lista = [];
    document.querySelectorAll(SEL_LECTOR).forEach(function (e) {
      if (e.closest(".wcl-root") || !visibleEl(e) || e.closest("[aria-hidden=true]")) return;
      if (filtro && !filtro(e)) return;
      if (e.tagName === "IMG" && !e.alt) return;
      if (BLOQUE_TEXTO.test(e.tagName) && !(e.innerText || "").trim()) return;
      if (!filtro) {
        // dentro de un párrafo, los enlaces y botones se leen con el propio párrafo (con «l» y «b» se llega a ellos)
        if ((e.tagName === "A" || e.tagName === "BUTTON" || e.tagName === "LABEL") && e.parentElement && e.parentElement.closest("p,li,td,th,dd,h1,h2,h3,h4,h5,h6,figcaption,blockquote")) return;
        if (BLOQUE_TEXTO.test(e.tagName) && e.querySelector("p,li,h1,h2,h3,h4,h5,h6") && e.tagName !== "LI") return;
        if (e.tagName === "LI" && e.querySelector("li")) return;
        if (e.tagName === "LABEL" && e.querySelector("input,select,textarea")) return;
      }
      lista.push(e);
    });
    return lista;
  }
  function etiquetaCampo(e) {
    var l = e.labels && e.labels[0] ? e.labels[0].innerText : (e.closest("label") ? e.closest("label").innerText : "");
    return (l || e.getAttribute("aria-label") || e.placeholder || e.title || e.name || "").replace(/\s+/g, " ").trim();
  }
  function describir(e) {
    var t = (e.innerText || e.textContent || "").replace(/\s+/g, " ").trim(), n = e.tagName;
    if (/^H[1-6]$/.test(n)) return "Encabezado nivel " + n[1] + ": " + t;
    if (n === "A" || e.getAttribute("role") === "link") return "Enlace: " + (t || nombreDe(e));
    if (n === "BUTTON" || e.getAttribute("role") === "button") return "Botón: " + (t || nombreDe(e));
    if (n === "INPUT") {
      var tipo = (e.type || "text").toLowerCase(), et = etiquetaCampo(e);
      if (tipo === "checkbox" || e.getAttribute("role") === "checkbox") return "Casilla " + (e.checked ? "marcada" : "sin marcar") + ": " + et;
      if (tipo === "radio") return "Opción " + (e.checked ? "elegida" : "no elegida") + ": " + et;
      if (tipo === "submit" || tipo === "button") return "Botón: " + (e.value || et);
      return "Campo de texto, " + et + (e.value ? ": " + e.value : ", vacío");
    }
    if (n === "SELECT") return "Lista desplegable, " + etiquetaCampo(e) + ": " + (e.options[e.selectedIndex] ? e.options[e.selectedIndex].text : "");
    if (n === "TEXTAREA") return "Área de texto, " + etiquetaCampo(e) + (e.value ? ": " + e.value.slice(0, 200) : ", vacía");
    if (n === "IMG") return "Imagen: " + e.alt;
    if (n === "SUMMARY") return "Desplegable " + (e.parentElement && e.parentElement.open ? "abierto" : "cerrado") + ": " + t;
    if (n === "LI") return "Elemento de lista: " + t;
    if (n === "TD" || n === "TH") return "Celda: " + t;
    return t;
  }
  function anunciar(texto) { decirVoz(texto, true, true); decir(texto.slice(0, 120)); }
  function irLector(e, texto) {
    if (lectorEl) lectorEl.classList.remove("wcl-lector");
    lectorEl = e; e.classList.add("wcl-lector");
    try { e.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (x) { e.scrollIntoView(); }
    if (e.tabIndex >= 0 || /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.tagName)) { try { e.focus({ preventScroll: true }); } catch (x) {} }
    anunciar(texto || describir(e));
  }
  function moverLector(paso, filtro, nombre) {
    var lista = filtro ? bloquesLector(filtro) : (lectorLista = bloquesLector());
    if (!lista.length) { anunciar("No hay " + (nombre || "contenido") + " en esta página."); return; }
    var i = lectorEl ? lista.indexOf(lectorEl) : -1;
    if (i < 0 && lectorEl) {   // el elemento actual no está en esta lista: se busca el siguiente en el orden del documento
      for (var k = 0; k < lista.length; k++) if (lectorEl.compareDocumentPosition(lista[k]) & Node.DOCUMENT_POSITION_FOLLOWING) { i = paso > 0 ? k - 1 : k; break; }
      if (i < 0 && k === lista.length) i = paso > 0 ? -1 : lista.length;
    }
    var j = i + paso;
    if (j < 0) { anunciar("Principio de la página. " + describir(lista[0])); irLector(lista[0]); return; }
    if (j >= lista.length) { anunciar("Final de la página."); return; }
    irLector(lista[j]);
  }
  var FILTROS_LECTOR = {
    h: [function (e) { return /^H[1-6]$/.test(e.tagName); }, "encabezados"],
    l: [function (e) { return e.tagName === "A" || e.getAttribute("role") === "link"; }, "enlaces"],
    b: [function (e) { return e.tagName === "BUTTON" || e.getAttribute("role") === "button" || (e.tagName === "INPUT" && /^(submit|button)$/i.test(e.type)); }, "botones"],
    f: [function (e) { return /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && !/^(submit|button|hidden)$/i.test(e.type || ""); }, "campos de formulario"],
    i: [function (e) { return e.tagName === "IMG"; }, "imágenes"]
  };
  function activarLector(si) {
    if (si) {
      var enc = bloquesLector(FILTROS_LECTOR.h[0]).length, enl = bloquesLector(FILTROS_LECTOR.l[0]).length;
      lectorEl = null; lectorLista = bloquesLector();
      anunciar("Lector de pantalla de Winclus activado. " + (document.title || "Página") + ". " + enc + " encabezados y " + enl + " enlaces. Flecha abajo para leer, h para encabezados, l para enlaces, Intro para activar, F1 para ayuda.");
    } else { if (lectorEl) lectorEl.classList.remove("wcl-lector"); lectorEl = null; callar(); }
  }
  document.addEventListener("focusin", function (e) {
    if (!ajustes.lector || !e.target || e.target.closest(".wcl-root") || e.target === lectorEl) return;
    lectorEl = e.target; anunciar(describir(e.target));
  });
  document.addEventListener("keydown", function (e) {
    if (!ajustes.lector || e.ctrlKey || e.altKey || e.metaKey) return;
    var act = document.activeElement;
    if (esEditable(act) && e.key !== "Escape" && e.key !== "F1") return;   // escribiendo: el teclado es para el campo
    var k = e.key, paso = e.shiftKey ? -1 : 1, hecho = true;
    if (k === "ArrowDown") moverLector(1); else if (k === "ArrowUp") moverLector(-1);
    else if (k === "Home") { var l0 = bloquesLector(); if (l0.length) irLector(l0[0]); }
    else if (k === "End") { var l1 = bloquesLector(); if (l1.length) irLector(l1[l1.length - 1]); }
    else if (FILTROS_LECTOR[k.toLowerCase()] && k.length === 1) { var f = FILTROS_LECTOR[k.toLowerCase()]; moverLector(paso, f[0], f[1]); }
    else if (k === "Enter" && lectorEl && !esEditable(lectorEl)) {
      if (lectorEl.tagName === "SUMMARY") lectorEl.click(); else despachar(lectorEl.closest(SEL_CLICABLE) || lectorEl, ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);
      setTimeout(function () { if (lectorEl) anunciar(describir(lectorEl)); }, 300);
    }
    else if (k === " " && lectorEl) anunciar(describir(lectorEl));
    else if (k === "Escape") callar();
    else if (k === "F1" || k === "?") anunciar("Flecha abajo y arriba leen el contenido. h encabezados, l enlaces, b botones, f campos, i imágenes; con Mayús hacia atrás. Intro activa lo leído, Espacio lo repite, Escape calla. Tabulador recorre los enlaces y botones como siempre.");
    else hecho = false;
    if (hecho) e.preventDefault();
  }, true);

  // --- panel: controles nuevos --------------------------------------------
  var sec7 = seccion("Colores y calma");
  sec7.appendChild(filaOpc("dalton", "Corrección de color para daltonismo", [["no", "Ninguna"], ["protan", "Protanopia (rojo)"], ["deutan", "Deuteranopia (verde)"], ["tritan", "Tritanopia (azul)"], ["gris", "Escala de grises"]], aplicarClases));
  sec7.appendChild(filaSw("calma", "Modo calma: sin destellos, animaciones ni vídeos que arranquen solos", aplicarClases));
  tabs.ver.appendChild(sec7);
  var sec8 = seccion("Leer con menos esfuerzo");
  sec8.appendChild(filaSw("lupa_pantalla", "Lupa de pantalla: agranda la página alrededor del puntero", aplicarLupaPantalla));
  sec8.appendChild(filaPaso("lupa_pantalla_zoom", "Aumento de la lupa de pantalla", 2, 8, 1, function (n) { return "×" + n; }, aplicarLupaPantalla));
  sec8.appendChild(botonGrande("Lectura limpia: solo el texto, grande", "azul", lecturaLimpia));
  sec8.appendChild(filaSw("mascara", "Máscara de enfoque: oscurece todo menos una franja", aplicarClases));
  sec8.appendChild(filaSw("dislexia", "Letras y palabras más separadas", aplicarClases));
  sec8.appendChild(filaSw("sinimg", "Atenuar imágenes y vídeos", aplicarClases));
  tabs.ver.appendChild(sec8);
  var sec9 = seccion("Lector de pantalla");
  sec9.appendChild(el("div", { "class": "wcl-estado" }, "Para personas ciegas o con muy poca visión: lee la página con voz y se maneja con el teclado (↓ ↑ leen, h encabezados, l enlaces, b botones, f campos, Intro activa, F1 ayuda)."));
  sec9.appendChild(filaSw("lector", "Lector de pantalla activado", activarLector));
  tabs.oir.appendChild(sec9);
  var sec10 = seccion("Modo fácil");
  sec10.appendChild(el("div", { "class": "wcl-estado" }, "Un panel con solo seis botones grandes, para quien se pierde con tantas opciones."));
  sec10.appendChild(filaSw("facil", "Modo fácil", function () { refrescos.forEach(function (f) { f(); }); }));
  tabs.mas.appendChild(sec10);
  var facilEl = el("div", { "class": "wcl-facil" });
  facilEl.appendChild(botonGrande("🔊 Leer la página", "suave", leerPagina));
  facilEl.appendChild(botonGrande("🔇 Callar", "suave", callar));
  facilEl.appendChild(botonGrande("A+ Texto más grande", "suave", function () { ajustes.texto = Math.min(200, ajustes.texto + 10); aplicarTexto(); guardar(); }));
  facilEl.appendChild(botonGrande("◐ Alto contraste", "suave", function () { ajustes.contraste = !ajustes.contraste; guardar(); aplicarTodo(); }));
  facilEl.appendChild(botonGrande("📖 Lectura limpia", "suave", lecturaLimpia));
  facilEl.appendChild(botonGrande("🔍 Lupa de pantalla", "suave", function () { ajustes.lupa_pantalla = !ajustes.lupa_pantalla; guardar(); aplicarLupaPantalla(); refrescos.forEach(function (f) { f(); }); }));
  if (opciones.camara) facilEl.appendChild(botonGrande("📷 Usar con la cara", "", function () { if (!camaraActiva) activarCamara(); else desactivarCamara(); }));
  facilEl.appendChild(botonGrande("Ver todas las opciones", "azul", function () { ajustes.facil = false; guardar(); refrescos.forEach(function (f) { f(); }); }));
  panel.appendChild(facilEl);
  refrescos.push(function () { panel.classList.toggle("facil", !!ajustes.facil); });

  // Mostrar solo los ajustes del modo elegido
  function visibilidad() {
    var modo = ajustes.modo_puntero === "ojos" ? ajustes.ojos_modo : "cabeza", clic = ajustes.modo_clic;
    var gs = panel.querySelectorAll("[data-cuando]");
    for (var i = 0; i < gs.length; i++) {
      var c = gs[i].dataset.cuando.split(" "), ver = c.indexOf("ojos") >= 0 ? ajustes.modo_puntero === "ojos" : (c.indexOf(modo) >= 0 || c.indexOf(clic) >= 0);
      gs[i].style.display = ver ? "" : "none";
    }
  }
  refrescos.push(visibilidad);

  // ------------------------------------------------------- aplicar --
  function aplicarClases() {
    raiz.classList.toggle("wcl-oscuro", ajustes.oscuro);
    raiz.classList.toggle("wcl-enlaces", ajustes.enlaces);
    raiz.classList.toggle("wcl-anim", ajustes.animaciones);
    raiz.classList.toggle("wcl-dislexia", ajustes.dislexia);
    raiz.classList.toggle("wcl-sinimg", ajustes.sinimg);
    guia.style.display = ajustes.guia ? "block" : "none";
    var f = [];
    if (ajustes.contraste) f.push("contrast(1.35) saturate(1.15)");
    if (ajustes.oscuro) f.push("invert(1) hue-rotate(180deg)");
    if (ajustes.calma) f.push("saturate(.7) brightness(.93)");
    if (ajustes.dalton && ajustes.dalton !== "no") f.push("url(#wcl-f-" + ajustes.dalton + ")");
    raiz.style.filter = f.join(" ");
    aplicarCalma(!!ajustes.calma); aplicarLupaPantalla();
    mascaraArriba.style.display = mascaraAbajo.style.display = ajustes.mascara ? "block" : "none";
    if (ajustes.mascara) actualizarMascara(P.y);
  }
  function aplicarTexto() { raiz.style.fontSize = ajustes.texto === 100 ? "" : ajustes.texto + "%"; refrescos.forEach(function (f) { f(); }); }
  function aplicarTodo() { aplicarClases(); raiz.style.fontSize = ajustes.texto === 100 ? "" : ajustes.texto + "%"; refrescos.forEach(function (f) { f(); }); }

  function abrir(si) {
    panel.classList.toggle("abierto", si);
    boton.setAttribute("aria-expanded", si ? "true" : "false");
    if (si) { refrescos.forEach(function (f) { f(); }); if (!camaraActiva) q(".wcl-cab button").focus(); }
  }
  boton.addEventListener("click", function () { abrir(!panel.classList.contains("abierto")); });
  q(".wcl-cab button").addEventListener("click", function () { abrir(false); if (!camaraActiva) boton.focus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("abierto") && !calibrando) { abrir(false); boton.focus(); } });
  document.addEventListener("mousemove", function (e) { if (ajustes.guia && !camaraActiva) guia.style.top = e.clientY + "px"; });
  window.addEventListener("pagehide", function () { if (camaraActiva) desactivarCamara(); });
  window.addEventListener("resize", function () { if (tecVisible) dibujarTeclado(); });

  function montar() {
    cont.appendChild(FILTROS); cont.appendChild(mascaraArriba); cont.appendChild(mascaraAbajo);
    cont.appendChild(guia); cont.appendChild(boton); cont.appendChild(btnPausa); cont.appendChild(panel);
    cont.appendChild(tecEl); cont.appendChild(menuEl); cont.appendChild(cursor); cont.appendChild(aviso); cont.appendChild(calibEl);
    raiz.appendChild(cont);
    var t = "ver"; try { t = sessionStorage.getItem("winclus.tab") || "ver"; } catch (e) {}
    elegirTab(tabs[t] ? t : "ver");
    aplicarTodo();
    if (ajustes.lector) setTimeout(function () { activarLector(true); }, 800);
  }
  if (document.body) montar(); else document.addEventListener("DOMContentLoaded", montar);

  window.Winclus = {
    version: VERSION, ajustes: ajustes,
    abrir: function () { abrir(true); }, cerrar: function () { abrir(false); },
    activarCamara: function () { if (!camaraActiva) activarCamara(); }, desactivarCamara: function () { if (camaraActiva) desactivarCamara(); },
    pausar: pausar, teclado: alternarTeclado, menu: function () { if (camaraActiva) abrirMenu(); }, leer: leerPagina, decir: function (t) { decirVoz(t, true, true); }, orden: ejecutarOrden,
    // Para pruebas e integraciones: llevar el puntero virtual a un punto y hacer el gesto de clic
    mover: function (x, y) { cursor.style.display = "block"; mover(x, y); }, clic: clic, puntero: P,
    cargarDetector: cargarDetector, deteccion: det, parpadeo: parpadeo
  };
})();
