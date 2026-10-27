import { DEFAULT_ORB_THEME } from "@/lib/orbThemes";
import type { Conversation, UserSettings } from "@/lib/types";
import { uid } from "@/lib/utils";

/** Defaults shared by the web app and the mobile app. */

export const DEFAULT_SETTINGS: UserSettings = {
  name: "",
  email: "",
  homeAirport: "YUL",
  currency: "CAD",
  locale: "en",
  theme: "dark",
  orbTheme: DEFAULT_ORB_THEME,
  defaultAdults: 1,
  defaultChildren: 0,
  travelStyle: { nonstop: false, carryOnOnly: false, flexibleDates: true },
  notifications: { email: true, priceAlerts: true, savedSearches: false, productNews: false },
};

export function newConversation(settings: UserSettings): Conversation {
  const now = new Date().toISOString();
  return {
    id: uid("c_"),
    title: "New trip",
    createdAt: now,
    updatedAt: now,
    messages: [],
    stage: "collecting",
    prefs: {
      currency: settings.currency,
      ...(settings.travelStyle.nonstop ? { nonstopOnly: true } : {}),
      ...(settings.travelStyle.carryOnOnly ? { carryOnOnly: true } : {}),
    },
  };
}
