import { demoProviders } from "./demo";
import type { TravelProviders } from "./types";

/**
 * Single switch point for travel data. When a real provider is configured
 * (e.g. FLIGHT_PROVIDER=duffel + key), return its adapter here — server-side only.
 */
export function getProviders(): TravelProviders {
  return demoProviders;
}

export type { TravelProviders } from "./types";
