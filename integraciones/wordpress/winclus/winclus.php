<?php
/**
 * Plugin Name: Winclus
 * Plugin URI:  https://winclus.com
 * Description: Añade a tu sitio el widget de accesibilidad Winclus: uso con la cara, la voz, un solo pulsador, teclado en pantalla, pictogramas y ajustes de lectura y color. Sin cuentas ni servidores propios.
 * Version:     0.6.13
 * Author:      Colaboradores de Winclus
 * License:     Apache-2.0
 * Text Domain: winclus
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

define( 'WINCLUS_VERSION_WIDGET', '0.6.13' );
define( 'WINCLUS_SRI_WIDGET', 'sha384-jNJF5O8PcPpQTX2+jystS43m6toT0wDm9E0p5E7OBJCewMGkRCeNBs01FdhBvkGx' );   // hash de integridad de la versión fija (winclus.com/integrar)

function winclus_opciones() {
	return wp_parse_args( get_option( 'winclus_opciones', array() ), array(
		'posicion' => 'derecha',
		'camara'   => 'si',
		'idioma'   => 'es-CO',
		'relevo'   => 'si',
		'explicar' => '',
		'version'  => 'fija',   // «fija»: widget-0.6.13.js (no cambia solo); «ultima»: widget.js
	) );
}

function winclus_encolar() {
	$o   = winclus_opciones();
	$src = 'https://winclus.com/' . ( 'ultima' === $o['version'] ? 'widget.js' : 'widget-' . WINCLUS_VERSION_WIDGET . '.js' );
	wp_enqueue_script( 'winclus', $src, array(), null, true );
	wp_script_add_data( 'winclus', 'async', true );
}
add_action( 'wp_enqueue_scripts', 'winclus_encolar' );

// Versión fija: el navegador comprueba el hash del archivo (integridad de subrecursos) antes de ejecutarlo.
function winclus_integridad( $tag, $handle ) {
	if ( 'winclus' !== $handle ) { return $tag; }
	$o = winclus_opciones();
	if ( 'ultima' === $o['version'] ) { return $tag; }
	return str_replace( ' src=', ' integrity="' . esc_attr( WINCLUS_SRI_WIDGET ) . '" crossorigin="anonymous" src=', $tag );
}
add_filter( 'script_loader_tag', 'winclus_integridad', 10, 2 );

// Los atributos data-* del <script> (posición, cámara, idioma…) y async
function winclus_atributos( $tag, $handle ) {
	if ( 'winclus' !== $handle ) { return $tag; }
	$o     = winclus_opciones();
	$attrs = ' async data-posicion="' . esc_attr( $o['posicion'] ) . '" data-idioma="' . esc_attr( $o['idioma'] ) . '"';
	if ( 'no' === $o['camara'] ) { $attrs .= ' data-camara="no"'; }
	if ( 'no' === $o['relevo'] ) { $attrs .= ' data-relevo="no"'; }
	if ( ! empty( $o['explicar'] ) ) { $attrs .= ' data-explicar="' . esc_url( $o['explicar'] ) . '"'; }
	return str_replace( ' src=', $attrs . ' src=', $tag );
}
add_filter( 'script_loader_tag', 'winclus_atributos', 10, 2 );

// Página de ajustes: Ajustes → Winclus
function winclus_menu() {
	add_options_page( 'Winclus', 'Winclus', 'manage_options', 'winclus', 'winclus_pagina_ajustes' );
}
add_action( 'admin_menu', 'winclus_menu' );

function winclus_registrar_ajustes() {
	register_setting( 'winclus', 'winclus_opciones', array( 'sanitize_callback' => 'winclus_sanear' ) );
}
add_action( 'admin_init', 'winclus_registrar_ajustes' );

function winclus_sanear( $in ) {
	$o = winclus_opciones();
	$o['posicion'] = ( isset( $in['posicion'] ) && 'izquierda' === $in['posicion'] ) ? 'izquierda' : 'derecha';
	$o['camara']   = ( isset( $in['camara'] ) && 'no' === $in['camara'] ) ? 'no' : 'si';
	$o['relevo']   = ( isset( $in['relevo'] ) && 'no' === $in['relevo'] ) ? 'no' : 'si';
	$o['version']  = ( isset( $in['version'] ) && 'ultima' === $in['version'] ) ? 'ultima' : 'fija';
	$o['idioma']   = isset( $in['idioma'] ) ? preg_replace( '/[^a-zA-Z-]/', '', $in['idioma'] ) : 'es-CO';
	$o['explicar'] = isset( $in['explicar'] ) ? esc_url_raw( $in['explicar'] ) : '';
	return $o;
}

function winclus_pagina_ajustes() {
	$o = winclus_opciones();
	?>
	<div class="wrap">
		<h1>Winclus</h1>
		<p>El widget se carga en todas las páginas del sitio. Los visitantes lo abren con el botón flotante; sus ajustes se guardan en su propio navegador. Winclus es tecnología de apoyo: no sustituye la accesibilidad del propio sitio.</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'winclus' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><label for="winclus-posicion">Posición del botón</label></th><td><select id="winclus-posicion" name="winclus_opciones[posicion]"><option value="derecha" <?php selected( $o['posicion'], 'derecha' ); ?>>Derecha</option><option value="izquierda" <?php selected( $o['posicion'], 'izquierda' ); ?>>Izquierda</option></select></td></tr>
				<tr><th scope="row">Cámara (puntero con la cara)</th><td><label><input type="radio" name="winclus_opciones[camara]" value="si" <?php checked( $o['camara'], 'si' ); ?>> Permitir</label> &nbsp; <label><input type="radio" name="winclus_opciones[camara]" value="no" <?php checked( $o['camara'], 'no' ); ?>> No ofrecer</label></td></tr>
				<tr><th scope="row"><label for="winclus-idioma">Idioma del reconocimiento de voz</label></th><td><input id="winclus-idioma" name="winclus_opciones[idioma]" value="<?php echo esc_attr( $o['idioma'] ); ?>" class="regular-text"> <span class="description">es-CO, es-MX, es-ES, en-US…</span></td></tr>
				<tr><th scope="row">Botón al Centro de Relevo (Colombia)</th><td><label><input type="radio" name="winclus_opciones[relevo]" value="si" <?php checked( $o['relevo'], 'si' ); ?>> Mostrar</label> &nbsp; <label><input type="radio" name="winclus_opciones[relevo]" value="no" <?php checked( $o['relevo'], 'no' ); ?>> Ocultar</label></td></tr>
				<tr><th scope="row"><label for="winclus-explicar">Servicio de lectura fácil con IA (opcional)</label></th><td><input id="winclus-explicar" name="winclus_opciones[explicar]" value="<?php echo esc_attr( $o['explicar'] ); ?>" class="regular-text" placeholder="https://…"> <span class="description">URL que reciba POST {texto, idioma} y devuelva {texto}. Sin ella, la lectura fácil funciona por reglas.</span></td></tr>
				<tr><th scope="row">Versión del widget</th><td><label><input type="radio" name="winclus_opciones[version]" value="fija" <?php checked( $o['version'], 'fija' ); ?>> Fija (<?php echo esc_html( WINCLUS_VERSION_WIDGET ); ?>): no cambia hasta que actualices el plugin</label><br><label><input type="radio" name="winclus_opciones[version]" value="ultima" <?php checked( $o['version'], 'ultima' ); ?>> Siempre la última de winclus.com</label></td></tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<p>Declaración de accesibilidad y política de datos del widget: <a href="https://winclus.com/accesibilidad">winclus.com/accesibilidad</a> · <a href="https://winclus.com/privacidad">winclus.com/privacidad</a>.</p>
	</div>
	<?php
}
