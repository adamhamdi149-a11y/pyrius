/**
 * FAQ text, shared by the page and its structured data for Google (which must match the visible
 * answers). `link` turns one phrase of the answer into a link.
 */
export interface FaqItem {
  q: string;
  a: string;
  link?: { text: string; href: string };
}

export const FAQS: FaqItem[] = [
  {
    q: "What is Pyrius?",
    a: "An AI travel concierge. You describe a trip in your own words, Pyrius asks for what it still needs, then lays out flights you can compare, save and track, with stays and rental cars for the same dates.",
  },
  {
    q: "Does Pyrius book my trip?",
    a: "No. Pyrius isn't a travel agency and never takes payment for travel. When you choose a flight, Pyrius shows who sells it and you book directly with the airline or travel site.",
  },
  {
    q: "Are the prices real?",
    a: "Flights in Pyrius are live fares from Google Flights at the moment you search. They can change until you book, and the price the seller shows you before you pay is the one that counts. Prices on this website are illustrative examples, and hotels and rental cars are still example data while those connections are added.",
  },
  {
    q: "How much does it cost?",
    a: "Pyrius is free to start. Plus ($9.99 a month, or $4.99 a month billed yearly) and Pro ($19.99 a month, or $11.99 a month billed yearly) add more AI-assisted flight searches, saved offers, tracked prices and alerts. Prices are in US dollars. See Pricing for what each plan includes.",
    link: { text: "Pricing", href: "#pricing" },
  },
  {
    q: "Can I cancel a paid plan?",
    a: "Yes, at any time, from Settings. Your paid features continue until the end of the month or year you've already paid for.",
  },
  {
    q: "Do I need an account?",
    a: "Yes, a free one. It keeps your conversations, saved offers and tracked prices together, on every device you sign in from.",
  },
  {
    q: "What happens to my data?",
    a: "Your trips and saved offers are stored in your account. We don't sell or rent personal information, and we don't use advertising trackers. The details are in our Privacy Policy.",
    link: { text: "Privacy Policy", href: "/legal/privacy" },
  },
];
