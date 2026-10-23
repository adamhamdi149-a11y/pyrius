"use client";
import { ArrowRight, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LiveOrb } from "@/components/ai/LiveOrb";
import { LogoMark } from "@/components/brand/Logo";
import { AppleMark, GoogleG } from "@/components/brand/ProviderLogos";
import { peekPendingPrompt, safeNext } from "@/lib/pendingPrompt";
import { useStore } from "@/lib/store/AppStore";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

type Providers = { google: boolean; apple: boolean };

/** The last answer is remembered so the buttons don't pop in on every visit. */
const PROVIDERS_KEY = "pyrius:auth-providers";

/** Which OAuth providers are switched on in Supabase. Buttons appear only for these. */
async function loadProviders(): Promise<Providers> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { google: false, apple: false };
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const j = await r.json();
    return { google: Boolean(j.external?.google), apple: Boolean(j.external?.apple) };
  } catch {
    return { google: false, apple: false };
  }
}

function AuthForm() {
  const { auth, ready } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [trip, setTrip] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(PROVIDERS_KEY);
      if (cached) setProviders(JSON.parse(cached));
    } catch {}
    loadProviders().then((p) => {
      setProviders(p);
      try {
        localStorage.setItem(PROVIDERS_KEY, JSON.stringify(p));
      } catch {}
    });
    setTrip(peekPendingPrompt());
    // OAuth/email-link errors come back on the URL.
    const err = params.get("error_description") || new URLSearchParams(window.location.hash.slice(1)).get("error_description");
    if (err) setMsg({ tone: "error", text: err.replace(/\+/g, " ") });
  }, [params]);

  // Already signed in: go straight to the app.
  useEffect(() => {
    if (ready && auth.mode === "cloud") router.replace(next);
  }, [ready, auth.mode, next, router]);

  if (!supabaseConfigured) {
    return (
      <div className="auth__card">
        <h1 className="auth__title">Accounts aren&apos;t set up here</h1>
        <p className="auth__sub">This copy of Pyrius has no Supabase keys, so it runs in browser-only demo mode.</p>
        <Link href="/app" className="mk-btn mk-btn--primary">
          Open the demo app
          <ArrowRight />
        </Link>
      </div>
    );
  }

  const sb = getSupabase()!;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${origin}${next}` } });
    if (error) {
      setBusy(false);
      setMsg({ tone: "error", text: error.message });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) setMsg({ tone: "error", text: error.message });
      else router.replace(next);
      return;
    }
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}${next}` } });
    setBusy(false);
    if (error) setMsg({ tone: "error", text: error.message });
    else if (data.session) router.replace(next);
    else setMsg({ tone: "ok", text: `We sent a confirmation link to ${email}. Open it on this device to finish creating your account.` });
  };

  const magic = async () => {
    if (!email) return setMsg({ tone: "error", text: "Enter your email first." });
    setBusy(true);
    setMsg(null);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}${next}` } });
    setBusy(false);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: `We sent a sign-in link to ${email}.` });
  };

  const anyProvider = providers && (providers.google || providers.apple);

  return (
    <div className="auth__card">
      <h1 className="auth__title">{mode === "signup" ? "Create your Pyrius account" : "Welcome back"}</h1>
      <p className="auth__sub">{mode === "signup" ? "Free to start. Describe a trip and Pyrius takes it from there." : "Sign in to continue planning."}</p>

      {trip && (
        <div className="auth__trip">
          <span>Your trip is waiting</span>
          <q>{trip}</q>
        </div>
      )}

      {anyProvider && (
        <div className="auth__providers">
          {providers.google && (
            <button type="button" className="auth__provider" onClick={() => oauth("google")} disabled={busy}>
              <GoogleG />
              Continue with Google
            </button>
          )}
          {providers.apple && (
            <button type="button" className="auth__provider auth__provider--apple" onClick={() => oauth("apple")} disabled={busy}>
              <AppleMark />
              Continue with Apple
            </button>
          )}
        </div>
      )}

      {anyProvider && <div className="auth__divider">or with email</div>}

      <form className="auth__form" onSubmit={submit}>
        <label className="auth__field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="auth__field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" && <small>At least 8 characters.</small>}
        </label>
        {msg && (
          <p className={msg.tone === "error" ? "auth__msg auth__msg--error" : "auth__msg"} role={msg.tone === "error" ? "alert" : "status"}>
            {msg.text}
          </p>
        )}
        <button className="mk-btn mk-btn--primary mk-btn--block" disabled={busy}>
          {mode === "signup" ? "Create account" : "Sign in"}
          <ArrowRight />
        </button>
        <button type="button" className="auth__link-btn" onClick={magic} disabled={busy}>
          <Mail />
          Email me a sign-in link instead
        </button>
      </form>

      <p className="auth__switch">
        {mode === "signup" ? "Already have an account?" : "New to Pyrius?"}{" "}
        <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </p>
      <p className="auth__legal">
        By continuing you agree to the <Link href="/legal/terms">Terms of Service</Link> and acknowledge the{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth">
      <aside className="auth__visual" aria-hidden="true">
        <div className="auth__orb">
          <LiveOrb mood="idle" />
        </div>
        <p className="auth__quote">
          Your next trip starts with a <em>conversation.</em>
        </p>
      </aside>
      <main className="auth__main">
        <Link href="/" className="auth__brand" aria-label="Pyrius home">
          <LogoMark className="auth__mark" />
          Pyrius
        </Link>
        <Suspense>
          <AuthForm />
        </Suspense>
      </main>
    </div>
  );
}
