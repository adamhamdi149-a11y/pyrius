import { demoProviders } from "./demo";
import { ProviderError } from "./errors";
import { serpApiFlights } from "./serpapi";
import type { FlightProvider, TravelProviders } from "./types";

/**
 * Single switch point for travel data, server-side only.
 *
 * Flights:
 *  - FLIGHT_PROVIDER=serpapi (or unset) with SERPAPI_API_KEY: live Google Flights results.
 *  - FLIGHT_PROVIDER=demo: generated sample flights, for development and demos only.
 *  - Otherwise: no provider. Searches fail with "not_configured"; sample flights are never
 *    substituted for a live search.
 * Hotels, cars and local businesses have no live provider yet and stay labelled as examples.
 */
export type FlightMode = "live" | "demo" | "none";

export function flightMode(): FlightMode {
  const choice = (process.env.FLIGHT_PROVIDER ?? "").trim().toLowerCase();
  if (choice === "demo") return "demo";
  if ((choice === "" || choice === "serpapi") && process.env.SERPAPI_API_KEY) return "live";
  return "none";
}

const notConfigured: FlightProvider = {
  id: "none",
  source: "live",
  async search() {
    throw new ProviderError("not_configured", "none");
  },
};

export function getProviders(): TravelProviders {
  const mode = flightMode();
  return { ...demoProviders, flights: mode === "live" ? serpApiFlights : mode === "demo" ? demoProviders.flights : notConfigured };
}

export { serpApiFlights };
export type { TravelProviders } from "./types";
