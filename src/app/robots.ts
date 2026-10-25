import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawlers may read every page; the private app pages say "noindex" themselves, which Google
 * can only see if it's allowed to fetch them. The API isn't for crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
