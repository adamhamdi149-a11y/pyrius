import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { AuthGate } from "@/components/shell/AuthGate";

// Behind sign-in: nothing here belongs in search results.
export const metadata: Metadata = { title: "Pyrius", robots: { index: false, follow: false } };

/** Everything under the product (assistant, dashboard, saved, tracking, trips, settings). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
