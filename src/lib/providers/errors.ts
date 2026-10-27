/** Why a live search didn't produce results. The code drives both the UI message and what the AI tells the user. */
export type ProviderErrorCode =
  | "not_configured" // no travel data provider is set up
  | "auth" // the provider rejected our credentials
  | "quota" // the provider account is out of searches or rate-limited
  | "timeout"
  | "expired" // a booking token or offer is no longer valid
  | "bad_request"
  | "unavailable";

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    public provider: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const PROVIDER_MESSAGES: Record<ProviderErrorCode, string> = {
  not_configured: "Live search isn't connected yet. Pyrius needs access to its travel data provider before it can show real prices.",
  auth: "The travel data provider rejected Pyrius's credentials, so the search couldn't run.",
  quota: "The travel data provider's search limit has been reached. Please try again later.",
  timeout: "The search took too long to answer. Please try again.",
  expired: "This offer has expired. Search again for current prices.",
  bad_request: "The search couldn't run with these details.",
  unavailable: "The travel data provider didn't respond. Please try again.",
};

export const PROVIDER_STATUS: Record<ProviderErrorCode, number> = {
  not_configured: 503,
  auth: 502,
  quota: 503,
  timeout: 504,
  expired: 410,
  bad_request: 400,
  unavailable: 502,
};
