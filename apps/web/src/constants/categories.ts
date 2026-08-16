import {
  Utensils,
  Car,
  PartyPopper,
  Home,
  Activity,
  ShoppingBag,
  Wallet,
  PiggyBank,
  Trophy,
  Repeat,
  Coffee,
  PawPrint,
  Tv,
  Dumbbell,
  Flame,
  Baby,
} from "lucide-react";

export type CategoryKey =
  | "food"
  | "transport"
  | "leisure"
  | "housing"
  | "health"
  | "shopping"
  | "general"
  | "coffee"
  | "pets"
  | "streaming"
  | "sports"
  | "events"
  | "family"
  | "pot"
  | "bet"
  | "recurring";

export interface CategoryConfig {
  category: string;
  label: string;
  iconName: string;
  keywords: string[];
  color: string;
}

export const CATEGORIES: Record<Exclude<CategoryKey, "pot" | "bet" | "recurring">, CategoryConfig> = {
  food: {
    category: "food",
    label: "Comida",
    iconName: "utensils",
    keywords: [
      "comida",
      "cena",
      "almuerzo",
      "desayuno",
      "brunch",
      "restaurante",
      "bar",
      "sushi",
      "pizza",
      "compra",
      "supermercado",
      "mercado",
      "lidl",
      "mercadona",
      "carrefour",
      "café",
      "cafe",
      "tacos",
      "hamburguesa",
      "burger",
      "comer",
      "tapa",
      "cerveza",
      "vino",
      "bebida",
    ],
    color: "#f97316",
  },
  transport: {
    category: "transport",
    label: "Transporte",
    iconName: "car",
    keywords: [
      "uber",
      "taxi",
      "bus",
      "tren",
      "avión",
      "avion",
      "vuelo",
      "gasolina",
      "parking",
      "metro",
      "gas",
      "peaje",
      "autobus",
      "cercanias",
      "renfe",
      "ave",
      "combustible",
      "diesel",
    ],
    color: "#3b82f6",
  },
  leisure: {
    category: "leisure",
    label: "Ocio",
    iconName: "party-popper",
    keywords: [
      "cine",
      "fiesta",
      "concierto",
      "viaje",
      "excursión",
      "excursion",
      "ocio",
      "museo",
      "teatro",
      "partido",
      "entrada",
      "hotel",
      "airbnb",
      "boleto",
      "festival",
      "discoteca",
      "copas",
      "espectáculo",
      "espectaculo",
      "parque",
      "zoo",
      "acuario",
    ],
    color: "#ec4899",
  },
  housing: {
    category: "housing",
    label: "Vivienda",
    iconName: "home",
    keywords: [
      "alquiler",
      "renta",
      "hipoteca",
      "casa",
      "piso",
      "agua",
      "luz",
      "internet",
      "wifi",
      "electricidad",
      "comunidad",
      "seguro",
      "gasto",
      "recibo",
      "factura",
      "ibis",
      "mantenimiento",
      "reforma",
      "fontanero",
      "electricista",
    ],
    color: "#22c55e",
  },
  health: {
    category: "health",
    label: "Salud",
    iconName: "activity",
    keywords: [
      "farmacia",
      "médico",
      "medico",
      "doctor",
      "dentista",
      "hospital",
      "gimnasio",
      "gym",
      "fisio",
      "vacuna",
      "medicina",
      "pastilla",
      "receta",
      "analisis",
      "análisis",
      "sangre",
      "optica",
      "óptica",
      "gafas",
      "lentes",
    ],
    color: "#ef4444",
  },
  shopping: {
    category: "shopping",
    label: "Compras",
    iconName: "shopping-bag",
    keywords: [
      "ropa",
      "zapatos",
      "amazon",
      "ali express",
      "aliexpress",
      "zara",
      "compras",
      "regalo",
      "camiseta",
      "pantalon",
      "pantalón",
      "chaqueta",
      "abrigo",
      "bolso",
      "mochila",
      "electronica",
      "electrónica",
      "movil",
      "móvil",
      "ordenador",
      "tablet",
    ],
    color: "#8b5cf6",
  },
  general: {
    category: "general",
    label: "General",
    iconName: "wallet",
    keywords: [],
    color: "#94a3b8",
  },
  coffee: {
    category: "coffee",
    label: "Café",
    iconName: "coffee",
    keywords: [
      "cafe",
      "cafeteria",
      "desayuno",
      "starbucks",
      "brunch",
      "croissant",
      "merienda",
    ],
    color: "#f59e0b",
  },
  pets: {
    category: "pets",
    label: "Mascotas",
    iconName: "paw-print",
    keywords: [
      "perro",
      "gato",
      "veterinario",
      "pienso",
      "mascota",
      "kiwoko",
      "tiendanimal",
    ],
    color: "#14b8a6",
  },
  streaming: {
    category: "streaming",
    label: "Streaming",
    iconName: "tv",
    keywords: [
      "netflix",
      "spotify",
      "hbo",
      "prime",
      "disney",
      "suscripcion",
      "dazn",
      "youtube",
    ],
    color: "#ef4444",
  },
  sports: {
    category: "sports",
    label: "Deportes",
    iconName: "dumbbell",
    keywords: [
      "padel",
      "gym",
      "gimnasio",
      "pista",
      "futbol",
      "crossfit",
      "deporte",
      "baloncesto",
    ],
    color: "#10b981",
  },
  events: {
    category: "events",
    label: "Eventos",
    iconName: "flame",
    keywords: [
      "barbacoa",
      "bbq",
      "carne",
      "fuego",
      "pique",
      "apuesta",
    ],
    color: "#f97316",
  },
  family: {
    category: "family",
    label: "Familia",
    iconName: "baby",
    keywords: [
      "nino",
      "ninos",
      "colegio",
      "guarderia",
      "panales",
      "cumple",
      "juguete",
    ],
    color: "#06b6d4",
  },
};

export const MODULE_FALLBACKS = {
  pot: { category: "pot", iconName: "piggy-bank", color: "#34d399" },
  bet: { category: "bet", iconName: "trophy", color: "#fbbf24" },
  recurring: { category: "recurring", iconName: "repeat", color: "#818cf8" },
  expense: { category: "general", iconName: "wallet", color: "#94a3b8" },
} as const;

export type ModuleKey = keyof typeof MODULE_FALLBACKS;

const ICON_MAP = {
  utensils: Utensils,
  car: Car,
  "party-popper": PartyPopper,
  home: Home,
  activity: Activity,
  "shopping-bag": ShoppingBag,
  wallet: Wallet,
  "piggy-bank": PiggyBank,
  trophy: Trophy,
  repeat: Repeat,
  coffee: Coffee,
  "paw-print": PawPrint,
  tv: Tv,
  dumbbell: Dumbbell,
  flame: Flame,
  baby: Baby,
} as const;

export function getIconComponent(name: string) {
  return ICON_MAP[name as keyof typeof ICON_MAP] ?? Wallet;
}

export function getCategoryColor(category: string): string {
  if (category in CATEGORIES) return CATEGORIES[category as keyof typeof CATEGORIES].color;
  if (category in MODULE_FALLBACKS) return MODULE_FALLBACKS[category as ModuleKey].color;
  return CATEGORIES.general.color;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectCategory(title: string): CategoryConfig {
  const norm = normalize(title);
  let best: CategoryConfig = CATEGORIES.general;
  let bestScore = 0;

  for (const cat of Object.values(CATEGORIES)) {
    if (cat.category === "general") continue;
    let score = 0;
    for (const kw of cat.keywords) {
      if (norm.includes(normalize(kw))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

export const CATEGORY_LIST: CategoryConfig[] = [
  CATEGORIES.food,
  CATEGORIES.transport,
  CATEGORIES.leisure,
  CATEGORIES.housing,
  CATEGORIES.health,
  CATEGORIES.shopping,
  CATEGORIES.coffee,
  CATEGORIES.pets,
  CATEGORIES.streaming,
  CATEGORIES.sports,
  CATEGORIES.events,
  CATEGORIES.family,
  CATEGORIES.general,
];