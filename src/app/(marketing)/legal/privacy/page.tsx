import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, PRIVACY_EMAIL, type LegalSection } from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pyrius collects, uses and protects personal information.",
};

const mail = <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>;

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Pyrius (pyrius.app) is an AI travel concierge operated by an individual based in Québec, Canada (&ldquo;Pyrius&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). We are responsible for
          the personal information described in this policy.
        </p>
        <p>
          The person in charge of the protection of personal information can be reached at {mail}. Write to this address for any question, request or complaint about
          your personal information.
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <p>We collect only what we need to run Pyrius:</p>
        <ul>
          <li>
            <strong>Account information</strong> — your email address and password (stored as a secure hash by our authentication provider). If you sign in with Google or
            Apple, we receive the email address, name and account identifier that service shares with us. Apple may give us a private relay address instead of your
            email.
          </li>
          <li>
            <strong>Profile and preferences</strong> — anything you choose to add in Settings, such as your name, home airport, currency, language, appearance, notification
            choices and usual number of travelers.
          </li>
          <li>
            <strong>Trip planning content</strong> — the messages you send to the assistant, the trip details understood from them (for example destinations, dates,
            travelers and budget), and the offers you save and prices you track.
          </li>
          <li>
            <strong>Subscription information</strong> — your plan, its status, and the customer and subscription identifiers issued by Stripe. Card details are entered
            directly with Stripe and never reach our servers.
          </li>
          <li>
            <strong>Technical information</strong> — your sign-in session and display preferences are stored in your browser&apos;s local storage. Our hosting provider keeps
            standard server logs (IP address, browser type, time of request) for security and reliability.
          </li>
        </ul>
        <p>We do not use advertising cookies or third-party analytics trackers, and we do not sell or rent personal information.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <>
        <p>We use personal information to:</p>
        <ul>
          <li>create and secure your account and keep you signed in;</li>
          <li>understand the trip you describe and show matching flight, hotel and rental-car options;</li>
          <li>save your conversations, offers, price tracking and settings so they are there when you return;</li>
          <li>manage subscriptions and payments through Stripe;</li>
          <li>answer your requests, prevent abuse and keep the service secure;</li>
          <li>meet our legal obligations.</li>
        </ul>
        <p>
          We use your information only for these purposes, with your consent, or as permitted or required by law. If we want to use it for a new purpose, we will ask
          you first.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "How the assistant handles your messages",
    body: (
      <>
        <p>
          Your messages are processed to work out the details of your trip. Today this happens on our own servers. If we connect an external AI model provider, the
          text of your messages would be sent to that provider only to extract trip details, and we will update this policy before that happens.
        </p>
        <p>
          The assistant does not make decisions about you that produce legal or similarly significant effects. Flight, hotel and car results shown in Pyrius may be
          demonstration data, and are labelled as such where that is the case.
        </p>
      </>
    ),
  },
  {
    id: "share",
    title: "Service providers and transfers outside Québec",
    body: (
      <>
        <p>We share personal information only with providers that help us operate Pyrius, under contracts that limit their use of it:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database and authentication, including sign-in and confirmation emails.
          </li>
          <li>
            <strong>Vercel</strong> — website and application hosting.
          </li>
          <li>
            <strong>Stripe</strong> — subscription billing and payment processing.
          </li>
          <li>
            <strong>Google and Apple</strong> — only if you choose to sign in with them.
          </li>
        </ul>
        <p>
          These providers may store or process information outside Québec, including in the United States. Before communicating personal information outside Québec, we
          assess whether it will receive adequate protection, and we remain responsible for it.
        </p>
        <p>We may also disclose information when required by law or to protect the rights, safety and security of users and of Pyrius.</p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Travel providers you visit from Pyrius",
    body: (
      <p>
        Pyrius does not book travel or take payment for it. When you open an offer with an airline, a booking site or a rental company, you leave Pyrius and that
        company&apos;s own terms and privacy policy apply. The links we open carry search details such as destinations, dates and number of travelers, not your name or
        email address.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <p>
          We keep your information while your account is open. If you ask us to delete your account, we delete or anonymize your personal information within 30 days,
          except records we must keep by law, such as billing records required for tax purposes.
        </p>
        <p>Information stored only in your browser stays there until you clear it, for example from Settings → Data or your browser&apos;s settings.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Subject to the law, you can:</p>
        <ul>
          <li>access the personal information we hold about you and ask how it is used and shared;</li>
          <li>have inaccurate or incomplete information corrected;</li>
          <li>withdraw your consent, or ask us to stop using or to delete your information;</li>
          <li>receive the information you provided to us in a structured, commonly used technological format.</li>
        </ul>
        <p>
          Send your request to {mail}. We may need to confirm your identity, and we respond within 30 days. You can also file a complaint with the{" "}
          <a href="https://www.cai.gouv.qc.ca/" rel="noopener noreferrer" target="_blank">
            Commission d&apos;accès à l&apos;information du Québec
          </a>{" "}
          or the{" "}
          <a href="https://www.priv.gc.ca/" rel="noopener noreferrer" target="_blank">
            Office of the Privacy Commissioner of Canada
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Information travels over encrypted connections (HTTPS). Each account&apos;s data is isolated in our database so that one user cannot read another&apos;s, and access is
        limited to what is needed to run the service. No system is perfectly secure; if a confidentiality incident presents a risk of serious injury, we will notify the
        Commission d&apos;accès à l&apos;information and the people affected, as the law requires.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Pyrius is not intended for children under 14, and we do not knowingly collect their personal information without the consent of a parent or guardian.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We will post any update on this page with a new effective date, and notify you by email or in the app before significant changes take effect. Read this
        policy together with our <Link href="/legal/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro={<p>This policy explains what personal information Pyrius collects, why, who it is shared with, and the choices you have.</p>}
      sections={sections}
    />
  );
}
