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
  region: "na" | "eu" | "asia" | "carib" | "latam" | "oceania" | "me" | "africa";
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
  // Kept by the AI concierge
  tripType?: "round" | "oneway";
  cabin?: "economy" | "premium_economy" | "business" | "first";
  departureTime?: "morning" | "afternoon" | "evening";
  /** When the user gave a per-person budget; `budget` then holds the total for everyone. */
  budgetPerPerson?: number;
  /** Other preferences in the user's words (short). */
  notes?: string;
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
  /** Individual flights, when the provider gives them. */
  legs?: { flightNumber: string; airline: string; from: string; to: string; depart: string; arrive: string; durationMin: number; aircraft?: string }[];
}

/** How a live offer is booked. Tokens are the provider's own and are only sent back to it, server-side. */
export interface FlightBookingRef {
  provider: "serpapi";
  /** Round trip: picks the return flight first. */
  departureToken?: string;
  /** Lists who sells this exact itinerary. */
  bookingToken?: string;
  params: FlightSearchParams;
}

export interface FlightOffer {
  id: string;
  source: DataSource;
  provider: string;
  airline: { code: string; name: string; color: string; logo?: string };
  outbound: FlightSegment;
  inbound?: FlightSegment;
  cabin: "Economy" | "Premium Economy" | "Business" | "First";
  /** Unknown for providers that don't report it per offer. */
  baggage?: { carryOn: boolean; checked: number };
  totalPrice: number;
  pricePerTraveler: number;
  currency: Currency;
  travelers: number;
  /** Round trip or one way, for the price shown. */
  tripType?: "round" | "oneway";
  /** Round-trip price whose return flight is chosen in the booking step. */
  returnPending?: boolean;
  /** City names for the route, set by the server so the app doesn't need the world airport table to label it. */
  places?: { from: string; to: string };
  booking?: FlightBookingRef;
  /** When the provider returned this offer, and when it should be treated as stale. */
  fetchedAt?: string;
  expiresAt?: string;
  notes?: string[];
  /** Fare facts as the provider states them, e.g. "Checked baggage for a fee". */
  conditions?: string[];
  bookingUrl?: string; // set only for real, configured providers
  searchUrl: string; // legitimate general search link with the search parameters
}

/** One completed flight search, stored with the reply so the cards show exactly what was found. */
export interface FlightSnapshot {
  offers: FlightOffer[];
  source: DataSource;
  provider: string;
  fetchedAt: string;
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
  /** Area of the city, when the provider gives one. */
  neighborhood?: string;
  city: string;
  distanceKm?: number;
  stars: number;
  /** Guest rating: out of 5 from Google (live), out of 10 on the website's illustrations. */
  rating?: number;
  ratingScale?: 5 | 10;
  reviews?: number;
  description: string;
  amenities: string[];
  image: string;
  images?: string[];
  address?: string;
  /** The property's own website. */
  link?: string;
  pricePerNight: number;
  totalPrice: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  guests: number;
  currency: Currency;
  freeCancellation?: boolean;
  breakfastIncluded?: boolean;
  /** Live offers: the provider's property id and the search, to find sellers and re-check the price. */
  propertyToken?: string;
  params?: HotelSearchParams;
  fetchedAt?: string;
  bookingUrl?: string;
  searchUrl: string;
}

/** One completed hotel search, stored with the reply so the cards show exactly what was found. */
export interface HotelSnapshot {
  offers: HotelOffer[];
  source: DataSource;
  provider: string;
  fetchedAt: string;
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

export type BusinessCategory = "Car rental agency" | "Car dealership" | "Private jet charter" | "Yacht charter";

/** A real business as listed on Google Maps. Pyrius has no partnership with any of them. */
export interface LocalBusiness {
  id: string;
  name: string;
  category: BusinessCategory;
  /** What the business calls itself on Google Maps, e.g. "Yacht broker". */
  type?: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  hours?: string;
  image?: string;
  distanceKm?: number;
  mapUrl?: string;
  verified: true; // only records from a real directory are ever rendered as businesses
}

export interface LocalBusinessResult {
  source: DataSource;
  provider?: string;
  fetchedAt?: string;
  businesses: LocalBusiness[];
  /** Honest fallback: a general map search the user can run themselves. */
  mapSearchUrl: string;
  city: string;
  category: BusinessCategory;
  /** True when nothing was found close by and the list shows the nearest ones further away. */
  widened?: boolean;
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
  /** Last price an email alert was sent for, so the same drop isn't announced twice. */
  alertedPrice?: number;
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
  | { type: "charter"; mode: "jets" | "yachts" }
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
      snapshot?: FlightSnapshot;
    }
  | { type: "hotels"; params: HotelSearchParams; budgetPerNight?: number; sort?: "luxury"; snapshot?: HotelSnapshot }
  /** Older conversations: rental-car estimates, now shown as the local rental agencies. */
  | { type: "cars"; params: CarSearchParams }
  /** `destinationCode` is the airport the search is centred on (the departure airport for private jets). */
  | { type: "businesses"; destinationCode: string; category: BusinessCategory; snapshot?: LocalBusinessResult };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  chips?: Chip[];
  attachment?: Attachment;
  /** Replies from the AI concierge can carry several result sets (e.g. hotels and cars). */
  attachments?: Attachment[];
  /** Web pages the AI consulted for this reply. */
  sources?: WebSource[];
}

export interface WebSource {
  title: string;
  url: string;
}

export const messageAttachments = (m: Pick<ChatMessage, "attachment" | "attachments">): Attachment[] => m.attachments ?? (m.attachment ? [m.attachment] : []);

/** Changes the AI asked for that the client applies through its own store (validated on the server first). */
export type ClientAction =
  | { type: "save"; offerId: string; kind: OfferKind; offer?: AnyOffer }
  | { type: "track"; offerId: string; kind: OfferKind; offer?: AnyOffer; targetPrice: number };

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
  attachments?: Attachment[];
  actions?: ClientAction[];
  sources?: WebSource[];
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

export type BillingInterval = "month" | "year";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** USD per month when billed monthly. */
  monthlyUSD: number;
  /** USD per month when billed yearly (charged as 12 × this, once a year). */
  yearlyMonthlyUSD: number;
  tagline: string;
  /** Infinity means unlimited. */
  limits: { searches: number; trackers: number; saved: number };
  features: string[];
}

export interface Subscription {
  plan: PlanId;
  /** "canceling": paid until the period ends; "past_due": a renewal failed and Stripe is retrying. */
  status: "active" | "demo-preview" | "canceling" | "past_due";
  /** Where the entitlement came from. Only "stripe" is a real paid subscription. */
  source: "default" | "demo" | "stripe";
}
