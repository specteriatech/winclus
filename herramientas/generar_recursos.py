"""Genera los recursos gráficos propios de Winclus.

Crea el logo e icono (a partir de assets/images/logo_fuente), los avisos que se dibujan sobre la imagen de la cámara,
los iconos del menú (versión clara y oscura), el globo de ayuda, el botón de
perfil y el tema de customtkinter
(assets/themes/tema.json) a partir de los colores de src/estilo.py.

Se ejecuta una vez y el resultado se guarda en el repositorio:

    .venv\\Scripts\\python.exe herramientas\\generar_recursos.py
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import customtkinter  # noqa: E402

from src import estilo  # noqa: E402

IMAGENES = RAIZ / "assets" / "images"
AVISOS = IMAGENES / "avisos"
ICONOS = IMAGENES / "iconos"
TEMA = RAIZ / "assets" / "themes" / "tema.json"

BLANCO = (255, 255, 255)


def rgb(hexa: str):
    hexa = hexa.lstrip("#")
    return tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4))


def fuente(tamano: int, negrita: bool = True) -> ImageFont.FreeTypeFont:
    """Segoe UI viene con Windows 10/11; si no está, se usa la fuente por defecto."""
    nombres = ["segoeuib.ttf", "seguisb.ttf"] if negrita else ["segoeui.ttf"]
    for n in nombres:
        try:
            return ImageFont.truetype(n, tamano)
        except OSError:
            continue
    return ImageFont.load_default()


# ------------------------------------------------------------------ Avisos --
def aviso(nombre: str, texto: str, color, simbolo: str) -> None:
    """Franja de 640x108 sobre fondo blanco de 640x480, como los avisos originales."""
    im = Image.new("RGBA", (640, 480), BLANCO + (255,))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 640, 108], fill=color + (255,))
    f = fuente(30)
    ancho = d.textlength(texto, font=f)
    x_texto = (640 - ancho) / 2 + 22
    d.text((x_texto, 54), texto, font=f, fill=BLANCO, anchor="lm")
    sx = int(x_texto) - 60
    if simbolo == "check":
        d.line([(sx, 56), (sx + 12, 68), (sx + 34, 40)], fill=BLANCO, width=5)
    elif simbolo == "alerta":
        d.polygon([(sx + 17, 34), (sx + 36, 70), (sx - 2, 70)], outline=BLANCO, width=4)
        d.line([(sx + 17, 46), (sx + 17, 58)], fill=BLANCO, width=4)
        d.ellipse([sx + 15, 61, sx + 19, 65], fill=BLANCO)
    elif simbolo == "pausa":
        d.rectangle([sx + 6, 38, sx + 14, 70], fill=BLANCO)
        d.rectangle([sx + 22, 38, sx + 30, 70], fill=BLANCO)
    AVISOS.mkdir(parents=True, exist_ok=True)
    im.save(AVISOS / nombre)


# ------------------------------------------------------------------- Logo --
# Marca Winclus (winclus.com): una «W» de tres cápsulas inclinadas (azul,
# teal y verde) con un punto morado. El original del usuario está en
# logo_fuente/winclus_logo_original.png sobre fondo negro con resplandor; de
# ahí se midieron las formas y aquí se dibujan limpias, sin fondo.
LOGO_FUENTE = IMAGENES / "logo_fuente"
MARCA_NAVY = (16, 31, 61)             # fondo del icono
# (p1, p2, radio, color en p1, color en p2), coordenadas del original 1536x1024;
# el emblema ocupa el recorte que empieza en ORIGEN y mide 480x420.
ORIGEN = (40, 320)
CAPSULAS = [
    ((465, 515), (438, 640), 42, (70, 224, 120), (120, 232, 120)),   # verde corta, detrás
    ((114, 400), (205, 680), 68, (10, 60, 170), (26, 140, 255)),     # azul
    ((282, 412), (378, 690), 62, (20, 200, 165), (32, 200, 105)),    # teal → verde
]
PUNTO = ((437, 430), 55, (110, 70, 235), (150, 120, 255))


def _capsula(n, p1, p2, r, c1, c2, k):
    """Cápsula con degradado de c1 (en p1) a c2 (en p2), como capa RGBA."""
    import numpy as np
    from PIL import ImageFilter
    (x1, y1), (x2, y2) = [((x - ORIGEN[0]) * k, (y - ORIGEN[1]) * k) for x, y in (p1, p2)]
    r *= k
    mascara = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(mascara)
    d.line([(x1, y1), (x2, y2)], fill=255, width=int(2 * r))
    for x, y in ((x1, y1), (x2, y2)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    mascara = mascara.filter(ImageFilter.GaussianBlur(1))
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    dx, dy = x2 - x1, y2 - y1
    t = np.clip(((xx - x1) * dx + (yy - y1) * dy) / (dx * dx + dy * dy), 0, 1)
    rgb = np.stack([c1[i] + (c2[i] - c1[i]) * t for i in range(3)], axis=-1)
    capa = np.dstack([rgb, np.asarray(mascara, dtype=np.float32)]).astype(np.uint8)
    return Image.fromarray(capa)


def emblema(n: int = 1024) -> Image.Image:
    """Dibuja la W de Winclus en un lienzo cuadrado transparente."""
    k = n / 480.0
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    for p1, p2, r, c1, c2 in CAPSULAS:
        capa = _capsula(n, p1, p2, r, c1, c2, k)
        im.alpha_composite(capa)
    (cx, cy), r, c1, c2 = PUNTO
    # El punto: degradado vertical de c1 (abajo) a c2 (arriba)
    capa = _capsula(n, (cx, cy + r * 0.8), (cx, cy - r * 0.8), r * 0.2, c1, c2, k)
    mascara = Image.new("L", (n, n), 0)
    ox, oy = cx - ORIGEN[0], cy - ORIGEN[1]
    ImageDraw.Draw(mascara).ellipse([(ox - r) * k, (oy - r) * k, (ox + r) * k, (oy + r) * k], fill=255)
    capa.putalpha(mascara)
    im.alpha_composite(capa)
    return _recortar(im).resize((n, n), Image.LANCZOS)


def _recortar(im: Image.Image, margen: int = 16) -> Image.Image:
    """Recorta al contenido y lo centra en un cuadrado con un margen."""
    caja = im.getbbox()
    im = im.crop(caja)
    lado = max(im.size) + 2 * margen
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    lienzo.paste(im, ((lado - im.width) // 2, (lado - im.height) // 2))
    return lienzo


def logo() -> None:
    """Logo de Winclus: el mismo emblema en claro y oscuro, el icono .ico y un PNG."""
    w = emblema()
    w.resize((256, 256), Image.LANCZOS).save(IMAGENES / "logo_winclus_claro.png")
    w.resize((256, 256), Image.LANCZOS).save(IMAGENES / "logo_winclus_oscuro.png")
    # Icono: la W sobre un cuadrado azul marino redondeado
    n = 1024
    ico = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(ico).rounded_rectangle([0, 0, n - 1, n - 1], radius=n // 5, fill=MARCA_NAVY + (255,))
    g = w.resize((int(n * 0.74), int(n * 0.74)), Image.LANCZOS)
    ico.paste(g, ((n - g.width) // 2, (n - g.height) // 2), g)
    ico = ico.resize((256, 256), Image.LANCZOS)
    ico.save(IMAGENES / "icono.png")
    ico.save(IMAGENES / "icono.ico",
             sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    # Versiones grandes para la web (landing)
    web = RAIZ / "web" / "img"
    web.mkdir(parents=True, exist_ok=True)
    w.resize((512, 512), Image.LANCZOS).save(web / "logo.png")
    w.resize((512, 512), Image.LANCZOS).save(web / "logo_blanco.png")
    ico.save(web / "icono.png")


# ---------------------------------------------------------- Iconos del menú --
def _lienzo(n=96):
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def dibujar_icono(nombre: str, color) -> Image.Image:
    """Iconos sencillos de línea gruesa, dibujados a 96 px y reducidos después."""
    c = color + (255,)
    im, d = _lienzo()
    g = 9  # grosor de línea
    if nombre == "casa":
        d.polygon([(48, 14), (86, 48), (10, 48)], outline=c, width=g)
        d.rectangle([20, 46, 76, 84], outline=c, width=g)
        d.rectangle([40, 60, 56, 84], fill=c)
    elif nombre == "camara":
        d.rounded_rectangle([8, 28, 88, 80], radius=12, outline=c, width=g)
        d.rectangle([32, 16, 64, 30], fill=c)
        d.ellipse([34, 40, 62, 68], outline=c, width=g)
    elif nombre == "puntero":
        d.polygon([(22, 10), (22, 78), (40, 62), (52, 88), (66, 82), (54, 56), (76, 54)],
                  fill=c)
    elif nombre == "clic":
        d.ellipse([10, 10, 86, 86], outline=c, width=g)
        d.ellipse([34, 34, 62, 62], fill=c)
    elif nombre == "teclado":
        d.rounded_rectangle([6, 24, 90, 76], radius=10, outline=c, width=g)
        for fila, y in enumerate((36, 50)):
            for x in range(20, 80, 14):
                d.rectangle([x + fila * 4, y, x + 8 + fila * 4, y + 8], fill=c)
        d.rectangle([28, 62, 68, 68], fill=c)
    elif nombre == "sol":
        d.ellipse([30, 30, 66, 66], outline=c, width=g)
        for (x1, y1, x2, y2) in [(48, 6, 48, 20), (48, 76, 48, 90), (6, 48, 20, 48),
                                 (76, 48, 90, 48), (18, 18, 28, 28), (68, 68, 78, 78),
                                 (18, 78, 28, 68), (68, 28, 78, 18)]:
            d.line([(x1, y1), (x2, y2)], fill=c, width=g)
    elif nombre == "luna":
        d.ellipse([12, 12, 84, 84], fill=c)
        d.ellipse([30, 2, 100, 72], fill=(0, 0, 0, 0))
    elif nombre == "perfil":
        d.ellipse([32, 10, 64, 42], outline=c, width=g)
        d.arc([14, 44, 82, 112], start=180, end=360, fill=c, width=g)
    elif nombre == "flecha_abajo":
        d.line([(26, 38), (48, 60), (70, 38)], fill=c, width=g, joint="curve")
    elif nombre == "ojo":
        # Ojo abierto con iris: forma de almendra
        d.line([(6, 48), (30, 22), (66, 22), (90, 48)], fill=c, width=g, joint="curve")
        d.line([(6, 48), (30, 74), (66, 74), (90, 48)], fill=c, width=g, joint="curve")
        d.ellipse([34, 34, 62, 62], outline=c, width=g)
        d.ellipse([43, 43, 53, 53], fill=c)
    elif nombre == "boca":
        # Boca abierta: labio superior e inferior separados
        d.arc([10, 18, 86, 62], start=200, end=340, fill=c, width=g)
        d.arc([10, 34, 86, 90], start=20, end=160, fill=c, width=g)
        d.line([(14, 44), (14, 58)], fill=c, width=g)
        d.line([(82, 44), (82, 58)], fill=c, width=g)
    elif nombre == "cejas":
        # Dos cejas arqueadas sobre dos ojos
        d.arc([6, 14, 44, 44], start=200, end=340, fill=c, width=g)
        d.arc([52, 14, 90, 44], start=200, end=340, fill=c, width=g)
        d.ellipse([14, 54, 36, 76], outline=c, width=g)
        d.ellipse([60, 54, 82, 76], outline=c, width=g)
    elif nombre == "reloj":
        d.ellipse([10, 10, 86, 86], outline=c, width=g)
        d.line([(48, 26), (48, 50), (64, 60)], fill=c, width=g, joint="curve")
    elif nombre == "escribir":
        # Lápiz inclinado sobre una línea de texto
        d.line([(24, 72), (70, 26)], fill=c, width=14)
        d.polygon([(18, 78), (30, 76), (20, 66)], fill=c)
        d.line([(62, 18), (78, 34)], fill=c, width=g)
        d.line([(12, 88), (86, 88)], fill=c, width=g)
    elif nombre == "asistente":
        # Destello de cuatro puntas con una chispa pequeña: «magia»
        d.polygon([(40, 8), (48, 34), (74, 42), (48, 50), (40, 76), (32, 50), (6, 42), (32, 34)], fill=c)
        d.polygon([(74, 58), (78, 70), (90, 74), (78, 78), (74, 90), (70, 78), (58, 74), (70, 70)], fill=c)
    elif nombre == "cabeza":
        # Cabeza de perfil con flechas de movimiento a los lados
        d.ellipse([28, 10, 68, 50], outline=c, width=g)
        d.arc([16, 44, 80, 108], start=180, end=360, fill=c, width=g)
        d.line([(6, 30), (16, 30)], fill=c, width=g)
        d.line([(80, 30), (90, 30)], fill=c, width=g)
        d.polygon([(2, 30), (12, 22), (12, 38)], fill=c)
        d.polygon([(94, 30), (84, 22), (84, 38)], fill=c)
    return im.resize((48, 48), Image.LANCZOS)


def iconos_menu() -> None:
    ICONOS.mkdir(parents=True, exist_ok=True)
    for nombre in ["casa", "camara", "puntero", "clic", "teclado", "sol", "luna",
                   "perfil", "flecha_abajo", "ojo", "boca", "cejas", "reloj", "cabeza",
                   "escribir", "asistente"]:
        dibujar_icono(nombre, rgb(estilo.TEXTO[0])).save(ICONOS / f"{nombre}_claro.png")
        dibujar_icono(nombre, rgb(estilo.TEXTO[1])).save(ICONOS / f"{nombre}_oscuro.png")


def dibujo_subir_cejas() -> None:
    """Dibujo «Subir las cejas» para el desplegable de gestos: mitad izquierda
    del dibujo de la ceja izquierda y mitad derecha del de la ceja derecha,
    con lo que las dos cejas quedan levantadas."""
    carpeta = IMAGENES / "dropdowns"
    izq = Image.open(carpeta / "subir_ceja_izquierda.png").convert("RGBA")
    der = Image.open(carpeta / "subir_ceja_derecha.png").convert("RGBA")
    ancho, alto = izq.size
    # Se elige de cada dibujo la mitad donde la ceja está levantada
    def mitad_levantada(im):
        px = im.load()
        # la ceja levantada deja más píxeles oscuros en la franja alta de su mitad
        cuenta = [0, 0]
        for x in range(ancho):
            for y in range(alto // 3):
                r, g, b, a = px[x, y]
                if a > 100 and (r + g + b) < 400:
                    cuenta[0 if x < ancho // 2 else 1] += 1
        return 0 if cuenta[0] >= cuenta[1] else 1
    fuente_izq = izq if mitad_levantada(izq) == 0 else der
    fuente_der = der if mitad_levantada(der) == 1 else izq
    im = fuente_izq.copy()
    im.paste(fuente_der.crop((ancho // 2, 0, ancho, alto)), (ancho // 2, 0))
    im.save(carpeta / "subir_cejas.png")


def dibujos_gestos_nuevos() -> None:
    """Dibujos de 68×48 para los gestos que calcula Winclus (guiños e inclinación
    de la cabeza): una cara sencilla con el ojo cerrado o la cabeza ladeada."""
    carpeta = IMAGENES / "dropdowns"
    oscuro = rgb(estilo.TEXTO[0]) if hasattr(estilo, "TEXTO") else (16, 31, 61)

    def cara(guino=None, inclinacion=0):
        n = 4   # se dibuja grande y se reduce: bordes suaves
        im = Image.new("RGBA", (68 * n, 48 * n), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        cx, cy, r = 34 * n, 25 * n, 19 * n
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=oscuro, width=3 * n)
        for lado, ox in (("izq", -8 * n), ("der", 8 * n)):
            ex, ey = cx + ox, cy - 4 * n
            if guino == lado:
                d.line((ex - 4 * n, ey, ex + 4 * n, ey), fill=oscuro, width=3 * n)      # ojo cerrado: una raya
            else:
                d.ellipse((ex - 3 * n, ey - 3 * n, ex + 3 * n, ey + 3 * n), fill=oscuro)
        d.arc((cx - 9 * n, cy + 2 * n, cx + 9 * n, cy + 12 * n), 10, 170, fill=oscuro, width=3 * n)   # sonrisa
        if inclinacion:
            im = im.rotate(inclinacion, resample=Image.BICUBIC, center=(cx, cy))
        return im.resize((68, 48), Image.LANCZOS)

    cara(guino="izq").save(carpeta / "guino_izquierdo.png")
    cara(guino="der").save(carpeta / "guino_derecho.png")
    cara(inclinacion=22).save(carpeta / "cabeza_izquierda.png")     # la cabeza cae hacia la izquierda de la imagen
    cara(inclinacion=-22).save(carpeta / "cabeza_derecha.png")


# ------------------------------------------------------- Globo de ayuda --
def globo() -> None:
    """Globo de ayuda 305x80: caja clara con borde y una puntita a la izquierda."""
    for sufijo, fondo, borde in [("claro", estilo.TARJETA[0], estilo.BORDE[0]),
                                 ("oscuro", estilo.TARJETA[1], estilo.BORDE[1])]:
        im = Image.new("RGBA", (305, 80), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([12, 2, 302, 77], radius=12, fill=rgb(fondo) + (255,),
                            outline=rgb(borde) + (255,), width=2)
        d.polygon([(2, 20), (14, 10), (14, 30)], fill=rgb(fondo) + (255,),
                  outline=rgb(borde) + (255,))
        im.save(IMAGENES / f"globo_{sufijo}.png")


# ---------------------------------------------------- Botón de perfil --
def boton_perfil() -> None:
    """Fondo del selector de perfil (660x120): caja con borde y flecha."""
    for sufijo, fondo, borde, texto in [
            ("claro", estilo.TARJETA[0], estilo.BORDE[0], estilo.TEXTO[0]),
            ("oscuro", estilo.TARJETA[1], estilo.BORDE[1], estilo.TEXTO[1])]:
        im = Image.new("RGBA", (660, 120), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([3, 3, 657, 117], radius=30, fill=rgb(fondo) + (255,),
                            outline=rgb(borde) + (255,), width=4)
        d.line([(590, 50), (610, 70), (630, 50)], fill=rgb(texto) + (255,), width=6)
        im.save(IMAGENES / f"perfil_fondo_{sufijo}.png")


# La ilustración de inicio (assets/images/inicio_ilustracion.png) es una imagen
# aportada por el proyecto, con el fondo ya transparente; no se genera aquí.


# -------------------------------------------------------------------- Tema --
def tema() -> None:
    """Tema de customtkinter con los colores de estilo.py, partiendo del tema
    'blue' instalado para no olvidar ninguna clave."""
    base = Path(customtkinter.__file__).parent / "assets" / "themes" / "blue.json"
    with open(base, encoding="utf-8") as f:
        d = json.load(f)
    E = estilo
    cambios = {
        "CTk": {"fg_color": E.FONDO},
        "CTkToplevel": {"fg_color": E.FONDO},
        "CTkFrame": {"corner_radius": 16, "border_width": 0, "fg_color": E.TARJETA,
                     "top_fg_color": E.TARJETA, "border_color": E.BORDE},
        "CTkButton": {"corner_radius": 12, "border_width": 0, "fg_color": E.PRIMARIO,
                      "hover_color": E.PRIMARIO_HOVER, "border_color": E.BORDE,
                      "text_color": E.TEXTO_SOBRE_PRIMARIO,
                      "text_color_disabled": E.TEXTO_SUAVE},
        "CTkLabel": {"corner_radius": 0, "fg_color": "transparent", "text_color": E.TEXTO},
        "CTkEntry": {"corner_radius": 10, "border_width": 2, "fg_color": E.TARJETA,
                     "border_color": E.BORDE, "text_color": E.TEXTO,
                     "placeholder_text_color": E.TEXTO_SUAVE},
        "CTkCheckBox": {"corner_radius": 6, "border_width": 3, "fg_color": E.PRIMARIO,
                        "border_color": E.TEXTO_SUAVE, "hover_color": E.PRIMARIO_HOVER,
                        "checkmark_color": E.TEXTO_SOBRE_PRIMARIO, "text_color": E.TEXTO,
                        "text_color_disabled": E.TEXTO_SUAVE},
        "CTkSwitch": {"corner_radius": 1000, "border_width": 3, "button_length": 0,
                      "fg_color": E.BORDE, "progress_color": E.PRIMARIO,
                      "button_color": E.TARJETA, "button_hover_color": E.PRIMARIO_SUAVE,
                      "text_color": E.TEXTO, "text_color_disabled": E.TEXTO_SUAVE},
        "CTkRadioButton": {"corner_radius": 1000, "border_width_checked": 7,
                           "border_width_unchecked": 3, "fg_color": E.PRIMARIO,
                           "border_color": E.TEXTO_SUAVE, "hover_color": E.PRIMARIO_HOVER,
                           "text_color": E.TEXTO, "text_color_disabled": E.TEXTO_SUAVE},
        "CTkProgressBar": {"corner_radius": 1000, "border_width": 0, "fg_color": E.BORDE,
                           "progress_color": E.PRIMARIO, "border_color": E.BORDE},
        "CTkSlider": {"corner_radius": 1000, "button_corner_radius": 1000, "border_width": 6,
                      "button_length": 0, "fg_color": E.BORDE, "progress_color": E.PRIMARIO_SUAVE,
                      "button_color": E.PRIMARIO, "button_hover_color": E.PRIMARIO_HOVER},
        "CTkOptionMenu": {"corner_radius": 10, "fg_color": E.TARJETA,
                          "button_color": E.PRIMARIO_SUAVE, "button_hover_color": E.BORDE,
                          "text_color": E.TEXTO, "text_color_disabled": E.TEXTO_SUAVE},
        "CTkComboBox": {"corner_radius": 10, "border_width": 2, "fg_color": E.TARJETA,
                        "border_color": E.BORDE, "button_color": E.PRIMARIO_SUAVE,
                        "button_hover_color": E.BORDE, "text_color": E.TEXTO,
                        "text_color_disabled": E.TEXTO_SUAVE},
        "CTkScrollbar": {"corner_radius": 1000, "border_spacing": 4, "fg_color": "transparent",
                         "button_color": E.BORDE, "button_hover_color": E.TEXTO_SUAVE},
        "CTkSegmentedButton": {"corner_radius": 10, "border_width": 2, "fg_color": E.BORDE,
                               "selected_color": E.PRIMARIO, "selected_hover_color": E.PRIMARIO_HOVER,
                               "unselected_color": E.TARJETA, "unselected_hover_color": E.PRIMARIO_SUAVE,
                               "text_color": E.TEXTO, "text_color_disabled": E.TEXTO_SUAVE},
        "CTkTextbox": {"corner_radius": 10, "border_width": 2, "fg_color": E.TARJETA,
                       "border_color": E.BORDE, "text_color": E.TEXTO,
                       "scrollbar_button_color": E.BORDE, "scrollbar_button_hover_color": E.TEXTO_SUAVE},
        "CTkScrollableFrame": {"label_fg_color": E.PANEL},
        "DropdownMenu": {"fg_color": E.TARJETA, "hover_color": E.PRIMARIO_SUAVE, "text_color": E.TEXTO},
    }
    for widget, valores in cambios.items():
        for clave, valor in valores.items():
            if clave in d[widget]:
                d[widget][clave] = list(valor) if isinstance(valor, tuple) else valor
    for so in d["CTkFont"]:
        d["CTkFont"][so] = {"family": estilo.FAMILIA_TEXTO, "size": 15, "weight": "normal"}
    TEMA.parent.mkdir(parents=True, exist_ok=True)
    with open(TEMA, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    aviso("activo.png", "Winclus está activo", rgb(estilo.OK[0]), "check")
    aviso("en_pausa.png", "En pausa", rgb(estilo.TEXTO_SUAVE[0]), "pausa")
    aviso("sin_cara.png", "No veo tu cara", rgb(estilo.ALERTA[0]), "alerta")
    logo()
    iconos_menu()
    dibujo_subir_cejas()
    dibujos_gestos_nuevos()
    globo()
    boton_perfil()
    tema()
    print("Recursos generados en", IMAGENES, "y", TEMA)
