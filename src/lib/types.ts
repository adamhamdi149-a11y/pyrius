import type { OrbThemeId } from "@/lib/orbThemes";

// Shared domain types. UI, AI logic, providers and persistence all speak these shapes.

export type Currency = "CAD" | "USD" | "EUR";
export type Locale = "en" | "fr";
export type ThemePref = "dark" | "light" | "system";
export type PlanId = "free" | "plus" | "pro";
export type OfferKind = "flight" | "hotel" | "car";

/** Every price carries its provenance so the UI never presents demo numbers as live. */
export type DataSource = "demo" | "live";

export interface Airport {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** UTC offset in hours (standard time, good enough for demo schedules). */
  tz: number;
  warm?: boolean;
  image?: string;
  region: "na" | "eu" | "asia" | "carib" | "latam" | "oceania" | "me";
}

export interface TripPreferences {
  originCode?: string;
  destinationCode?: string;
  departDate?: string; // YYYY-MM-DD
  returnDate?: string;
  durationDays?: number;
  flexibleDates?: boolean;
  adults?: number;
  children?: number;
  budget?: number; // total, 0 = no budget
  nonstopOnly?: boolean;
  carryOnOnly?: boolean;
  priority?: "cheapest" | "fastest" | "balanced";
  wantsWarm?: boolean;
  currency: Currency;
  // Accommodation
  rooms?: number;
  stayType?: "hotel" | "apartment";
  stayBudgetPerNight?: number;
  // Car
  carMode?: "rental" | "agencies" | "dealerships";
  // Conversation bookkeeping (not shown to the user)
  awaiting?: AwaitField;
  askedPrefs?: boolean;
}

export type AwaitField = "origin" | "destination" | "warm-pick" | "dates" | "duration" | "travelers" | "budget" | "prefs" | "stay-details";

export interface FlightSearchParams {
  originCode: string;
  destinationCode: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  currency: Currency;
  nonstopOnly?: boolean;
}

export interface FlightSegment {
  from: string;
  to: string;
  depart: string; // ISO local "YYYY-MM-DDTHH:mm"
  arrive: string;
  durationMin: number;
  stops: number;
  stopCodes: string[];
  flightNumber: string;
}

export interface FlightOffer {
  id: string;
  source: DataSource;
  provider: string;
  airline: { code: string; name: string; color: string };
  outbound: FlightSegment;
  inbound?: FlightSegment;
  cabin: "Economy" | "Premium Economy";
  baggage: { carryOn: boolean; checked: number };
  totalPrice: number;
  pricePerTraveler: number;
  currency: Currency;
  travelers: number;
  bookingUrl?: string; // set only for real, configured providers
  searchUrl: string; // legitimate general search link with the search parameters
}

export interface HotelSearchParams {
  destinationCode: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
  currency: Currency;
  stayType?: "hotel" | "apartment";
}

export interface HotelOffer {
  id: string;
  source: DataSource;
  provider: string;
  name: string;
  type: "Hotel" | "Boutique hotel" | "Apartment" | "Resort" | "Guesthouse";
  neighborhood: string;
  city: string;
  distanceKm: number;
  stars: number;
  rating?: number; // demo-labeled rating; omitted when a provider has none
  description: string;
  amenities: string[];
  image: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  currency: Currency;
  freeCancellation: boolean;
  breakfastIncluded: boolean;
  bookingUrl?: string;
  searchUrl: string;
}

export interface CarSearchParams {
  destinationCode: string;
  pickUp: string;
  dropOff: string;
  currency: Currency;
}

export interface CarOffer {
  id: string;
  source: DataSource;
  provider: string;
  category: "Economy" | "Compact" | "Midsize SUV" | "Full-size" | "Premium" | "Electric";
  example: string;
  image: string;
  supplier: string;
  seats: number;
  bags: number;
  transmission: "Automatic" | "Manual";
  pickupLocation: string;
  dropoffLocation: string;
  pickUp: string;
  dropOff: string;
  days: number;
  totalPrice: number;
  currency: Currency;
  conditions: string[];
  bookingUrl?: string;
  searchUrl: string;
}

export interface LocalBusiness {
  id: string;
  name: string;
  category: "Car rental agency" | "Car dealership";
  address: string;
  phone?: string;
  website?: string;
  distanceKm?: number;
  mapUrl?: string;
  verified: true; // only verified records are ever rendered as businesses
}

export interface LocalBusinessResult {
  source: DataSource;
  businesses: LocalBusiness[];
  /** Honest fallback: a general map search the user can run themselves. */
  mapSearchUrl: string;
  city: string;
  category: LocalBusiness["category"];
}

export type AnyOffer =
  | { kind: "flight"; offer: FlightOffer }
  | { kind: "hotel"; offer: HotelOffer }
  | { kind: "car"; offer: CarOffer };

export interface PricePoint {
  at: string; // ISO timestamp
  price: number;
  simulated: boolean;
}

export type TrackingStatus = "active" | "paused" | "target-reached" | "unavailable";

export interface PriceTracker {
  id: string;
  offerId: string;
  kind: OfferKind;
  provider: string;
  providerOfferId?: string;
  label: string; // route or property
  subLabel: string; // dates / travelers
  travelDates: { start: string; end?: string };
  travelers: number;
  currency: Currency;
  savedPrice: number;
  lastKnownPrice: number;
  targetPrice: number;
  lastCheckedAt: string;
  status: TrackingStatus;
  history: PricePoint[];
  source: DataSource;
  createdAt: string;
}

export interface SavedOffer {
  id: string; // = offer id
  kind: OfferKind;
  savedAt: string;
  conversationId?: string;
  data: AnyOffer;
}

export type ChipAction =
  | { type: "say"; text: string }
  | { type: "hotels"; stayType: "hotel" | "apartment" }
  | { type: "skip-hotels" }
  | { type: "cars"; mode: "rental" | "agencies" | "dealerships" }
  | { type: "skip-cars" }
  | { type: "navigate"; href: string };

export interface Chip {
  label: string;
  action: ChipAction;
  icon?: string;
}

export type Attachment =
  | {
      type: "flights";
      params: FlightSearchParams;
      budget?: number;
      filters?: { nonstopOnly?: boolean; carryOnOnly?: boolean; sort?: "price" | "duration" | "depart" };
    }
  | { type: "hotels"; params: HotelSearchParams; budgetPerNight?: number }
  | { type: "cars"; params: CarSearchParams }
  | { type: "businesses"; destinationCode: string; category: LocalBusiness["category"] };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  chips?: Chip[];
  attachment?: Attachment;
}

export type AgentStage =
  | "collecting"
  | "flights"
  | "offer-hotels"
  | "hotels"
  | "offer-cars"
  | "cars"
  | "done";

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  prefs: TripPreferences;
  stage: AgentStage;
}

export interface AgentReply {
  reply: string;
  chips?: Chip[];
  prefs: TripPreferences;
  stage: AgentStage;
  attachment?: Attachment;
  title?: string;
  engine: "demo" | "openai";
}

export interface UserSettings {
  name: string;
  email: string;
  homeAirport: string;
  currency: Currency;
  locale: Locale;
  theme: ThemePref;
  /** Orb colour theme; also drives the app accent colours. */
  orbTheme: OrbThemeId;
  defaultAdults: number;
  defaultChildren: number;
  travelStyle: { nonstop: boolean; carryOnOnly: boolean; flexibleDates: boolean };
  notifications: { email: boolean; priceAlerts: boolean; savedSearches: boolean; productNews: boolean };
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  monthlyCAD: number;
  tagline: string;
  limits: { trackers: number; saved: number };
  features: string[];
  provisional: true;
}

export interface Subscription {
  plan: PlanId;
  status: "active" | "demo-preview";
  /** Where the entitlement came from. Only "stripe" is a real paid subscription. */
  source: "default" | "demo" | "stripe";
}
