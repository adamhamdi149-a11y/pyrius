import { MkFooter, MkHeader } from "@/components/marketing/MkChrome";
import { serif } from "@/lib/fonts";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mk ${serif.variable}`}>
      <MkHeader />
      <main id="main">{children}</main>
      <MkFooter />
    </div>
  );
}
