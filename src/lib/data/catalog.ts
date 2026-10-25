import type { Airport } from "@/lib/types";

/** Static reference data used by the demo providers. Nothing here is a price or availability claim. */

const img = (id: string, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;

export const imageUrl = img;

export const AIRPORTS: Airport[] = [
  // Canada & US origins
  { code: "YUL", city: "Montreal", country: "Canada", lat: 45.47, lon: -73.74, tz: -5, region: "na" },
  { code: "YYZ", city: "Toronto", country: "Canada", lat: 43.68, lon: -79.63, tz: -5, region: "na" },
  { code: "YVR", city: "Vancouver", country: "Canada", lat: 49.19, lon: -123.18, tz: -8, region: "na" },
  { code: "YYC", city: "Calgary", country: "Canada", lat: 51.13, lon: -114.01, tz: -7, region: "na" },
  { code: "YOW", city: "Ottawa", country: "Canada", lat: 45.32, lon: -75.67, tz: -5, region: "na" },
  { code: "YQB", city: "Quebec City", country: "Canada", lat: 46.79, lon: -71.39, tz: -5, region: "na" },
  { code: "BOS", city: "Boston", country: "United States", lat: 42.36, lon: -71.01, tz: -5, region: "na" },
  { code: "JFK", city: "New York", country: "United States", lat: 40.64, lon: -73.78, tz: -5, region: "na", image: img("1514565131-fce0801e5785") },
  { code: "ORD", city: "Chicago", country: "United States", lat: 41.97, lon: -87.91, tz: -6, region: "na" },
  { code: "LAX", city: "Los Angeles", country: "United States", lat: 33.94, lon: -118.41, tz: -8, region: "na", warm: true },
  { code: "SFO", city: "San Francisco", country: "United States", lat: 37.62, lon: -122.38, tz: -8, region: "na", image: img("1501594907352-04cda38ebc29") },
  { code: "MIA", city: "Miami", country: "United States", lat: 25.79, lon: -80.29, tz: -5, region: "na", warm: true, image: img("1519046904884-53103b34b206") },
  { code: "HNL", city: "Honolulu", country: "United States", lat: 21.32, lon: -157.92, tz: -10, region: "oceania", warm: true, image: img("1584132967334-10e028bd69f7") },
  // Caribbean & Latin America
  { code: "CUN", city: "Cancún", country: "Mexico", lat: 21.04, lon: -86.87, tz: -5, region: "carib", warm: true, image: img("1510097467424-192d713fd8b2") },
  { code: "PUJ", city: "Punta Cana", country: "Dominican Republic", lat: 18.57, lon: -68.36, tz: -4, region: "carib", warm: true, image: img("1507525428034-b723cf961d3e") },
  { code: "MBJ", city: "Montego Bay", country: "Jamaica", lat: 18.5, lon: -77.91, tz: -5, region: "carib", warm: true, image: img("1505228395891-9a51e7e86bf6") },
  { code: "SJO", city: "San José", country: "Costa Rica", lat: 9.99, lon: -84.2, tz: -6, region: "latam", warm: true, image: img("1520250497591-112f2f40a3f4") },
  { code: "GIG", city: "Rio de Janeiro", country: "Brazil", lat: -22.81, lon: -43.25, tz: -3, region: "latam", warm: true, image: img("1483729558449-99ef09a8c325") },
  // Europe
  { code: "CDG", city: "Paris", country: "France", lat: 49.01, lon: 2.55, tz: 1, region: "eu", image: img("1502602898657-3e91760cbb34") },
  { code: "LHR", city: "London", country: "United Kingdom", lat: 51.47, lon: -0.45, tz: 0, region: "eu", image: img("1533929736458-ca588d08c8be") },
  { code: "FCO", city: "Rome", country: "Italy", lat: 41.8, lon: 12.25, tz: 1, region: "eu", image: img("1552832230-c0197dd311b5") },
  { code: "VCE", city: "Venice", country: "Italy", lat: 45.51, lon: 12.35, tz: 1, region: "eu", image: img("1523906834658-6e24ef2386f9") },
  { code: "BCN", city: "Barcelona", country: "Spain", lat: 41.3, lon: 2.08, tz: 1, region: "eu", image: img("1539037116277-4db20889f2d4") },
  { code: "MAD", city: "Madrid", country: "Spain", lat: 40.49, lon: -3.57, tz: 1, region: "eu", image: img("1543783207-ec64e4d95325") },
  { code: "LIS", city: "Lisbon", country: "Portugal", lat: 38.77, lon: -9.13, tz: 0, region: "eu", image: img("1585208798174-6cedd86e019a") },
  { code: "JTR", city: "Santorini", country: "Greece", lat: 36.4, lon: 25.48, tz: 2, region: "eu", image: img("1533105079780-92b9be482077") },
  { code: "KEF", city: "Reykjavík", country: "Iceland", lat: 63.99, lon: -22.62, tz: 0, region: "eu", image: img("1531366936337-7c912a4589a7") },
  // Asia, Middle East, Oceania
  { code: "HND", city: "Tokyo", country: "Japan", lat: 35.55, lon: 139.78, tz: 9, region: "asia", image: img("1540959733332-eab4deabeeaf") },
  { code: "KIX", city: "Osaka · Kyoto", country: "Japan", lat: 34.43, lon: 135.24, tz: 9, region: "asia", image: img("1493976040374-85c8e12f0c0e") },
  { code: "DPS", city: "Bali", country: "Indonesia", lat: -8.75, lon: 115.17, tz: 8, region: "asia", warm: true, image: img("1518548419970-58e3b4079ab2") },
  { code: "MLE", city: "Malé", country: "Maldives", lat: 4.19, lon: 73.53, tz: 5, region: "asia", warm: true, image: img("1590523277543-a94d2e4eb00b") },
  { code: "DXB", city: "Dubai", country: "United Arab Emirates", lat: 25.25, lon: 55.36, tz: 4, region: "me", warm: true, image: img("1512453979798-5ea266f8880c") },
  { code: "SYD", city: "Sydney", country: "Australia", lat: -33.94, lon: 151.18, tz: 10, region: "oceania", warm: true, image: img("1506973035872-a4ec16b8e8d9") },
];

export const airportByCode = (code?: string) => AIRPORTS.find((a) => a.code === code);

const FR_NAMES: Record<string, string> = {
  YUL: "Montréal", YQB: "Québec", JFK: "New York", LHR: "Londres", LIS: "Lisbonne", VCE: "Venise", MIA: "Miami",
  BCN: "Barcelone", SJO: "San José", GIG: "Rio de Janeiro", MLE: "Malé", HNL: "Honolulu", KIX: "Osaka · Kyoto",
};

export const cityName = (code: string | undefined, locale: "en" | "fr" = "en") =>
  (locale === "fr" && code && FR_NAMES[code]) || airportByCode(code)?.city || code || "";

/** Words a traveler might use for a place, mapped to the nearest supported airport. */
export const PLACE_ALIASES: Record<string, string> = {
  montreal: "YUL", montréal: "YUL", mtl: "YUL",
  toronto: "YYZ", vancouver: "YVR", calgary: "YYC", ottawa: "YOW", quebec: "YQB", "québec": "YQB",
  boston: "BOS", "new york": "JFK", nyc: "JFK", manhattan: "JFK", chicago: "ORD",
  "los angeles": "LAX", lax: "LAX", "san francisco": "SFO", miami: "MIA", florida: "MIA",
  hawaii: "HNL", honolulu: "HNL",
  cancun: "CUN", "cancún": "CUN", mexico: "CUN", "punta cana": "PUJ", "dominican": "PUJ",
  jamaica: "MBJ", "montego bay": "MBJ", "costa rica": "SJO", rio: "GIG", brazil: "GIG",
  paris: "CDG", france: "CDG", london: "LHR", england: "LHR", uk: "LHR",
  rome: "FCO", italy: "FCO", venice: "VCE", barcelona: "BCN", madrid: "MAD", spain: "MAD",
  lisbon: "LIS", portugal: "LIS", santorini: "JTR", greece: "JTR", iceland: "KEF", reykjavik: "KEF",
  tokyo: "HND", japan: "HND", osaka: "KIX", kyoto: "KIX", bali: "DPS", indonesia: "DPS",
  maldives: "MLE", dubai: "DXB", uae: "DXB", sydney: "SYD", australia: "SYD",
  // French
  japon: "HND", mexique: "CUN", italie: "FCO", espagne: "MAD", grece: "JTR", islande: "KEF", bresil: "GIG",
  londres: "LHR", angleterre: "LHR", lisbonne: "LIS", venise: "VCE", australie: "SYD", indonesie: "DPS",
  "republique dominicaine": "PUJ", jamaique: "MBJ", floride: "MIA", hawai: "HNL", "nouvelle-york": "JFK",
  emirats: "DXB", barcelone: "BCN", "san jose": "SJO", "osaka · kyoto": "KIX",
};

export const AIRLINES: Record<string, { name: string; color: string; regions: Airport["region"][] }> = {
  AC: { name: "Air Canada", color: "#D22630", regions: ["na", "eu", "asia", "carib", "latam", "oceania", "me"] },
  WS: { name: "WestJet", color: "#00A3AD", regions: ["na", "carib", "eu"] },
  TS: { name: "Air Transat", color: "#1F3B73", regions: ["carib", "eu"] },
  PD: { name: "Porter", color: "#2A3F6B", regions: ["na", "carib"] },
  UA: { name: "United", color: "#1A4F9C", regions: ["na", "eu", "asia", "latam", "oceania"] },
  DL: { name: "Delta", color: "#B7202E", regions: ["na", "eu", "asia", "carib", "latam"] },
  AF: { name: "Air France", color: "#0B2A5B", regions: ["eu", "asia", "me"] },
  KL: { name: "KLM", color: "#00A1DE", regions: ["eu", "asia"] },
  LH: { name: "Lufthansa", color: "#0A1D3D", regions: ["eu", "asia", "me"] },
  BA: { name: "British Airways", color: "#2B5797", regions: ["eu", "carib"] },
  TP: { name: "TAP Air Portugal", color: "#2E8B57", regions: ["eu", "latam"] },
  IB: { name: "Iberia", color: "#C8102E", regions: ["eu", "latam"] },
  JL: { name: "Japan Airlines", color: "#C8102E", regions: ["asia"] },
  NH: { name: "ANA", color: "#13448F", regions: ["asia"] },
  EK: { name: "Emirates", color: "#B8932E", regions: ["me", "asia", "oceania"] },
  AM: { name: "Aeromexico", color: "#0B2343", regions: ["carib", "latam"] },
  CM: { name: "Copa", color: "#1D3E8C", regions: ["latam", "carib"] },
  QF: { name: "Qantas", color: "#D71920", regions: ["oceania"] },
  FI: { name: "Icelandair", color: "#003F7D", regions: ["eu"] },
};

/** Hubs used to build plausible connections for one-stop itineraries. */
export const HUBS: Record<Airport["region"], string[]> = {
  na: ["YYZ", "ORD", "JFK", "BOS"],
  eu: ["LHR", "CDG", "MAD", "LIS", "KEF"],
  asia: ["HND", "DXB", "YVR"],
  carib: ["MIA", "YYZ", "JFK"],
  latam: ["MIA", "MAD", "LIS"],
  oceania: ["LAX", "SFO", "YVR"],
  me: ["LHR", "CDG"],
  africa: ["CDG", "LHR", "MAD", "DXB"],
};

export const NEIGHBORHOODS: Record<string, string[]> = {
  HND: ["Shibuya", "Shinjuku", "Asakusa", "Ginza", "Ebisu"],
  KIX: ["Gion", "Higashiyama", "Namba", "Kawaramachi", "Arashiyama"],
  CDG: ["Le Marais", "Saint-Germain", "Montmartre", "Opéra", "Canal Saint-Martin"],
  LHR: ["Covent Garden", "Shoreditch", "South Bank", "Marylebone", "Notting Hill"],
  FCO: ["Trastevere", "Monti", "Centro Storico", "Prati", "Testaccio"],
  VCE: ["San Marco", "Dorsoduro", "Cannaregio", "Castello", "Giudecca"],
  BCN: ["El Born", "Gràcia", "Eixample", "Barceloneta", "Gothic Quarter"],
  MAD: ["Malasaña", "Salamanca", "La Latina", "Chamberí", "Huertas"],
  LIS: ["Alfama", "Chiado", "Príncipe Real", "Baixa", "Belém"],
  JTR: ["Oia", "Fira", "Imerovigli", "Kamari", "Firostefani"],
  KEF: ["Miðborg", "Vesturbær", "Laugardalur", "Hlíðar", "Old Harbour"],
  CUN: ["Hotel Zone", "Downtown", "Playa Mujeres", "Puerto Morelos", "Isla Blanca"],
  PUJ: ["Bávaro", "Cap Cana", "Uvero Alto", "Cabeza de Toro", "Macao"],
  MBJ: ["Hip Strip", "Rose Hall", "Ironshore", "Montego Freeport", "Falmouth"],
  SJO: ["Escazú", "Barrio Amón", "Santa Ana", "Sabana", "Los Yoses"],
  GIG: ["Ipanema", "Copacabana", "Leblon", "Santa Teresa", "Botafogo"],
  DPS: ["Seminyak", "Ubud", "Canggu", "Uluwatu", "Sanur"],
  MLE: ["North Malé Atoll", "South Malé Atoll", "Hulhumalé", "Baa Atoll", "Ari Atoll"],
  DXB: ["Downtown", "Dubai Marina", "Jumeirah", "Al Fahidi", "Business Bay"],
  SYD: ["The Rocks", "Surry Hills", "Bondi", "Darling Harbour", "Newtown"],
  HNL: ["Waikiki", "Kaka'ako", "Ala Moana", "Diamond Head", "Ko Olina"],
  MIA: ["South Beach", "Brickell", "Wynwood", "Coconut Grove", "Mid-Beach"],
  JFK: ["SoHo", "Midtown", "West Village", "Williamsburg", "Lower East Side"],
  SFO: ["Union Square", "Hayes Valley", "Nob Hill", "Mission", "Embarcadero"],
  LAX: ["Santa Monica", "West Hollywood", "Venice", "Downtown", "Silver Lake"],
};

export const HOTEL_IMAGES = [
  "1566073771259-6a8506099945",
  "1582719478250-c89cae4dc85b",
  "1611892440504-42a792e24d32",
  "1551882547-ff40c63fe5fa",
  "1590490360182-c33d57733427",
  "1542314831-068cd1dbfeeb",
  "1631049307264-da0ec9d70304",
  "1618773928121-c32242e63f39",
  "1564501049412-61c2a3083791",
  "1596394516093-501ba68a0ba6",
  "1571896349842-33c89424de2d",
  "1445019980597-93fa8acb246c",
  "1578683010236-d716f9a3f461",
  "1595576508898-0ad5c879a061",
  "1621293954908-907159247fc8",
  "1609766857041-ed402ea8069a",
  "1559599238-308793637427",
].map((id) => img(id, 900));

export const APARTMENT_IMAGES = [
  "1596394516093-501ba68a0ba6",
  "1609766857041-ed402ea8069a",
  "1631049307264-da0ec9d70304",
  "1559599238-308793637427",
  "1618773928121-c32242e63f39",
].map((id) => img(id, 900));

export const CAR_CATALOG = [
  { category: "Economy", example: "Fiat 500 or similar", image: img("1549317661-bd32c8ce0db2", 800), seats: 4, bags: 1, base: 34 },
  { category: "Compact", example: "BMW 1 Series or similar", image: img("1541899481282-d53bffe3c35d", 800), seats: 5, bags: 2, base: 42 },
  { category: "Midsize SUV", example: "Toyota RAV4 or similar", image: img("1533473359331-0135ef1b58bf", 800), seats: 5, bags: 3, base: 58 },
  { category: "Full-size", example: "BMW 3 Series or similar", image: img("1555215695-3004980ad54e", 800), seats: 5, bags: 3, base: 66 },
  { category: "Electric", example: "Tesla Model 3 or similar", image: img("1617788138017-80ad40651399", 800), seats: 5, bags: 2, base: 72 },
  { category: "Premium", example: "Porsche Panamera or similar", image: img("1503376780353-7e6692767b70", 800), seats: 4, bags: 2, base: 118 },
] as const;

export const CAR_SUPPLIERS = ["Hertz", "Avis", "Enterprise", "Budget", "Sixt", "National"];
