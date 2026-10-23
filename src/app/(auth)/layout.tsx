import { serif } from "@/lib/fonts";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`mk ${serif.variable}`}>{children}</div>;
}
