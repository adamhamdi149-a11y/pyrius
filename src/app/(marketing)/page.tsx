import type { Metadata } from "next";
import { Landing } from "@/components/marketing/Landing";

export const metadata: Metadata = {
  title: { absolute: "Pyrius — Flight search, reimagined" },
  description: "Describe your trip in your own words. Pyrius, the AI travel concierge, asks what matters and lays out flights you can compare, save and track.",
  openGraph: {
    title: "Pyrius — Flight search, reimagined",
    description: "The future of flight search isn't another search engine. It's a conversation.",
    url: "https://www.pyrius.app",
    siteName: "Pyrius",
    type: "website",
  },
};

export default function Home() {
  return <Landing />;
}
