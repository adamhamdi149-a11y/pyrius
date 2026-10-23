import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, PRIVACY_EMAIL, type LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use Pyrius.",
};

const mail = <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        These terms form an agreement between you and the operator of Pyrius, an individual based in Québec, Canada (&ldquo;Pyrius&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By
        creating an account or using pyrius.app, you agree to them and to our <Link href="/legal/privacy">Privacy Policy</Link>. If you do not agree, please do not use
        Pyrius.
      </p>
    ),
  },
  {
    id: "service",
    title: "What Pyrius does — and doesn't",
    body: (
      <>
        <p>
          Pyrius is an AI travel concierge. You describe a trip in your own words, and it helps you explore and compare flight options, save offers, follow prices, and
          look at hotels and rental cars.
        </p>
        <p>
          <strong>Pyrius is not a travel agency.</strong> We do not sell tickets, make reservations or take payment for travel. When you choose an offer, you are sent to
          an airline, booking site or rental company, and any booking is a contract between you and that company under its own terms.
        </p>
      </>
    ),
  },
  {
    id: "accuracy",
    title: "Prices and information",
    body: (
      <>
        <p>
          Results, prices, schedules and availability shown in Pyrius may be demonstration data or may change at any time, and are labelled as demonstration data where
          that is the case. Always confirm the final price and conditions with the provider before you book.
        </p>
        <p>
          Price tracking shows the prices Pyrius has recorded and may use simulated prices where labelled. We do not guarantee that an offer is the cheapest available,
          that a price will drop, or that you will save money.
        </p>
      </>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <>
        <p>
          You must be at least 14 years old to use Pyrius, and of the age of majority where you live to subscribe to a paid plan. Give accurate information, keep your
          sign-in details confidential, and tell us at {mail} if you think your account has been used without your permission.
        </p>
        <p>You can stop using Pyrius at any time and ask us to delete your account.</p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans and payment",
    body: (
      <>
        <p>
          Pyrius offers a free plan and optional paid plans. Paid plans are billed monthly in advance through Stripe, in Canadian dollars, plus applicable taxes, and
          renew automatically each month until you cancel. Prices and what each plan includes are shown before you subscribe.
        </p>
        <p>
          You can cancel at any time; your paid features continue until the end of the period you have paid for. We will tell you at least 30 days in advance of any
          price increase or change to what your plan includes, and you can cancel before it takes effect. Refunds are provided where required by law.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>Please do not:</p>
        <ul>
          <li>use Pyrius in a way that breaks the law or infringes anyone&apos;s rights;</li>
          <li>try to access other people&apos;s accounts or data, or disrupt or overload the service;</li>
          <li>scrape, copy or resell Pyrius or its content, or use it to build a competing product;</li>
          <li>reverse engineer the service except where the law allows it.</li>
        </ul>
        <p>We may suspend or close an account that breaks these rules, after notice where reasonable.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <p>
        The messages and information you enter remain yours. You give us permission to store and process them only as needed to provide Pyrius to you, as described in
        the <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Our content",
    body: (
      <p>
        The Pyrius name, logo, design, software and website content belong to us or our licensors. These terms give you a personal, non-transferable right to use
        Pyrius; they do not transfer any ownership to you. Third-party names and logos belong to their owners.
      </p>
    ),
  },
  {
    id: "third",
    title: "Third-party services",
    body: (
      <p>
        Pyrius links to and relies on services we do not control, such as airlines, booking sites, rental companies, Google, Apple and Stripe. We are not responsible
        for their content, prices, availability or practices.
      </p>
    ),
  },
  {
    id: "warranty",
    title: "Disclaimers",
    body: (
      <p>
        We work to keep Pyrius useful and available, but we provide it as is and do not promise that it will be uninterrupted or error-free. Nothing in these terms
        limits rights you have under the Québec Consumer Protection Act or other laws that cannot be excluded by agreement.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <p>
        To the extent permitted by law, we are not liable for indirect or consequential losses, or for losses arising from bookings, prices or services of third-party
        providers. Nothing in these terms excludes liability that cannot be excluded by law, including for our own intentional or gross fault.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and termination",
    body: (
      <p>
        We may update these terms. We will give you notice of significant changes before they take effect, and you can close your account if you do not accept them.
        You may stop using Pyrius at any time; we may end or suspend the service, with reasonable notice where possible.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of Québec and the federal laws of Canada that apply there. If you are a consumer, you keep any right to bring a claim
        before the courts of the place where you live.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these terms: {mail}.</p>,
  },
];

export default function TermsPage() {
  return <LegalDoc title="Terms of Service" intro={<p>The short version: Pyrius helps you plan; you book with the provider you choose.</p>} sections={sections} />;
}
