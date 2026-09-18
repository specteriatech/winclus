// Genera el vocabulario nuclear del tablero de comunicación (familia 4): unas 330 palabras, las que cubren la
// mayor parte de lo que se dice a diario, agrupadas por función gramatical con los colores de la clave de
// Fitzgerald (personas amarillo, acciones verde, descripciones azul, cosas naranja, lugares marrón, tiempo gris,
// preguntas y enlaces morado, sociales rosa). Para cada palabra pide a ARASAAC su mejor pictograma
// (api.arasaac.org/api/pictograms/es/bestsearch) y escribe herramientas/nuclear.json con {categoria: [[palabra, id], …]}, que se pega en NUCLEAR de web/widget.js.
// Las palabras sin pictograma quedan con id 0 (se muestran solo con texto). Uso: node herramientas/vocabulario_nuclear.js
const fs = require("fs");
const path = require("path");

const NUCLEAR = {
  "Personas": ["yo", "tú", "él", "ella", "nosotros", "ellos", "usted", "mamá", "papá", "familia", "amigo", "amiga", "hermano", "hermana", "abuelo", "abuela", "hijo", "hija", "bebé", "niño", "niña", "hombre", "mujer", "médico", "enfermera", "profesor", "cuidador", "gente", "todos", "nadie", "alguien"],
  "Acciones": ["querer", "necesitar", "tener", "ser", "estar", "ir", "venir", "hacer", "poder", "dar", "ver", "mirar", "oír", "escuchar", "hablar", "decir", "comer", "beber", "dormir", "despertar", "jugar", "trabajar", "estudiar", "leer", "escribir", "abrir", "cerrar", "poner", "quitar", "ayudar", "esperar", "parar", "seguir", "empezar", "terminar", "buscar", "encontrar", "saber", "pensar", "sentir", "gustar", "amar", "llorar", "reír", "caminar", "correr", "sentarse", "levantarse", "lavar", "bañarse", "vestirse", "comprar", "pagar", "llamar", "cantar", "bailar", "pintar", "tocar", "coger", "dejar", "llevar", "traer", "subir", "bajar", "entrar", "salir", "volver", "cambiar", "romper", "arreglar", "limpiar", "cocinar", "mover", "saltar", "nadar", "viajar", "vivir", "olvidar", "recordar", "aprender", "enseñar", "preguntar", "contestar", "pedir", "doler", "descansar", "respirar", "toser", "vomitar", "tomar"],
  "Cómo es": ["bueno", "malo", "grande", "pequeño", "mucho", "poco", "más", "menos", "caliente", "frío", "nuevo", "viejo", "bonito", "feo", "rápido", "lento", "alto", "bajo", "largo", "corto", "fácil", "difícil", "lleno", "vacío", "limpio", "sucio", "fuerte", "débil", "feliz", "triste", "enfadado", "cansado", "enfermo", "sano", "contento", "aburrido", "asustado", "nervioso", "tranquilo", "dulce", "salado", "rico", "igual", "diferente", "otro", "todo", "nada", "algo", "mío", "tuyo", "importante", "bien", "mal", "mejor", "peor", "rojo", "azul", "verde", "amarillo", "negro", "blanco"],
  "Cosas": ["agua", "comida", "pan", "leche", "fruta", "carne", "medicina", "ropa", "zapatos", "cama", "silla", "mesa", "puerta", "ventana", "coche", "autobús", "teléfono", "televisión", "ordenador", "tableta", "música", "libro", "juguete", "pelota", "dinero", "llave", "bolso", "gafas", "pañal", "vaso", "plato", "cuchara", "ducha", "jabón", "cepillo de dientes", "peine", "papel", "bolígrafo", "luz", "silla de ruedas", "perro", "gato", "sol", "lluvia", "regalo", "fiesta", "cumpleaños", "foto", "mano", "cabeza", "boca", "ojo", "oreja", "nariz", "pie", "pierna", "brazo", "barriga", "espalda", "corazón", "dolor"],
  "Lugares": ["casa", "colegio", "hospital", "parque", "tienda", "trabajo", "calle", "cocina", "habitación", "baño", "jardín", "ciudad", "playa", "campo", "iglesia", "restaurante", "aquí", "allí", "dentro", "fuera", "arriba", "abajo", "cerca", "lejos", "delante", "detrás", "encima", "debajo"],
  "Tiempo": ["ahora", "luego", "después", "antes", "hoy", "mañana", "ayer", "siempre", "nunca", "otra vez", "pronto", "tarde", "temprano", "noche", "día", "semana", "hora", "fin"],
  "Preguntas y enlaces": ["qué", "quién", "dónde", "cuándo", "cómo", "por qué", "cuánto", "y", "o", "pero", "porque", "con", "sin", "para", "de", "a", "en", "no", "sí", "también", "tampoco", "muy", "ya", "todavía"],
  "Sociales": ["hola", "adiós", "gracias", "por favor", "perdón", "lo siento", "ayuda", "socorro", "vale", "no sé", "no entiendo", "basta", "me gusta", "no me gusta", "te quiero", "buenos días", "buenas noches", "cómo estás", "más o menos", "espera", "mira", "ven", "dame", "quiero", "no quiero"]
};

async function mejor(palabra) {
  try {
    const r = await fetch("https://api.arasaac.org/api/pictograms/es/bestsearch/" + encodeURIComponent(palabra));
    if (!r.ok) return 0;
    const lista = await r.json();
    if (!Array.isArray(lista) || !lista.length) return 0;
    const exacto = lista.find((p) => (p.keywords || []).some((k) => (k.keyword || "").toLowerCase() === palabra.toLowerCase()));
    return (exacto || lista[0])._id || 0;
  } catch (e) { return 0; }
}

(async () => {
  const salida = {}; let total = 0, sin = [];
  for (const cat of Object.keys(NUCLEAR)) {
    salida[cat] = [];
    for (const p of NUCLEAR[cat]) {
      const id = await mejor(p); total++;
      if (!id) sin.push(p);
      salida[cat].push([p, id]);
      process.stdout.write((id ? "." : "x"));
    }
    process.stdout.write(" " + cat + "\n");
  }
  const destino = path.resolve(__dirname, "nuclear.json");   // después se pega en NUCLEAR de web/widget.js
  fs.writeFileSync(destino, JSON.stringify(salida));
  console.log(total + " palabras, " + sin.length + " sin pictograma: " + sin.join(", "));
  console.log("escrito " + destino + " (" + fs.statSync(destino).size + " bytes)");
})();
