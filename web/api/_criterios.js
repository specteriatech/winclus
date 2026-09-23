// Generado desde herramientas/pruebas/widget/auditar.js (CRITERIOS_1519): no editar a mano.
const CRITERIOS_1519 = {
 "CC1 Alternativa texto para elementos no textuales": [
  "captcha",
  "image-alt",
  "input-image-alt",
  "area-alt",
  "object-alt",
  "svg-img-alt",
  "role-img-alt",
  "image-redundant-alt"
 ],
 "CC2 Complemento para vídeos o elementos multimedia": [
  "video-caption",
  "audio-caption",
  "video-description"
 ],
 "CC3 Guion para solo vídeo y solo audio": [
  "transcripcion"
 ],
 "CC4 Textos e imágenes ampliables y en tamaños adecuados": [
  "zoom-200",
  "meta-viewport",
  "meta-viewport-large"
 ],
 "CC5 Contraste de color suficiente en textos e imágenes": [
  "color-contrast",
  "color-contrast-enhanced",
  "link-in-text-block"
 ],
 "CC6 Imágenes alternas al texto cuando sea posible": [],
 "CC7 Identificación coherente": [
  "identificacion-coherente"
 ],
 "CC8 Todo documento y página organizado en secciones": [
  "heading-order",
  "empty-heading",
  "page-has-heading-one",
  "landmark-one-main",
  "region",
  "landmark-unique",
  "landmark-no-duplicate-banner",
  "landmark-no-duplicate-contentinfo"
 ],
 "CC9 Contenedores como tablas y listas usados correctamente": [
  "list",
  "listitem",
  "definition-list",
  "dlitem",
  "table-duplicate-name",
  "table-fake-caption",
  "td-headers-attr",
  "th-has-data-cells",
  "scope-attr-valid",
  "empty-table-header",
  "lista-de-uno"
 ],
 "CC10 Permitir saltar bloques que se repiten": [
  "bypass",
  "skip-link"
 ],
 "CC11 Lenguaje de marcado bien utilizado": [
  "duplicate-id",
  "duplicate-id-active",
  "duplicate-id-aria",
  "marcado-sin-cerrar"
 ],
 "CC12 Permitir encontrar las páginas por múltiples vías": [
  "multiples-vias"
 ],
 "CC13 Navegación coherente": [
  "navegacion-coherente"
 ],
 "CC14 Orden adecuado de los contenidos si es significativo": [
  "tabindex",
  "focus-order-semantics"
 ],
 "CC15 Advertencias bien ubicadas": [],
 "CC16 Orden adecuado de los elementos al navegar con tabulación": [
  "tabindex"
 ],
 "CC17 Foco visible al navegar con tabulación": [
  "foco-visible"
 ],
 "CC18 No utilizar audio automático": [
  "no-autoplay-audio"
 ],
 "CC19 Permitir control de eventos temporizados": [
  "tiempo-sesion",
  "meta-refresh-no-exceptions"
 ],
 "CC20 Permitir control de contenidos con movimiento y parpadeo": [
  "blink",
  "marquee"
 ],
 "CC21 No generar actualización automática de páginas": [
  "meta-refresh"
 ],
 "CC22 No generar cambios automáticos al recibir el foco o entradas": [
  "cambio-al-foco"
 ],
 "CC23 Utilice textos adecuados en títulos, páginas y secciones": [
  "document-title",
  "titulo-repetido",
  "frame-title",
  "frame-title-unique"
 ],
 "CC24 Utilice nombres e indicaciones claras en campos de formulario": [
  "label",
  "label-title-only",
  "form-field-multiple-labels",
  "select-name",
  "input-button-name",
  "autocomplete-valid"
 ],
 "CC25 Utilice instrucciones expresas y claras": [],
 "CC26 Enlaces adecuados": [
  "link-name",
  "enlace-vago"
 ],
 "CC27 Idioma": [
  "html-has-lang",
  "html-lang-valid",
  "valid-lang",
  "html-xml-lang-mismatch"
 ],
 "CC28 Manejo del error": [],
 "CC29 Imágenes de texto": [
  "captcha-imagen",
  "image-redundant-alt"
 ],
 "CC30 Objetos programados": [
  "aria-*",
  "aria-allowed-attr",
  "aria-required-attr",
  "aria-valid-attr",
  "aria-valid-attr-value",
  "aria-roles",
  "aria-hidden-focus",
  "nested-interactive",
  "button-name",
  "scrollable-region-focusable"
 ],
 "CC31 Desde una letra hasta un elemento complejo utilizable": [
  "charset-utf8"
 ],
 "CC32 Manejable por teclado": [
  "no-keyboard-trap",
  "accesskeys",
  "focusable-content"
 ],
 "Declaración de accesibilidad (Res. 1519, 2.2.1)": [
  "declaracion"
 ]
};
function criterioDe(id) { for (const c in CRITERIOS_1519) if (CRITERIOS_1519[c].some((r) => r === id || (r.endsWith("*") && id.startsWith(r.slice(0, -1))))) return c; return "Otros criterios WCAG"; }
module.exports = { CRITERIOS_1519, criterioDe };
