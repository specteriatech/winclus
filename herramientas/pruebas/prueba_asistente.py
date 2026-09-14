"""Asistente sin cámara.

1. Lector de pantalla: una ventanita WinForms (PowerShell) con un botón «Probar»
   y un campo de texto; se leen sus controles y se encuentra el botón por nombre.
2. Ejecutor: acciones con escritura y pydirectinput sustituidos por registros.
3. Cerebro de reglas: peticiones sencillas → acciones.
4. Bucle completo del asistente con el cerebro de reglas y ejecutor simulado.
5. Si Ollama responde: una petición real al modelo local (solo se mira que
   devuelva una acción válida; no se ejecuta nada).
"""
import os
import subprocess
import sys
import time

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

import customtkinter  # noqa: E402

from src.asistente import acciones as acc  # noqa: E402
from src.asistente import cerebro as cer  # noqa: E402
from src.asistente import nucleo  # noqa: E402
from src.asistente.contexto import LectorPantalla  # noqa: E402
from src.config_manager import ConfigManager  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


root = customtkinter.CTk()
root.withdraw()
ConfigManager().start()

print("1. Lector de pantalla")
ps = ("Add-Type -AssemblyName System.Windows.Forms; "
      "$f = New-Object Windows.Forms.Form; $f.Text='Prueba Winclus asistente'; $f.StartPosition='Manual'; "
      "$f.Location = New-Object Drawing.Point(200,200); $f.Size = New-Object Drawing.Size(420,300); $f.TopMost = $true; "
      "$b = New-Object Windows.Forms.Button; $b.Text='Probar'; $b.Location = New-Object Drawing.Point(150,100); "
      "$b.Size = New-Object Drawing.Size(120,44); $f.Controls.Add($b); "
      "$t = New-Object Windows.Forms.TextBox; $t.Text='Hola desde la prueba'; $t.Location = New-Object Drawing.Point(40,40); "
      "$t.Size = New-Object Drawing.Size(300,28); $f.Controls.Add($t); "
      "$l = New-Object Windows.Forms.Label; $l.Text='Etiqueta visible'; $l.Location = New-Object Drawing.Point(40,180); "
      "$l.Size = New-Object Drawing.Size(300,28); $f.Controls.Add($l); "
      "$f.Add_Shown({ $f.Activate() }); [void]$f.ShowDialog()")
proc = subprocess.Popen(["powershell", "-NoProfile", "-Command", ps])
time.sleep(3.0)
import win32gui
hwnd = win32gui.FindWindow(None, "Prueba Winclus asistente")
lector = LectorPantalla(hwnd_fijo=hwnd or None)   # la ventana de prueba, esté o no delante
try:
    v = lector.ventana_activa()
    comprobar("Prueba Winclus" in v["titulo"], f"ventana activa: {v}")
    ctr = lector.controles()
    nombres = [c["nombre"] for c in ctr]
    comprobar("Probar" in nombres, f"controles leídos: {nombres[:8]}")
    encontrado = lector.buscar_control("probar")
    comprobar(encontrado is not None and encontrado[2] == "Probar", f"buscar_control «probar» → {encontrado}")
    comprobar(lector.buscar_control("no existe") is None, "un control inexistente devuelve None")
    resumen = lector.resumen()
    comprobar("Ventana activa" in resumen and "Probar" in resumen, f"resumen: {resumen[:160]}…")
finally:
    proc.kill()

print("2. Ejecutor con acciones simuladas")
registro = []


class EscrituraFalsa:
    @staticmethod
    def escribir_texto(t): registro.append(("escribir", t))
    @staticmethod
    def pulsar_tecla(n, modificadores=()): registro.append(("tecla", n))
    @staticmethod
    def atajo(*t): registro.append(("atajo", t))


class PDIFalso:
    @staticmethod
    def moveTo(x, y): registro.append(("moveTo", x, y))
    @staticmethod
    def click(button="left"): registro.append(("click", button))


acc.escritura = EscrituraFalsa
acc.pydirectinput = PDIFalso
abiertos = []
acc.os.startfile = lambda x: abiertos.append(x)


class LectorFalso:
    def buscar_control(self, n): return (100, 200, "Aceptar") if "acept" in n.lower() else None
    def controles(self, max_n=45): return [{"nombre": "Aceptar", "clicable": True}, {"nombre": "Cancelar", "clicable": True}]
    def texto(self, n=1500): return "Texto de prueba en pantalla"
    def ventana_activa(self): return {"titulo": "Prueba", "proceso": "prueba", "hwnd": 0}
    def resumen(self, con_texto=True): return "Ventana activa: «Prueba»."


dichos = []
ej = acc.Ejecutor(LectorFalso(), decir=dichos.append)
acc.time.sleep = lambda s: None
comprobar("Chrome" in ej.abrir_programa("Chrome") and abiertos[-1] == "chrome", "abrir_programa chrome → startfile")
ej.abrir_programa("YouTube")
comprobar(abiertos[-1].startswith("https://www.youtube"), "abrir_programa youtube → url")
ej.buscar_youtube("música relajante")
comprobar("results?search_query=m" in abiertos[-1], f"buscar_youtube → {abiertos[-1]}")
ej.buscar_web("el tiempo mañana")
comprobar("google.com/search?q=el+tiempo" in abiertos[-1], f"buscar_web → {abiertos[-1]}")
ej.escribir("hola")
comprobar(registro[-1] == ("escribir", "hola"), "escribir")
ej.pulsar("Intro")
comprobar(registro[-1] == ("tecla", "enter"), "pulsar intro → enter")
ej.pulsar("ctrl + s")
comprobar(registro[-1] == ("atajo", ("ctrl", "s")), "pulsar ctrl+s → atajo")
r = ej.clic("aceptar")
comprobar(("moveTo", 100, 200) in registro and registro[-1] == ("click", "left") and "Aceptar" in r, f"clic por nombre: {r}")
r = ej.clic("enviar")
comprobar("No encuentro" in r and "Cancelar" in r, f"clic inexistente explica qué ve: {r[:70]}")
comprobar("Texto de prueba" in ej.leer_pantalla(), "leer_pantalla")
ej.decir("hola")
comprobar(dichos == ["hola"], "decir usa la voz")
comprobar("desconocida" in ej.ejecutar({"tipo": "volar"}), "acción desconocida se explica")
comprobar("Programa desconocido" not in ej.ejecutar({"tipo": "abrir_programa", "nombre": "Zoom"}) and registro[-3][0] == "atajo",
          "programa desconocido: se busca en el menú Inicio")

print("3. Cerebro de reglas")
cr = cer.CerebroReglas()
casos = [("abre chrome", "abrir_programa"), ("Busca en youtube música para dormir", "buscar_youtube"),
         ("pon música relajante", "buscar_youtube"), ("busca el tiempo de mañana", "buscar_web"),
         ("escribe hola mamá", "escribir"), ("pulsa intro", "pulsar"), ("lee la pantalla", "leer_pantalla"),
         ("cierra esta ventana", "pulsar"), ("cuéntame un chiste", "decir")]
for peticion, esperado in casos:
    cr.iniciar(peticion, "")
    a, _ = cr.siguiente()
    comprobar(a["tipo"] == esperado, f"«{peticion}» → {a}")
cr.iniciar("abre chrome", "")
cr.siguiente()
a2, _ = cr.siguiente()
comprobar(a2["tipo"] == "terminado", "tras la acción viene terminado")

print("4. Bucle completo con reglas")
asist = nucleo.Asistente()
mensajes = []
asist.al_mensaje = lambda t, tipo: mensajes.append((tipo, t))
asist.decir = dichos.append
asist.lector = LectorFalso()
asist.ejecutor = ej
cer.crear_cerebro = lambda preferencia=None: cer.CerebroReglas()
nucleo.cerebro_mod.crear_cerebro = cer.crear_cerebro
asist.pedir("busca en youtube canciones infantiles")
asist.hilo.join(10)
comprobar(not asist.ocupado, "termina")
comprobar(any(tipo == "accion" and "buscar_youtube" in t for tipo, t in mensajes), f"registró la acción: {mensajes}")
comprobar("youtube.com/results" in abiertos[-1], "y la ejecutó")

print("5. Ollama (si responde)")
modelos = cer.ollama_disponible()
if modelos:
    co = cer.CerebroOllama(next((m for m in modelos if "8b" in m), modelos[0]))
    t0 = time.time()
    co.iniciar("busca en youtube videos de relajación y pon el primero",
               "Ventana activa: «Nueva pestaña - Google Chrome» (programa chrome).\nControles visibles: campo «Barra de direcciones»; botón «Buscar con Google»; enlace «Gmail».")
    a, decir = co.siguiente()
    print(f"    {co.nombre} tardó {time.time() - t0:.1f} s → {a} / decir={decir!r}")
    comprobar(a is not None and a.get("tipo") in acc.ACCIONES, "devuelve una acción válida")
    co.informar("Busqué «videos de relajación» en YouTube; los resultados están en pantalla.",
                "Ventana activa: «videos de relajación - YouTube» (programa chrome).\nControles visibles: enlace «Música relajante para dormir 8 horas»; enlace «Relajación guiada 10 minutos»; botón «Buscar».")
    a, decir = co.siguiente()
    print(f"    segundo paso → {a} / decir={decir!r}")
    comprobar(a is not None and a.get("tipo") in acc.ACCIONES, "segundo paso válido")
else:
    print("    Ollama no responde: se omite")

root.destroy()
print(f"\n{'Todo bien' if fallos == 0 else str(fallos) + ' fallos'}")
sys.exit(1 if fallos else 0)
