import type {
  CarOffer,
  CarSearchParams,
  DataSource,
  FlightOffer,
  FlightSearchParams,
  HotelOffer,
  HotelSearchParams,
  LocalBusiness,
  LocalBusinessResult,
  PriceTracker,
} from "@/lib/types";

/**
 * Adapter contracts. A real provider (Duffel, Amadeus, Booking affiliate, a Places API…)
 * implements these and is swapped in via `getProviders()` without touching the UI.
 */

export interface FlightProvider {
  id: string;
  source: DataSource;
  search(params: FlightSearchParams): Promise<FlightOffer[]>;
}

export interface HotelProvider {
  id: string;
  source: DataSource;
  search(params: HotelSearchParams): Promise<HotelOffer[]>;
}

export interface CarProvider {
  id: string;
  source: DataSource;
  search(params: CarSearchParams): Promise<CarOffer[]>;
}

export interface LocalBusinessProvider {
  id: string;
  source: DataSource;
  search(destinationCode: string, category: LocalBusiness["category"]): Promise<LocalBusinessResult>;
}

/** Re-prices a tracked offer. Real implementations run server-side on a schedule. */
export interface PriceCheckProvider {
  id: string;
  source: DataSource;
  check(tracker: PriceTracker): Promise<{ price: number; available: boolean; checkedAt: string }>;
}

export interface TravelProviders {
  flights: FlightProvider;
  hotels: HotelProvider;
  cars: CarProvider;
  businesses: LocalBusinessProvider;
}
