<?php
/**
 * System - Winclus: carga el widget de accesibilidad Winclus en todas las páginas del sitio (Joomla 4 y 5).
 * Licencia Apache 2.0. https://winclus.com/plataformas
 */
defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\Plugin\CMSPlugin;

class PlgSystemWinclus extends CMSPlugin
{
    const VERSION_WIDGET = '0.7.0';
    const SRI_WIDGET = 'sha384-X6BhT2D8uzD69hh0/hrNpePgzss68qUW8xPUT5Fj67x2JEocCSpFSasD43BnZUdn';

    /** Solo en el sitio (no en la administración) y solo en páginas HTML. */
    public function onBeforeCompileHead()
    {
        $app = Factory::getApplication();
        if ($app->isClient('administrator')) {
            return;
        }
        $doc = $app->getDocument();
        if ($doc->getType() !== 'html') {
            return;
        }
        $fija = $this->params->get('version', 'ultima') === 'fija';
        $src = 'https://winclus.com/' . ($fija ? 'widget-' . self::VERSION_WIDGET . '.js' : 'widget.js');
        $attrs = [
            'async' => true,
            'data-posicion' => $this->params->get('posicion', 'derecha'),
            'data-idioma' => preg_replace('/[^a-zA-Z-]/', '', $this->params->get('idioma', 'es-CO')),
        ];
        if ($this->params->get('camara', 'si') === 'no') {
            $attrs['data-camara'] = 'no';
        }
        if ($this->params->get('relevo', 'si') === 'no') {
            $attrs['data-relevo'] = 'no';
        }
        if ($this->params->get('arreglos', 'si') === 'no') {
            $attrs['data-arreglos'] = 'no';
        }
        $explicar = trim((string) $this->params->get('explicar', ''));
        if ($explicar !== '' && filter_var($explicar, FILTER_VALIDATE_URL)) {
            $attrs['data-explicar'] = $explicar;
        }
        if ($fija) {
            $attrs['integrity'] = self::SRI_WIDGET;
            $attrs['crossorigin'] = 'anonymous';
        }
        $doc->addScript($src, [], $attrs);
    }
}
