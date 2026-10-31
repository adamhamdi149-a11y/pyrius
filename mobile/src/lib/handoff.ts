import { router } from "expo-router";

/**
 * Opens the chat on a new conversation and sends this request to Pyrius, so a destination picked in
 * Explore or a trip continues straight into the real flight, hotel or car search.
 */
export function askPyrius(prompt: string) {
  router.dismissTo({ pathname: "/chat", params: { ask: prompt, k: String(Date.now()) } });
}
