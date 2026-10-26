import type { BusinessCategory, DataSource, FlightOffer, FlightSearchParams, HotelOffer, HotelSearchParams, LocalBusinessResult } from "@/lib/types";

/**
 * Adapter contracts. A provider (Google Flights, Google Hotels, Google Maps through SerpApi…)
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

/** Car rental agencies, dealerships, private jet and yacht charters near an airport. */
export interface LocalBusinessProvider {
  id: string;
  source: DataSource;
  search(airportCode: string, category: BusinessCategory): Promise<LocalBusinessResult>;
}

export interface TravelProviders {
  flights: FlightProvider;
  hotels: HotelProvider;
  businesses: LocalBusinessProvider;
}
