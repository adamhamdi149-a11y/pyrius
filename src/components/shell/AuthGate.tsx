"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { LiveOrb } from "@/components/ai/LiveOrb";
import { useStore } from "@/lib/store/AppStore";

/**
 * The product requires an account. When Supabase is configured and nobody is signed in,
 * send the visitor to sign-in and bring them back afterwards. Without Supabase (local
 * development) the app keeps working in browser-only demo mode.
 */
function Gate({ children }: { children: ReactNode }) {
  const { ready, auth } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const blocked = auth.mode === "signed-out";
  const wasSignedIn = useRef(false);
  if (auth.mode === "cloud") wasSignedIn.current = true;

  useEffect(() => {
    if (!ready || !blocked) return;
    // Signing out returns to the website; arriving signed out goes to sign-in.
    if (wasSignedIn.current) {
      router.replace("/");
      return;
    }
    const here = pathname + (params.size ? `?${params}` : "");
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [ready, blocked, pathname, params, router]);

  if (!ready || blocked) {
    return (
      <div className="gate" role="status" aria-live="polite">
        <div className="gate__orb">
          <LiveOrb mood="thinking" interactive={false} />
        </div>
        <span className="sr-only">{blocked ? "Redirecting to sign in" : "Loading Pyrius"}</span>
      </div>
    );
  }
  return <>{children}</>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
