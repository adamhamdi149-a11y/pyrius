import { demoProviders } from "./demo";
import { ProviderError } from "./errors";
import { serpApiFlights } from "./serpapi";
import { serpApiHotels } from "./serpapiHotels";
import { serpApiPlaces } from "./serpapiPlaces";
import type { FlightProvider, HotelProvider, LocalBusinessProvider, TravelProviders } from "./types";

/**
 * Single switch point for travel data, server-side only.
 *
 *  - FLIGHT_PROVIDER=serpapi (or unset) with SERPAPI_API_KEY: live Google Flights, Google Hotels
 *    and Google Maps results.
 *  - FLIGHT_PROVIDER=demo: generated sample flights and stays, for development only.
 *  - Otherwise: no provider. Searches fail with "not_configured"; samples are never substituted
 *    for a live search.
 */
export type FlightMode = "live" | "demo" | "none";

export function flightMode(): FlightMode {
  const choice = (process.env.FLIGHT_PROVIDER ?? "").trim().toLowerCase();
  if (choice === "demo") return "demo";
  if ((choice === "" || choice === "serpapi") && process.env.SERPAPI_API_KEY) return "live";
  return "none";
}

const fail = async (): Promise<never> => {
  throw new ProviderError("not_configured", "none");
};
const notConfigured: FlightProvider & HotelProvider & LocalBusinessProvider = { id: "none", source: "live", search: fail };

export function getProviders(): TravelProviders {
  const mode = flightMode();
  if (mode === "live") return { flights: serpApiFlights, hotels: serpApiHotels, businesses: serpApiPlaces };
  if (mode === "demo") return demoProviders;
  return { flights: notConfigured, hotels: notConfigured, businesses: notConfigured };
}

export { serpApiFlights, serpApiHotels };
export type { TravelProviders } from "./types";
