"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { useStore } from "@/lib/store/AppStore";
import { carryDraft, useTryHref } from "./useTryHref";

/** On the home page, section links glide with the smooth scroller instead of jumping. */
function sectionLink(pathname: string, id: string) {
  return {
    href: `/#${id}`,
    onClick: (e: React.MouseEvent) => {
      if (pathname !== "/") return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("mk:goto", { detail: id }));
    },
  };
}

export function MkHeader() {
  const pathname = usePathname();
  const tryHref = useTryHref();
  const { auth, ready } = useStore();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const signedIn = ready && auth.mode === "cloud";

  return (
    <header className="mk-header" data-scrolled={scrolled}>
      <div className="mk-header__inner">
        <Link href="/" className="mk-brand" aria-label="Pyrius home">
          <LogoMark className="mk-brand__mark" />
          <span>Pyrius</span>
        </Link>
        <nav className="mk-nav" aria-label="Main">
          <a {...sectionLink(pathname, "how")}>How it works</a>
          <a {...sectionLink(pathname, "product")}>Product</a>
          {!signedIn && <Link href="/login">Sign in</Link>}
        </nav>
        <Link href={tryHref} className="mk-btn mk-btn--primary mk-btn--sm" onClick={carryDraft}>
          {signedIn ? "Open Pyrius" : "Try Pyrius"}
          <ArrowRight />
        </Link>
      </div>
    </header>
  );
}

export function MkFooter() {
  const pathname = usePathname();
  return (
    <footer className="mk-footer">
      <div className="mk-footer__inner">
        <div className="mk-footer__brand">
          <Link href="/" className="mk-brand" aria-label="Pyrius home">
            <LogoMark className="mk-brand__mark" />
            <span>Pyrius</span>
          </Link>
          <p>The AI travel concierge. Describe a trip; Pyrius helps you find it.</p>
        </div>
        <nav className="mk-footer__links" aria-label="Footer">
          <div>
            <span>Product</span>
            <a {...sectionLink(pathname, "how")}>How it works</a>
            <a {...sectionLink(pathname, "product")}>Product</a>
            <Link href="/login">Sign in</Link>
          </div>
          <div>
            <span>Legal</span>
            <Link href="/legal/terms">Terms of Service</Link>
            <Link href="/legal/privacy">Privacy Policy</Link>
            <a href="mailto:privacy@pyrius.app">privacy@pyrius.app</a>
          </div>
        </nav>
      </div>
      <div className="mk-footer__base">
        <span>© {new Date().getFullYear()} Pyrius</span>
        <span>Flight, hotel and car prices shown on this site are illustrative, not live fares. Pyrius doesn&apos;t sell travel; you book with the provider.</span>
      </div>
    </footer>
  );
}
