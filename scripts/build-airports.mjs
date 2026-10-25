// Builds src/lib/data/worldAirports.ts from the OurAirports dataset (public domain, https://ourairports.com/data/).
// Keeps every airport with scheduled passenger service and an IATA code, which is what Google Flights can search.
//
//   node scripts/build-airports.mjs                       downloads the latest data
//   node scripts/build-airports.mjs airports.csv countries.csv   uses local copies
import { readFile, writeFile } from "node:fs/promises";

const SRC = "https://davidmegginson.github.io/ourairports-data";
const [airportsPath, countriesPath] = process.argv.slice(2);
const load = async (path, name) => (path ? readFile(path, "utf8") : (await fetch(`${SRC}/${name}`)).text());

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const CARIB = new Set("AG AI AW BB BL BQ BS CU CW DM DO GD GP HT JM KN KY LC MF MQ MS PR SX TC TT VC VG VI".split(" "));
const CENTRAL = new Set("MX GT BZ SV HN NI CR PA".split(" "));
const MIDEAST = new Set("AE BH IL IQ IR JO KW LB OM PS QA SA SY YE CY TR".split(" "));
function region(continent, country) {
  if (continent === "NA") return CARIB.has(country) ? "carib" : CENTRAL.has(country) ? "latam" : "na";
  if (continent === "SA") return "latam";
  if (continent === "EU") return MIDEAST.has(country) ? "me" : "eu";
  if (continent === "AS") return MIDEAST.has(country) ? "me" : "asia";
  if (continent === "AF") return "africa";
  return "oceania";
}

const RANK = { large_airport: 3, medium_airport: 2, small_airport: 1 };
const clean = (s) => s.replace(/[|\n]/g, " ").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

// OurAirports names the municipality an airport sits in, which is sometimes a suburb ("Ferno" for Milan
// Malpensa). Travelers know these airports by the city they serve.
const CITY = {
  ACE: "Lanzarote", ADB: "Izmir", AGA: "Agadir", ANU: "Antigua", ARN: "Stockholm", ATH: "Athens", AVV: "Melbourne", BCN: "Barcelona", BDJ: "Banjarmasin",
  BEM: "Beni Mellal", BGY: "Bergamo", BJX: "León", BNX: "Banja Luka", BRU: "Brussels", BSL: "Basel", BVC: "Boa Vista", BWA: "Bhairahawa", CAY: "Cayenne",
  CDG: "Paris", CEB: "Cebu", CFU: "Corfu", CGN: "Cologne", CHQ: "Chania", CND: "Constanța", COV: "Adana", CPH: "Copenhagen", CRK: "Clark", CXR: "Nha Trang",
  DJE: "Djerba", DJJ: "Jayapura", DMM: "Dammam", DPS: "Bali", DUB: "Dublin", DWC: "Dubai", ECN: "Nicosia", EDI: "Edinburgh", EFL: "Kefalonia",
  EIS: "Tortola", EMA: "East Midlands", ESM: "Esmeraldas", FKB: "Karlsruhe", FLR: "Florence", FMO: "Münster", FRA: "Frankfurt", FSZ: "Shizuoka", FUE: "Fuerteventura",
  GJL: "Jijel", GOA: "Genoa", GOI: "Goa", GOX: "Goa", GRZ: "Graz", GUM: "Guam", HAN: "Hanoi", HEA: "Herat", HEL: "Helsinki", HHN: "Frankfurt-Hahn",
  HND: "Tokyo", HNL: "Honolulu", HPH: "Haiphong", IAD: "Washington", IAR: "Yaroslavl", IBR: "Ibaraki", ILO: "Iloilo", ISB: "Islamabad", JHG: "Xishuangbanna",
  JTR: "Santorini", KGS: "Kos", KLU: "Klagenfurt", KMQ: "Komatsu", KNO: "Medan", KOS: "Sihanoukville", KRK: "Kraków", KSF: "Kassel", KTI: "Phnom Penh",
  KUL: "Kuala Lumpur", KUT: "Kutaisi", LEJ: "Leipzig", LIL: "Lille", LIN: "Milan", LJU: "Ljubljana", LLW: "Lilongwe", LOP: "Lombok", LPA: "Gran Canaria",
  LTN: "London", LXA: "Lhasa", LYS: "Lyon", MAH: "Menorca", MCT: "Muscat", MCY: "Sunshine Coast", MFM: "Macau", MNI: "Montserrat", MPL: "Montpellier",
  MRS: "Marseille", MRU: "Mauritius", MVD: "Montevideo", MXP: "Milan", NAP: "Naples", NBJ: "Luanda", NGO: "Nagoya", NRT: "Tokyo", NTL: "Newcastle",
  NUM: "Neom", NYO: "Stockholm", ORY: "Paris", OSL: "Oslo", OSR: "Ostrava", OTP: "Bucharest", OUD: "Oujda", OVD: "Asturias", PAD: "Paderborn",
  PDG: "Padang", PIE: "St. Petersburg", PQC: "Phu Quoc", PZO: "Puerto Ordaz", RMU: "Murcia", ROR: "Palau", RSI: "Red Sea", RUN: "Réunion", SAG: "Shirdi",
  SAW: "Istanbul", SDJ: "Sendai", SEZ: "Mahé", SFS: "Subic Bay", SHO: "Manzini", SID: "Sal", SKP: "Skopje", SNA: "Orange County", SPX: "Cairo",
  STN: "London", TIA: "Tirana", TLS: "Toulouse", TPE: "Taipei", TRN: "Turin", TZL: "Tuzla", USM: "Ko Samui", UYU: "Uyuni", VCE: "Venice", VIE: "Vienna",
  FEZ: "Fez", GIG: "Rio de Janeiro", OGG: "Maui", ORN: "Oran", PTY: "Panama City", TLM: "Tlemcen",
  VRN: "Verona", VST: "Västerås", VVO: "Vladivostok", VXE: "São Vicente", WMI: "Warsaw", XNN: "Xining", YNY: "Yangyang", ZAG: "Zagreb", ZRH: "Zurich",
};

const [airportsCsv, countriesCsv] = await Promise.all([load(airportsPath, "airports.csv"), load(countriesPath, "countries.csv")]);
const countries = Object.fromEntries(parseCsv(countriesCsv).map((c) => [c.code, clean(c.name)]));
const best = new Map();
for (const a of parseCsv(airportsCsv)) {
  const code = a.iata_code?.trim();
  if (!/^[A-Z]{3}$/.test(code) || a.scheduled_service !== "yes" || !RANK[a.type]) continue;
  const prev = best.get(code);
  if (prev && RANK[prev.type] >= RANK[a.type]) continue;
  best.set(code, a);
}

const used = new Set();
const rows = [...best.values()]
  .sort((p, q) => p.iata_code.localeCompare(q.iata_code))
  .map((a) => {
    used.add(a.iso_country);
    const city = CITY[a.iata_code] ?? clean(a.municipality || a.name.replace(/\s+(International\s+)?Airport$/i, "")).split(",")[0].trim();
    const lat = Number(a.latitude_deg).toFixed(2);
    const lon = Number(a.longitude_deg).toFixed(2);
    return [a.iata_code, city, a.iso_country, lat, lon, region(a.continent, a.iso_country), RANK[a.type]].join("|");
  });
const names = [...used].sort().map((c) => `${c}|${countries[c] ?? c}`);

const out = `// Generated by scripts/build-airports.mjs from OurAirports (public domain). Don't edit by hand.
// ${rows.length} airports with scheduled passenger service: code|city|country|lat|lon|region|size (3 large, 2 medium, 1 small)
export const WORLD_AIRPORT_ROWS = ${JSON.stringify(rows.join("\n"))};
export const COUNTRY_NAMES = ${JSON.stringify(names.join("\n"))};
`;
await writeFile(new URL("../src/lib/data/worldAirports.ts", import.meta.url), out);
console.log(`Wrote ${rows.length} airports in ${used.size} countries (${(out.length / 1024).toFixed(0)} KB).`);
