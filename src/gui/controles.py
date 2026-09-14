"""Controles grandes para manejar Winclus con la cara.

Con el puntero guiado por la cabeza o los ojos, arrastrar el botón de un
deslizador es difícil. Cada deslizador lleva al lado dos botones grandes,
«−» y «+», que lo mueven de uno en uno (o del paso que se indique): un clic
por unidad, sin arrastrar nada.
"""

import customtkinter

from src import estilo


def _limites(slider):
    try:
        return int(slider.cget("from_")), int(slider.cget("to"))
    except Exception:
        return int(getattr(slider, "_from_", 0)), int(getattr(slider, "_to", 100))


def botones_paso(master, slider, al_cambiar, paso: int = 1, alto: int = 34, ancho: int = 40):
    """Marco con «−» y «+» que mueven `slider` `paso` unidades y llaman a
    al_cambiar(valor_nuevo). El valor queda dentro de los límites del
    deslizador."""
    marco = customtkinter.CTkFrame(master, fg_color="transparent")

    def mover(signo):
        lo, hi = _limites(slider)
        valor = max(lo, min(hi, int(round(slider.get())) + signo * paso))
        slider.set(valor)
        al_cambiar(valor)

    for i, (texto, signo) in enumerate((("−", -1), ("+", 1))):
        customtkinter.CTkButton(marco, text=texto, width=ancho, height=alto, corner_radius=10,
                                fg_color=estilo.PRIMARIO_SUAVE, hover_color=estilo.BORDE,
                                text_color=estilo.PRIMARIO, font=estilo.fuente("boton"),
                                command=lambda s=signo: mover(s)).grid(row=0, column=i, padx=(0, 6))
    marco.mover = mover
    return marco
