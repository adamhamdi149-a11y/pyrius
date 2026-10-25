/** The one public address of the website. Every canonical URL, sitemap entry and social link uses it. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") ? process.env.NEXT_PUBLIC_APP_URL : "https://pyrius.app").replace(/\/$/, "");

export const SITE_NAME = "Pyrius";
export const SITE_TITLE = "Pyrius — AI travel concierge for real flight search";
export const SITE_DESCRIPTION =
  "Describe your trip in your own words. Pyrius, the AI travel concierge, searches real flights, compares them side by side, tracks prices and sends you to book with the airline.";

/**
 * The full Open Graph block for a page. A page that sets openGraph replaces the layout's whole block
 * (no deep merge), so every page builds it here to keep the image, type and site name.
 */
export function openGraph(path: string, title = SITE_TITLE, description = SITE_DESCRIPTION) {
  return {
    type: "website" as const,
    siteName: SITE_NAME,
    locale: "en_CA",
    url: path,
    title,
    description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Pyrius — AI travel concierge. Describe your trip; Pyrius finds real flights." }],
  };
}
