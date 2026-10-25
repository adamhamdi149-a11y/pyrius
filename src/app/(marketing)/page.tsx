import type { Metadata } from "next";
import { Landing } from "@/components/marketing/Landing";
import { homeJsonLd } from "@/lib/seo/jsonld";
import { openGraph, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: openGraph("/"),
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()) }} />
      <Landing />
    </>
  );
}
