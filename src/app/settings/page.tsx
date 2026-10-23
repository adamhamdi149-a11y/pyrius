"use client";
import { Bell, Check, CreditCard, Database, LogIn, LogOut, Minus, Monitor, Moon, Palette, SlidersHorizontal, Sparkles, Sun, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { initials, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { AIRPORTS } from "@/lib/data/catalog";
import { PLANS, planById } from "@/lib/plans";
import { useStore } from "@/lib/store/AppStore";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import type { PlanId, UserSettings } from "@/lib/types";
import { cx, moneyExact } from "@/lib/utils";

const SECTIONS = [
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "data", label: "Data", icon: Database },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="srow-set">
      <div className="srow-set__text">
        <div className="srow-set__label">{label}</div>
        {hint && <div className="srow-set__hint">{hint}</div>}
      </div>
      <div className="srow-set__control">{children}</div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="sset" aria-labelledby={`s-${title}`}>
      <div className="sset__head">
        <h2 id={`s-${title}`} className="t-h2">
          {title}
        </h2>
        {desc && <p className="sset__desc">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Account() {
  const store = useStore();
  const { settings, auth, storage } = store;
  const [name, setName] = useState(settings.name);
  const [email, setEmail] = useState(settings.email);
  const toast = useToast();
  useEffect(() => {
    setName(settings.name);
    setEmail(settings.email);
  }, [settings.name, settings.email]);
  const cloudEmail = auth.mode === "cloud" ? auth.email : undefined;
  const dirty = name !== settings.name || (!cloudEmail && email !== settings.email);

  return (
    <Section title="Account" desc="How you appear in Pyrius.">
      <div className="sgroup">
        <div className="profile-card">
          <span className="avatar avatar--lg">{initials(name, cloudEmail ?? email)}</span>
          <div style={{ minWidth: 0 }}>
            <div className="t-h3">{name || "Guest traveler"}</div>
            <div className="t-meta">{cloudEmail ?? (email || "No email set")}</div>
            <div style={{ marginTop: 8 }}>
              {storage === "cloud" ? <span className="badge badge--success">Synced to your account</span> : <span className="badge">Stored in this browser only</span>}
            </div>
          </div>
        </div>
        <div className="srow-set" style={{ display: "block" }}>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="input"
                type="email"
                value={cloudEmail ?? email}
                disabled={Boolean(cloudEmail)}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
              <span className="field__hint">{cloudEmail ? "Managed by your sign-in." : "Kept locally. Used for alerts once email delivery is configured."}</span>
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button
              className="btn btn--primary"
              disabled={!dirty}
              onClick={() => {
                store.updateSettings({ name: name.trim(), email: cloudEmail ? settings.email : email.trim() });
                toast({ title: "Profile updated", description: storage === "cloud" ? undefined : "Saved in this browser." });
              }}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
      <div className="sgroup">
        {auth.mode === "cloud" ? (
          <Row label="Signed in" hint={`As ${auth.email ?? "your account"}. Your saved offers, trackers and conversations sync across devices.`}>
            <button className="btn btn--secondary" onClick={() => store.signOut()}>
              <LogOut />
              Sign out
            </button>
          </Row>
        ) : supabaseConfigured ? (
          <Row label="Sign in to sync" hint="You're using Pyrius without an account. Data stays in this browser until you sign in.">
            <Link href="/login" className="btn btn--primary">
              <LogIn />
              Sign in
            </Link>
          </Row>
        ) : (
          <Row label="Local demo mode" hint="Accounts aren't configured yet (Supabase keys missing). Everything you do is stored in this browser only and isn't synchronized between devices.">
            <span className="badge">No account</span>
          </Row>
        )}
      </div>
    </Section>
  );
}

function Preferences() {
  const { settings, updateSettings } = useStore();
  const toast = useToast();
  const set = (p: Partial<UserSettings>) => {
    updateSettings(p);
    toast({ title: "Preferences saved" });
  };
  return (
    <Section title="Preferences" desc="Defaults the assistant uses so it can ask fewer questions.">
      <div className="sgroup">
        <Row label="Home airport" hint="Suggested first when the assistant asks where you're leaving from.">
          <select className="select" value={settings.homeAirport} onChange={(e) => set({ homeAirport: e.target.value })}>
            {AIRPORTS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.city} ({a.code})
              </option>
            ))}
          </select>
        </Row>
        <Row label="Currency" hint="Applies to new searches. Demo conversions use fixed approximate rates.">
          <select className="select" value={settings.currency} onChange={(e) => set({ currency: e.target.value as UserSettings["currency"] })}>
            <option value="CAD">CAD — Canadian dollar</option>
            <option value="USD">USD — US dollar</option>
            <option value="EUR">EUR — Euro</option>
          </select>
        </Row>
        <Row label="Language" hint="Interface and assistant replies.">
          <select className="select" value={settings.locale} onChange={(e) => set({ locale: e.target.value as UserSettings["locale"] })}>
            <option value="en">English</option>
            <option value="fr">Français (Canada)</option>
          </select>
        </Row>
      </div>
      <div className="sgroup">
        <Row label="Default travelers" hint="Adults and children you usually travel with.">
          <select className="select" value={settings.defaultAdults} onChange={(e) => set({ defaultAdults: Number(e.target.value) })} aria-label="Adults">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} adult{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <select className="select" value={settings.defaultChildren} onChange={(e) => set({ defaultChildren: Number(e.target.value) })} aria-label="Children">
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "child" : "children"}
              </option>
            ))}
          </select>
        </Row>
        {(
          [
            ["nonstop", "Prefer nonstop flights", "Pre-selects the nonstop filter on new trips."],
            ["carryOnOnly", "Carry-on included", "Hide fares without a carry-on bag by default."],
            ["flexibleDates", "My dates are usually flexible", "Lets the assistant suggest nearby dates."],
          ] as const
        ).map(([k, label, hint]) => (
          <Row key={k} label={label} hint={hint}>
            <Switch checked={settings.travelStyle[k]} onChange={(v) => set({ travelStyle: { ...settings.travelStyle, [k]: v } })} label={label} />
          </Row>
        ))}
      </div>
    </Section>
  );
}

function Appearance() {
  const { settings, updateSettings } = useStore();
  const opts = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Monitor },
  ] as const;
  return (
    <Section title="Appearance" desc="Dark is the default. Your choice is remembered on this device.">
      <div className="sgroup">
        <div className="theme-cards" role="radiogroup" aria-label="Theme">
          {opts.map(({ id, label, icon: Icon }) => (
            <button key={id} role="radio" aria-checked={settings.theme === id} className="theme-card" onClick={() => updateSettings({ theme: id })}>
              <div className={`theme-prev theme-prev--${id}`}>
                <div className="theme-prev__side">
                  <i style={{ width: "70%" }} />
                  <i />
                  <i style={{ width: "80%" }} />
                </div>
                <div className="theme-prev__main">
                  <span className="theme-prev__orb" />
                  <i style={{ width: 60 }} />
                  <i style={{ width: 90, height: 10, borderRadius: 5 }} />
                </div>
              </div>
              <span>
                <Icon />
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Notifications() {
  const { settings, updateSettings } = useStore();
  const n = settings.notifications;
  const set = (k: keyof UserSettings["notifications"], v: boolean) => updateSettings({ notifications: { ...n, [k]: v } });
  return (
    <Section title="Notifications" desc="Choose what Pyrius may tell you about.">
      <div className="notice" style={{ marginBottom: 14 }}>
        <Bell />
        <span>Email delivery isn&apos;t connected yet, so no messages are sent. Your choices are saved and will apply once it is.</span>
      </div>
      <div className="sgroup">
        <Row label="Email notifications" hint="Master switch for all emails.">
          <Switch checked={n.email} onChange={(v) => set("email", v)} label="Email notifications" />
        </Row>
        <Row label="Price alerts" hint="When a tracked price reaches your target. Simulated prices never trigger real alerts.">
          <Switch checked={n.priceAlerts} onChange={(v) => set("priceAlerts", v)} label="Price alerts" />
        </Row>
        <Row label="Saved-search updates" hint="A digest when new options appear for a saved trip.">
          <Switch checked={n.savedSearches} onChange={(v) => set("savedSearches", v)} label="Saved-search updates" />
        </Row>
        <Row label="Product news" hint="Occasional updates about new Pyrius features.">
          <Switch checked={n.productNews} onChange={(v) => set("productNews", v)} label="Product news" />
        </Row>
      </div>
    </Section>
  );
}

const MATRIX: [string, string | boolean, string | boolean, string | boolean][] = [
  ["AI trip planning", true, true, true],
  ["Saved offers", "25", "250", "1,000"],
  ["Tracked prices", "3", "25", "100"],
  ["Price-alert emails", false, true, true],
  ["Saved-search alerts", false, true, true],
  ["Multi-trip planning", false, false, true],
];

function Subscription() {
  const store = useStore();
  const { subscription, trackers, saved, auth } = store;
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [busy, setBusy] = useState<PlanId | null>(null);
  const current = planById(subscription.plan);

  useEffect(() => {
    const c = params.get("checkout");
    if (c === "success") toast({ title: "Checkout complete", description: "Your plan updates as soon as Stripe confirms the payment." });
    if (c === "cancelled") toast({ tone: "info", title: "Checkout cancelled", description: "No changes were made." });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upgrade = async (plan: PlanId) => {
    if (plan === "free") {
      if (subscription.source === "demo") {
        store.setDemoPlan("free");
        toast({ tone: "info", title: "Back on Free", description: "The demo preview has ended." });
      } else toast({ tone: "info", title: "Manage billing in Stripe", description: "Plan downgrades are handled by the billing portal once connected." });
      return;
    }
    setBusy(plan);
    try {
      const token = auth.mode === "cloud" ? (await getSupabase()?.auth.getSession())?.data.session?.access_token : undefined;
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ plan }),
      });
      const data = await r.json();
      if (data.demo) router.push(`/checkout/demo?plan=${plan}`);
      else if (data.url) window.location.href = data.url;
      else toast({ tone: "error", title: "Couldn't start checkout", description: data.error ?? "Please try again." });
    } catch {
      toast({ tone: "error", title: "Couldn't reach the server", description: "Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title="Subscription" desc="Prices in CAD, billed monthly. These are provisional product settings, not final pricing.">
      <div className="sgroup" style={{ marginBottom: 16 }}>
        <Row
          label={`Current plan: ${current.name}${subscription.source === "demo" ? " (demo preview)" : ""}`}
          hint={`${trackers.length} of ${current.limits.trackers} tracked prices · ${saved.length} of ${current.limits.saved} saved offers${subscription.source === "demo" ? " · No payment was taken." : ""}`}
        >
          <span className={cx("badge", subscription.plan !== "free" && "badge--accent")}>
            <Sparkles />
            {current.name}
          </span>
        </Row>
      </div>

      <div className="plans">
        {PLANS.map((p) => {
          const isCurrent = p.id === subscription.plan;
          const featured = p.id === "plus";
          return (
            <div key={p.id} data-glow className={cx("plan", featured && "plan--featured")}>
              <div className="plan__name">
                {p.name}
                {featured && !isCurrent && <span className="badge badge--accent">Recommended</span>}
                {featured && isCurrent && <span className="badge badge--accent">Current</span>}
                {isCurrent && !featured && <span className="badge">Current</span>}
              </div>
              <div className="plan__price">
                <b className="num">{moneyExact(p.monthlyCAD, "CAD", store.settings.locale)}</b>
                <span>/ month</span>
              </div>
              <p className="plan__tag">{p.tagline}</p>
              <ul className="plan__features">
                {p.features.map((f) => (
                  <li key={f}>
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={cx("btn btn--lg btn--block", featured && !isCurrent ? "btn--primary" : "btn--secondary")}
                disabled={isCurrent || busy !== null}
                onClick={() => upgrade(p.id)}
              >
                {isCurrent ? "Current plan" : busy === p.id ? "Opening checkout…" : p.id === "free" ? "Switch to Free" : `Choose ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="sgroup compare-wrap" style={{ marginTop: 16 }}>
        <table className="compare">
          <thead>
            <tr>
              <th>Compare plans</th>
              {PLANS.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map(([label, ...vals]) => (
              <tr key={label}>
                <td>{label}</td>
                {vals.map((v, i) => (
                  <td key={i} className="num">
                    {v === true ? <Check aria-label="Included" /> : v === false ? <Minus className="dash" aria-label="Not included" style={{ color: "var(--text-3)" }} /> : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="results__fine" style={{ marginTop: 12 }}>
        Payments are handled by Stripe once configured. Pyrius never stores card details. Without Stripe keys, upgrades open a clearly labeled demo checkout and no payment is processed.
      </p>
    </Section>
  );
}

function DataSection() {
  const store = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  return (
    <Section title="Data" desc="What's stored and where.">
      <div className="sgroup">
        <Row label="Storage" hint={store.storage === "cloud" ? "Your data is stored in your Pyrius account (Supabase) and protected so only you can access it." : "Everything is stored in this browser (localStorage). Clearing site data removes it."}>
          <span className="badge">{store.storage === "cloud" ? "Account" : "This browser"}</span>
        </Row>
        <Row label="Travel data sources" hint="Flights, stays, cars and price history are demonstration data until real providers are connected.">
          <span className="badge badge--demo">Demo</span>
        </Row>
        {store.storage === "local" && (
          <Row label="Clear local data" hint="Removes conversations, saved offers, trackers and settings from this browser.">
            <button className="btn btn--danger" onClick={() => setConfirm(true)}>
              Clear data
            </button>
          </Row>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await store.clearLocalData();
          toast({ tone: "info", title: "Local data cleared" });
        }}
        title="Clear all local data?"
        description="This permanently removes everything Pyrius stored in this browser. It can't be undone."
        confirmLabel="Clear everything"
        danger
      />
    </Section>
  );
}

function SettingsInner() {
  const { t } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const initial = (SECTIONS.find((s) => s.id === params.get("section"))?.id ?? "account") as SectionId;
  const [section, setSection] = useState<SectionId>(initial);
  useEffect(() => setSection(initial), [initial]);

  const go = (id: SectionId) => {
    setSection(id);
    router.replace(`/settings?section=${id}`, { scroll: false });
  };

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="t-title">{t("settings.title")}</h1>
          <p className="page__sub">{t("settings.subtitle")}</p>
        </div>
      </header>
      <div className="settings">
        <nav className="settings__nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} aria-current={section === id} onClick={() => go(id)}>
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div key={section}>
          {section === "account" && <Account />}
          {section === "preferences" && <Preferences />}
          {section === "appearance" && <Appearance />}
          {section === "notifications" && <Notifications />}
          {section === "subscription" && <Subscription />}
          {section === "data" && <DataSection />}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="main__scroll">
      <Suspense>
        <SettingsInner />
      </Suspense>
    </div>
  );
}
