import { TRAITS, type Bilingual, type Pole, type TraitVector } from "./traits";

/**
 * Destinations Explore can recommend. Each one is a real place with its own position on every trait,
 * the months it's at its best, a budget category (never a price), the airport flights search for,
 * and short reasons tied to traits, used to explain a recommendation. A travel data API can replace
 * or extend this catalog later: the engine only needs the fields of `Destination`.
 */

export type BudgetTier = 1 | 2 | 3 | 4;
export type Region = "europe" | "asia" | "americas" | "africa" | "middle-east" | "oceania";

export interface Destination {
  id: string;
  name: Bilingual;
  country: Bilingual;
  region: Region;
  /** Airport flights search for (IATA). */
  airport: string;
  /** English Wikipedia article whose main photo shows the place. */
  photo: string;
  about: Bilingual;
  /** Months (1–12) when it's at its best. */
  bestMonths: number[];
  budget: BudgetTier;
  traits: TraitVector;
  /** Why it fits someone who leans to a pole. */
  reasons: Partial<Record<Pole, Bilingual>>;
}

/** Trait values in TRAITS order: climate, energy, setting, style, terrain, fame, pace, era, social, budget, distance. */
type Row = [number, number, number, number, number, number, number, number, number, number, number];
const vec = (r: Row): TraitVector => Object.fromEntries(TRAITS.map((t, i) => [t, r[i]]));
const b = (en: string, fr: string): Bilingual => ({ en, fr });

function d(id: string, name: Bilingual, country: Bilingual, region: Region, airport: string, photo: string, about: Bilingual, bestMonths: number[], budget: BudgetTier, row: Row, reasons: Destination["reasons"]): Destination {
  return { id, name, country, region, airport, photo, about, bestMonths, budget, traits: vec(row), reasons };
}

export const DESTINATIONS: Destination[] = [
  d("lisbon", b("Lisbon", "Lisbonne"), b("Portugal", "Portugal"), "europe", "LIS", "Lisbon", b("Hills, light and the Atlantic at the end of every street.", "Des collines, de la lumière et l'Atlantique au bout de chaque rue."), [4, 5, 6, 9, 10], 2,
    [0.5, 0.5, 0.6, -0.3, 0.6, 0.3, 0, 0.7, 0.5, -0.3, -0.1],
    { historic: b("tiled old quarters and rattling trams", "ses vieux quartiers d'azulejos et ses tramways"), lively: b("late dinners and fado bars", "ses soupers tardifs et ses bars de fado"), coast: b("Atlantic beaches a short train ride away", "ses plages de l'Atlantique à quelques minutes de train"), value: b("great value for Western Europe", "un excellent rapport qualité-prix pour l'Europe de l'Ouest"), warm: b("more than 280 sunny days a year", "plus de 280 jours de soleil par an") }),
  d("kyoto", b("Kyoto", "Kyoto"), b("Japan", "Japon"), "asia", "KIX", "Kyoto", b("Temples, gardens and wooden lanes from Japan's old capital.", "Temples, jardins et ruelles de bois de l'ancienne capitale."), [3, 4, 10, 11], 3,
    [0, -0.3, 0.3, -0.2, -0.2, 0.6, -0.2, 1, -0.3, 0.2, 0.9],
    { historic: b("over a thousand temples and shrines", "plus de mille temples et sanctuaires"), calm: b("moss gardens made for slow mornings", "des jardins de mousse faits pour les matins tranquilles"), faraway: b("rituals and traditions unlike anywhere else", "des rituels et traditions uniques au monde"), authentic: b("tea houses and family-run inns", "ses maisons de thé et auberges familiales") }),
  d("tokyo", b("Tokyo", "Tokyo"), b("Japan", "Japon"), "asia", "HND", "Tokyo", b("A city of endless neighbourhoods, each a world of its own.", "Une ville aux quartiers infinis, chacun un monde à part."), [3, 4, 5, 10, 11], 3,
    [0, 1, 1, 0.3, 0, 1, 0.9, -0.6, 0.5, 0.4, 0.9],
    { lively: b("neon streets that never sleep", "des rues néon qui ne dorment jamais"), urban: b("the world's largest city to explore", "la plus grande ville du monde à explorer"), packed: b("something new around every corner", "de la nouveauté à chaque coin de rue"), modern: b("cutting-edge design and architecture", "un design et une architecture d'avant-garde"), faraway: b("a culture that surprises at every turn", "une culture qui surprend à chaque instant") }),
  d("bali", b("Bali", "Bali"), b("Indonesia", "Indonésie"), "asia", "DPS", "Bali", b("Rice terraces, temples and surf on the island of the gods.", "Rizières, temples et surf sur l'île des dieux."), [4, 5, 6, 7, 8, 9, 10], 1,
    [1, 0, -0.6, -0.3, 0.5, 0.6, -0.5, 0.3, 0.2, -0.7, 0.8],
    { warm: b("warm all year", "la chaleur toute l'année"), nature: b("jungle valleys and rice terraces", "ses vallées de jungle et ses rizières"), slow: b("yoga mornings and long lazy afternoons", "ses matins de yoga et ses longs après-midi"), value: b("beautiful stays at gentle prices", "de beaux séjours à prix doux"), faraway: b("Balinese ceremonies in every village", "des cérémonies balinaises dans chaque village") }),
  d("maldives", b("The Maldives", "Les Maldives"), b("Maldives", "Maldives"), "asia", "MLE", "Maldives", b("A thousand coral islands in a turquoise sea.", "Un millier d'îles coralliennes dans une mer turquoise."), [11, 12, 1, 2, 3, 4], 4,
    [1, -0.9, -1, 1, 1, 0.5, -1, -0.2, -1, 1, 0.7],
    { private: b("a private island feel", "l'impression d'avoir une île à soi"), luxury: b("overwater villas and world-class resorts", "ses villas sur pilotis et resorts d'exception"), coast: b("some of the clearest water on earth", "l'une des eaux les plus claires au monde"), calm: b("nothing to do but unwind", "rien d'autre à faire que se détendre"), warm: b("sun and warm sea all winter", "soleil et mer chaude tout l'hiver") }),
  d("zermatt", b("Zermatt", "Zermatt"), b("Switzerland", "Suisse"), "europe", "GVA", "Zermatt", b("A car-free alpine village at the foot of the Matterhorn.", "Un village alpin sans voitures au pied du Cervin."), [12, 1, 2, 3, 7, 8, 9], 4,
    [-1, -0.2, -0.8, 0.6, -1, 0.5, 0.2, 0.2, -0.2, 1, 0.1],
    { cold: b("snow-sure skiing well into spring", "un enneigement garanti jusqu'au printemps"), mountain: b("the Matterhorn from your window", "le Cervin depuis votre fenêtre"), premium: b("polished chalets and fine mountain dining", "chalets raffinés et grandes tables d'altitude"), nature: b("glacier trails and alpine lakes", "sentiers glaciaires et lacs alpins") }),
  d("banff", b("Banff", "Banff"), b("Canada", "Canada"), "americas", "YYC", "Banff, Alberta", b("Turquoise lakes and Rocky Mountain peaks in Canada's first national park.", "Lacs turquoise et sommets des Rocheuses dans le premier parc national du Canada."), [6, 7, 8, 9, 12, 1, 2, 3], 3,
    [-0.6, -0.4, -1, 0, -1, 0.4, 0.3, -0.2, -0.3, 0.3, -0.6],
    { mountain: b("the Canadian Rockies at their most dramatic", "les Rocheuses canadiennes dans toute leur splendeur"), nature: b("glacier-fed lakes and wildlife", "des lacs glaciaires et une faune sauvage"), familiar: b("an easy trip from home", "un voyage facile depuis chez vous"), cold: b("powder days and frozen lakes in winter", "poudreuse et lacs gelés en hiver") }),
  d("iceland", b("Iceland", "Islande"), b("Iceland", "Islande"), "europe", "KEF", "Iceland", b("Volcanoes, waterfalls and northern lights at the edge of the Arctic.", "Volcans, cascades et aurores boréales aux portes de l'Arctique."), [6, 7, 8, 10, 11, 12, 1, 2, 3], 4,
    [-0.9, -0.2, -0.7, -0.2, -0.3, 0.1, 0.5, -0.3, -0.3, 0.8, 0.3],
    { cold: b("northern lights on winter nights", "des aurores boréales les nuits d'hiver"), nature: b("waterfalls, glaciers and black-sand beaches", "cascades, glaciers et plages de sable noir"), packed: b("a road trip full of wonders every day", "un road trip plein de merveilles chaque jour") }),
  d("faroe", b("Faroe Islands", "Îles Féroé"), b("Denmark", "Danemark"), "europe", "FAE", "Faroe Islands", b("Eighteen wild islands of cliffs, grass roofs and sea fog.", "Dix-huit îles sauvages de falaises, toits d'herbe et brume marine."), [6, 7, 8], 3,
    [-0.8, -0.9, -1, -0.6, 0, -1, -0.4, 0.2, -0.9, 0.5, 0.4],
    { hidden: b("one of Europe's best-kept secrets", "l'un des secrets les mieux gardés d'Europe"), calm: b("more sheep than people", "plus de moutons que d'habitants"), nature: b("sea cliffs and waterfalls into the ocean", "falaises et cascades qui plongent dans l'océan"), private: b("empty trails all to yourself", "des sentiers déserts rien que pour vous") }),
  d("marrakech", b("Marrakech", "Marrakech"), b("Morocco", "Maroc"), "africa", "RAK", "Marrakesh", b("Souks, riads and the Atlas mountains on the horizon.", "Souks, riads et l'Atlas à l'horizon."), [3, 4, 5, 9, 10, 11], 1,
    [0.8, 0.8, 0.4, -0.8, -0.1, 0.5, 0.4, 0.9, 0.4, -0.6, 0.8],
    { authentic: b("the maze of the medina's souks", "le dédale des souks de la médina"), lively: b("the buzz of Jemaa el-Fnaa at night", "l'effervescence de Jemaa el-Fna la nuit"), historic: b("palaces and riads from another century", "palais et riads d'un autre siècle"), value: b("unforgettable stays for little", "des séjours inoubliables à petit prix"), faraway: b("a short flight to a different world", "un autre monde à quelques heures de vol") }),
  d("amalfi", b("Amalfi Coast", "Côte amalfitaine"), b("Italy", "Italie"), "europe", "NAP", "Amalfi Coast", b("Pastel villages stacked above the Mediterranean.", "Des villages pastel suspendus au-dessus de la Méditerranée."), [5, 6, 9], 4,
    [0.7, 0, -0.3, 0.6, 1, 0.7, -0.5, 0.6, -0.1, 0.7, -0.2],
    { coast: b("cliffside villages and boat days", "villages à flanc de falaise et journées en bateau"), luxury: b("terrace dining with the best views in Italy", "des terrasses avec les plus belles vues d'Italie"), slow: b("limoncello afternoons", "des après-midi au limoncello"), historic: b("centuries-old towns like Amalfi and Ravello", "des villes séculaires comme Amalfi et Ravello") }),
  d("dolomites", b("The Dolomites", "Les Dolomites"), b("Italy", "Italie"), "europe", "VCE", "Dolomites", b("Jagged pink peaks, alpine huts and Italian cooking.", "Pics roses déchiquetés, refuges alpins et cuisine italienne."), [6, 7, 8, 9, 12, 1, 2, 3], 3,
    [-0.5, -0.5, -1, 0.1, -1, -0.1, 0.3, 0.1, -0.4, 0.4, -0.1],
    { mountain: b("some of the most striking peaks in the Alps", "parmi les sommets les plus saisissants des Alpes"), nature: b("hut-to-hut hiking trails", "des randonnées de refuge en refuge"), cold: b("world-class skiing in winter", "un ski de classe mondiale en hiver") }),
  d("paris", b("Paris", "Paris"), b("France", "France"), "europe", "CDG", "Paris", b("Grand boulevards, museums and cafés on every corner.", "Grands boulevards, musées et cafés à chaque coin de rue."), [4, 5, 6, 9, 10], 3,
    [0.1, 0.7, 1, 0.7, 0, 1, 0.6, 0.8, 0.4, 0.7, -0.3],
    { iconic: b("the Eiffel Tower, the Louvre and the Seine", "la tour Eiffel, le Louvre et la Seine"), luxury: b("legendary hotels and bistros", "des hôtels et bistrots légendaires"), urban: b("a city made for walking", "une ville faite pour marcher"), historic: b("two thousand years of history", "deux mille ans d'histoire") }),
  d("rome", b("Rome", "Rome"), b("Italy", "Italie"), "europe", "FCO", "Rome", b("An open-air museum where every street has a story.", "Un musée à ciel ouvert où chaque rue a son histoire."), [4, 5, 6, 9, 10], 3,
    [0.5, 0.7, 0.8, 0, 0, 1, 0.8, 1, 0.5, 0.3, -0.2],
    { historic: b("the Colosseum, the Forum and the Vatican", "le Colisée, le Forum et le Vatican"), packed: b("wonders at every turn for full days", "des merveilles à chaque pas pour des journées pleines"), iconic: b("sights you've seen all your life", "des lieux que vous connaissez depuis toujours"), lively: b("piazzas full of life at night", "des piazzas animées le soir") }),
  d("tuscany", b("Tuscany", "Toscane"), b("Italy", "Italie"), "europe", "FLR", "Tuscany", b("Cypress roads, hill towns and long lunches among the vines.", "Routes de cyprès, villages perchés et longs repas dans les vignes."), [4, 5, 6, 9, 10], 3,
    [0.5, -0.4, -0.4, 0.3, -0.3, 0.5, -0.8, 0.8, -0.2, 0.4, -0.2],
    { slow: b("days set by the pace of the vineyards", "des journées au rythme des vignobles"), historic: b("medieval hill towns like Siena and San Gimignano", "des bourgs médiévaux comme Sienne et San Gimignano"), calm: b("quiet farm stays in the countryside", "des agritourismes paisibles à la campagne") }),
  d("prague", b("Prague", "Prague"), b("Czechia", "Tchéquie"), "europe", "PRG", "Prague", b("A fairytale old town of spires, bridges and beer halls.", "Une vieille ville de conte de fées, de flèches, de ponts et de brasseries."), [4, 5, 6, 9, 10, 12], 2,
    [-0.2, 0.6, 0.7, -0.3, 0, 0.6, 0.4, 1, 0.7, -0.5, -0.1],
    { historic: b("a perfectly preserved medieval centre", "un centre médiéval parfaitement préservé"), social: b("lively beer halls and Christmas markets", "ses brasseries animées et marchés de Noël"), value: b("great value for a European capital", "un excellent rapport qualité-prix pour une capitale européenne") }),
  d("singapore", b("Singapore", "Singapour"), b("Singapore", "Singapour"), "asia", "SIN", "Singapore", b("A garden city of futuristic skylines and hawker food.", "Une cité-jardin aux gratte-ciel futuristes et à la street food légendaire."), [2, 3, 4], 3,
    [1, 0.6, 1, 0.6, 0.2, 0.7, 0.6, -1, 0.2, 0.7, 0.6],
    { modern: b("futuristic architecture like Gardens by the Bay", "une architecture futuriste comme Gardens by the Bay"), urban: b("a spotless, effortless city", "une ville impeccable et facile à vivre"), warm: b("tropical warmth all year", "une chaleur tropicale toute l'année"), luxury: b("rooftop pools and world-class dining", "piscines sur les toits et grandes tables") }),
  d("dubai", b("Dubai", "Dubaï"), b("United Arab Emirates", "Émirats arabes unis"), "middle-east", "DXB", "Dubai", b("Record-breaking towers between the desert and the sea.", "Des tours record entre désert et mer."), [11, 12, 1, 2, 3], 4,
    [1, 0.5, 1, 1, 0.5, 0.8, 0.5, -1, 0.3, 0.9, 0.5],
    { luxury: b("some of the most lavish hotels in the world", "parmi les hôtels les plus luxueux du monde"), modern: b("the world's tallest skyline", "la plus haute skyline du monde"), warm: b("winter sun with guaranteed beach days", "un soleil d'hiver et des journées de plage garanties"), premium: b("five-star everything", "le cinq étoiles partout") }),
  d("hoian", b("Hội An", "Hội An"), b("Vietnam", "Viêt Nam"), "asia", "DAD", "Hội An", b("A lantern-lit trading town on a river near the sea.", "Une ville marchande illuminée de lanternes, entre rivière et mer."), [2, 3, 4], 1,
    [0.9, 0.1, -0.1, -0.8, 0.4, -0.2, -0.6, 0.9, 0.2, -1, 0.9],
    { value: b("tailor shops, food and stays at tiny prices", "tailleurs, cuisine et séjours à tout petits prix"), historic: b("a UNESCO old town of lanterns and wooden houses", "une vieille ville classée à l'UNESCO, de lanternes et maisons de bois"), authentic: b("bánh mì stalls and riverside markets", "ses stands de bánh mì et marchés au bord de l'eau"), slow: b("bike rides through rice fields", "des balades à vélo dans les rizières") }),
  d("bangkok", b("Bangkok", "Bangkok"), b("Thailand", "Thaïlande"), "asia", "BKK", "Bangkok", b("Golden temples, river boats and the world's best street food.", "Temples dorés, bateaux sur le fleuve et la meilleure street food du monde."), [11, 12, 1, 2], 1,
    [1, 1, 1, -0.6, 0, 0.7, 0.9, 0.2, 0.9, -0.9, 0.9],
    { lively: b("night markets and rooftop bars", "ses marchés de nuit et bars sur les toits"), authentic: b("legendary street food on every block", "une street food légendaire à chaque coin de rue"), value: b("luxury that costs a fraction of home", "un luxe qui coûte une fraction du prix chez vous"), social: b("a city that loves to go out", "une ville qui adore sortir") }),
  d("ibiza", b("Ibiza", "Ibiza"), b("Spain", "Espagne"), "europe", "IBZ", "Ibiza", b("Coves, sunsets and the most famous nights in the Mediterranean.", "Criques, couchers de soleil et les nuits les plus célèbres de la Méditerranée."), [6, 7, 8, 9], 3,
    [0.9, 1, -0.2, 0.3, 1, 0.6, 0.3, -0.2, 1, 0.5, -0.2],
    { social: b("legendary clubs and beach parties", "ses clubs légendaires et fêtes sur la plage"), coast: b("hidden coves with clear water", "des criques cachées à l'eau claire"), lively: b("sunsets that turn into all-night parties", "des couchers de soleil qui deviennent des nuits blanches") }),
  d("barcelona", b("Barcelona", "Barcelone"), b("Spain", "Espagne"), "europe", "BCN", "Barcelona", b("Gaudí, beaches and tapas into the small hours.", "Gaudí, plages et tapas jusqu'au bout de la nuit."), [5, 6, 9, 10], 3,
    [0.7, 0.9, 0.9, 0.2, 0.6, 0.9, 0.6, 0.2, 0.8, 0.3, -0.2],
    { lively: b("tapas bars and late nights", "ses bars à tapas et ses nuits tardives"), coast: b("city beaches minutes from the centre", "des plages urbaines à deux pas du centre"), iconic: b("Gaudí's Sagrada Família", "la Sagrada Família de Gaudí"), social: b("a city that lives outdoors", "une ville qui vit dehors") }),
  d("mexicocity", b("Mexico City", "Mexico"), b("Mexico", "Mexique"), "americas", "MEX", "Mexico City", b("A giant, creative capital of murals, markets and tacos.", "Une capitale géante et créative de murales, marchés et tacos."), [3, 4, 5, 10, 11], 1,
    [0.5, 0.9, 1, -0.6, 0, 0.4, 0.7, 0.6, 0.7, -0.7, 0.5],
    { authentic: b("taquerías and colourful markets", "taquerias et marchés colorés"), lively: b("a food and art scene that never stops", "une scène gourmande et artistique qui ne s'arrête jamais"), historic: b("Aztec ruins and colonial plazas", "des ruines aztèques et des places coloniales"), value: b("world-class meals for little", "des repas d'exception pour peu") }),
  d("tulum", b("Tulum", "Tulum"), b("Mexico", "Mexique"), "americas", "CUN", "Tulum", b("Mayan ruins above a white-sand Caribbean coast.", "Des ruines mayas au-dessus d'une côte caribéenne de sable blanc."), [12, 1, 2, 3, 4], 3,
    [1, 0.3, -0.6, 0.3, 1, 0.4, -0.5, 0.4, 0.4, 0.2, 0.3],
    { coast: b("white sand and turquoise Caribbean water", "sable blanc et eau turquoise des Caraïbes"), warm: b("sunshine all winter", "le soleil tout l'hiver"), slow: b("cenote swims and beach days", "baignades en cenote et journées de plage"), historic: b("Mayan ruins by the sea", "des ruines mayas face à la mer") }),
  d("patagonia", b("Patagonia", "Patagonie"), b("Chile", "Chili"), "americas", "PUQ", "Torres del Paine National Park", b("Granite towers, glaciers and wind at the end of the world.", "Tours de granit, glaciers et vent au bout du monde."), [11, 12, 1, 2, 3], 3,
    [-0.6, -0.8, -1, -0.4, -0.9, -0.2, 0.5, -0.3, -0.6, 0.4, 0.6],
    { nature: b("Torres del Paine's granite towers", "les tours de granit de Torres del Paine"), mountain: b("multi-day treks among glaciers", "des treks de plusieurs jours entre les glaciers"), hidden: b("true wilderness far from the crowds", "une vraie nature sauvage loin des foules") }),
  d("capetown", b("Cape Town", "Le Cap"), b("South Africa", "Afrique du Sud"), "africa", "CPT", "Cape Town", b("A city between Table Mountain and two oceans.", "Une ville entre la montagne de la Table et deux océans."), [11, 12, 1, 2, 3], 2,
    [0.6, 0.5, 0.3, 0.2, 0.6, 0.4, 0.5, -0.1, 0.5, -0.3, 0.6],
    { coast: b("beaches on two oceans", "des plages sur deux océans"), nature: b("Table Mountain right above the city", "la montagne de la Table au-dessus de la ville"), value: b("wine country at great prices", "des vignobles à excellent prix"), packed: b("safari, wine and whales in one trip", "safari, vin et baleines en un seul voyage") }),
  d("seville", b("Seville", "Séville"), b("Spain", "Espagne"), "europe", "SVQ", "Seville", b("Orange trees, flamenco and Moorish palaces.", "Orangers, flamenco et palais mauresques."), [3, 4, 5, 10, 11], 2,
    [0.9, 0.7, 0.5, -0.4, 0, 0.2, -0.1, 0.9, 0.7, -0.4, 0],
    { historic: b("the Alcázar and the great cathedral", "l'Alcazar et l'immense cathédrale"), lively: b("flamenco and tapas late into the night", "flamenco et tapas jusque tard dans la nuit"), warm: b("sunny almost all year", "du soleil presque toute l'année"), social: b("evenings spent out in the plazas", "des soirées passées dehors sur les places") }),
  d("santorini", b("Santorini", "Santorin"), b("Greece", "Grèce"), "europe", "JTR", "Santorini", b("White villages on a volcanic caldera above the Aegean.", "Des villages blancs sur une caldeira volcanique au-dessus de la mer Égée."), [5, 6, 9, 10], 4,
    [0.8, 0.2, -0.4, 0.8, 1, 0.9, -0.6, 0.3, 0.1, 0.8, -0.1],
    { coast: b("caldera views over the Aegean", "des vues sur la caldeira et la mer Égée"), luxury: b("cave suites with private plunge pools", "des suites troglodytes avec piscine privée"), iconic: b("the most photographed sunsets in Greece", "les couchers de soleil les plus photographiés de Grèce") }),
  d("queenstown", b("Queenstown", "Queenstown"), b("New Zealand", "Nouvelle-Zélande"), "oceania", "ZQN", "Queenstown", b("The adventure capital of the world on a mountain lake.", "La capitale mondiale de l'aventure, au bord d'un lac de montagne."), [12, 1, 2, 3, 6, 7, 8], 3,
    [-0.4, 0.4, -0.7, 0.2, -0.8, 0.3, 0.9, -0.4, 0.4, 0.6, 0.5],
    { packed: b("bungee, jet boats and heli-hikes", "saut à l'élastique, jet-boat et héli-randonnée"), mountain: b("the Remarkables right on the lake", "les Remarkables au bord du lac"), nature: b("fjords like Milford Sound nearby", "des fjords comme Milford Sound à proximité") }),
  d("quebec", b("Québec City", "Québec"), b("Canada", "Canada"), "americas", "YQB", "Quebec City", b("North America's walled old town, European in spirit.", "La vieille ville fortifiée d'Amérique du Nord, à l'esprit européen."), [6, 7, 8, 9, 12, 1, 2], 2,
    [-0.6, 0.2, 0.4, -0.2, 0, 0.1, -0.2, 0.9, 0.2, -0.2, -0.9],
    { familiar: b("a short trip with a European feel", "un court voyage aux airs d'Europe"), historic: b("cobblestone streets inside 17th-century walls", "des rues pavées dans des remparts du XVIIe siècle"), cold: b("the magic of the Winter Carnival", "la magie du Carnaval d'hiver") }),
  d("costarica", b("Costa Rica", "Costa Rica"), b("Costa Rica", "Costa Rica"), "americas", "SJO", "Arenal Volcano", b("Volcanoes, cloud forests and two coastlines full of wildlife.", "Volcans, forêts de nuages et deux côtes pleines de faune."), [12, 1, 2, 3, 4], 2,
    [0.9, -0.3, -1, -0.4, -0.3, 0.1, 0.4, -0.4, 0.1, 0, 0.5],
    { nature: b("rainforests full of sloths and toucans", "des forêts tropicales pleines de paresseux et de toucans"), warm: b("tropical warmth in winter", "une chaleur tropicale en hiver"), packed: b("zip lines, hot springs and volcano hikes", "tyroliennes, sources chaudes et randonnées sur les volcans") }),
  d("copenhagen", b("Copenhagen", "Copenhague"), b("Denmark", "Danemark"), "europe", "CPH", "Copenhagen", b("Canals, bikes and some of the world's best design and food.", "Canaux, vélos et parmi les meilleurs design et cuisine au monde."), [5, 6, 7, 8], 4,
    [-0.3, 0.4, 0.9, 0.5, 0.3, 0.4, 0, -0.6, 0.4, 0.8, -0.2],
    { modern: b("Scandinavian design everywhere you look", "le design scandinave à chaque coin de rue"), luxury: b("a world-famous restaurant scene", "une scène gastronomique de renommée mondiale"), urban: b("a city best seen by bike", "une ville qui se découvre à vélo") }),
  d("oaxaca", b("Oaxaca", "Oaxaca"), b("Mexico", "Mexique"), "americas", "OAX", "Oaxaca City", b("Mexico's culinary heart of mole, mezcal and markets.", "Le cœur culinaire du Mexique : mole, mezcal et marchés."), [10, 11, 12, 1, 2, 3, 4], 1,
    [0.7, 0.4, 0.2, -1, -0.2, -0.5, -0.4, 0.8, 0.5, -0.9, 0.5],
    { authentic: b("markets, mole and mezcal distilleries", "marchés, mole et distilleries de mezcal"), hidden: b("off the usual tourist trail", "hors des sentiers battus"), value: b("rich experiences at small prices", "de riches expériences à petit prix"), historic: b("Zapotec ruins at Monte Albán", "les ruines zapotèques de Monte Albán") }),
  d("lofoten", b("Lofoten Islands", "Îles Lofoten"), b("Norway", "Norvège"), "europe", "BOO", "Lofoten", b("Fishing villages under sharp peaks rising from the Arctic sea.", "Des villages de pêcheurs sous des pics surgissant de la mer arctique."), [6, 7, 8, 1, 2, 3], 3,
    [-0.9, -0.9, -1, -0.2, 0.2, -0.6, -0.5, 0.1, -0.8, 0.7, 0.3],
    { cold: b("northern lights and midnight sun", "aurores boréales et soleil de minuit"), hidden: b("remote Arctic fishing villages", "des villages de pêcheurs arctiques isolés"), calm: b("silence and endless light in summer", "le silence et la lumière infinie de l'été"), private: b("red cabins on quiet fjords", "des cabanes rouges sur des fjords paisibles") }),
  d("porto", b("Porto", "Porto"), b("Portugal", "Portugal"), "europe", "OPO", "Porto", b("A riverside city of port cellars, tiles and bridges.", "Une ville au bord du fleuve, de caves à porto, d'azulejos et de ponts."), [5, 6, 7, 8, 9], 2,
    [0.4, 0.5, 0.5, -0.5, 0.4, 0, -0.2, 0.9, 0.5, -0.6, -0.2],
    { historic: b("a UNESCO riverside old town", "une vieille ville riveraine classée à l'UNESCO"), value: b("excellent food and wine for little", "une excellente cuisine et du bon vin pour peu"), authentic: b("port wine cellars and local tascas", "les caves à porto et les tascas locales") }),
  d("maui", b("Maui", "Maui"), b("Hawaii, United States", "Hawaï, États-Unis"), "oceania", "OGG", "Maui", b("Beaches, waterfalls and volcano sunrises in Hawaii.", "Plages, cascades et levers de soleil sur le volcan à Hawaï."), [4, 5, 9, 10], 4,
    [1, -0.2, -0.8, 0.5, 0.8, 0.5, 0.1, -0.5, -0.1, 0.9, 0.1],
    { coast: b("snorkelling with sea turtles", "du snorkeling avec les tortues de mer"), warm: b("warm and sunny year-round", "chaud et ensoleillé toute l'année"), nature: b("sunrise above the clouds on Haleakalā", "le lever de soleil au-dessus des nuages sur le Haleakalā") }),
  d("newyork", b("New York City", "New York"), b("United States", "États-Unis"), "americas", "JFK", "New York City", b("The city that never sleeps, close to home.", "La ville qui ne dort jamais, tout près de chez vous."), [4, 5, 6, 9, 10, 11, 12], 4,
    [0, 1, 1, 0.5, 0, 1, 1, -0.4, 0.7, 0.9, -0.5],
    { urban: b("the ultimate city break", "le séjour urbain par excellence"), packed: b("Broadway, museums and neighbourhoods to fill every day", "Broadway, musées et quartiers pour remplir chaque journée"), iconic: b("Central Park, Times Square and the skyline", "Central Park, Times Square et la skyline"), familiar: b("a quick trip from home", "un voyage rapide depuis chez vous") }),
  d("chiangmai", b("Chiang Mai", "Chiang Mai"), b("Thailand", "Thaïlande"), "asia", "CNX", "Chiang Mai", b("Temples and night markets in the green hills of northern Thailand.", "Temples et marchés de nuit dans les collines verdoyantes du nord de la Thaïlande."), [11, 12, 1, 2], 1,
    [0.9, 0, -0.1, -0.8, -0.6, -0.3, -0.6, 0.7, 0.4, -1, 0.9],
    { value: b("comfort at a fraction of the price", "le confort à une fraction du prix"), slow: b("a relaxed pace made for long stays", "un rythme détendu fait pour les longs séjours"), authentic: b("cooking classes and night markets", "cours de cuisine et marchés de nuit"), historic: b("over 300 temples in the old city", "plus de 300 temples dans la vieille ville") }),
];

export const destinationById = (id: string) => DESTINATIONS.find((x) => x.id === id);
