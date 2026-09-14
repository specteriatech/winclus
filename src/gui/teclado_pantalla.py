"""Teclado en pantalla de Winclus: teclas grandes que se pulsan con el puntero.

Es una ventana sin bordes, siempre encima, pegada al borde inferior (o
superior) de la pantalla, que no toma el foco: lo que se pulsa llega a la
aplicación que estaba activa. Las teclas se pulsan con el clic que la persona
tenga elegido (parpadeo, boca, cejas o quedarse quieto), igual que cualquier
botón, porque el teclado recibe un clic de ratón normal.

Tiene cuatro capas (letras, números y símbolos, acentos, y más teclas), una
fila de palabras sugeridas (src/prediccion.py) y modificadores que se
enganchan (controllers/escritura.py). Todo se dibuja en un solo Canvas para
que cambiar de capa sea instantáneo.
"""

import logging
import threading
import time
import tkinter

import win32api
import win32con
import win32gui

from src import estilo
from src.config_manager import ConfigManager
from src import frases as frases_mod
from src.controllers import escritura
from src.prediccion import Prediccion
from src.voz import Voz

logger = logging.getLogger("TecladoPantalla")

SEP = 6            # separación entre teclas (px)
MARGEN = 8
RADIO = 10
N_SUGERENCIAS = 5
DESTELLO_MS = 130
ALTO_SUGERENCIAS = 0.75   # la fila de sugerencias es más baja que las teclas

# Definición de capas. Cada tecla es una cadena (escribe ese texto, ancho 1)
# o una tupla (etiqueta, tipo, valor, ancho). Tipos:
#   texto   escribe el valor          tecla   pulsa la tecla especial
#   mayus   capa de mayúsculas        mod     engancha Ctrl, Alt, Mayús o Win
#   capa    cambia de capa            atajo   pulsa una combinación
#   cerrar  oculta el teclado
_BORRAR = ("Borrar", "tecla", "backspace", 1.6)
_INTRO = ("Intro", "tecla", "enter", 1.6)
_IZQ = ("←", "tecla", "left", 1)
_DER = ("→", "tecla", "right", 1)
_MAS = ("Más", "capa", "mas", 1.2)
_CERRAR = ("Ocultar", "cerrar", None, 1.5)
_ESPACIO = ("Espacio", "texto", " ", 5)
_ABC = ("abc", "capa", "abc", 1.5)
_NUM = ("123", "capa", "123", 1.5)
_ACENTOS = ("áé", "capa", "acentos", 1.2)
# Voz: «Decir» lee lo escrito desde el último Decir o Intro; «Frases» abre
# la capa de frases guardadas (src/frases.py)
_DECIR = ("Decir", "decir", None, 1.3)
_FRASES = ("Frases", "capa", "frases", 1.3)

CAPAS = {
    "abc": [
        list("qwertyuiop") + [_BORRAR],
        list("asdfghjklñ") + [_INTRO],
        [("Mayús", "mayus", None, 1.3)] + list("zxcvbnm,.") + ["?"],
        [_NUM, _ACENTOS, _ESPACIO, _IZQ, _DER, _DECIR, _FRASES, _MAS, _CERRAR],
    ],
    "ABC": [
        list("QWERTYUIOP") + [_BORRAR],
        list("ASDFGHJKLÑ") + [_INTRO],
        [("Mayús", "mayus", None, 1.3)] + list("ZXCVBNM;:") + ["!"],
        [_NUM, _ACENTOS, _ESPACIO, _IZQ, _DER, _DECIR, _FRASES, _MAS, _CERRAR],
    ],
    "123": [
        list("1234567890") + [_BORRAR],
        list("@#€$%&-+()") + [_INTRO],
        list("!¿?¡\"':;/*"),
        [_ABC, _ACENTOS, _ESPACIO, _IZQ, _DER, _DECIR, _FRASES, _MAS, _CERRAR],
    ],
    "acentos": [
        list("áéíóúüñ¿¡«") + [_BORRAR],
        list("ÁÉÍÓÚÜÑ»ªº") + [_INTRO],
        list("çÇ~^`´¨·=_"),
        [_ABC, _NUM, _ESPACIO, _IZQ, _DER, _DECIR, _FRASES, _MAS, _CERRAR],
    ],
    "mas": [
        [("Esc", "tecla", "esc", 1), ("Tab", "tecla", "tab", 1),
         ("Ctrl", "mod", "ctrl", 1), ("Alt", "mod", "alt", 1),
         ("Mayús", "mod", "shift", 1), ("Win", "mod", "win", 1),
         ("Supr", "tecla", "delete", 1), ("Inicio", "tecla", "home", 1),
         ("Fin", "tecla", "end", 1), ("↑", "tecla", "up", 1), _BORRAR],
        [("Copiar", "atajo", ("ctrl", "c"), 1), ("Pegar", "atajo", ("ctrl", "v"), 1),
         ("Cortar", "atajo", ("ctrl", "x"), 1), ("Deshacer", "atajo", ("ctrl", "z"), 1),
         ("Rehacer", "atajo", ("ctrl", "y"), 1), ("Todo", "atajo", ("ctrl", "a"), 1),
         ("Guardar", "atajo", ("ctrl", "s"), 1), ("Buscar", "atajo", ("ctrl", "f"), 1),
         ("←", "tecla", "left", 1), ("↓", "tecla", "down", 1), ("→", "tecla", "right", 1)],
        [("RePág", "tecla", "pageup", 1), ("AvPág", "tecla", "pagedown", 1),
         ("F5", "tecla", "f5", 1), ("Menú", "tecla", "win", 1),
         ("Escritorio", "atajo", ("win", "d"), 1.2), ("Ventanas", "atajo", ("win", "tab"), 1.2),
         ("Cerrar app", "atajo", ("alt", "f4"), 1.2), ("Zoom +", "atajo", ("ctrl", "add"), 1),
         ("Zoom −", "atajo", ("ctrl", "subtract"), 1), ("Imprimir", "tecla", "printscreen", 1)],
        [_ABC, _NUM, _ESPACIO, _IZQ, _DER, _CERRAR],
    ],
}

escritura.VK.setdefault("add", 0x6B)
escritura.VK.setdefault("subtract", 0x6D)


def _sonar():
    try:
        import winsound
        threading.Thread(target=winsound.Beep, args=(880, 25), daemon=True).start()
    except Exception:
        pass


class TecladoPantalla:

    def __init__(self, tk_root):
        self.tk_root = tk_root
        self.ventana = tkinter.Toplevel(tk_root)
        self.ventana.title("Winclus teclado")
        self.ventana.overrideredirect(True)
        self.ventana.attributes("-topmost", True)
        self.lienzo = tkinter.Canvas(self.ventana, bd=0, highlightthickness=0)
        self.lienzo.pack(fill="both", expand=True)
        self.lienzo.bind("<Button-1>", self._clic)

        self.prediccion = Prediccion()
        self.mods = escritura.Modificadores()
        self.capa = "abc"
        self.bloq_mayus = False
        self.palabra = ""            # lo que se lleva escrito de la palabra actual
        self.frase = ""              # lo escrito desde el último «Decir» o Intro (para la voz)
        self.sugerencias = []
        self.teclas = []             # dicts con rect, ids y acción
        self.tecla_hover = None
        self.visible = False
        self.rect = (0, 0, 0, 0)     # posición en pantalla
        self.destello_hasta = {}     # id del rectángulo -> (tecla, hasta cuándo)
        self.al_cambiar_visible = None   # avisa a la página de ajustes

        self.ventana.withdraw()
        self.ventana.update_idletasks()
        self._sin_foco()
        self.tk_root.after(40, self._bucle)
        estilo.al_cambiar_modo(self.reconstruir)

    # ---------------------------------------------------------- ventana --
    def _sin_foco(self):
        try:
            hwnd = int(self.ventana.winfo_id())
            hwnd = win32gui.GetParent(hwnd) or hwnd
            estilos = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            estilos |= win32con.WS_EX_NOACTIVATE | win32con.WS_EX_TOOLWINDOW
            win32gui.SetWindowLong(hwnd, win32con.GWL_EXSTYLE, estilos)
        except Exception as e:
            logger.warning(f"No se pudo quitar el foco al teclado: {e}")

    def _area_trabajo(self):
        """Pantalla principal sin la barra de tareas."""
        try:
            return win32gui.SystemParametersInfo(win32con.SPI_GETWORKAREA)
        except Exception:
            return (0, 0, self.tk_root.winfo_screenwidth(), self.tk_root.winfo_screenheight())

    def geometria(self):
        cfg = ConfigManager().config
        x1, y1, x2, y2 = self._area_trabajo()
        ancho_total, alto_total = x2 - x1, y2 - y1
        ancho = int(ancho_total * cfg.get("teclado_ancho", 100) / 100)
        alto = int(alto_total * cfg.get("teclado_altura", 32) / 100)
        x = x1 + (ancho_total - ancho) // 2
        y = y1 if cfg.get("teclado_posicion", "abajo") == "arriba" else y2 - alto
        return x, y, ancho, alto

    def mostrar(self):
        x, y, ancho, alto = self.geometria()
        self.rect = (x, y, x + ancho, y + alto)
        self.ventana.geometry(f"{ancho}x{alto}+{x}+{y}")
        self.ventana.configure(bg=estilo.color_actual(estilo.PANEL))
        self.lienzo.configure(bg=estilo.color_actual(estilo.PANEL))
        self._dibujar(ancho, alto)
        self.ventana.deiconify()
        self.ventana.lift()
        self.ventana.attributes("-topmost", True)
        self._sin_foco()
        self.visible = True
        logger.info(f"Teclado en pantalla visible ({ancho}x{alto} en {x},{y})")
        self._avisar()

    def ocultar(self):
        if not self.visible:
            return
        self.ventana.withdraw()
        self.visible = False
        self.mods.soltar_todos()
        logger.info("Teclado en pantalla oculto")
        self._avisar()

    def alternar(self):
        if self.visible:
            self.ocultar()
        else:
            self.mostrar()

    def reconstruir(self):
        """Tras cambiar tamaño, posición o modo de color."""
        if self.visible:
            self.mostrar()

    def contiene(self, x, y) -> bool:
        """¿Está el punto de pantalla (x, y) sobre el teclado visible?"""
        if not self.visible:
            return False
        x1, y1, x2, y2 = self.rect
        return x1 <= x < x2 and y1 <= y < y2

    def _avisar(self):
        if self.al_cambiar_visible is not None:
            try:
                self.al_cambiar_visible(self.visible)
            except Exception as e:
                logger.warning(f"Aviso de visibilidad: {e}")

    def destruir(self):
        try:
            self.ventana.destroy()
        except Exception:
            pass

    # ----------------------------------------------------------- dibujo --
    def _dibujar(self, ancho, alto):
        self.lienzo.delete("all")
        self.teclas = []
        self.tecla_hover = None
        filas = self._filas_capa(self.capa)
        cfg = ConfigManager().config
        con_sugerencias = bool(cfg.get("teclado_prediccion", True))

        n_filas = len(filas) + (ALTO_SUGERENCIAS if con_sugerencias else 0)
        alto_util = alto - 2 * MARGEN - SEP * (len(filas) - 1 + (1 if con_sugerencias else 0))
        alto_fila = alto_util / n_filas
        y = MARGEN

        if con_sugerencias:
            alto_sug = alto_fila * ALTO_SUGERENCIAS
            self._dibujar_sugerencias(y, alto_sug, ancho)
            y += alto_sug + SEP

        for fila in filas:
            especificas = [self._tecla(t) for t in fila]
            unidades = sum(t["ancho"] for t in especificas)
            ancho_util = ancho - 2 * MARGEN - SEP * (len(fila) - 1)
            x = MARGEN
            for t in especificas:
                w = ancho_util * t["ancho"] / unidades
                self._crear_tecla(t, x, y, x + w, y + alto_fila)
                x += w + SEP
            y += alto_fila + SEP

    @staticmethod
    def _filas_capa(capa):
        """Filas de teclas de una capa. La capa «frases» se construye con las
        frases guardadas del perfil: 4 por fila, cada una se dice al pulsarla."""
        if capa != "frases":
            return CAPAS[capa]
        frases = frases_mod.cargar()
        filas = []
        for i in range(0, len(frases), 4):
            filas.append([(f, "frase", f, 1) for f in frases[i:i + 4]])
        if not filas:
            filas.append([("(Añade frases en la página Escribir)", "frase", "", 1)])
        filas.append([_ABC, ("Callar", "callar", None, 1.3), _DECIR, _CERRAR])
        return filas

    def _dibujar_sugerencias(self, y, alto, ancho):
        ancho_util = ancho - 2 * MARGEN - SEP * (N_SUGERENCIAS - 1)
        w = ancho_util / N_SUGERENCIAS
        for i in range(N_SUGERENCIAS):
            palabra = self.sugerencias[i] if i < len(self.sugerencias) else ""
            t = {"etiqueta": palabra, "tipo": "pred", "valor": palabra, "ancho": 1,
                 "sugerencia": True, "indice": i}
            x = MARGEN + i * (w + SEP)
            self._crear_tecla(t, x, y, x + w, y + alto)

    @staticmethod
    def _tecla(definicion) -> dict:
        if isinstance(definicion, str):
            return {"etiqueta": definicion, "tipo": "texto", "valor": definicion, "ancho": 1}
        etiqueta, tipo, valor, ancho = definicion
        return {"etiqueta": etiqueta, "tipo": tipo, "valor": valor, "ancho": ancho}

    def _crear_tecla(self, t, x1, y1, x2, y2):
        t.update({"x1": x1, "y1": y1, "x2": x2, "y2": y2})
        relleno, texto, borde, grosor = self._colores(t, hover=False)
        t["rect"] = self._rectangulo(x1, y1, x2, y2, relleno, borde, grosor)
        alto = y2 - y1
        tam = int(alto * (0.42 if len(t["etiqueta"]) <= 2 or t.get("sugerencia") else 0.32))
        largo = max(1, max(len(p) for p in t["etiqueta"].split()) if t["tipo"] == "frase" else len(t["etiqueta"]))
        tam = max(12, min(tam, int((x2 - x1) / (largo * 0.62))))
        familia = estilo.FAMILIA_TEXTO
        t["texto"] = self.lienzo.create_text((x1 + x2) / 2, (y1 + y2) / 2,
                                             text=t["etiqueta"],
                                             fill=texto,
                                             width=int(x2 - x1 - 8) if t["tipo"] == "frase" else 0,
                                             justify=tkinter.CENTER,
                                             font=(familia, -tam, "bold" if t["tipo"] != "texto" else "normal"))
        self.teclas.append(t)

    def _rectangulo(self, x1, y1, x2, y2, relleno, borde, grosor):
        r = min(RADIO, (x2 - x1) / 2, (y2 - y1) / 2)
        puntos = [x1 + r, y1, x2 - r, y1, x2, y1, x2, y1 + r, x2, y2 - r, x2, y2,
                  x2 - r, y2, x1 + r, y2, x1, y2, x1, y2 - r, x1, y1 + r, x1, y1]
        return self.lienzo.create_polygon(puntos, smooth=True, fill=relleno,
                                          outline=borde, width=grosor)

    def _colores(self, t, hover: bool):
        """(relleno, texto, borde, grosor) según tipo, estado y hover."""
        c = estilo.color_actual
        especial = t["tipo"] not in ("texto", "pred")
        relleno = c(estilo.FONDO) if especial else c(estilo.TARJETA)
        texto = c(estilo.TEXTO)
        borde = c(estilo.BORDE)
        grosor = 1
        if t.get("sugerencia") and not t["valor"]:
            return c(estilo.PANEL), c(estilo.PANEL), c(estilo.PANEL), 0
        if t["tipo"] == "pred":
            texto = c(estilo.PRIMARIO)
        activo = ((t["tipo"] == "mayus" and (self.capa == "ABC" or self.bloq_mayus))
                  or (t["tipo"] == "mod" and self.mods.estado[t["valor"]] != self.mods.SUELTO)
                  or (t["tipo"] == "capa" and t["valor"] == self.capa))
        fijo = ((t["tipo"] == "mayus" and self.bloq_mayus)
                or (t["tipo"] == "mod" and self.mods.estado[t["valor"]] == self.mods.FIJO))
        if fijo:
            relleno, texto = c(estilo.PRIMARIO), c(estilo.TEXTO_SOBRE_PRIMARIO)
        elif activo:
            relleno, borde, grosor = c(estilo.PRIMARIO_SUAVE), c(estilo.PRIMARIO), 3
        if hover:
            relleno = c(estilo.PRIMARIO_SUAVE) if not fijo else c(estilo.PRIMARIO_HOVER)
            borde, grosor = c(estilo.PRIMARIO), 3
        return relleno, texto, borde, grosor

    def _pintar(self, t, hover=False, destello=False):
        relleno, texto, borde, grosor = self._colores(t, hover)
        if destello:
            c = estilo.color_actual
            relleno, texto = c(estilo.PRIMARIO), c(estilo.TEXTO_SOBRE_PRIMARIO)
        self.lienzo.itemconfigure(t["rect"], fill=relleno, outline=borde, width=grosor)
        self.lienzo.itemconfigure(t["texto"], fill=texto)

    def _tecla_en(self, x, y):
        for t in self.teclas:
            if t["x1"] <= x < t["x2"] and t["y1"] <= y < t["y2"]:
                if t.get("sugerencia") and not t["valor"]:
                    return None
                return t
        return None

    # ------------------------------------------------------------ bucle --
    def _bucle(self):
        try:
            if self.visible:
                self._hover()
                self._destellos()
        except Exception as e:
            logger.warning(f"Teclado: {e}")
        self.tk_root.after(40, self._bucle)

    def _hover(self):
        try:
            px, py = win32api.GetCursorPos()
        except Exception:
            return
        t = None
        if self.contiene(px, py):
            t = self._tecla_en(px - self.rect[0], py - self.rect[1])
        if t is self.tecla_hover:
            return
        if self.tecla_hover is not None and any(self.tecla_hover is k for k in self.teclas):
            self._pintar(self.tecla_hover, hover=False)
        self.tecla_hover = t
        if t is not None:
            self._pintar(t, hover=True)

    def _destellos(self):
        if not self.destello_hasta:
            return
        ahora = time.time()
        for clave, (t, hasta) in list(self.destello_hasta.items()):
            if ahora >= hasta:
                del self.destello_hasta[clave]
                if any(t is k for k in self.teclas):
                    self._pintar(t, hover=(t is self.tecla_hover))

    # ----------------------------------------------------------- pulsar --
    def _clic(self, evento):
        t = self._tecla_en(evento.x, evento.y)
        if t is None:
            return
        self._pulsar(t)

    def _pulsar(self, t):
        cfg = ConfigManager().config
        if cfg.get("teclado_sonido", True):
            _sonar()
        self._pintar(t, destello=True)
        self.destello_hasta[t["rect"]] = (t, time.time() + DESTELLO_MS / 1000)
        tipo, valor = t["tipo"], t["valor"]
        logger.info(f"Tecla {ascii(t['etiqueta'])} ({tipo})")

        if tipo == "texto":
            self._escribir(valor)
        elif tipo == "pred":
            self._completar(valor)
        elif tipo == "tecla":
            escritura.pulsar_con_modificadores(valor, self.mods)
            if valor == "backspace":
                self.palabra = self.palabra[:-1]
                self.frase = self.frase[:-1]
            else:
                self._terminar_palabra(aprender=(valor == "enter"))
                if valor == "enter":
                    self.frase = ""
            self._refrescar_sugerencias()
            self._redibujar_si_cambian_mods()
        elif tipo == "atajo":
            escritura.atajo(*valor)
            self.mods.consumir()
            self._terminar_palabra(aprender=False)
            self._refrescar_sugerencias()
            self._redibujar_si_cambian_mods()
        elif tipo == "mayus":
            self._mayusculas()
        elif tipo == "mod":
            self.mods.pulsar(valor)
            self._redibujar()
        elif tipo == "capa":
            self.capa = valor
            self.bloq_mayus = False
            self._redibujar()
        elif tipo == "cerrar":
            self.ocultar()
        elif tipo == "decir":
            if self.frase.strip():
                Voz().decir(self.frase)
                self.frase = ""
            else:
                Voz().decir("No hay nada escrito")
        elif tipo == "frase":
            if valor:
                Voz().decir(valor)
        elif tipo == "callar":
            Voz().callar()

    def _escribir(self, texto):
        escritura.escribir_con_modificadores(texto, self.mods)
        self.frase += texto
        if texto.isalpha():
            self.palabra += texto
        else:
            self._terminar_palabra(aprender=True)
        if self.capa == "ABC" and not self.bloq_mayus:
            self.capa = "abc"
            self._refrescar_sugerencias()
            self._redibujar()
            return
        self._refrescar_sugerencias()
        self._redibujar_si_cambian_mods()

    def _completar(self, palabra):
        if not palabra:
            return
        resto = palabra[len(self.palabra):] if palabra.lower().startswith(self.palabra.lower()) else palabra
        escritura.escribir_texto(resto + " ")
        self.mods.consumir()
        self.prediccion.aprender(palabra)
        self.frase += resto + " "
        if ConfigManager().config.get("voz_eco", False):
            Voz().decir(palabra, interrumpir=False)
        self.palabra = ""
        self._refrescar_sugerencias()
        if self.capa == "ABC" and not self.bloq_mayus:
            self.capa = "abc"
            self._redibujar()

    def _terminar_palabra(self, aprender: bool):
        if aprender and self.palabra:
            self.prediccion.aprender(self.palabra)
        if self.palabra and ConfigManager().config.get("voz_eco", False):
            Voz().decir(self.palabra, interrumpir=False)
        self.palabra = ""

    def _mayusculas(self):
        if self.capa == "ABC":
            if self.bloq_mayus:
                self.bloq_mayus = False
                self.capa = "abc"
            else:
                self.bloq_mayus = True
        else:
            self.capa = "ABC"
            self.bloq_mayus = False
        self._redibujar()

    def _refrescar_sugerencias(self):
        cfg = ConfigManager().config
        if not cfg.get("teclado_prediccion", True):
            self.sugerencias = []
            return
        nuevas = self.prediccion.sugerir(self.palabra, N_SUGERENCIAS)
        if nuevas == self.sugerencias:
            return
        self.sugerencias = nuevas
        for t in self.teclas:
            if t.get("sugerencia"):
                i = t["indice"]
                palabra = nuevas[i] if i < len(nuevas) else ""
                t["valor"] = palabra
                t["etiqueta"] = palabra
                self.lienzo.itemconfigure(t["texto"], text=palabra)
                self._pintar(t, hover=(t is self.tecla_hover))

    def _redibujar(self):
        x1, y1, x2, y2 = self.rect
        self._dibujar(x2 - x1, y2 - y1)
        self.destello_hasta = {}

    def _redibujar_si_cambian_mods(self):
        """Los modificadores enganchados se sueltan tras una tecla: hay que
        quitarles el resalte si la capa «mas» está a la vista."""
        if self.capa == "mas":
            for t in self.teclas:
                if t["tipo"] == "mod":
                    self._pintar(t, hover=(t is self.tecla_hover))
