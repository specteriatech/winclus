"""El cerebro del asistente: decide la siguiente acción.

Tres motores, de mejor a peor:
- CerebroClaude: la API de Claude con herramientas (SDK oficial anthropic).
  Necesita una clave (ajuste «clave_claude» o variable ANTHROPIC_API_KEY).
- CerebroOllama: un modelo local de Ollama (http://localhost:11434), gratis y
  sin internet. Responde en JSON con una acción por turno.
- CerebroReglas: sin ningún modelo, entiende peticiones sencillas («abre
  chrome», «busca X», «escribe X», «lee la pantalla», «pulsa intro»).

Todos siguen el mismo ciclo: iniciar(petición, pantalla) → siguiente() →
informar(resultado, pantalla) → siguiente() … hasta la acción «terminado».
`crear_cerebro("auto")` elige el mejor disponible.
"""

import json
import logging
import os
import re

from src import ajustes_globales

logger = logging.getLogger("Cerebro")

MODELO_CLAUDE = "claude-opus-5"
MODELO_OLLAMA = "llama3.1:8b"
OLLAMA_URL = "http://localhost:11434"
MAX_PASOS = 12

SISTEMA = """Eres el asistente de Winclus, un programa que maneja Windows por una persona con discapacidad que no puede usar las manos. Ella te pide algo en español y tú lo haces paso a paso con las herramientas.

Reglas:
- Una acción por turno. Tras cada acción recibes el resultado y una lectura nueva de la pantalla (ventana activa, controles visibles y texto).
- Usa los nombres de los controles exactamente como aparecen en la lectura de pantalla cuando hagas clic.
- Prefiere las acciones de alto nivel: abrir_programa, buscar_web, buscar_youtube, abrir_web. Solo escribe o pulsa teclas cuando haga falta dentro de una ventana ya abierta.
- Para reproducir un vídeo de YouTube: busca con buscar_youtube y luego haz clic en el título del primer resultado que veas en la lectura de pantalla.
- Si algo falla dos veces, di qué pasa y termina.
- Cuando la petición esté cumplida, llama a terminado con un resumen de una frase.
- Habla en español, frases cortas, tuteando. No pidas confirmación salvo para cerrar programas o enviar mensajes.
- Nunca hagas nada destructivo (borrar archivos, comprar, pagar)."""

HERRAMIENTAS = [
    {"name": "abrir_programa", "description": "Abre un programa o sitio conocido por su nombre en español: chrome, edge, bloc de notas, calculadora, explorador, whatsapp, correo, configuración, word, excel, youtube, gmail, google, spotify… Otros nombres se buscan en el menú Inicio.",
     "input_schema": {"type": "object", "properties": {"nombre": {"type": "string"}}, "required": ["nombre"]}},
    {"name": "abrir_web", "description": "Abre una dirección web en el navegador.",
     "input_schema": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}},
    {"name": "buscar_web", "description": "Busca en Google y deja los resultados en pantalla.",
     "input_schema": {"type": "object", "properties": {"consulta": {"type": "string"}}, "required": ["consulta"]}},
    {"name": "buscar_youtube", "description": "Busca en YouTube y deja los resultados en pantalla.",
     "input_schema": {"type": "object", "properties": {"consulta": {"type": "string"}}, "required": ["consulta"]}},
    {"name": "escribir", "description": "Escribe texto en la ventana activa, donde esté el cursor.",
     "input_schema": {"type": "object", "properties": {"texto": {"type": "string"}}, "required": ["texto"]}},
    {"name": "pulsar", "description": "Pulsa una tecla o combinación: enter, esc, tab, ctrl+s, alt+f4, win+d, ctrl+l…",
     "input_schema": {"type": "object", "properties": {"combo": {"type": "string"}}, "required": ["combo"]}},
    {"name": "clic", "description": "Hace clic en un control de la ventana activa por su nombre visible (botón, enlace, casilla, pestaña, elemento de lista).",
     "input_schema": {"type": "object", "properties": {"control": {"type": "string"}}, "required": ["control"]}},
    {"name": "esperar", "description": "Espera unos milisegundos a que cargue algo (máximo 5000).",
     "input_schema": {"type": "object", "properties": {"ms": {"type": "integer"}}, "required": ["ms"]}},
    {"name": "leer_pantalla", "description": "Devuelve el texto de la ventana activa.",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "decir", "description": "Dice una frase corta en voz alta a la persona.",
     "input_schema": {"type": "object", "properties": {"texto": {"type": "string"}}, "required": ["texto"]}},
    {"name": "terminado", "description": "La petición está cumplida (o no se puede cumplir). Resume en una frase.",
     "input_schema": {"type": "object", "properties": {"resumen": {"type": "string"}}, "required": ["resumen"]}},
]


def _accion_de(nombre: str, entrada: dict) -> dict:
    accion = {"tipo": nombre}
    accion.update(entrada or {})
    return accion


# ------------------------------------------------------------------ Claude --
class CerebroClaude:
    nombre = "Claude"

    def __init__(self, clave: str, modelo: str = MODELO_CLAUDE):
        import anthropic
        self.client = anthropic.Anthropic(api_key=clave)
        self.modelo = modelo
        self.mensajes = []
        self._pendiente = None     # tool_use_id a la espera de resultado
        self.nombre = f"Claude ({modelo})"

    def iniciar(self, peticion: str, pantalla: str) -> None:
        self.mensajes = [{"role": "user", "content": f"Pantalla ahora:\n{pantalla}\n\nPetición: {peticion}"}]
        self._pendiente = None

    def siguiente(self):
        """(accion | None, texto_para_decir | None)."""
        import anthropic
        try:
            respuesta = self.client.messages.create(
                model=self.modelo,
                max_tokens=2048,
                system=[{"type": "text", "text": SISTEMA, "cache_control": {"type": "ephemeral"}}],
                tools=HERRAMIENTAS,
                thinking={"type": "adaptive"},
                messages=self.mensajes,
            )
        except anthropic.AuthenticationError:
            return None, "La clave de Claude no es válida. Revísala en la página Asistente."
        except anthropic.RateLimitError:
            return None, "Claude está saturado ahora mismo. Prueba en un momento."
        except anthropic.APIConnectionError:
            return None, "No hay conexión con Claude. Revisa internet."
        except anthropic.APIStatusError as e:
            return None, f"Claude devolvió un error: {e.message}"
        if respuesta.stop_reason == "refusal":
            return None, "Claude no puede ayudar con esa petición."
        self.mensajes.append({"role": "assistant", "content": respuesta.content})
        texto = " ".join(b.text for b in respuesta.content if b.type == "text").strip() or None
        uso = [b for b in respuesta.content if b.type == "tool_use"]
        if not uso:
            return None, texto
        b = uso[0]
        self._pendiente = b.id
        return _accion_de(b.name, dict(b.input)), texto

    def informar(self, resultado: str, pantalla: str) -> None:
        if self._pendiente is None:
            return
        self.mensajes.append({"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": self._pendiente,
             "content": f"{resultado}\n\nPantalla ahora:\n{pantalla}"}]})
        self._pendiente = None

    def resumir_pantalla(self, texto: str, imagen_png_b64: str = None) -> str:
        contenido = []
        if imagen_png_b64:
            contenido.append({"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                          "data": imagen_png_b64}})
        contenido.append({"type": "text", "text": (
            "Describe en dos o tres frases, en español sencillo y tuteando, qué hay en esta pantalla y qué "
            "puede hacer la persona. Si hay un mensaje o texto importante, léelo. "
            f"Texto extraído de la ventana: {texto[:1500]}")})
        respuesta = self.client.messages.create(
            model=self.modelo, max_tokens=600,
            messages=[{"role": "user", "content": contenido}])
        return " ".join(b.text for b in respuesta.content if b.type == "text").strip()


# ------------------------------------------------------------------ Ollama --
def ollama_disponible(url: str = OLLAMA_URL, espera: float = 1.0):
    """Lista de modelos si Ollama responde, o None."""
    import urllib.request
    try:
        with urllib.request.urlopen(url + "/api/tags", timeout=espera) as r:
            datos = json.loads(r.read().decode("utf-8"))
        return [m["name"] for m in datos.get("models", [])]
    except Exception:
        return None


def _extraer_json(texto: str):
    texto = texto.strip()
    try:
        return json.loads(texto)
    except ValueError:
        pass
    m = re.search(r"\{.*\}", texto, re.S)
    if m:
        try:
            return json.loads(m.group(0))
        except ValueError:
            return None
    return None


class CerebroOllama:

    def __init__(self, modelo: str = MODELO_OLLAMA, url: str = OLLAMA_URL):
        self.modelo = modelo
        self.url = url
        self.mensajes = []
        self.nombre = f"Ollama ({modelo}, local)"

    def _sistema(self) -> str:
        herramientas = "\n".join(
            f"- {h['name']}({', '.join(h['input_schema'].get('properties', {}).keys())}): {h['description']}"
            for h in HERRAMIENTAS)
        return (SISTEMA + "\n\nHerramientas:\n" + herramientas +
                "\n\nResponde SIEMPRE solo con un JSON así: "
                '{"accion": {"tipo": "<nombre de herramienta>", "<parámetro>": "<valor>"}, "decir": "<frase corta o vacío>"}. '
                "Una sola acción por respuesta. Para terminar: {\"accion\": {\"tipo\": \"terminado\", \"resumen\": \"...\"}, \"decir\": \"...\"}.")

    def iniciar(self, peticion: str, pantalla: str) -> None:
        self.mensajes = [{"role": "system", "content": self._sistema()},
                         {"role": "user", "content": f"Pantalla ahora:\n{pantalla}\n\nPetición: {peticion}"}]

    def siguiente(self):
        import urllib.request
        cuerpo = json.dumps({"model": self.modelo, "stream": False, "format": "json",
                             "options": {"temperature": 0}, "messages": self.mensajes}).encode("utf-8")
        try:
            req = urllib.request.Request(self.url + "/api/chat", data=cuerpo,
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                datos = json.loads(r.read().decode("utf-8"))
        except Exception as e:
            return None, f"El modelo local no responde: {e}"
        contenido = datos.get("message", {}).get("content", "")
        self.mensajes.append({"role": "assistant", "content": contenido})
        obj = _extraer_json(contenido) or {}
        accion = obj.get("accion") if isinstance(obj.get("accion"), dict) else None
        decir = obj.get("decir") or None
        if accion is None:
            return None, decir or "No he entendido qué hacer."
        return accion, (str(decir).strip() or None) if decir else None

    def informar(self, resultado: str, pantalla: str) -> None:
        self.mensajes.append({"role": "user", "content": f"Resultado: {resultado}\n\nPantalla ahora:\n{pantalla}"})

    def resumir_pantalla(self, texto: str, imagen_png_b64: str = None) -> str:
        import urllib.request
        cuerpo = json.dumps({"model": self.modelo, "stream": False, "options": {"temperature": 0},
                             "messages": [{"role": "user", "content": (
                                 "Describe en dos frases, en español sencillo y tuteando, qué hay en esta "
                                 f"pantalla según su texto. Texto: {texto[:1500]}")}]}).encode("utf-8")
        req = urllib.request.Request(self.url + "/api/chat", data=cuerpo,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as r:
            datos = json.loads(r.read().decode("utf-8"))
        return datos.get("message", {}).get("content", "").strip()


# ------------------------------------------------------------------ Reglas --
class CerebroReglas:
    nombre = "reglas básicas (sin modelo)"

    PATRONES = [
        (r"^(?:lee|leer|léeme|leeme)\b.*pantalla", lambda m: [{"tipo": "leer_pantalla"}]),
        (r"^(?:busca|buscar|búscame|buscame)\s+(?:en\s+)?youtube\s+(.+)$", lambda m: [{"tipo": "buscar_youtube", "consulta": m.group(1)}]),
        (r"^(?:pon|reproduce|ponme)\s+(?:en\s+youtube\s+)?(.+?)(?:\s+en\s+youtube)?$", lambda m: [{"tipo": "buscar_youtube", "consulta": m.group(1)}]),
        (r"^(?:busca|buscar|búscame|buscame)\s+(?:en\s+(?:google|internet)\s+)?(.+)$", lambda m: [{"tipo": "buscar_web", "consulta": m.group(1)}]),
        (r"^(?:abre|abrir|ábreme|abreme|entra\s+en)\s+(.+)$", lambda m: [{"tipo": "abrir_programa", "nombre": m.group(1)}]),
        (r"^(?:escribe|escribir|teclea)\s+(.+)$", lambda m: [{"tipo": "escribir", "texto": m.group(1)}]),
        (r"^(?:pulsa|pulsar|presiona)\s+(.+)$", lambda m: [{"tipo": "pulsar", "combo": m.group(1)}]),
        (r"^(?:haz\s+)?clic\s+en\s+(.+)$", lambda m: [{"tipo": "clic", "control": m.group(1)}]),
        (r"^(?:cierra|cerrar)\b.*(?:ventana|programa|esto)", lambda m: [{"tipo": "pulsar", "combo": "alt+f4"}]),
        (r"^(?:di|dime|repite)\s+(.+)$", lambda m: [{"tipo": "decir", "texto": m.group(1)}]),
    ]

    def __init__(self):
        self.cola = []

    def iniciar(self, peticion: str, pantalla: str) -> None:
        p = peticion.strip().rstrip(".!").lower()
        self.cola = []
        for patron, fabrica in self.PATRONES:
            m = re.match(patron, p, re.I)
            if m:
                self.cola = fabrica(m)
                break
        if not self.cola:
            self.cola = [{"tipo": "decir", "texto": ("No tengo un modelo de inteligencia artificial "
                                                     "conectado. Puedo abrir programas, buscar en Google o "
                                                     "YouTube, escribir, pulsar teclas y leer la pantalla.")}]
        self.cola.append({"tipo": "terminado", "resumen": "Hecho."})

    def siguiente(self):
        if not self.cola:
            return None, None
        return self.cola.pop(0), None

    def informar(self, resultado: str, pantalla: str) -> None:
        pass

    def resumir_pantalla(self, texto: str, imagen_png_b64: str = None) -> str:
        return texto[:400] if texto else "No hay texto legible en la ventana activa."


# ------------------------------------------------------------------ elegir --
def clave_claude() -> str:
    return (ajustes_globales.obtener("clave_claude") or os.environ.get("ANTHROPIC_API_KEY") or "").strip()


def crear_cerebro(preferencia: str = None):
    """Devuelve el cerebro según el ajuste «asistente_cerebro»: auto, claude,
    ollama o reglas. «auto» = Claude si hay clave, si no Ollama si responde,
    si no reglas."""
    pref = (preferencia or ajustes_globales.obtener("asistente_cerebro", "auto") or "auto").lower()
    clave = clave_claude()
    if pref in ("auto", "claude") and clave:
        try:
            return CerebroClaude(clave, ajustes_globales.obtener("modelo_claude", MODELO_CLAUDE))
        except Exception as e:
            logger.warning(f"Claude no disponible: {e}")
    if pref in ("auto", "ollama"):
        modelos = ollama_disponible()
        if modelos:
            modelo = ajustes_globales.obtener("modelo_ollama", MODELO_OLLAMA)
            if modelo not in modelos:
                modelo = next((m for m in modelos if "embed" not in m), modelos[0])
            return CerebroOllama(modelo)
    return CerebroReglas()
