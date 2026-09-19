"""De lo que se oye a lo que hace Winclus: órdenes por voz y dictado.

Este módulo no toca el micrófono ni Windows: convierte una frase en una
acción, para poder probarlo entero sin hablar
(`herramientas\\pruebas\\prueba_voz.py`). Quien oye es `src/escucha.py`
y quien mueve el ratón y escribe es `EjecutorVoz`, al final del archivo.

Hay dos modos:

* **Órdenes**: «baja», «clic», «pulsa Aceptar», «abre el bloc de notas»,
  «escribe hola»… Cada frase es una orden completa.
* **Dictado**: todo lo que se dice se escribe, salvo unas pocas frases de
  corrección («borra eso», «borra palabra»), los signos de puntuación
  («punto», «coma», «nueva línea») y «mayúscula». Así se puede escribir un
  texto largo sin que una palabra suelta dispare una orden.

Se puede pedir confirmación antes de escribir lo dictado: Winclus enseña lo
que ha entendido y espera un «sí» o un «no».
"""

import logging
import re
import unicodedata

logger = logging.getLogger("OrdenesVoz")

# --------------------------------------------------------------- utilidades --


def sin_acentos(texto: str) -> str:
    """«pulsá Acción» -> «pulsa accion»: para comparar sin tildes ni mayúsculas."""
    plano = unicodedata.normalize("NFD", texto)
    plano = "".join(c for c in plano if unicodedata.category(c) != "Mn")
    return plano.lower()


def normalizar(frase: str) -> str:
    """Lo que devuelve el reconocedor, listo para comparar con las órdenes.

    Quita la puntuación que el motor añade por su cuenta (un punto final, los
    signos de interrogación) y los espacios de sobra.
    """
    t = sin_acentos(frase).strip()
    t = t.strip("¿?¡!.,;:\"'()[] ")
    return re.sub(r"\s+", " ", t)


# ------------------------------------------------------------------ dictado --

# Lo que se dice -> lo que se escribe. Se busca primero lo más largo, para que
# «punto y coma» no se quede en «punto».
SIGNOS = {
    "punto y coma": ";",
    "punto y aparte": "\n\n",
    "punto y seguido": ". ",
    "dos puntos": ":",
    "puntos suspensivos": "…",
    "signo de interrogacion": "?",
    "cierra interrogacion": "?",
    "abre interrogacion": "¿",
    "signo de exclamacion": "!",
    "cierra exclamacion": "!",
    "abre exclamacion": "¡",
    "abre parentesis": "(",
    "cierra parentesis": ")",
    "abre comillas": "«",
    "cierra comillas": "»",
    "nueva linea": "\n",
    "salto de linea": "\n",
    "nuevo parrafo": "\n\n",
    "barra baja": "_",
    "guion bajo": "_",
    "punto": ".",
    "coma": ",",
    "interrogacion": "?",
    "exclamacion": "!",
    "comillas": "\"",
    "guion": "-",
    "raya": "—",
    "arroba": "@",
    "almohadilla": "#",
    "asterisco": "*",
    "barra": "/",
    "mas": "+",
    "porciento": "%",
    "euro": "€",
    "peso": "$",
    "dolar": "$",
    "espacio": " ",
    "tabulador": "\t",
}

# Frases que cambian cómo se escribe lo siguiente, no lo que se escribe.
MAYUSCULA_UNA = ("mayuscula", "en mayuscula", "mayuscula inicial")
MAYUSCULA_FIJA = ("todo mayusculas", "mayusculas", "bloqueo de mayusculas")
MINUSCULA_FIJA = ("fin de mayusculas", "quita mayusculas", "minusculas", "en minusculas")

# Después de estos signos, la siguiente palabra va en mayúscula.
FIN_DE_FRASE = (".", "?", "!", "\n", "…")

# No se separa con espacio lo que va pegado a la palabra anterior o siguiente.
SIN_ESPACIO_ANTES = ".,;:?!)»…%\n\t"
SIN_ESPACIO_DESPUES = "¿¡(«\n\t"

MAX_BORRADO = 400        # «borra eso» nunca borra más que esto, por seguridad


def _trocear(palabras, signos=SIGNOS):
    """Parte la frase en piezas: ('signo', '.') , ('mayus', 'una') o ('palabra', 'hola').

    Busca primero las expresiones de tres palabras, luego las de dos y luego
    las de una, para que «punto y coma» gane a «punto».
    """
    piezas, i = [], 0
    especiales = {}
    for frases, etiqueta in ((MAYUSCULA_UNA, "una"), (MAYUSCULA_FIJA, "fija"), (MINUSCULA_FIJA, "quitar")):
        for f in frases:
            especiales[f] = etiqueta
    while i < len(palabras):
        encontrado = False
        for n in (4, 3, 2, 1):
            if i + n > len(palabras):
                continue
            trozo = " ".join(palabras[i:i + n])
            llano = sin_acentos(trozo)
            if llano in signos:
                piezas.append(("signo", signos[llano]))
            elif llano in especiales:
                piezas.append(("mayus", especiales[llano]))
            else:
                continue
            i += n
            encontrado = True
            break
        if not encontrado:
            piezas.append(("palabra", palabras[i]))
            i += 1
    return piezas


class Dictado:
    """Va guardando lo que se lleva dictado para escribirlo bien.

    Sabe cuándo poner mayúscula (al empezar y después de un punto), cuándo
    hace falta un espacio y cuánto hay que borrar si se dice «borra eso».
    """

    def __init__(self):
        self.reiniciar()

    def reiniciar(self):
        self.texto = ""              # todo lo dictado desde que se empezó
        self.ultimo = ""             # la última frase escrita («borra eso»)
        self.mayus_una = True        # la primera palabra va en mayúscula
        self.mayus_fija = False

    # ------------------------------------------------------------ escribir --
    def _mayuscula_toca(self) -> bool:
        if self.mayus_una:
            return True
        t = self.texto.rstrip(" ")
        if not t:
            return True
        return t[-1] in FIN_DE_FRASE

    def _pegar(self, pieza: str, es_palabra: bool) -> str:
        """Devuelve lo que hay que escribir de verdad (con su espacio delante)."""
        anterior = self.texto[-1:] if self.texto else ""
        espacio = ""
        if es_palabra or pieza[0] not in SIN_ESPACIO_ANTES:
            if anterior and anterior not in SIN_ESPACIO_DESPUES and anterior != " ":
                espacio = " "
        if es_palabra:
            if self.mayus_fija:
                pieza = pieza.upper()
            elif self._mayuscula_toca():
                pieza = pieza[:1].upper() + pieza[1:]
            # Si no toca mayúscula se deja tal cual: los nombres propios que
            # el reconocedor devuelve en mayúscula («Alfredo») se respetan.
            self.mayus_una = False
        return espacio + pieza

    def procesar(self, frase: str) -> list:
        """La frase oída -> acciones que hay que ejecutar (escribir o borrar)."""
        frase = frase.strip()
        if not frase:
            return []
        palabras = frase.split()
        salida = ""
        for tipo, valor in _trocear(palabras):
            if tipo == "mayus":
                if valor == "una":
                    self.mayus_una = True
                elif valor == "fija":
                    self.mayus_fija = True
                else:
                    self.mayus_fija = False
                continue
            trozo = self._pegar(valor, tipo == "palabra")
            salida += trozo
            self.texto += trozo
        if not salida:
            return []
        self.ultimo = salida
        return [{"tipo": "escribir", "texto": salida, "resumen": salida.strip()}]

    # ------------------------------------------------------------ corregir --
    def borrar_ultimo(self) -> list:
        """«Borra eso»: quita lo último que se escribió."""
        n = min(len(self.ultimo), MAX_BORRADO)
        if n == 0:
            return [{"tipo": "nada", "resumen": "No hay nada dictado que borrar"}]
        self.texto = self.texto[:-n]
        self.ultimo = ""
        return [{"tipo": "borrar", "n": n, "resumen": "Borrado lo último"}]

    def borrar_palabra(self) -> list:
        """«Borra palabra»: quita la última palabra dictada (y su espacio)."""
        recortado = re.sub(r"[^\s]*\s*$", "", self.texto)
        n = min(len(self.texto) - len(recortado), MAX_BORRADO)
        if n == 0:
            return [{"tipo": "nada", "resumen": "No hay ninguna palabra que borrar"}]
        self.texto = recortado
        self.ultimo = ""
        return [{"tipo": "borrar", "n": n, "resumen": "Palabra borrada"}]

    def borrar_todo(self) -> list:
        """«Borra todo»: selecciona lo que hay en el campo y lo quita."""
        self.reiniciar()
        return [{"tipo": "pulsar", "combo": "ctrl+a", "resumen": "Todo seleccionado"},
                {"tipo": "borrar", "n": 1, "resumen": "Campo vacío"}]


# ------------------------------------------------------------------ órdenes --

def _o(tipo, resumen, **extra):
    accion = {"tipo": tipo, "resumen": resumen}
    accion.update(extra)
    return accion


# Frases de corrección y de control que funcionan también mientras se dicta.
# (expresión, función que devuelve la acción)
ORDENES_DICTADO = [
    (r"^(para|parar|deja de|dejar de) (el )?(dictado|dictar|escribir)$|^fin del dictado$",
     lambda m, t: _o("dictado_off", "Dictado parado")),
    (r"^(borra|borrar|quita|quitar)( eso| esto| lo ultimo)?$|^borralo$",
     lambda m, t: _o("dictado_borrar_ultimo", "Borrar lo último")),
    (r"^(borra|borrar|quita|quitar) (la )?(ultima )?palabra$",
     lambda m, t: _o("dictado_borrar_palabra", "Borrar la palabra")),
    (r"^(borra|borrar) (todo|el campo|lo escrito)$",
     lambda m, t: _o("dictado_borrar_todo", "Borrar todo")),
    (r"^(intro|enter|entrar|nueva linea y ya|enviar)$",
     lambda m, t: _o("pulsar", "Intro", combo="enter")),
    (r"^(tabulador|tabula|siguiente campo)$",
     lambda m, t: _o("pulsar", "Tabulador", combo="tab")),
    (r"^(calla|callate|silencio|para de hablar)$",
     lambda m, t: _o("callar", "Callar")),
    (r"^(deja de escuchar|para de escuchar|apaga el microfono)$",
     lambda m, t: _o("parar_escucha", "Dejar de escuchar")),
]

# Órdenes normales. El orden importa: lo más concreto primero.
ORDENES = [
    # --- moverse por la página ---
    (r"^(baja|bajar|abajo)( un poco| mas)?$",
     lambda m, t: _o("rueda", "Bajar", delta=-3)),
    (r"^(sube|subir|arriba)( un poco| mas)?$",
     lambda m, t: _o("rueda", "Subir", delta=3)),
    (r"^(baja|bajar) (mucho|del todo|hasta abajo)$|^al final$",
     lambda m, t: _o("pulsar", "Hasta abajo", combo="ctrl+end")),
    (r"^(sube|subir) (mucho|del todo|hasta arriba)$|^al principio$",
     lambda m, t: _o("pulsar", "Hasta arriba", combo="ctrl+home")),
    (r"^(pagina )?(siguiente|abajo de pagina)$",
     lambda m, t: _o("pulsar", "Página abajo", combo="pagedown")),
    (r"^pagina anterior$",
     lambda m, t: _o("pulsar", "Página arriba", combo="pageup")),
    # --- clics ---
    (r"^(clic|click|pulsa|pulsar|dale|pincha)$",
     lambda m, t: _o("clic", "Clic")),
    (r"^(clic|click) derecho$|^menu contextual$",
     lambda m, t: _o("clic_derecho", "Clic derecho")),
    (r"^doble (clic|click)$",
     lambda m, t: _o("doble_clic", "Doble clic")),
    (r"^(arrastra|arrastrar|coge|agarra)$",
     lambda m, t: _o("arrastrar", "Arrastrando: di «suelta» para soltar")),
    (r"^(suelta|soltar|deja)$",
     lambda m, t: _o("soltar", "Soltado")),
    # --- escribir ---
    (r"^(escribe|escribir|poner) (.+)$",
     lambda m, t: _o("escribir", "Escribir", texto=_cola(m, t))),
    (r"^(dicta|dictar|empieza a dictar|escribe lo que digo|dictado)$",
     lambda m, t: _o("dictado_on", "Dictado encendido")),
    (r"^(borra|borrar)( una letra| atras)?$",
     lambda m, t: _o("borrar", "Borrar", n=1)),
    (r"^(borra|borrar) (la )?(ultima )?palabra$",
     lambda m, t: _o("pulsar", "Palabra borrada", combo="ctrl+backspace")),
    (r"^(borra|borrar) (todo|el campo)$",
     lambda m, t: _o("borrar_campo", "Campo vacío")),
    (r"^(intro|enter|entrar|enviar|acepta)$",
     lambda m, t: _o("pulsar", "Intro", combo="enter")),
    (r"^(escape|cancela|cancelar)$",
     lambda m, t: _o("pulsar", "Escape", combo="esc")),
    (r"^(tabulador|siguiente campo|tabula)$",
     lambda m, t: _o("pulsar", "Tabulador", combo="tab")),
    (r"^(campo )?anterior$",
     lambda m, t: _o("pulsar", "Campo anterior", combo="shift+tab")),
    (r"^(copia|copiar)$", lambda m, t: _o("pulsar", "Copiado", combo="ctrl+c")),
    (r"^(pega|pegar)$", lambda m, t: _o("pulsar", "Pegado", combo="ctrl+v")),
    (r"^(corta|cortar)$", lambda m, t: _o("pulsar", "Cortado", combo="ctrl+x")),
    (r"^(guarda|guardar)$", lambda m, t: _o("pulsar", "Guardar", combo="ctrl+s")),
    (r"^(deshaz|deshacer|atras del todo)$", lambda m, t: _o("pulsar", "Deshecho", combo="ctrl+z")),
    (r"^(selecciona|seleccionar) todo$", lambda m, t: _o("pulsar", "Todo seleccionado", combo="ctrl+a")),
    # --- moverse por Windows ---
    # «Pulsa» busca un botón o un enlace en la ventana (UI Automation); «abre»
    # prueba primero con los programas y, si no es ninguno, con la ventana.
    (r"^(pulsa|pulsar|dale a|elige|escoge|selecciona|marca) (el |la |los |las )?(.+)$",
     lambda m, t: _o("clic_control", "Pulsar «" + _cola(m, t) + "»", nombre=_cola(m, t))),
    (r"^(abre|abrir|arranca|ve a|ir a|entra en|entra a) (el |la |los |las )?(programa )?(.+)$",
     lambda m, t: _o("abrir", "Abrir " + _cola(m, t), nombre=_cola(m, t))),
    (r"^(busca|buscar|buscame) en youtube (.+)$",
     lambda m, t: _o("buscar_youtube", "Buscar en YouTube", consulta=_cola(m, t))),
    (r"^(busca|buscar|buscame) (.+)$",
     lambda m, t: _o("buscar_web", "Buscar en Google", consulta=_cola(m, t))),
    (r"^(atras|volver|vuelve|pagina atras)$",
     lambda m, t: _o("pulsar", "Atrás", combo="alt+left")),
    (r"^(adelante|pagina adelante)$",
     lambda m, t: _o("pulsar", "Adelante", combo="alt+right")),
    (r"^(cambia|cambiar) (de )?ventana$",
     lambda m, t: _o("pulsar", "Cambiar de ventana", combo="alt+tab")),
    (r"^(cierra|cerrar) (la )?ventana$",
     lambda m, t: _o("pulsar", "Cerrar la ventana", combo="alt+f4")),
    (r"^(minimiza|minimizar)$", lambda m, t: _o("pulsar", "Minimizar", combo="win+down")),
    (r"^(escritorio|ver el escritorio)$", lambda m, t: _o("pulsar", "Escritorio", combo="win+d")),
    # --- Winclus ---
    (r"^(pausa|pausar|para el puntero|para|quieto)$",
     lambda m, t: _o("pausar", "Puntero en pausa")),
    (r"^(sigue|seguir|continua|reanuda|activa|adelante con el puntero)$",
     lambda m, t: _o("seguir", "Puntero en marcha")),
    (r"^(centro|centrar|recentrar|al centro)$",
     lambda m, t: _o("recentrar", "Recentrar")),
    (r"^(teclado|abre el teclado|cierra el teclado|muestra el teclado)$",
     lambda m, t: _o("teclado", "Teclado")),
    (r"^(menu|menu de clics|abre el menu)$",
     lambda m, t: _o("menu", "Menú de clics")),
    (r"^(lee|leer|lee la pantalla|que hay en la pantalla|donde estoy)$",
     lambda m, t: _o("leer_pantalla", "Leer la pantalla")),
    (r"^(calla|callate|silencio|para de hablar)$",
     lambda m, t: _o("callar", "Callar")),
    (r"^(di|dice|decir|repite) (.+)$",
     lambda m, t: _o("decir", "Decir", texto=_cola(m, t))),
    (r"^(asistente|pregunta al asistente|abre el asistente)$",
     lambda m, t: _o("asistente", "Asistente")),
    (r"^(deja de escuchar|para de escuchar|apaga el microfono|deja de oirme)$",
     lambda m, t: _o("parar_escucha", "Dejar de escuchar")),
    (r"^(ayuda|que puedo decir|que digo|ordenes)$",
     lambda m, t: _o("ayuda", "Qué puedo decir")),
]

ORDENES_COMPILADAS = [(re.compile(p), f) for p, f in ORDENES]
ORDENES_DICTADO_COMPILADAS = [(re.compile(p), f) for p, f in ORDENES_DICTADO]

AYUDA = ("Puedes decir: baja, sube, clic, doble clic, clic derecho, "
         "pulsa y el nombre de un botón, escribe y lo que quieras, dicta, "
         "borra, intro, copia, pega, abre el bloc de notas, busca gatos, "
         "atrás, lee la pantalla, teclado, menú, pausa, sigue, calla, "
         "y deja de escuchar.")


def _cola(m, frase: str) -> str:
    """Lo que viene después de la orden, tal como se dijo (con tildes).

    Las expresiones se comparan sin tildes y en minúsculas, así que el texto
    de verdad se saca contando cuántas palabras ocupa el último grupo: «abre
    el Bloc de notas» -> «Bloc de notas».
    """
    payload = (m.groups()[-1] or "").strip()
    n = len(payload.split())
    palabras = frase.strip().strip(" .,¿?¡!").split()
    if not n or n > len(palabras):
        return " ".join(palabras).strip()
    return " ".join(palabras[len(palabras) - n:]).strip()


# --------------------------------------------------- gramática del motor --
# El reconocimiento de órdenes de Windows funciona sin internet solo si se le
# da la lista cerrada de lo que puede oír (src/escucha.py). Estas son las
# frases fijas; a ellas se les suman los botones de la ventana y los
# programas conocidos. Todas tienen que entenderse en `interpretar()`: eso lo
# comprueba herramientas\pruebas\prueba_voz.py, para que no se desparejen.
FRASES_BASE = [
    "baja", "baja un poco", "baja más", "abajo",
    "sube", "sube un poco", "sube más", "arriba",
    "baja del todo", "sube del todo", "al principio", "al final",
    "página siguiente", "página anterior",
    "clic", "pulsa", "dale", "pincha", "clic derecho", "doble clic",
    "arrastra", "suelta",
    "dicta", "empieza a dictar", "escribe lo que digo",
    "borra", "borra una letra", "borra la palabra", "borra todo", "borra el campo",
    "intro", "enviar", "acepta", "escape", "cancela",
    "tabulador", "siguiente campo", "campo anterior",
    "copia", "pega", "corta", "guarda", "deshaz", "selecciona todo",
    "atrás", "volver", "adelante", "cambia de ventana", "cierra la ventana",
    "minimiza", "escritorio",
    "pausa", "para el puntero", "sigue", "continúa",
    "centro", "recentrar", "teclado", "abre el teclado", "cierra el teclado",
    "menú", "menú de clics", "lee la pantalla", "dónde estoy",
    "calla", "silencio", "asistente",
    "deja de escuchar", "para de escuchar",
    "ayuda", "qué puedo decir",
]

# Lo que se puede decir mientras se dicta (ahí el motor oye texto libre, pero
# la lista sirve para la ayuda y para la prueba).
FRASES_DICTADO = [
    "para el dictado", "deja de dictar", "borra eso", "borra la palabra",
    "borra todo", "punto", "coma", "nueva línea", "nuevo párrafo",
    "mayúscula", "intro", "calla", "deja de escuchar",
]

MAX_FRASES = 400          # el motor de Windows se atraganta con listas enormes


def _limpia_nombre(nombre: str) -> str:
    """Un nombre de botón que el motor pueda oír: corto y sin símbolos raros."""
    n = re.sub(r"\s+", " ", str(nombre or "")).strip(" .:;,…")
    n = re.sub(r"[^\w áéíóúüñÁÉÍÓÚÜÑ-]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n if 2 <= len(n) <= 40 and any(c.isalpha() for c in n) else ""


def frases_gramatica(controles=(), con_programas: bool = True) -> list:
    """Todo lo que el motor puede oír: las órdenes fijas, los botones y los programas."""
    frases = list(FRASES_BASE)
    for nombre in controles:
        limpio = _limpia_nombre(nombre)
        if limpio:
            frases.append("pulsa " + limpio)
            frases.append("abre " + limpio)
    if con_programas:
        for nombre in programas_conocidos():
            frases.append("abre " + nombre)
    vistas, unicas = set(), []
    for f in frases:
        clave = sin_acentos(f)
        if clave not in vistas:
            vistas.add(clave)
            unicas.append(f)
    return unicas[:MAX_FRASES]


def programas_conocidos() -> list:
    try:
        from src.asistente.acciones import PROGRAMAS
    except Exception:
        return []
    return [n for n in PROGRAMAS if _limpia_nombre(n)]


def es_programa(nombre: str) -> bool:
    """¿«chrome», «bloc de notas», «calculadora»…? La lista es la del asistente."""
    try:
        from src.asistente.acciones import PROGRAMAS
    except Exception:                                # sin Windows (pruebas sueltas)
        PROGRAMAS = {"chrome": "", "bloc de notas": "", "calculadora": ""}
    clave = sin_acentos(nombre).strip()
    return clave in {sin_acentos(k) for k in PROGRAMAS}


def interpretar(frase: str, dictando: bool = False) -> dict:
    """La frase oída -> una acción. `dictando` cambia las reglas del juego."""
    llana = normalizar(frase)
    if not llana:
        return _o("nada", "No se entendió nada")
    tabla = ORDENES_DICTADO_COMPILADAS if dictando else ORDENES_COMPILADAS
    for expresion, construir in tabla:
        m = expresion.match(llana)
        if m:
            return construir(m, frase.strip())
    if dictando:
        return _o("dictar", "Escribir lo dictado", texto=frase.strip())
    return _o("no_entendido", "No entendí: " + frase.strip(), texto=frase.strip())


# ---------------------------------------------------------------- ejecutor --

SI = ("si", "vale", "correcto", "eso es", "adelante", "escribelo", "confirmo", "de acuerdo")
NO = ("no", "cancela", "cancelar", "borra", "eso no", "descarta", "no es eso")


class EjecutorVoz:
    """Recibe frases y las convierte en acciones de verdad.

    Todo lo que toca Windows entra por `ganchos`, un diccionario de funciones
    que pone main_gui.py: así el guion de prueba puede darle ganchos falsos y
    comprobar el recorrido entero sin escribir ni mover el ratón.

    Ganchos que se usan: escribir(texto), borrar(n), pulsar(combo), clic(),
    clic_derecho(), doble_clic(), arrastrar(), soltar(), rueda(delta),
    clic_control(nombre), abrir_programa(nombre), buscar_web(consulta),
    buscar_youtube(consulta), leer_pantalla(), decir(texto), callar(),
    pausar(), seguir(), recentrar(), teclado(), menu(), asistente(),
    parar_escucha(), avisar(texto, error=False).
    """

    def __init__(self, ganchos: dict = None):
        self.ganchos = dict(ganchos or {})
        self.dictado = Dictado()
        self.dictando = False
        self.confirmar = False       # pedir «sí» antes de escribir lo dictado
        self.pendiente = None        # texto a la espera de confirmación
        self.ultima_frase = ""
        self.ultimo_resumen = ""

    # ------------------------------------------------------------ ganchos --
    def _llamar(self, nombre, *args):
        f = self.ganchos.get(nombre)
        if f is None:
            logger.info(f"Sin gancho para {nombre}{args}")
            return None
        try:
            return f(*args)
        except Exception as e:                      # nunca tirar la escucha
            logger.warning(f"El gancho {nombre} falló: {e}")
            return None

    def _avisar(self, texto, error=False):
        self.ultimo_resumen = texto
        self._llamar("avisar", texto, error)

    # ------------------------------------------------------------- entrada --
    def oir(self, frase: str) -> dict:
        """Punto de entrada: una frase reconocida. Devuelve la acción hecha."""
        self.ultima_frase = frase.strip()
        llana = normalizar(frase)
        # 1. ¿Estamos esperando un «sí» o un «no»?
        if self.pendiente is not None:
            if llana in SI:
                texto = self.pendiente
                self.pendiente = None
                self._escribir(texto)
                return _o("escribir", "Escrito", texto=texto)
            if llana in NO:
                self.pendiente = None
                self.dictado.texto = self.dictado.texto[:-len(self.dictado.ultimo)] if self.dictado.ultimo else self.dictado.texto
                self.dictado.ultimo = ""
                self._avisar("Descartado")
                return _o("descartado", "Descartado")
            # Cualquier otra cosa sustituye a lo anterior: se vuelve a preguntar
            self.pendiente = None
        accion = interpretar(frase, dictando=self.dictando)
        return self.ejecutar(accion)

    def ejecutar(self, accion: dict) -> dict:
        tipo = accion.get("tipo", "")
        resumen = accion.get("resumen", "")
        if tipo == "dictar":
            self._dictar(accion.get("texto", ""))
            return accion
        if tipo == "escribir":
            self._escribir(accion.get("texto", ""))
            return accion
        if tipo in ("dictado_borrar_ultimo", "dictado_borrar_palabra", "dictado_borrar_todo"):
            metodo = {"dictado_borrar_ultimo": self.dictado.borrar_ultimo,
                      "dictado_borrar_palabra": self.dictado.borrar_palabra,
                      "dictado_borrar_todo": self.dictado.borrar_todo}[tipo]
            for paso in metodo():
                self._paso(paso)
            self._avisar(resumen)
            return accion
        if tipo == "dictado_on":
            self.dictando = True
            self.dictado.reiniciar()
            self._avisar("Dictado: di lo que quieras escribir")
            return accion
        if tipo == "dictado_off":
            self.dictando = False
            self.pendiente = None
            self._avisar("Dictado parado")
            return accion
        if tipo == "ayuda":
            self._llamar("decir", AYUDA)
            self._avisar("Qué puedo decir")
            return accion
        if tipo == "no_entendido":
            self._avisar(resumen, True)
            return accion
        if tipo == "nada":
            return accion
        self._paso(accion)
        if resumen:
            self._avisar(resumen)
        return accion

    # -------------------------------------------------------------- pasos --
    def _paso(self, accion: dict):
        """Una acción suelta contra los ganchos."""
        tipo = accion.get("tipo", "")
        if tipo == "escribir":
            self._llamar("escribir", accion.get("texto", ""))
        elif tipo == "borrar":
            self._llamar("borrar", int(accion.get("n", 1)))
        elif tipo == "borrar_campo":
            self._llamar("pulsar", "ctrl+a")
            self._llamar("borrar", 1)
        elif tipo == "pulsar":
            self._llamar("pulsar", accion.get("combo", ""))
        elif tipo == "rueda":
            self._llamar("rueda", int(accion.get("delta", -3)))
        elif tipo == "clic_control":
            nombre = accion.get("nombre", "")
            if self._llamar("clic_control", nombre) is False:
                self._avisar(f"No encuentro «{nombre}»", True)
        elif tipo == "abrir":
            # «Abre X»: si X es un programa conocido se abre; si no, se busca
            # un botón o un enlace con ese nombre en la ventana y, en último
            # caso, se busca X en el menú Inicio (eso ya lo hace el gancho).
            nombre = accion.get("nombre", "")
            if es_programa(nombre):
                self._llamar("abrir_programa", nombre)
            elif self._llamar("clic_control", nombre) is False:
                self._llamar("abrir_programa", nombre)
        elif tipo in ("abrir_programa", "buscar_web", "buscar_youtube"):
            self._llamar(tipo, accion.get("nombre") or accion.get("consulta", ""))
        elif tipo == "decir":
            self._llamar("decir", accion.get("texto", ""))
        elif tipo in ("clic", "clic_derecho", "doble_clic", "arrastrar", "soltar",
                      "pausar", "seguir", "recentrar", "teclado", "menu", "asistente",
                      "leer_pantalla", "callar", "parar_escucha"):
            self._llamar(tipo)
        else:
            logger.info(f"Acción sin ejecutar: {accion}")

    def _dictar(self, texto: str):
        pasos = self.dictado.procesar(texto)
        if not pasos:
            return
        escrito = pasos[0].get("texto", "")
        if self.confirmar:
            self.pendiente = escrito
            self._avisar(f"¿Escribo «{escrito.strip()}»? Di sí o no")
            return
        for paso in pasos:
            self._paso(paso)
        self._avisar(escrito.strip()[:60])

    def _escribir(self, texto: str):
        if not texto:
            return
        self._llamar("escribir", texto)
        self._avisar("Escrito: " + texto.strip()[:60])
