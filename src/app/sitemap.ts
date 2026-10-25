import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The public pages. The app itself is behind sign-in and stays out of search results. */
export default function sitemap(): MetadataRoute.Sitemap {
  const legal = new Date("2026-10-25");
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: legal, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, lastModified: legal, changeFrequency: "yearly", priority: 0.3 },
  ];
}
