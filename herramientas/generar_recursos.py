"""Genera los recursos gráficos propios de Puntero Libre.

Crea el icono neutro, los avisos que se dibujan sobre la imagen de la cámara,
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


# ------------------------------------------------------------------- Icono --
def icono() -> None:
    """Icono propio: cara sonriente estilizada con un puntero encima."""
    n = 512
    fondo = rgb(estilo.PRIMARIO[0]) + (255,)
    ambar = rgb(estilo.AMBAR[0]) + (255,)
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([16, 16, n - 16, n - 16], radius=110, fill=fondo)
    d.ellipse([96, 120, 416, 460], fill=BLANCO + (255,))
    d.ellipse([170, 230, 214, 274], fill=fondo)
    d.ellipse([298, 230, 342, 274], fill=fondo)
    d.arc([176, 250, 336, 400], start=20, end=160, fill=fondo, width=22)
    px, py = 330, 40
    flecha = [(px, py), (px, py + 150), (px + 40, py + 112), (px + 66, py + 168),
              (px + 96, py + 154), (px + 70, py + 100), (px + 122, py + 96)]
    d.polygon(flecha, fill=ambar, outline=fondo, width=10)
    im.save(IMAGENES / "icono.png")
    im.save(IMAGENES / "icono.ico",
            sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])


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
    return im.resize((48, 48), Image.LANCZOS)


def iconos_menu() -> None:
    ICONOS.mkdir(parents=True, exist_ok=True)
    for nombre in ["casa", "camara", "puntero", "clic", "teclado", "sol", "luna",
                   "perfil", "flecha_abajo"]:
        dibujar_icono(nombre, rgb(estilo.TEXTO[0])).save(ICONOS / f"{nombre}_claro.png")
        dibujar_icono(nombre, rgb(estilo.TEXTO[1])).save(ICONOS / f"{nombre}_oscuro.png")


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
    aviso("activo.png", "Puntero Libre está activo", rgb(estilo.OK[0]), "check")
    aviso("en_pausa.png", "En pausa", rgb(estilo.TEXTO_SUAVE[0]), "pausa")
    aviso("sin_cara.png", "No veo tu cara", rgb(estilo.ALERTA[0]), "alerta")
    icono()
    iconos_menu()
    globo()
    boton_perfil()
    tema()
    print("Recursos generados en", IMAGENES, "y", TEMA)
