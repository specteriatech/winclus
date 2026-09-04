"""Genera los recursos gráficos propios de Puntero Libre.

Crea el icono neutro (assets/images/icono.ico y icono.png) y los avisos que se
dibujan sobre la imagen de la cámara (assets/images/avisos/*.png), todos en
español y sin marcas. Se ejecuta una vez y el resultado se guarda en el repo:

    .venv\Scripts\python.exe herramientas\generar_recursos.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent
IMAGENES = RAIZ / "assets" / "images"
AVISOS = IMAGENES / "avisos"

# Colores propios, neutros (no son los de ninguna marca).
VERDE = (46, 160, 96)
NARANJA = (240, 150, 40)
GRIS = (120, 124, 130)
AZUL_OSCURO = (24, 52, 88)
BLANCO = (255, 255, 255)
AMARILLO = (255, 200, 40)


def fuente(tamano: int, negrita: bool = True) -> ImageFont.FreeTypeFont:
    """Segoe UI viene con Windows 10/11; si no está, se usa la fuente por defecto."""
    nombres = ["segoeuib.ttf", "seguisb.ttf"] if negrita else ["segoeui.ttf"]
    for n in nombres:
        try:
            return ImageFont.truetype(n, tamano)
        except OSError:
            continue
    return ImageFont.load_default()


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


def icono() -> None:
    """Icono propio: cara sonriente estilizada con un puntero encima."""
    n = 512
    im = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Fondo redondeado
    d.rounded_rectangle([16, 16, n - 16, n - 16], radius=110, fill=AZUL_OSCURO + (255,))
    # Cara: óvalo blanco
    d.ellipse([96, 120, 416, 460], fill=BLANCO + (255,))
    # Ojos
    d.ellipse([170, 230, 214, 274], fill=AZUL_OSCURO + (255,))
    d.ellipse([298, 230, 342, 274], fill=AZUL_OSCURO + (255,))
    # Sonrisa
    d.arc([176, 250, 336, 400], start=20, end=160, fill=AZUL_OSCURO + (255,), width=22)
    # Puntero amarillo con borde oscuro, arriba a la derecha
    px, py = 330, 40
    flecha = [(px, py), (px, py + 150), (px + 40, py + 112), (px + 66, py + 168),
              (px + 96, py + 154), (px + 70, py + 100), (px + 122, py + 96)]
    d.polygon(flecha, fill=AMARILLO + (255,), outline=AZUL_OSCURO + (255,), width=10)
    im.save(IMAGENES / "icono.png")
    im.save(IMAGENES / "icono.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])


if __name__ == "__main__":
    aviso("activo.png", "Puntero Libre está activo", VERDE, "check")
    aviso("en_pausa.png", "En pausa", GRIS, "pausa")
    aviso("sin_cara.png", "No veo tu cara", NARANJA, "alerta")
    icono()
    print("Recursos generados en", IMAGENES)
