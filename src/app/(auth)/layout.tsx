import type { Metadata } from "next";
import { serif } from "@/lib/fonts";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`mk ${serif.variable}`}>{children}</div>;
}
