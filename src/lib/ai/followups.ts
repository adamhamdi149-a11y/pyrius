import type { Chip, Locale } from "@/lib/types";

/** Short assistant follow-ups the client can add instantly (e.g. right after a save). Pure, no I/O. */

export function staysQuestion(locale: Locale): { text: string; chips: Chip[] } {
  const L = (en: string, fr: string) => (locale === "fr" ? fr : en);
  return {
    text: L("Saved. Would you like me to find a place to stay?", "C'est enregistré. Voulez-vous que je vous trouve un hébergement ?"),
    chips: [
      { label: L("Find hotels", "Trouver des hôtels"), action: { type: "hotels", stayType: "hotel" } },
      { label: L("Apartments & other stays", "Appartements et autres"), action: { type: "hotels", stayType: "apartment" } },
      { label: L("Skip accommodation", "Passer l'hébergement"), action: { type: "skip-hotels" } },
    ],
  };
}

export function carsQuestion(locale: Locale, afterSave = false): { text: string; chips: Chip[] } {
  const L = (en: string, fr: string) => (locale === "fr" ? fr : en);
  return {
    text: afterSave
      ? L("Saved. Would you like a car for your trip?", "C'est enregistré. Aurez-vous besoin d'une voiture ?")
      : L("Would you like a car for your trip?", "Aurez-vous besoin d'une voiture pour ce voyage ?"),
    chips: [
      { label: L("Find a rental car", "Louer une voiture"), action: { type: "cars", mode: "rental" } },
      { label: L("Local rental agencies", "Agences de location locales"), action: { type: "cars", mode: "agencies" } },
      { label: L("Car dealerships", "Concessionnaires"), action: { type: "cars", mode: "dealerships" } },
      { label: L("Skip", "Passer"), action: { type: "skip-cars" } },
    ],
  };
}
