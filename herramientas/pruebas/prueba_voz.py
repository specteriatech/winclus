"""Órdenes por voz y dictado, sin micrófono.

Se le dan a Winclus las frases ya reconocidas (lo que el motor de Windows
habría oído) y se comprueba qué hace con ellas:

1. Entender: cada frase se convierte en la acción que toca.
2. Gramática: todas las frases que se le pasan al motor se entienden después
   (si no, el motor oiría cosas que Winclus no sabe hacer).
3. Dictado: puntuación, mayúsculas, espacios y las correcciones («borra eso»,
   «borra palabra», «borra todo»).
4. Recorrido entero con ganchos falsos: nada escribe ni mueve el ratón de
   verdad, pero se ve qué se habría escrito y pulsado.
5. Escucha: qué dice el equipo de su propio micrófono y de su motor de voz,
   y que pedir dictado sin «Reconocimiento de voz en línea» no cuelga nada.

No toca la configuración ni el perfil.
"""
import os
import sys

RAIZ = r"C:\Users\RYZEN\Documents\puntero libre"
os.chdir(RAIZ)
sys.path.insert(0, RAIZ)

from src import ordenes_voz  # noqa: E402
from src.ordenes_voz import Dictado, EjecutorVoz, interpretar  # noqa: E402

fallos = 0


def comprobar(cond, texto):
    global fallos
    print(("  OK   " if cond else "  FALLO") + " " + texto)
    if not cond:
        fallos += 1


def accion(frase, dictando=False):
    return interpretar(frase, dictando=dictando)


print("1. Entender las órdenes")
casos = [
    ("Baja.", "rueda"), ("sube un poco", "rueda"), ("al final", "pulsar"),
    ("clic", "clic"), ("clic derecho", "clic_derecho"), ("doble clic", "doble_clic"),
    ("pulsa Aceptar", "clic_control"), ("abre el Bloc de notas", "abrir"),
    ("busca en YouTube gatos", "buscar_youtube"), ("busca la hora en Bogotá", "buscar_web"),
    ("escribe hola qué tal", "escribir"), ("intro", "pulsar"), ("copia", "pulsar"),
    ("pausa", "pausar"), ("sigue", "seguir"), ("teclado", "teclado"),
    ("lee la pantalla", "leer_pantalla"), ("calla", "callar"),
    ("dicta", "dictado_on"), ("deja de escuchar", "parar_escucha"),
    ("qué puedo decir", "ayuda"), ("crocodilo bombardiro", "no_entendido"),
]
malas = [(f, accion(f)["tipo"]) for f, esperado in casos if accion(f)["tipo"] != esperado]
comprobar(not malas, f"{len(casos)} frases dan la acción esperada" + (f" (fallan {malas})" if malas else ""))
comprobar(accion("pulsa Aceptar")["nombre"] == "Aceptar", "«pulsa Aceptar» guarda el nombre con su mayúscula")
comprobar(accion("abre el Bloc de notas")["nombre"] == "Bloc de notas",
          "«abre el Bloc de notas» quita el artículo y deja el nombre")
comprobar(accion("escribe hola qué tal")["texto"] == "hola qué tal",
          "«escribe…» conserva las tildes de lo que se dijo")
comprobar(accion("busca en YouTube gatos monos")["consulta"] == "gatos monos",
          "«busca en YouTube…» se queda con la consulta")
comprobar(ordenes_voz.es_programa("bloc de notas") and not ordenes_voz.es_programa("Aceptar"),
          "sabe qué nombres son programas y cuáles no")
comprobar(accion("baja", dictando=True)["tipo"] == "dictar",
          "mientras se dicta, «baja» se escribe en vez de mover la página")
comprobar(accion("borra eso", dictando=True)["tipo"] == "dictado_borrar_ultimo",
          "pero «borra eso» sigue corrigiendo mientras se dicta")
comprobar(accion("para el dictado", dictando=True)["tipo"] == "dictado_off",
          "y «para el dictado» lo apaga")

print("2. La gramática del motor y lo que Winclus entiende van juntas")
sueltas = [f for f in ordenes_voz.FRASES_BASE if accion(f)["tipo"] in ("no_entendido", "nada")]
comprobar(not sueltas, f"las {len(ordenes_voz.FRASES_BASE)} frases fijas se entienden" +
          (f" (sueltas: {sueltas})" if sueltas else ""))
gram = ordenes_voz.frases_gramatica(["Aceptar", "Cancelar", "x", "Guardar como…"])
comprobar("pulsa Aceptar" in gram and "abre Cancelar" in gram,
          "los botones de la ventana entran en la lista de lo que se puede oír")
comprobar("pulsa x" not in gram, "los nombres de una letra no entran (el motor no los distingue)")
comprobar("pulsa Guardar como" in gram, "los puntos suspensivos del menú no ensucian la frase")
comprobar("abre calculadora" in gram, "los programas conocidos también se pueden abrir por voz")
comprobar(len(gram) <= ordenes_voz.MAX_FRASES, f"la lista no pasa de {ordenes_voz.MAX_FRASES} frases")

print("3. Dictado: puntuación, mayúsculas y correcciones")
d = Dictado()
d.procesar("hola qué tal")
d.procesar("coma")
d.procesar("me llamo Alfredo")
d.procesar("punto")
comprobar(d.texto == "Hola qué tal, me llamo Alfredo.",
          f"escribe «{d.texto}» (mayúscula al empezar, coma pegada, punto final)")
d.procesar("nueva línea")
d.procesar("esto funciona")
comprobar(d.texto.endswith("\nEsto funciona"), "tras un salto de línea vuelve la mayúscula")
d.procesar("punto")
d.procesar("mayúscula winclus")
comprobar(d.texto.endswith(". Winclus"), "«mayúscula» fuerza la mayúscula de la palabra siguiente")
antes = d.texto
d.procesar("no quería decir esto")
borrado = d.borrar_ultimo()
comprobar(borrado[0]["tipo"] == "borrar" and d.texto == antes,
          f"«borra eso» quita {borrado[0]['n']} letras y deja el texto como estaba")
d.borrar_palabra()
comprobar(d.texto.endswith(". ") or d.texto.endswith("."),
          f"«borra palabra» quita la última palabra: «{d.texto[-20:]}»")
pasos = d.borrar_todo()
comprobar([p["tipo"] for p in pasos] == ["pulsar", "borrar"] and d.texto == "",
          "«borra todo» selecciona el campo y lo vacía")
d2 = Dictado()
d2.procesar("dos puntos")
comprobar(d2.texto == ":", "«dos puntos» gana a «punto» (se busca lo más largo primero)")
d3 = Dictado()
d3.procesar("abre interrogación cómo estás cierra interrogación")
comprobar(d3.texto == "¿Cómo estás?", f"la interrogación española se abre y se cierra: «{d3.texto}»")

print("4. El recorrido entero con ganchos falsos")
hecho = []


def ganchos(encontrado=True):
    return {
        "escribir": lambda t: hecho.append(("escribir", t)),
        "borrar": lambda n: hecho.append(("borrar", n)),
        "pulsar": lambda c: hecho.append(("pulsar", c)),
        "clic": lambda: hecho.append(("clic",)),
        "rueda": lambda d: hecho.append(("rueda", d)),
        "clic_control": lambda n: hecho.append(("clic_control", n)) or encontrado,
        "abrir_programa": lambda n: hecho.append(("abrir_programa", n)),
        "buscar_web": lambda c: hecho.append(("buscar_web", c)),
        "decir": lambda t: hecho.append(("decir", t[:20])),
        "pausar": lambda: hecho.append(("pausar",)),
        "parar_escucha": lambda: hecho.append(("parar_escucha",)),
        "avisar": lambda t, err=False: hecho.append(("aviso", t, err)),
    }


e = EjecutorVoz(ganchos())
e.oir("baja")
comprobar(("rueda", -3) in hecho, "«baja» mueve la rueda hacia abajo")
e.oir("pulsa Aceptar")
comprobar(("clic_control", "Aceptar") in hecho, "«pulsa Aceptar» busca el botón y lo pulsa")
e.oir("abre el bloc de notas")
comprobar(("abrir_programa", "bloc de notas") in hecho, "«abre el bloc de notas» abre el programa")
hecho.clear()
e.oir("abre Ventas del mes")
comprobar(("clic_control", "Ventas del mes") in hecho,
          "lo que no es un programa se busca como botón en la ventana")
hecho.clear()
perdido = EjecutorVoz(ganchos(encontrado=False))
perdido.oir("pulsa Enviar")
comprobar(any(p[0] == "aviso" and p[2] for p in hecho), "si no encuentra el botón, avisa del error")
hecho.clear()
e.oir("dicta")
comprobar(e.dictando, "«dicta» enciende el dictado")
e.oir("buenos días a todos")
comprobar(("escribir", "Buenos días a todos") in hecho, "y lo siguiente se escribe tal cual")
hecho.clear()
e.oir("borra eso")
comprobar(hecho and hecho[0] == ("borrar", len("Buenos días a todos")),
          "«borra eso» manda tantos borrados como letras escribió")
hecho.clear()
e.oir("para el dictado")
comprobar(not e.dictando, "«para el dictado» vuelve a las órdenes")
e.oir("pausa")
comprobar(("pausar",) in hecho, "y las órdenes normales vuelven a funcionar")

print("5. Dictado con confirmación")
hecho.clear()
c = EjecutorVoz(ganchos())
c.confirmar = True
c.dictando = True
c.oir("hola mundo")
comprobar(not any(p[0] == "escribir" for p in hecho), "con confirmación, lo dictado no se escribe aún")
comprobar(any(p[0] == "aviso" and "¿Escribo" in p[1] for p in hecho), "se pregunta qué se ha entendido")
c.oir("sí")
comprobar(("escribir", "Hola mundo") in hecho, "al decir «sí» se escribe")
hecho.clear()
c.oir("esto no lo quiero")
c.oir("no")
comprobar(not any(p[0] == "escribir" for p in hecho), "al decir «no» no se escribe nada")
comprobar(c.dictado.texto == "Hola mundo", "y lo descartado no se queda en el texto dictado")

print("6. El micrófono y el motor de este equipo")
from src.escucha import Escucha  # noqa: E402

est = Escucha().comprobar()
print("     " + Escucha().texto_estado())
comprobar(isinstance(est, dict) and "disponible" in est, "comprobar() responde sin encender nada")
comprobar(est["disponible"] is False or est["idioma"],
          "si hay motor, dice en qué idioma escucha" if est["disponible"] else
          "si no hay motor, dice qué hacer")
comprobar(not est["disponible"] or "escuchar" in Escucha().texto_estado().lower(),
          "el texto de estado está en español y sin jerga")
if est["disponible"] and not est["en_linea"]:
    avisos = []
    ok = Escucha().empezar(lambda f: None, lambda t, err=False: avisos.append((t, err)), "dictado")
    comprobar(ok is False and avisos and avisos[0][1],
              "pedir dictado sin «voz en línea» no arranca y explica por qué")
    comprobar("línea" in avisos[0][0], "el aviso dice justo qué hay que encender en Windows")
else:
    comprobar(True, "(este equipo tiene la voz en línea encendida: el dictado libre puede arrancar)")
    comprobar(True, "(sin comprobar el aviso de «voz en línea»)")

print("7. Cuando Winclus no oye, tiene que decir por qué")
from src.microfono import Microfono, diagnostico  # noqa: E402

comprobar(diagnostico(0.0, True, 0.8, False, "Casco") .startswith("Tu micrófono «Casco» está en silencio"),
          "micrófono silenciado: lo dice y explica dónde encenderlo")
comprobar("casi a cero" in diagnostico(0.0, False, 0.05, False),
          "volumen casi a cero: lo dice con el porcentaje")
comprobar("No me llega nada" in diagnostico(0.0, False, 0.8, False),
          "sin señal: propone mirar cuál es el micrófono que se usa")
comprobar("muy bajito" in diagnostico(0.07, False, 0.8, False),
          "señal floja: pide acercar el micrófono")
comprobar("no entiendo" in diagnostico(0.4, False, 0.8, False),
          "hay voz pero no se entiende: se dice así, no «no te oigo»")
comprobar(diagnostico(0.0, True, 0.0, True) == "",
          "si ha entendido algo, no da la lata con el micrófono")
mic = Microfono()
est = mic.estado()
print("     micrófono de este equipo:", est)
comprobar(set(est) == {"hay", "nombre", "silenciado", "volumen"}, "el estado del micrófono trae las cuatro cosas")
comprobar(not est["hay"] or est["nombre"], "si hay micrófono, se sabe cuál es (nombre de Windows)")
comprobar(0.0 <= mic.pico() <= 1.0, "el medidor de Windows responde (0 si nadie está capturando)")

print()
print("FALLOS:", fallos)
sys.exit(1 if fallos else 0)
