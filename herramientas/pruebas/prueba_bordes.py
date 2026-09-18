"""Bajar y subir llevando el puntero al borde, en la aplicación de Windows.

Comprueba la decisión de `lado_borde` (controllers/mouse_controller.py): en qué
franja está el puntero, que el centro no desplaza, que una pantalla muy baja no
usa los bordes y que la rueda se manda lejos de la barra de tareas.

    .venv\\Scripts\\python.exe herramientas\\pruebas\\prueba_bordes.py
"""
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(RAIZ))

from src.controllers.mouse_controller import (  # noqa: E402
    DENTRO_PX, FRANJA_PX, lado_borde)

fallos = 0


def comprobar(bien, nombre, detalle=""):
    global fallos
    fallos += 0 if bien else 1
    print(("OK  " if bien else "MAL ") + nombre + (f"  ({detalle})" if detalle else ""))


ALTO = 1080

comprobar(lado_borde(ALTO - 1, ALTO) == 1, "el puntero pegado al borde de abajo desplaza hacia abajo")
comprobar(lado_borde(ALTO - FRANJA_PX, ALTO) == 1, "justo al entrar en la franja de abajo, también")
comprobar(lado_borde(ALTO - FRANJA_PX - 1, ALTO) == 0, "un píxel antes de la franja, no")
comprobar(lado_borde(0, ALTO) == -1 and lado_borde(FRANJA_PX, ALTO) == -1, "en la franja de arriba, hacia arriba")
comprobar(lado_borde(FRANJA_PX + 1, ALTO) == 0, "un píxel después de la franja de arriba, no")
comprobar(lado_borde(ALTO // 2, ALTO) == 0, "en el centro de la pantalla no se desplaza")
comprobar(lado_borde(5, 300) == 0 and lado_borde(295, 300) == 0, "en una pantalla muy baja no se usan los bordes")
comprobar(FRANJA_PX >= 100, "la franja es ancha: con la cara el puntero se queda pegado al borde", f"{FRANJA_PX} px")
comprobar(ALTO - DENTRO_PX < ALTO - FRANJA_PX,
          "la rueda se manda más adentro que la franja, para no dársela a la barra de tareas",
          f"franja {FRANJA_PX} px, rueda a {DENTRO_PX} px del borde")

print(f"{fallos} comprobación(es) MAL" if fallos else "todo bien")
sys.exit(1 if fallos else 0)
