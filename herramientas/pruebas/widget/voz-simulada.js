// Se inyecta antes de la página (addInitScript) cuando el motor no trae síntesis de voz (WebKit de Playwright en
// Windows): una speechSynthesis mínima para que las pruebas puedan sustituir speak() y contar lo dicho.
if (!window.speechSynthesis) {
  window.speechSynthesis = { speak: function () {}, cancel: function () {}, pause: function () {}, resume: function () {}, getVoices: function () { return []; }, speaking: false, pending: false, paused: false, onvoiceschanged: null, addEventListener: function () {}, removeEventListener: function () {} };
  window.SpeechSynthesisUtterance = function (t) { this.text = t || ""; this.lang = ""; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onend = this.onerror = this.onstart = this.onboundary = null; };
}
