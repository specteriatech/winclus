<?php
/**
 * Winclus para PrestaShop 1.7 y 8: carga el widget de accesibilidad en todas las páginas de la tienda.
 * Licencia Apache 2.0. https://winclus.com/plataformas
 */
if (!defined('_PS_VERSION_')) {
    exit;
}

class Winclus extends Module
{
    const VERSION_WIDGET = '0.8.0';
    const SRI_WIDGET = 'sha384-agbdf84tq/QjFTn0MV2UAKTXh8ISlaWIoMuTUctnPnFTR20Akt1tsvSGAXUcoxSH';

    public function __construct()
    {
        $this->name = 'winclus';
        $this->tab = 'front_office_features';
        $this->version = '0.8.0';
        $this->author = 'Colaboradores de Winclus';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = ['min' => '1.7.0.0', 'max' => _PS_VERSION_];
        $this->bootstrap = true;
        parent::__construct();
        $this->displayName = $this->l('Winclus');
        $this->description = $this->l('Widget de accesibilidad: uso con la cara, la voz, un solo pulsador, teclado en pantalla, pictogramas, lectura y color, y arreglos al vuelo para lectores de pantalla. Sin cuentas ni servidores propios.');
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('displayBeforeBodyClosingTag')
            && Configuration::updateValue('WINCLUS_POSICION', 'derecha')
            && Configuration::updateValue('WINCLUS_CAMARA', 'si')
            && Configuration::updateValue('WINCLUS_IDIOMA', 'es-CO')
            && Configuration::updateValue('WINCLUS_ARREGLOS', 'si')
            && Configuration::updateValue('WINCLUS_VERSION', 'ultima');
    }

    public function uninstall()
    {
        foreach (['WINCLUS_POSICION', 'WINCLUS_CAMARA', 'WINCLUS_IDIOMA', 'WINCLUS_ARREGLOS', 'WINCLUS_VERSION'] as $k) {
            Configuration::deleteByName($k);
        }
        return parent::uninstall();
    }

    public function hookDisplayBeforeBodyClosingTag($params)
    {
        $fija = Configuration::get('WINCLUS_VERSION') === 'fija';
        $src = 'https://winclus.com/' . ($fija ? 'widget-' . self::VERSION_WIDGET . '.js' : 'widget.js');
        $attrs = ' async data-posicion="' . htmlspecialchars(Configuration::get('WINCLUS_POSICION') ?: 'derecha') . '"'
            . ' data-idioma="' . htmlspecialchars(preg_replace('/[^a-zA-Z-]/', '', Configuration::get('WINCLUS_IDIOMA') ?: 'es-CO')) . '"';
        if (Configuration::get('WINCLUS_CAMARA') === 'no') {
            $attrs .= ' data-camara="no"';
        }
        if (Configuration::get('WINCLUS_ARREGLOS') === 'no') {
            $attrs .= ' data-arreglos="no"';
        }
        if ($fija) {
            $attrs .= ' integrity="' . self::SRI_WIDGET . '" crossorigin="anonymous"';
        }
        return '<script src="' . $src . '"' . $attrs . '></script>';
    }

    public function getContent()
    {
        $salida = '';
        if (Tools::isSubmit('guardarWinclus')) {
            Configuration::updateValue('WINCLUS_POSICION', Tools::getValue('WINCLUS_POSICION') === 'izquierda' ? 'izquierda' : 'derecha');
            Configuration::updateValue('WINCLUS_CAMARA', Tools::getValue('WINCLUS_CAMARA') === 'no' ? 'no' : 'si');
            Configuration::updateValue('WINCLUS_ARREGLOS', Tools::getValue('WINCLUS_ARREGLOS') === 'no' ? 'no' : 'si');
            Configuration::updateValue('WINCLUS_IDIOMA', preg_replace('/[^a-zA-Z-]/', '', Tools::getValue('WINCLUS_IDIOMA')) ?: 'es-CO');
            Configuration::updateValue('WINCLUS_VERSION', Tools::getValue('WINCLUS_VERSION') === 'fija' ? 'fija' : 'ultima');
            $salida .= $this->displayConfirmation($this->l('Ajustes guardados.'));
        }
        $helper = new HelperForm();
        $helper->module = $this;
        $helper->name_controller = $this->name;
        $helper->token = Tools::getAdminTokenLite('AdminModules');
        $helper->currentIndex = AdminController::$currentIndex . '&configure=' . $this->name;
        $helper->submit_action = 'guardarWinclus';
        $helper->fields_value = [
            'WINCLUS_POSICION' => Configuration::get('WINCLUS_POSICION'),
            'WINCLUS_CAMARA' => Configuration::get('WINCLUS_CAMARA'),
            'WINCLUS_ARREGLOS' => Configuration::get('WINCLUS_ARREGLOS'),
            'WINCLUS_IDIOMA' => Configuration::get('WINCLUS_IDIOMA'),
            'WINCLUS_VERSION' => Configuration::get('WINCLUS_VERSION'),
        ];
        $sino = [['id' => 'si', 'name' => $this->l('Sí')], ['id' => 'no', 'name' => $this->l('No')]];
        $form = [['form' => [
            'legend' => ['title' => 'Winclus'],
            'description' => $this->l('El widget se carga en todas las páginas. Es tecnología de apoyo: no sustituye la accesibilidad de la propia tienda.'),
            'input' => [
                ['type' => 'select', 'label' => $this->l('Posición del botón'), 'name' => 'WINCLUS_POSICION', 'options' => ['query' => [['id' => 'derecha', 'name' => $this->l('Derecha')], ['id' => 'izquierda', 'name' => $this->l('Izquierda')]], 'id' => 'id', 'name' => 'name']],
                ['type' => 'select', 'label' => $this->l('Cámara (puntero con la cara)'), 'name' => 'WINCLUS_CAMARA', 'options' => ['query' => $sino, 'id' => 'id', 'name' => 'name']],
                ['type' => 'select', 'label' => $this->l('Arreglos al vuelo (alt, nombres, etiquetas, foco)'), 'name' => 'WINCLUS_ARREGLOS', 'options' => ['query' => $sino, 'id' => 'id', 'name' => 'name']],
                ['type' => 'text', 'label' => $this->l('Idioma del reconocimiento de voz'), 'name' => 'WINCLUS_IDIOMA', 'desc' => 'es-CO, es-MX, es-ES, en-US…'],
                ['type' => 'select', 'label' => $this->l('Versión del widget'), 'name' => 'WINCLUS_VERSION', 'options' => ['query' => [['id' => 'ultima', 'name' => $this->l('Siempre la última (recomendado)')], ['id' => 'fija', 'name' => $this->l('Fija ' . self::VERSION_WIDGET . ' con integridad SRI')]], 'id' => 'id', 'name' => 'name']],
            ],
            'submit' => ['title' => $this->l('Guardar')],
        ]]];
        return $salida . $helper->generateForm($form);
    }
}
