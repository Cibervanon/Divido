import type { CategoryKey } from "./categories";

/**
 * Diccionario de categorización automática por palabras clave.
 * Las claves son CategoryKey (sin incluir general/pot/bet/recurring).
 *
 * El motor normaliza el texto (minúsculas, sin tildes/diacríticos) y compara
 * coincidencia de PALABRA COMPLETA (\b), por lo que las keywords deben escribirse
 * sin tildes y pueden contener &, - o dígitos (ej: "h&m", "free-now", "95").
 */
export const CATEGORY_KEYWORDS: Record<Exclude<CategoryKey, "general" | "pot" | "bet" | "recurring">, string[]> = {
  food: [
    // Supermercados & Cadenas
    "mercadona", "lidl", "carrefour", "dia", "alcampo", "eroski", "consom", "bonpreu", "supercor",
    "hipercor", "ahorro", "coviran", "spar", "walmart", "oxxo", "jumbo", "coto", "vea", "costco",
    "super", "supermercado", "hiper", "ultramarinos", "fruteria", "carniceria", "pescaderia", "panaderia",
    // Restaurantes & Cadenas Comida Rápida
    "restaurante", "rest", "restaurac", "cena", "cenar", "comida", "comer", "almuerzo", "tapeo", "tapas",
    "raciones", "menudadia", "chiringuito", "bodega", "tasca", "pizzeria", "brunch", "buffet", "wok",
    "burger", "mcdonalds", "burgerking", "fiveguys", "kfc", "popeyes", "pizza", "telepizza", "domino",
    "dominos", "kebab", "shawarma", "sushi", "100montaditos", "foster", "vips", "ginos", "tagliatella",
    "taco", "tacobell", "subway", "goiko", "honestgreens",
    // Delivery & Platos
    "takeaway", "glovo", "ubereats", "justeat", "rappi", "pedidosya", "deliveroo",
    "asador", "pollos", "hamburguesa", "empanadas", "poke", "ramen", "paella", "chuleton", "parrilla",
    // Extra: despensa y platos sueltos
    "alimentacion", "congelados", "fruta", "verdura", "carne", "pescado", "yogur", "leche", "huevos",
    "bocadillo", "sandwich", "ensalada", "menu", "barra", "racion", "vino", "bebida", "barbacoa", "bbq",
  ],

  transport: [
    // VTC & Taxis
    "uber", "cabify", "bolt", "freenow", "free-now", "taxi", "radiotaxi", "didi", "beat",
    // Transporte Público & Viajes
    "bus", "autobus", "emt", "tmb", "metro", "renfe", "tren", "ave", "ouigo", "iryo", "rodalies",
    "cercanias", "tranvia", "billete", "pasaje", "abono", "tarjeta", "flixbus", "alsa", "blablacar",
    "avior", "iberia", "vueling", "ryanair", "easyjet", "aireuropa", "aeropuerto", "vuelo",
    // Vehículo, Gasolina & Parking
    "peaje", "autopista", "parking", "aparcamiento", "parquimetro", "zonaazul", "zonavol", "pagozona",
    "gasolina", "gasolinera", "repsol", "cepsa", "bp", "galp", "shell", "plenoil", "ballenoil",
    "petroprix", "diesel", "gasoleo", "95", "98", "electrolinera", "cargaev", "tesla", "ionity",
    "taller", "itv", "mecanico", "lavado", "lavadero", "renting", "neumaticos", "cambioaceite", "grua",
    // Extra: micromovilidad
    "bicing", "patinete", "lime", "tier", "aparcacoches",
  ],

  leisure: [
    // Cine & Teatro
    "cine", "yelmo", "cinesa", "kinepolis", "entradas", "fever", "entradium", "ticketmaster",
    "teatro", "museo", "exposicion", "auditorio",
    // Fiesta & Noche
    "concierto", "concert", "festival", "fiesta", "copas", "disco", "discoteca", "pub", "bar",
    "boliche", "antro", "cerveza", "birra", "cubata", "ron", "gin", "vodka", "fernet",
    // Recreación & Actividades
    "bolera", "bowling", "recreativos", "escaperoom", "escape", "parqueatracciones", "tibidabo",
    "portaventura", "warner", "zoo", "acuario", "piscina", "spa", "paintball", "karting", "billar",
    // Extra: viajes y escapadas
    "viaje", "excursion", "hotel", "hostal", "airbnb", "booking", "apartamento", "turismo",
  ],

  housing: [
    // Alquiler & Hipoteca
    "alquiler", "renta", "hipoteca", "comunidad", "fianza", "propietario",
    // Suministros (Luz, Agua, Gas, Net)
    "luz", "electricidad", "endesa", "iberdrola", "naturgy", "edp", "repsolluz",
    "agua", "aqualia", "canalisabel", "agbar", "gas", "butano",
    "internet", "wifi", "fibra", "movistar", "vodafone", "orange", "yoigo", "digi", "masmovil", "o2",
    // Mantenimiento & Muebles
    "ikea", "leroymerlin", "bauhaus", "bricomart", "obramat", "brico", "ferreteria", "mantenimiento",
    "reforma", "fontanero", "electricista", "pintura", "limpieza", "segurohogar", "cerrajero",
    // Extra: hogar genérico y recibos
    "casa", "piso", "recibo", "factura", "seguro",
  ],

  health: [
    // Medicina & Farmacia
    "farmacia", "boticaria", "botica", "medico", "doctor", "dentista", "odontologo", "clinica",
    "hospital", "urgencias", "sanitas", "asisa", "adeslas", "mapfre", "medicamento", "pastillas",
    "receta", "analisis", "laboratorio",
    // Óptica, Fisio & Bienestar
    "optometria", "gafas", "lentillas", "optica", "multiopticas", "soloptical", "alainafflelou",
    "fisioterapia", "fisio", "psicologo", "terapia", "podologo", "masajista", "osteopata",
    // Extra
    "medicina", "pastilla", "sangre", "enfermero", "ambulancia",
  ],

  shopping: [
    // E-Commerce & Retail
    "amazon", "aliexpress", "shein", "temu", "miravia", "elcorteingles", "fnac", "mediamarkt",
    "pccomponentes", "apple", "xiaomi", "samsung",
    // Moda & Calzado
    "zara", "pullandbear", "pull&bear", "bershka", "stradivarius", "mango", "hm", "h&m", "primark",
    "uniclo", "massimodutti", "shein", "ropa", "zapatillas", "calzado", "zapateria", "tienda",
    "electronica", "gadget", "moda", "bolso", "abrigo", "pantalon", "camiseta",
    // Extra: electrónica y accesorios
    "movil", "ordenador", "tablet", "portatil", "auriculares", "mochila", "chaqueta", "compras",
  ],

  coffee: [
    "starbucks", "manolobakes", "rodilla", "365", "cafeteria", "cafe", "cortado", "capuchino",
    "matcha", "desayuno", "merienda", "croissant", "tostada", "bakery", "pasteleria", "confiteria",
    "panaderia", "pan", "bolleria", "churros", "churreria", "helado", "heladeria", "llaollao", "dunkin",
    // Extra
    "espresso", "nespresso", "brunchcafe", "smoothie",
  ],

  pets: [
    "veterinario", "vet", "pienso", "croquetas", "comidaperro", "comidagato", "tiendaanimales",
    "kiwoko", "tiendanimal", "zooplus", "vacuna", "desparasitar", "peluqueriacanina", "correa",
    "arenagato", "accesoriosmascota", "bozal", "rascador",
    // Extra
    "perro", "gato", "mascota", "cachorro", "adopcion",
  ],

  streaming: [
    // Video & Música
    "netflix", "spotify", "disney", "disneyplus", "hbo", "hbomax", "max", "primevideo",
    "amazonprime", "youtube", "youtubepremium", "twitch", "applemusic", "appletv", "crunchyroll",
    "filmin", "dazn",
    // Gaming & Cloud
    "playstation", "psn", "psplus", "xbox", "gamepass", "nintendo", "steam", "epicgames",
    "patreon", "icloud", "drive", "googledrive", "dropbox", "onedrive", "chatgpt", "midjourney",
    // Extra
    "suscripcion", "skyshowtime", "movistarplus", "audible", "kindle",
  ],

  sports: [
    // Gimnasios & Centros
    "gimnasio", "gym", "basicfit", "vivagym", "altafit", "fitup", "synergym", "crossfit",
    // Material & Marcas
    "decathlon", "sprinter", "jdsports", "nike", "adidas", "puma", "underarmour", "asics", "rebook",
    // Actividades & Suplementación
    "padel", "futbol", "baloncesto", "tenis", "entrenamiento", "suplementos", "proteina",
    "creatina", "dorsal", "maraton", "yoga", "pilates", "pista", "alquilerpista",
    // Extra
    "deporte", "running", "ciclismo", "natacion", "senderismo",
  ],

  events: [
    "regalo", "cumple", "cumpleanos", "boda", "bautizo", "comunion", "aniversario", "detalle",
    "fieston", "tarta", "pastel", "flores", "floristeria", "tarjeta", "cotillon", "sorpresa",
    // Extra
    "graduacion", "despedida", "navidad", "reyes", "amaranto",
  ],

  family: [
    "guarderia", "colegio", "escuela", "instituto", "panales", "ropabebe", "pediatra", "juguetes",
    "toysrus", "juguetilandia", "extraescolar", "uniforme", "carrito", "cuna", "biberon", "niñera",
    // Extra
    "bebe", "juguete", "matrona", "colonias",
  ],
};
