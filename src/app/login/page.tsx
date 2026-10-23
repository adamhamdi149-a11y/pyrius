"use client";
import { Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { useStore } from "@/lib/store/AppStore";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const { auth } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    if (auth.mode === "cloud") router.replace("/settings");
  }, [auth.mode, router]);

  if (!supabaseConfigured) {
    return (
      <div className="main__scroll">
        <div className="page">
          <div className="center-card card checkout">
            <LogoMark className="brand__mark" />
            <h1 className="t-h2">Accounts aren&apos;t set up yet</h1>
            <p className="t-body" style={{ fontSize: "var(--fs-sm)" }}>
              Pyrius is running in local demo mode: everything is stored in this browser only. Add Supabase keys to enable sign-in and sync between devices.
            </p>
            <Link href="/" className="btn btn--primary">
              Continue without an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (auth.mode === "cloud") return null;

  const sb = getSupabase()!;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = mode === "signin" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMsg({ tone: "error", text: error.message });
    else if (mode === "signup") setMsg({ tone: "ok", text: "Check your inbox to confirm your email, then sign in." });
    else router.push("/dashboard");
  };

  const magic = async () => {
    if (!email) return setMsg({ tone: "error", text: "Enter your email first." });
    setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/dashboard` } });
    setBusy(false);
    setMsg(error ? { tone: "error", text: error.message } : { tone: "ok", text: "We sent you a sign-in link." });
  };

  return (
    <div className="main__scroll">
      <div className="page">
        <form className="center-card card checkout" onSubmit={submit}>
          <LogoMark className="brand__mark" />
          <div>
            <h1 className="t-h2">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="t-meta">Sync saved offers, trackers and trips across devices.</p>
          </div>
          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Password</span>
            <input className="input" type="password" required minLength={8} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {msg && <div className={msg.tone === "error" ? "notice notice--warn" : "notice"}>{msg.text}</div>}
          <button className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <button type="button" className="btn btn--secondary btn--block" onClick={magic} disabled={busy}>
            <Mail />
            Email me a sign-in link
          </button>
          <button type="button" className="link-btn" style={{ justifySelf: "center" }} onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
