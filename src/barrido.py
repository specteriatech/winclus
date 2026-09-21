"""Barrido con un solo pulsador en todo Windows (la familia 5, que el widget ya tenía, llevada a la aplicación).

Quien solo puede accionar una cosa (un pulsador, una tecla, un soplo, un gesto de la cara) no puede usar el ratón
ni el teclado. Aquí Winclus pide a Windows, por UI Automation, los controles pulsables de la ventana que está
delante, los recorre uno a uno en orden de lectura marcándolos con un marco (gui/marco_barrido.py) y, cuando llega
la señal, pulsa el marcado.

- La señal es una tecla (Espacio por defecto, que es lo que envían casi todos los pulsadores USB) o el gesto de
  clic de la cara (controllers/clics.py llama a `senal()`). Mientras el barrido está activo, esa tecla se la queda
  Winclus con un gancho de teclado de bajo nivel: si no, el Espacio escribiría en el programa de delante.
- Pulsar no mueve el ratón: se usa lo que el propio control ofrece (Invoke, Toggle, Select, foco en los campos);
  solo si no ofrece nada se hace clic en su centro.
- Tras pulsar, la ventana suele cambiar: se vuelve a pedir la lista y el recorrido empieza de nuevo.

Todo lo de UI Automation corre en un hilo propio (es COM). El marco lo dibuja el hilo de tkinter preguntando
`rect_actual()`.
"""

import ctypes
import ctypes.wintypes
import logging
import threading
import time

from src.config_manager import ConfigManager
from src.singleton_meta import Singleton

logger = logging.getLogger("Barrido")

TIPOS = {
    50000: "botón", 50002: "casilla", 50003: "lista desplegable", 50004: "campo de texto",
    50005: "enlace", 50007: "elemento de lista", 50011: "opción de menú", 50013: "opción",
    50016: "selector", 50019: "pestaña", 50024: "elemento", 50031: "botón de división",
}
TAMANO_MAX = (900, 400)
TECLAS = {"espacio": 0x20, "intro": 0x0D, "f8": 0x77, "f9": 0x78, "f10": 0x79}


def _cfg():
    """La configuración de Winclus, o {} si todavía no hay (en las pruebas, sin ventana de tkinter)."""
    # Solo se lee si Winclus ya la creó: construirla aquí (sin ventana de tkinter) fallaría en cada vuelta del bucle
    inst = getattr(Singleton, "_instances", {}).get(ConfigManager)
    return (inst.config or {}) if inst is not None else {}


class Control:
    __slots__ = ("elemento", "rect", "nombre", "tipo")

    def __init__(self, elemento, rect, nombre, tipo):
        self.elemento, self.rect, self.nombre, self.tipo = elemento, rect, nombre, tipo

    def __repr__(self):
        return f"{self.tipo} {self.nombre!r} {self.rect}"


def preparar_uia():
    """(módulo UIA, objeto IUIAutomation) para el hilo que llama (COM se inicia por hilo)."""
    import comtypes
    import comtypes.client
    comtypes.CoInitialize()
    comtypes.client.GetModule("UIAutomationCore.dll")
    from comtypes.gen import UIAutomationClient as UIA
    return UIA, comtypes.client.CreateObject(UIA.CUIAutomation, interface=UIA.IUIAutomation)


def listar_controles(UIA, uia, hwnd):
    """Controles pulsables, visibles y activos de la ventana `hwnd`, en orden de lectura."""
    try:
        raiz = uia.ElementFromHandle(hwnd)
        cond = uia.CreatePropertyCondition(UIA.UIA_IsEnabledPropertyId, True)
        todos = raiz.FindAll(UIA.TreeScope_Descendants, cond)
    except Exception as e:
        logger.warning(f"No se pudo leer la ventana: {e}")
        return []
    salida, vistos = [], set()
    for i in range(todos.Length):
        try:
            e = todos.GetElement(i)
            tipo = int(e.CurrentControlType)
            if tipo not in TIPOS or e.CurrentIsOffscreen:
                continue
            r = e.CurrentBoundingRectangle
            w, h = r.right - r.left, r.bottom - r.top
            if w <= 2 or h <= 2 or w > TAMANO_MAX[0] or h > TAMANO_MAX[1]:
                continue
            rect = (int(r.left), int(r.top), int(r.right), int(r.bottom))
            if rect in vistos:          # el mismo sitio expuesto dos veces (un botón y su texto)
                continue
            vistos.add(rect)
            salida.append(Control(e, rect, (e.CurrentName or "").strip(), TIPOS[tipo]))
        except Exception:
            continue
    salida.sort(key=lambda c: (c.rect[1] // 24, c.rect[0]))   # por renglones y de izquierda a derecha
    return salida


def pulsar(UIA, control):
    """Acciona el control sin mover el ratón si él lo permite. Devuelve cómo se hizo."""
    e = control.elemento
    intentos = (
        (UIA.UIA_InvokePatternId, UIA.IUIAutomationInvokePattern, lambda p: p.Invoke(), "invocar"),
        (UIA.UIA_TogglePatternId, UIA.IUIAutomationTogglePattern, lambda p: p.Toggle(), "marcar"),
        (UIA.UIA_SelectionItemPatternId, UIA.IUIAutomationSelectionItemPattern, lambda p: p.Select(), "elegir"),
        (UIA.UIA_ExpandCollapsePatternId, UIA.IUIAutomationExpandCollapsePattern, lambda p: p.Expand(), "desplegar"),
        (UIA.UIA_LegacyIAccessiblePatternId, UIA.IUIAutomationLegacyIAccessiblePattern, lambda p: p.DoDefaultAction(), "acción"),
    )
    if control.tipo == "campo de texto":
        try:
            e.SetFocus()
            return "foco"
        except Exception:
            pass
    for pid, interfaz, hacer, como in intentos:
        try:
            p = e.GetCurrentPattern(pid)
            if p:
                hacer(p.QueryInterface(interfaz))
                return como
        except Exception:
            continue
    import pydirectinput
    x1, y1, x2, y2 = control.rect
    pydirectinput.click((x1 + x2) // 2, (y1 + y2) // 2)
    return "clic"


class _GanchoTeclado:
    """Se queda con la tecla-pulsador mientras el barrido está activo (WH_KEYBOARD_LL)."""

    def __init__(self, vk, al_pulsar):
        self.vk, self.al_pulsar, self.hilo, self.id_hilo, self._proc = vk, al_pulsar, None, None, None

    def iniciar(self):
        self.hilo = threading.Thread(target=self._correr, name="barrido-tecla", daemon=True)
        self.hilo.start()

    def _correr(self):
        user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
        self.id_hilo = kernel32.GetCurrentThreadId()
        LRESULT = ctypes.c_ssize_t
        PROC = ctypes.WINFUNCTYPE(LRESULT, ctypes.c_int, ctypes.wintypes.WPARAM, ctypes.wintypes.LPARAM)
        user32.CallNextHookEx.argtypes = (ctypes.c_void_p, ctypes.c_int, ctypes.wintypes.WPARAM, ctypes.wintypes.LPARAM)
        user32.CallNextHookEx.restype = LRESULT

        def proc(codigo, wparam, lparam):
            if codigo == 0:
                vk = ctypes.cast(lparam, ctypes.POINTER(ctypes.c_ulong))[0]   # KBDLLHOOKSTRUCT.vkCode
                if vk == self.vk:
                    if wparam in (0x0100, 0x0104):      # WM_KEYDOWN / WM_SYSKEYDOWN
                        try:
                            self.al_pulsar()
                        except Exception as ex:
                            logger.warning(f"Señal del pulsador: {ex}")
                    return 1                             # la tecla no llega al programa de delante
            return user32.CallNextHookEx(None, codigo, wparam, lparam)

        self._proc = PROC(proc)
        user32.SetWindowsHookExW.argtypes = (ctypes.c_int, PROC, ctypes.c_void_p, ctypes.wintypes.DWORD)
        user32.SetWindowsHookExW.restype = ctypes.c_void_p
        gancho = user32.SetWindowsHookExW(13, self._proc, kernel32.GetModuleHandleW(None), 0)   # WH_KEYBOARD_LL
        if not gancho:
            logger.warning("No se pudo instalar el gancho de teclado del barrido")
            return
        msg = ctypes.wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            user32.TranslateMessage(ctypes.byref(msg))
            user32.DispatchMessageW(ctypes.byref(msg))
        user32.UnhookWindowsHookEx(ctypes.c_void_p(gancho))

    def parar(self):
        if self.id_hilo:
            ctypes.windll.user32.PostThreadMessageW(self.id_hilo, 0x0012, 0, 0)   # WM_QUIT


class Barrido(metaclass=Singleton):

    def __init__(self):
        self.activo = False
        self.lista = []
        self.i = -1
        self.hwnd = None
        self.hilo = None
        self.lock = threading.Lock()
        self._senal = threading.Event()
        self._rehacer = threading.Event()
        self.gancho = None
        self.decir = None             # fn(texto): voz (la pone main_gui con src/voz.py)
        self.avisar = None            # fn(texto): etiqueta en pantalla
        self.ventana_fija = None      # para las pruebas: recorrer esta ventana y no la de delante
        self.ultimo = None            # (control, cómo) de la última pulsación
        self.ms = 1500

    # ------------------------------------------------------------ control --
    def activar(self):
        if self.activo:
            return
        cfg = _cfg()
        self.ms = max(400, int(cfg.get("barrido_ms", 1500)))
        self.activo = True
        self._rehacer.set()
        self.hilo = threading.Thread(target=self._bucle, name="barrido", daemon=True)
        self.hilo.start()
        if cfg.get("barrido_tecla", "espacio") != "ninguna" and self.ventana_fija is None:
            self.gancho = _GanchoTeclado(TECLAS.get(cfg.get("barrido_tecla", "espacio"), 0x20), self.senal)
            self.gancho.iniciar()
        self._decir("Barrido activado. Cuando el marco esté en lo que quieres, pulsa.")

    def desactivar(self):
        self.activo = False
        if self.gancho is not None:
            self.gancho.parar()
            self.gancho = None
        with self.lock:
            self.lista, self.i = [], -1

    def senal(self):
        """La señal del pulsador: pulsar lo marcado."""
        if self.activo:
            self._senal.set()

    def rect_actual(self):
        with self.lock:
            if 0 <= self.i < len(self.lista):
                return self.lista[self.i].rect
        return None

    def actual(self):
        with self.lock:
            return self.lista[self.i] if 0 <= self.i < len(self.lista) else None

    # --------------------------------------------------------------- hilo --
    def _decir(self, texto):
        for fn in (self.avisar, self.decir):
            if fn is not None:
                try:
                    fn(texto)
                except Exception:
                    pass

    def _bucle(self):
        try:
            UIA, uia = preparar_uia()
        except Exception as e:
            logger.warning(f"Barrido sin UI Automation: {e}")
            self.activo = False
            return
        ultimo_paso = 0.0
        while self.activo:
            hwnd = self.ventana_fija or ctypes.windll.user32.GetForegroundWindow()
            if hwnd and (hwnd != self.hwnd or self._rehacer.is_set()):
                self._rehacer.clear()
                lista = listar_controles(UIA, uia, hwnd)
                with self.lock:
                    self.hwnd, self.lista, self.i = hwnd, lista, -1
                ultimo_paso = 0.0
                logger.info(f"Barrido: {len(lista)} controles en la ventana {hwnd}")
            if self._senal.is_set():
                self._senal.clear()
                c = self.actual()
                if c is not None:
                    try:
                        como = pulsar(UIA, c)
                        self.ultimo = (c, como)
                        logger.info(f"Barrido: {como} {c}")
                        self._decir(c.nombre or c.tipo)
                    except Exception as e:
                        logger.warning(f"Barrido, no se pudo pulsar {c}: {e}")
                    time.sleep(0.25)               # la ventana cambia: se pide la lista otra vez
                    self._rehacer.set()
                continue
            ahora = time.time()
            if self.lista and ahora - ultimo_paso >= self.ms / 1000:
                ultimo_paso = ahora
                with self.lock:
                    self.i = (self.i + 1) % len(self.lista)
                    c = self.lista[self.i]
                if _cfg().get("barrido_voz", True):
                    self._decir(c.nombre or c.tipo)
            time.sleep(0.03)
