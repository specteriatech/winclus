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
  var CDN_MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22";
  var MODELO = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  var CLAVE = "winclus.ajustes";
  var raiz = document.documentElement;

  // ------------------------------------------------------------ ajustes --
  var ajustes = { texto: 100, contraste: false, oscuro: false, enlaces: false, animaciones: false,
                  lectura: false, guia: false, dwell: false, velocidad: 3 };
  try { var g = JSON.parse(localStorage.getItem(CLAVE)); if (g) for (var k in g) if (k in ajustes) ajustes[k] = g[k]; } catch (e) {}
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch (e) {} }

  // -------------------------------------------------------------- estilo --
  var LOGO = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 22 34 78" stroke="#2F4FD8" stroke-width="20" stroke-linecap="round"/><path d="M42 30 62 82" stroke="#1AA89A" stroke-width="18" stroke-linecap="round"/><path d="M80 52 72 76" stroke="#34C26B" stroke-width="15" stroke-linecap="round"/><circle cx="76" cy="30" r="10" fill="#6B4FC2"/></svg>';
  var css = ''
    + '.wcl-btn{position:fixed;bottom:22px;' + (opciones.posicion === "izquierda" ? "left" : "right") + ':22px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;background:' + opciones.color + ';box-shadow:0 8px 24px rgba(16,31,61,.35);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}'
    + '.wcl-btn svg{width:34px;height:34px}.wcl-btn:focus-visible{outline:3px solid #F2B705;outline-offset:3px}'
    + '.wcl-panel{position:fixed;bottom:92px;' + (opciones.posicion === "izquierda" ? "left" : "right") + ':22px;z-index:2147483001;width:340px;max-width:calc(100vw - 32px);max-height:calc(100vh - 120px);overflow:auto;background:#fff;color:#101F3D;border-radius:18px;box-shadow:0 18px 60px rgba(16,31,61,.28);font:15px/1.45 "Segoe UI",system-ui,sans-serif;display:none}'
    + '.wcl-panel.abierto{display:block}'
    + '.wcl-cab{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#101F3D;color:#fff;border-radius:18px 18px 0 0;position:sticky;top:0}'
    + '.wcl-cab svg{width:26px;height:26px}.wcl-cab b{flex:1;font-size:16px}.wcl-cab button{background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;width:36px;height:36px;border-radius:8px}.wcl-cab button:hover{background:rgba(255,255,255,.15)}'
    + '.wcl-sec{padding:12px 16px;border-bottom:1px solid #E3E8F0}.wcl-sec h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#5A6784}'
    + '.wcl-fila{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0}'
    + '.wcl-sw{position:relative;width:46px;height:26px;border-radius:999px;background:#C8D0DC;border:0;cursor:pointer;flex:none;padding:0}.wcl-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}.wcl-sw[aria-checked="true"]{background:#1AA89A}.wcl-sw[aria-checked="true"]::after{left:23px}.wcl-sw:focus-visible{outline:3px solid #F2B705;outline-offset:2px}'
    + '.wcl-mm{display:flex;gap:6px;align-items:center}.wcl-mm button{width:40px;height:36px;border-radius:10px;border:1px solid #C8D0DC;background:#fff;font-size:18px;cursor:pointer;color:#101F3D}.wcl-mm span{min-width:48px;text-align:center;font-weight:600}'
    + '.wcl-cam{display:flex;flex-direction:column;gap:8px}.wcl-cam .wcl-estado{font-size:13px;color:#5A6784;min-height:18px}'
    + '.wcl-big{width:100%;min-height:46px;border-radius:12px;border:0;background:#34C26B;color:#101F3D;font-weight:700;font-size:15px;cursor:pointer}.wcl-big.rojo{background:#F2B705}'
    + '.wcl-pie{padding:12px 16px;font-size:13px;color:#5A6784}.wcl-pie a{color:#2F4FD8}'
    + 'input.wcl-rango{width:110px;accent-color:#1AA89A}'
    + '.wcl-cursor{position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #2F4FD8;background:rgba(47,79,216,.18);z-index:2147483002;pointer-events:none;display:none;box-sizing:border-box}'
    + '.wcl-cursor::after{content:"";position:absolute;left:11px;top:11px;width:6px;height:6px;border-radius:50%;background:#2F4FD8}'
    + '.wcl-cursor.clic{background:rgba(52,194,107,.5);border-color:#34C26B}'
    + '.wcl-cursor .wcl-anillo{position:absolute;inset:-6px;border-radius:50%;border:4px solid #34C26B;clip-path:inset(0 0 0 0);display:none}'
    + '.wcl-guia{position:fixed;left:0;right:0;height:38px;margin-top:-19px;background:rgba(242,183,5,.18);border-top:2px solid #F2B705;border-bottom:2px solid #F2B705;pointer-events:none;z-index:2147482999;display:none}'
    + '.wcl-video{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px}'
    + 'html.wcl-contraste{filter:contrast(1.35) saturate(1.15)}'
    + 'html.wcl-oscuro{filter:invert(1) hue-rotate(180deg)}html.wcl-oscuro img,html.wcl-oscuro video,html.wcl-oscuro .wcl-panel,html.wcl-oscuro .wcl-btn{filter:invert(1) hue-rotate(180deg)}'
    + 'html.wcl-enlaces a{outline:3px solid #F2B705!important;outline-offset:2px;text-decoration:underline!important;background:rgba(242,183,5,.18)!important}'
    + 'html.wcl-anim *{animation-play-state:paused!important;transition:none!important;scroll-behavior:auto!important}'
    + '.wcl-leyendo{outline:3px solid #1AA89A!important;outline-offset:2px}';
  var estilo = document.createElement("style"); estilo.textContent = css; document.head.appendChild(estilo);

  // ----------------------------------------------------------------- DOM --
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  var boton = el("button", { "class": "wcl-btn", "aria-label": "Abrir accesibilidad Winclus", "aria-expanded": "false", "type": "button" }, LOGO);
  var panel = el("div", { "class": "wcl-panel", "role": "dialog", "aria-label": "Accesibilidad Winclus" });
  var cursor = el("div", { "class": "wcl-cursor", "aria-hidden": "true" });
  var guia = el("div", { "class": "wcl-guia", "aria-hidden": "true" });

  function fila(etiqueta, id, tipo) {
    var f = el("div", { "class": "wcl-fila" });
    f.appendChild(el("label", { "for": id }, etiqueta));
    if (tipo === "sw") {
      var sw = el("button", { "class": "wcl-sw", "role": "switch", "aria-checked": "false", "id": id, "type": "button" });
      f.appendChild(sw);
    }
    return f;
  }

  panel.innerHTML = '<div class="wcl-cab">' + LOGO + '<b>Winclus</b><button type="button" aria-label="Cerrar">×</button></div>';
  var sec1 = el("div", { "class": "wcl-sec" }, "<h4>Ver mejor</h4>");
  var fTexto = el("div", { "class": "wcl-fila" }, '<span id="wcl-texto-l">Tamaño del texto</span><div class="wcl-mm" role="group" aria-labelledby="wcl-texto-l"><button type="button" aria-label="Texto más pequeño">−</button><span id="wcl-texto-v">100%</span><button type="button" aria-label="Texto más grande">+</button></div>');
  sec1.appendChild(fTexto);
  sec1.appendChild(fila("Alto contraste", "wcl-contraste", "sw"));
  sec1.appendChild(fila("Modo oscuro", "wcl-oscuro", "sw"));
  sec1.appendChild(fila("Resaltar enlaces", "wcl-enlaces", "sw"));
  sec1.appendChild(fila("Guía de lectura", "wcl-guia", "sw"));
  sec1.appendChild(fila("Pausar animaciones", "wcl-animaciones", "sw"));
  var sec2 = el("div", { "class": "wcl-sec" }, "<h4>Escuchar</h4>");
  sec2.appendChild(fila("Leer en voz alta al hacer clic", "wcl-lectura", "sw"));
  var fLeer = el("div", { "class": "wcl-fila" }, '<button type="button" class="wcl-big" id="wcl-leer-pagina" style="background:#E8F7F3">Leer la página</button>');
  sec2.appendChild(fLeer);
  var sec3 = el("div", { "class": "wcl-sec wcl-cam" }, "<h4>Usar con la cara</h4>");
  if (opciones.camara) {
    sec3.appendChild(el("div", { "class": "wcl-estado", "id": "wcl-estado", "aria-live": "polite" }, "Mueve el puntero con la cabeza y haz clic con un parpadeo. Se usa tu cámara aquí mismo: nada sale de tu equipo."));
    sec3.appendChild(el("button", { "type": "button", "class": "wcl-big", "id": "wcl-activar" }, "Activar cámara"));
    var fVel = el("div", { "class": "wcl-fila" }, '<label for="wcl-vel">Velocidad</label><input class="wcl-rango" type="range" id="wcl-vel" min="1" max="6" step="1">');
    sec3.appendChild(fVel);
    sec3.appendChild(fila("Clic al quedarte quieto", "wcl-dwell", "sw"));
    sec3.appendChild(el("div", { "class": "wcl-estado" }, "Parpadeo: clic · Boca abierta: bajar · Cejas arriba: subir"));
  } else {
    sec3.appendChild(el("div", { "class": "wcl-estado" }, "El control con la cámara está desactivado en esta página."));
  }
  var pie = el("div", { "class": "wcl-pie" }, '¿Quieres controlar todo el ordenador con la cara? <a href="https://winclus.com" target="_blank" rel="noopener">Descarga Winclus para Windows</a>, gratis.');
  panel.appendChild(sec1); panel.appendChild(sec2); panel.appendChild(sec3); panel.appendChild(pie);

  function montar() {
    document.body.appendChild(boton); document.body.appendChild(panel);
    document.body.appendChild(cursor); document.body.appendChild(guia);
    aplicarTodo();
  }
  if (document.body) montar(); else document.addEventListener("DOMContentLoaded", montar);

  // ------------------------------------------------------------- panel --
  function abrir(si) {
    panel.classList.toggle("abierto", si);
    boton.setAttribute("aria-expanded", si ? "true" : "false");
    if (si) panel.querySelector(".wcl-cab button").focus();
  }
  boton.addEventListener("click", function () { abrir(!panel.classList.contains("abierto")); });
  panel.querySelector(".wcl-cab button").addEventListener("click", function () { abrir(false); boton.focus(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel.classList.contains("abierto")) { abrir(false); boton.focus(); } });

  function sw(id) { return panel.querySelector("#" + id); }
  function ponerSw(id, valor) { var s = sw(id); if (s) s.setAttribute("aria-checked", valor ? "true" : "false"); }
  function enlazarSw(id, clave, alCambiar) {
    var s = sw(id); if (!s) return;
    s.addEventListener("click", function () {
      ajustes[clave] = !ajustes[clave]; ponerSw(id, ajustes[clave]); guardar();
      if (alCambiar) alCambiar(ajustes[clave]);
    });
  }
  function aplicarClases() {
    raiz.classList.toggle("wcl-contraste", ajustes.contraste);
    raiz.classList.toggle("wcl-oscuro", ajustes.oscuro);
    raiz.classList.toggle("wcl-enlaces", ajustes.enlaces);
    raiz.classList.toggle("wcl-anim", ajustes.animaciones);
    guia.style.display = ajustes.guia ? "block" : "none";
  }
  function aplicarTexto() {
    raiz.style.fontSize = ajustes.texto === 100 ? "" : ajustes.texto + "%";
    panel.querySelector("#wcl-texto-v").textContent = ajustes.texto + "%";
  }
  function aplicarTodo() {
    aplicarClases(); aplicarTexto();
    ["contraste", "oscuro", "enlaces", "guia", "animaciones", "lectura", "dwell"].forEach(function (c) { ponerSw("wcl-" + c, ajustes[c]); });
    var v = panel.querySelector("#wcl-vel"); if (v) v.value = ajustes.velocidad;
  }
  enlazarSw("wcl-contraste", "contraste", aplicarClases);
  enlazarSw("wcl-oscuro", "oscuro", aplicarClases);
  enlazarSw("wcl-enlaces", "enlaces", aplicarClases);
  enlazarSw("wcl-guia", "guia", aplicarClases);
  enlazarSw("wcl-animaciones", "animaciones", aplicarClases);
  enlazarSw("wcl-lectura", "lectura");
  enlazarSw("wcl-dwell", "dwell");
  var mm = fTexto.querySelectorAll("button");
  mm[0].addEventListener("click", function () { ajustes.texto = Math.max(80, ajustes.texto - 10); aplicarTexto(); guardar(); });
  mm[1].addEventListener("click", function () { ajustes.texto = Math.min(200, ajustes.texto + 10); aplicarTexto(); guardar(); });
  var rango = panel.querySelector("#wcl-vel");
  if (rango) rango.addEventListener("input", function () { ajustes.velocidad = +rango.value; guardar(); });

  document.addEventListener("mousemove", function (e) { if (ajustes.guia && !camaraActiva) guia.style.top = e.clientY + "px"; });

  // --------------------------------------------------------------- voz --
  var leyendo = null;
  function leer(texto) {
    if (!("speechSynthesis" in window) || !texto) return;
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = document.documentElement.lang || "es";
    var voces = window.speechSynthesis.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf("es") === 0; });
    if (voces.length) u.voice = voces[0];
    window.speechSynthesis.speak(u);
  }
  function leerElemento(elm) {
    if (!elm) return;
    var bloque = elm.closest("p,h1,h2,h3,h4,h5,h6,li,td,th,a,button,label,figcaption,blockquote,summary,dd,dt") || elm;
    if (bloque.closest(".wcl-panel")) return;
    if (leyendo) leyendo.classList.remove("wcl-leyendo");
    leyendo = bloque; bloque.classList.add("wcl-leyendo");
    leer((bloque.innerText || bloque.textContent || "").trim().slice(0, 2000));
  }
  document.addEventListener("click", function (e) { if (ajustes.lectura && !e.target.closest(".wcl-panel,.wcl-btn")) leerElemento(e.target); }, true);
  panel.querySelector("#wcl-leer-pagina").addEventListener("click", function () {
    var m = document.querySelector("main,article,[role=main]") || document.body;
    var texto = (m.innerText || "").replace(/\s+/g, " ").trim().slice(0, 15000);
    leer(texto || "La página no tiene texto que leer.");
  });

  // ------------------------------------------------- puntero con la cara --
  var camaraActiva = false, video, flujo, landmarker, animando = false, ultimoT = -1;
  var estado = panel.querySelector("#wcl-estado");
  var btnActivar = panel.querySelector("#wcl-activar");
  var px = window.innerWidth / 2, py = window.innerHeight / 2, base = null;
  var cerrados = 0, bocaDesde = 0, cejasDesde = 0, quietoDesde = 0, quietoX = 0, quietoY = 0, ultimoClic = 0;

  function decir(t) { if (estado) estado.textContent = t; }

  function activarCamara() {
    if (camaraActiva) { desactivarCamara(); return; }
    btnActivar.disabled = true; decir("Cargando el detector de cara…");
    cargarDetector().then(function () {
      return navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
    }).then(function (f) {
      flujo = f;
      video = video || el("video", { "class": "wcl-video", "playsinline": "", "muted": "", "autoplay": "" });
      document.body.appendChild(video);
      video.srcObject = f;
      return video.play();
    }).then(function () {
      camaraActiva = true; base = null; animando = true;
      btnActivar.textContent = "Desactivar cámara"; btnActivar.classList.add("rojo"); btnActivar.disabled = false;
      cursor.style.display = "block"; mover(px, py);
      decir("Cámara activa. Mira al centro un momento: el puntero sigue tu cabeza.");
      requestAnimationFrame(bucle);
    }).catch(function (err) {
      btnActivar.disabled = false;
      decir("No se pudo activar: " + (err && err.message ? err.message : err));
    });
  }
  function desactivarCamara() {
    camaraActiva = false; animando = false;
    if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; }
    cursor.style.display = "none";
    btnActivar.textContent = "Activar cámara"; btnActivar.classList.remove("rojo");
    decir("Cámara apagada.");
  }
  if (btnActivar) btnActivar.addEventListener("click", activarCamara);

  function cargarDetector() {
    if (landmarker) return Promise.resolve();
    return import(CDN_MP + "/vision_bundle.mjs").then(function (mp) {
      return mp.FilesetResolver.forVisionTasks(CDN_MP + "/wasm").then(function (fs) {
        return mp.FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: MODELO, delegate: "GPU" },
          runningMode: "VIDEO", numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: false
        });
      });
    }).then(function (lm) { landmarker = lm; });
  }

  function mover(x, y) {
    px = Math.max(0, Math.min(window.innerWidth - 1, x));
    py = Math.max(0, Math.min(window.innerHeight - 1, y));
    cursor.style.transform = "translate(" + px + "px," + py + "px)";
    if (ajustes.guia) guia.style.top = py + "px";
  }

  function bucle() {
    if (!animando) return;
    var t = performance.now();
    if (video.readyState >= 2 && t !== ultimoT) {
      ultimoT = t;
      var r = landmarker.detectForVideo(video, t);
      if (r && r.faceLandmarks && r.faceLandmarks.length) procesar(r, t);
      else decirSuave("No veo tu cara. Ponte frente a la cámara con luz de frente.");
    }
    requestAnimationFrame(bucle);
  }
  var ultimoAviso = 0;
  function decirSuave(t) { var ahora = performance.now(); if (ahora - ultimoAviso > 1500) { ultimoAviso = ahora; decir(t); } }

  function forma(r, nombre) {
    var cats = r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories;
    if (!cats) return 0;
    for (var i = 0; i < cats.length; i++) if (cats[i].categoryName === nombre) return cats[i].score;
    return 0;
  }

  function procesar(r, t) {
    var lm = r.faceLandmarks[0];
    var nariz = lm[1];                 // punta de la nariz
    if (!base) { base = { x: nariz.x, y: nariz.y }; decir("Listo. Mueve la cabeza para mover el puntero y parpadea para hacer clic."); }
    // La imagen de la cámara está espejada: mover la cabeza a la derecha debe llevar el puntero a la derecha
    var gan = 1400 + ajustes.velocidad * 900;
    var dx = (base.x - nariz.x) * gan, dy = (nariz.y - base.y) * gan * 1.15;
    var objX = window.innerWidth / 2 + dx, objY = window.innerHeight / 2 + dy;
    var suav = 0.32;
    mover(px + (objX - px) * suav, py + (objY - py) * suav);

    // Parpadeo (los dos ojos) entre 120 y 700 ms: clic
    var ojos = (forma(r, "eyeBlinkLeft") + forma(r, "eyeBlinkRight")) / 2;
    if (ojos > 0.55) { if (!cerrados) cerrados = t; }
    else if (cerrados) {
      var dur = t - cerrados; cerrados = 0;
      if (dur > 120 && dur < 700 && t - ultimoClic > 500) clic();
    }
    // Boca abierta mantenida: bajar; cejas arriba mantenidas: subir
    if (forma(r, "jawOpen") > 0.5) { if (!bocaDesde) bocaDesde = t; if (t - bocaDesde > 250) window.scrollBy(0, 6); } else bocaDesde = 0;
    if (forma(r, "browInnerUp") > 0.65) { if (!cejasDesde) cejasDesde = t; if (t - cejasDesde > 250) window.scrollBy(0, -6); } else cejasDesde = 0;

    // Quedarse quieto: clic (si está activado)
    if (ajustes.dwell) {
      if (Math.abs(px - quietoX) > 14 || Math.abs(py - quietoY) > 14) { quietoX = px; quietoY = py; quietoDesde = t; }
      else if (t - quietoDesde > 1100 && t - ultimoClic > 1500) { quietoDesde = t; clic(); }
    }
  }

  function clic() {
    ultimoClic = performance.now();
    cursor.classList.add("clic"); setTimeout(function () { cursor.classList.remove("clic"); }, 220);
    var objetivo = document.elementFromPoint(px, py);
    if (!objetivo) return;
    if (objetivo.closest && objetivo.closest(".wcl-cursor,.wcl-guia")) return;
    var interactivo = objetivo.closest ? objetivo.closest("a,button,input,select,textarea,summary,label,[role=button],[onclick],[tabindex]") : null;
    var el2 = interactivo || objetivo;
    if (el2.focus) try { el2.focus({ preventScroll: true }); } catch (e) {}
    if (ajustes.lectura && !interactivo) { leerElemento(objetivo); return; }
    ["mousedown", "mouseup", "click"].forEach(function (tipo) {
      el2.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: px, clientY: py, view: window }));
    });
  }

  window.addEventListener("pagehide", function () { if (camaraActiva) desactivarCamara(); });

  window.Winclus = { version: "0.1.0", abrir: function () { abrir(true); }, cerrar: function () { abrir(false); }, ajustes: ajustes };
})();
