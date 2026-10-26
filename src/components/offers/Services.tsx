"use client";
import { Anchor, ArrowUpRight, BedDouble, Building2, Car, Plane, PlaneTakeoff } from "lucide-react";
import Link from "next/link";
import { placeName } from "@/lib/data/world";
import { savePendingPrompt } from "@/lib/pendingPrompt";
import { useStore } from "@/lib/store/AppStore";

type Service = { key: string; icon: typeof Plane; title: [string, string]; body: [string, string]; badge: [string, string]; live: boolean; prompt: (home: string) => [string, string] };

const SERVICES: Service[] = [
  {
    key: "flights",
    icon: Plane,
    title: ["Flights", "Vols"],
    body: ["Live fares from Google Flights, booked with the cheapest seller.", "Tarifs en direct de Google Flights, réservés chez le vendeur le moins cher."],
    badge: ["Live prices", "Prix en direct"],
    live: true,
    prompt: (home) => [`Find me flights from ${home} to `, `Trouve-moi des vols de ${home} vers `],
  },
  {
    key: "stays",
    icon: BedDouble,
    title: ["Hotels & stays", "Hôtels et séjours"],
    body: ["Hotels and vacation rentals with real prices, ratings and photos.", "Hôtels et locations avec prix réels, notes et photos."],
    badge: ["Live prices", "Prix en direct"],
    live: true,
    prompt: () => ["Find me a hotel in ", "Trouve-moi un hôtel à "],
  },
  {
    key: "rentals",
    icon: Car,
    title: ["Car rentals", "Location de voitures"],
    body: ["Rental agencies near any airport, with ratings, phone and website.", "Agences de location près de tout aéroport, avec notes, téléphone et site."],
    badge: ["Real companies", "Vraies entreprises"],
    live: false,
    prompt: () => ["Find car rental agencies in ", "Trouve des agences de location de voitures à "],
  },
  {
    key: "dealers",
    icon: Building2,
    title: ["Car dealerships", "Concessionnaires"],
    body: ["Dealers near your destination, rated by real customers.", "Concessionnaires près de votre destination, notés par de vrais clients."],
    badge: ["Real companies", "Vraies entreprises"],
    live: false,
    prompt: () => ["Find car dealerships in ", "Trouve des concessionnaires à "],
  },
  {
    key: "jets",
    icon: PlaneTakeoff,
    title: ["Private jets", "Jets privés"],
    body: ["Charter operators near you, and published empty-leg deals.", "Opérateurs de vols nolisés près de vous, et offres « empty leg » publiées."],
    badge: ["Operators & deals", "Opérateurs et offres"],
    live: false,
    prompt: (home) => [`Find private jet charters from ${home} to `, `Trouve des jets privés de ${home} vers `],
  },
  {
    key: "yachts",
    icon: Anchor,
    title: ["Yachts", "Yachts"],
    body: ["Yacht and boat charters at your destination, and current deals.", "Locations de yachts et de bateaux à destination, et offres du moment."],
    badge: ["Charters & deals", "Locations et offres"],
    live: false,
    prompt: () => ["Find yacht charters in ", "Trouve des locations de yacht à "],
  },
];

/** What Pyrius can search, each one starting a new conversation with the request half-written. */
export function Services() {
  const store = useStore();
  const fr = store.settings.locale === "fr";
  const home = placeName(store.settings.homeAirport, store.settings.locale) || (fr ? "Montréal" : "Montreal");
  return (
    <section className="section" aria-labelledby="services-title">
      <div className="section__head">
        <h2 id="services-title" className="t-h2">
          {fr ? "Tout le voyage, au même endroit" : "Everything for the trip"}
        </h2>
        <span className="t-meta services__sub">{fr ? "Pyrius trouve, compare et vous envoie au bon vendeur." : "Pyrius finds, compares and sends you to the right seller."}</span>
      </div>
      <div className="services">
        {SERVICES.map(({ key, icon: Icon, title, body, badge, live, prompt }) => (
          <Link
            key={key}
            href="/app"
            className="service m-press"
            data-glow
            onClick={() => {
              savePendingPrompt(prompt(home)[fr ? 1 : 0]);
              store.setActiveId(null);
            }}
          >
            <span className="service__icon">
              <Icon />
            </span>
            <span className="service__text">
              <b>{title[fr ? 1 : 0]}</b>
              <span>{body[fr ? 1 : 0]}</span>
            </span>
            <span className={`badge ${live ? "badge--live" : ""} service__badge`}>{badge[fr ? 1 : 0]}</span>
            <ArrowUpRight className="service__go" />
          </Link>
        ))}
      </div>
    </section>
  );
}
