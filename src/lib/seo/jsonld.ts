import { FAQS } from "@/components/marketing/faq";
import { PLANS } from "@/lib/plans";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Structured data for the home page (schema.org, read by Google). Everything here is also
 * visible on the page: no ratings, reviews or claims that aren't on the site.
 */
export function homeJsonLd() {
  const org = `${SITE_URL}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": org,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/apple-icon`, width: 180, height: 180 },
        email: "contact@pyrius.app",
        areaServed: "CA",
        contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: "contact@pyrius.app", availableLanguage: ["English", "French"] },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { "@id": org },
        inLanguage: "en-CA",
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: `${SITE_URL}/app`,
        description: SITE_DESCRIPTION,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web browser",
        browserRequirements: "Requires JavaScript",
        publisher: { "@id": org },
        offers: PLANS.map((p) => ({
          "@type": "Offer",
          name: p.name,
          description: p.tagline,
          price: p.monthlyCAD.toFixed(2),
          priceCurrency: "CAD",
          category: p.monthlyCAD === 0 ? "free" : "subscription",
          url: `${SITE_URL}/#pricing`,
        })),
        featureList: ["Plan trips by describing them in your own words", "Live flight search and comparison", "Save offers", "Price tracking", "Hotels and rental cars for the same dates"],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
}
