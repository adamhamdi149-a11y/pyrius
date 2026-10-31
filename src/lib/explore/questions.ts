import type { Bilingual, TraitVector } from "./traits";

/**
 * The discovery game: each question shows two places and asks which one pulls you in. Every option
 * is a real place (its photo comes from Wikimedia Commons by its Wikipedia article) and moves the
 * person along one or more traits. Add a question by adding an entry here; the engine reads them all.
 */

export interface ExploreOption {
  id: string;
  title: Bilingual;
  caption: Bilingual;
  /** English Wikipedia article whose main photo illustrates the option. */
  photo: string;
  /** Where the photo is, shown on the card. */
  place: Bilingual;
  effects: TraitVector;
}

export interface ExploreQuestion {
  id: string;
  prompt: Bilingual;
  options: [ExploreOption, ExploreOption];
}

export const QUESTIONS: ExploreQuestion[] = [
  {
    id: "climate",
    prompt: { en: "Where would you rather wake up?", fr: "Où préférez-vous vous réveiller ?" },
    options: [
      {
        id: "snow",
        title: { en: "Winter wonderland", fr: "Féerie d'hiver" },
        caption: { en: "Snowy peaks, ski runs and cozy chalets", fr: "Sommets enneigés, pistes et chalets douillets" },
        photo: "Zermatt",
        place: { en: "Zermatt, Switzerland", fr: "Zermatt, Suisse" },
        effects: { climate: -1, terrain: -0.4 },
      },
      {
        id: "tropics",
        title: { en: "Tropical escape", fr: "Évasion tropicale" },
        caption: { en: "Turquoise water, palms and warm sand", fr: "Eau turquoise, palmiers et sable chaud" },
        photo: "Bora Bora",
        place: { en: "Bora Bora, French Polynesia", fr: "Bora-Bora, Polynésie française" },
        effects: { climate: 1, terrain: 0.4 },
      },
    ],
  },
  {
    id: "energy",
    prompt: { en: "What kind of energy do you want around you?", fr: "Quelle énergie voulez-vous autour de vous ?" },
    options: [
      {
        id: "vibrant",
        title: { en: "Vibrant energy", fr: "Énergie vibrante" },
        caption: { en: "Busy streets, nightlife and buzzing restaurants", fr: "Rues animées, vie nocturne et restos bondés" },
        photo: "Shibuya Crossing",
        place: { en: "Shibuya, Tokyo", fr: "Shibuya, Tokyo" },
        effects: { energy: 1, social: 0.3 },
      },
      {
        id: "peaceful",
        title: { en: "Peaceful retreat", fr: "Retraite paisible" },
        caption: { en: "Quiet landscapes and time to breathe", fr: "Paysages calmes et temps pour respirer" },
        photo: "Lake Bled",
        place: { en: "Lake Bled, Slovenia", fr: "Lac de Bled, Slovénie" },
        effects: { energy: -1, social: -0.3 },
      },
    ],
  },
  {
    id: "setting",
    prompt: { en: "Pick your playground.", fr: "Choisissez votre terrain de jeu." },
    options: [
      {
        id: "city",
        title: { en: "Urban explorer", fr: "Explorateur urbain" },
        caption: { en: "Skylines, museums and streets to get lost in", fr: "Gratte-ciel, musées et rues où se perdre" },
        photo: "Manhattan",
        place: { en: "Manhattan, New York", fr: "Manhattan, New York" },
        effects: { setting: 1 },
      },
      {
        id: "wild",
        title: { en: "Nature seeker", fr: "Amoureux de nature" },
        caption: { en: "Mountains, forests and glacier lakes", fr: "Montagnes, forêts et lacs glaciaires" },
        photo: "Moraine Lake",
        place: { en: "Moraine Lake, Banff", fr: "Lac Moraine, Banff" },
        effects: { setting: -1 },
      },
    ],
  },
  {
    id: "style",
    prompt: { en: "How do you like to experience a place?", fr: "Comment aimez-vous vivre un lieu ?" },
    options: [
      {
        id: "luxury",
        title: { en: "Luxury escape", fr: "Escapade de luxe" },
        caption: { en: "Exceptional hotels and fine dining", fr: "Hôtels d'exception et grandes tables" },
        photo: "Burj Al Arab",
        place: { en: "Burj Al Arab, Dubai", fr: "Burj Al Arab, Dubaï" },
        effects: { style: 1, budget: 0.4 },
      },
      {
        id: "authentic",
        title: { en: "Authentic adventure", fr: "Aventure authentique" },
        caption: { en: "Local life, markets and hidden corners", fr: "Vie locale, marchés et recoins secrets" },
        photo: "Jemaa el-Fnaa",
        place: { en: "Jemaa el-Fnaa, Marrakech", fr: "Jemaa el-Fna, Marrakech" },
        effects: { style: -1, distance: 0.3 },
      },
    ],
  },
  {
    id: "terrain",
    prompt: { en: "Ocean or altitude?", fr: "Océan ou altitude ?" },
    options: [
      {
        id: "ocean",
        title: { en: "Ocean lifestyle", fr: "Vie au bord de l'eau" },
        caption: { en: "Swims, boats and seaside villages", fr: "Baignades, bateaux et villages côtiers" },
        photo: "Amalfi Coast",
        place: { en: "Amalfi Coast, Italy", fr: "Côte amalfitaine, Italie" },
        effects: { terrain: 1 },
      },
      {
        id: "mountain",
        title: { en: "Mountain lifestyle", fr: "Vie en montagne" },
        caption: { en: "Trails, summits and big views", fr: "Sentiers, sommets et grands panoramas" },
        photo: "Dolomites",
        place: { en: "The Dolomites, Italy", fr: "Les Dolomites, Italie" },
        effects: { terrain: -1, setting: -0.3 },
      },
    ],
  },
  {
    id: "fame",
    prompt: { en: "Famous sights or secret spots?", fr: "Sites célèbres ou coins secrets ?" },
    options: [
      {
        id: "iconic",
        title: { en: "Iconic destinations", fr: "Destinations mythiques" },
        caption: { en: "The landmarks everyone dreams of seeing", fr: "Les monuments dont tout le monde rêve" },
        photo: "Eiffel Tower",
        place: { en: "Eiffel Tower, Paris", fr: "Tour Eiffel, Paris" },
        effects: { fame: 1 },
      },
      {
        id: "hidden",
        title: { en: "Hidden gems", fr: "Trésors cachés" },
        caption: { en: "Far from the usual tourist routes", fr: "Loin des circuits touristiques" },
        photo: "Faroe Islands",
        place: { en: "Faroe Islands", fr: "Îles Féroé" },
        effects: { fame: -1 },
      },
    ],
  },
  {
    id: "pace",
    prompt: { en: "What does a perfect travel day look like?", fr: "À quoi ressemble une journée de voyage parfaite ?" },
    options: [
      {
        id: "packed",
        title: { en: "Packed itinerary", fr: "Programme chargé" },
        caption: { en: "See as much as possible, every day", fr: "En voir le plus possible, chaque jour" },
        photo: "Trevi Fountain",
        place: { en: "Trevi Fountain, Rome", fr: "Fontaine de Trevi, Rome" },
        effects: { pace: 1 },
      },
      {
        id: "slow",
        title: { en: "Slow travel", fr: "Voyage lent" },
        caption: { en: "Long lunches and nowhere to be", fr: "Longs déjeuners et aucun horaire" },
        photo: "Val d'Orcia",
        place: { en: "Val d'Orcia, Tuscany", fr: "Val d'Orcia, Toscane" },
        effects: { pace: -1, energy: -0.3 },
      },
    ],
  },
  {
    id: "era",
    prompt: { en: "Which streets would you rather wander?", fr: "Dans quelles rues aimeriez-vous flâner ?" },
    options: [
      {
        id: "historic",
        title: { en: "Historic charm", fr: "Charme historique" },
        caption: { en: "Old towns, cobblestones and centuries of stories", fr: "Vieilles villes, pavés et siècles d'histoire" },
        photo: "Old Town Square",
        place: { en: "Old Town Square, Prague", fr: "Place de la Vieille-Ville, Prague" },
        effects: { era: 1 },
      },
      {
        id: "modern",
        title: { en: "Modern design", fr: "Design moderne" },
        caption: { en: "Bold architecture and futuristic skylines", fr: "Architecture audacieuse et horizons futuristes" },
        photo: "Gardens by the Bay",
        place: { en: "Gardens by the Bay, Singapore", fr: "Gardens by the Bay, Singapour" },
        effects: { era: -1, setting: 0.3 },
      },
    ],
  },
  {
    id: "social",
    prompt: { en: "Crowd or quiet?", fr: "Foule ou tranquillité ?" },
    options: [
      {
        id: "people",
        title: { en: "Meet people", fr: "Faire des rencontres" },
        caption: { en: "Festivals, events and new friends", fr: "Festivals, événements et nouveaux amis" },
        photo: "Oktoberfest",
        place: { en: "Oktoberfest, Munich", fr: "Oktoberfest, Munich" },
        effects: { social: 1, energy: 0.3 },
      },
      {
        id: "private",
        title: { en: "Private escape", fr: "Escapade intime" },
        caption: { en: "Tranquility, privacy and space to yourself", fr: "Tranquillité, intimité et espace à soi" },
        photo: "Maldives",
        place: { en: "The Maldives", fr: "Les Maldives" },
        effects: { social: -1, energy: -0.3 },
      },
    ],
  },
  {
    id: "budget",
    prompt: { en: "Where does your travel budget go?", fr: "Où va votre budget voyage ?" },
    options: [
      {
        id: "value",
        title: { en: "Affordable adventures", fr: "Aventures abordables" },
        caption: { en: "More experiences for every dollar", fr: "Plus d'expériences pour chaque dollar" },
        photo: "Hội An",
        place: { en: "Hội An, Vietnam", fr: "Hội An, Viêt Nam" },
        effects: { budget: -1 },
      },
      {
        id: "premium",
        title: { en: "Premium experiences", fr: "Expériences haut de gamme" },
        caption: { en: "Comfort first, every step of the way", fr: "Le confort d'abord, à chaque étape" },
        photo: "St. Moritz",
        place: { en: "St. Moritz, Switzerland", fr: "Saint-Moritz, Suisse" },
        effects: { budget: 1, style: 0.3 },
      },
    ],
  },
  {
    id: "distance",
    prompt: { en: "How far from home do you want to feel?", fr: "À quel point voulez-vous être dépaysé ?" },
    options: [
      {
        id: "familiar",
        title: { en: "Familiar comforts", fr: "Repères familiers" },
        caption: { en: "Easy to get to, easy to settle in", fr: "Facile d'accès, facile de s'y sentir bien" },
        photo: "Quebec City",
        place: { en: "Old Québec", fr: "Vieux-Québec" },
        effects: { distance: -1 },
      },
      {
        id: "faraway",
        title: { en: "A whole new world", fr: "Un tout autre monde" },
        caption: { en: "New languages, rituals and flavours", fr: "Nouvelles langues, rituels et saveurs" },
        photo: "Fushimi Inari-taisha",
        place: { en: "Fushimi Inari, Kyoto", fr: "Fushimi Inari, Kyoto" },
        effects: { distance: 1 },
      },
    ],
  },
  {
    id: "food",
    prompt: { en: "Dinner tonight?", fr: "Le souper de ce soir ?" },
    options: [
      {
        id: "street",
        title: { en: "Street food markets", fr: "Marchés de rue" },
        caption: { en: "Sizzling stalls and plastic stools", fr: "Échoppes fumantes et tabourets en plastique" },
        photo: "Yaowarat Road",
        place: { en: "Yaowarat, Bangkok", fr: "Yaowarat, Bangkok" },
        effects: { style: -0.5, budget: -0.5, energy: 0.4 },
      },
      {
        id: "dining",
        title: { en: "A table to remember", fr: "Une table mémorable" },
        caption: { en: "Tasting menus and a great wine list", fr: "Menus dégustation et belle carte des vins" },
        photo: "San Sebastián",
        place: { en: "San Sebastián, Spain", fr: "Saint-Sébastien, Espagne" },
        effects: { style: 0.5, budget: 0.5 },
      },
    ],
  },
];
