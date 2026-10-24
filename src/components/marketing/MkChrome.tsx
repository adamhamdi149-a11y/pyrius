"use client";
import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { useStore } from "@/lib/store/AppStore";
import { carryDraft, useTryHref } from "./useTryHref";

/** On the home page, section links glide with the smooth scroller instead of jumping. */
function sectionLink(pathname: string, id: string, after?: () => void) {
  return {
    href: `/#${id}`,
    onClick: (e: React.MouseEvent) => {
      after?.();
      if (pathname !== "/") return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("mk:goto", { detail: id }));
    },
  };
}

const SECTIONS = [
  ["how", "How it works"],
  ["product", "Product"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
] as const;

export function MkHeader() {
  const pathname = usePathname();
  const tryHref = useTryHref();
  const { auth, ready } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [menu]);

  const signedIn = ready && auth.mode === "cloud";
  const close = () => setMenu(false);

  return (
    <header className="mk-header" data-scrolled={scrolled} data-menu={menu}>
      <div className="mk-header__bar">
        <Link href="/" className="mk-brand" aria-label="Pyrius home" onClick={close}>
          <LogoMark className="mk-brand__mark" />
          <span>Pyrius</span>
        </Link>
        <nav className="mk-nav" aria-label="Main">
          {SECTIONS.map(([id, label]) => (
            <a key={id} {...sectionLink(pathname, id)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="mk-header__end">
          {!signedIn && (
            <Link href="/login" className="mk-header__signin">
              Sign in
            </Link>
          )}
          <Link href={tryHref} className="mk-btn mk-btn--primary mk-btn--sm" onClick={carryDraft}>
            {signedIn ? "Open Pyrius" : "Try Pyrius"}
            <ArrowRight />
          </Link>
          <button type="button" className="mk-header__menu" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} aria-controls="mk-menu" onClick={() => setMenu((m) => !m)}>
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <nav className="mk-header__drop" id="mk-menu" aria-label="Menu" hidden={!menu}>
        {SECTIONS.map(([id, label]) => (
          <a key={id} {...sectionLink(pathname, id, close)}>
            {label}
          </a>
        ))}
        {!signedIn && (
          <Link href="/login" onClick={close}>
            Sign in
          </Link>
        )}
      </nav>
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
            {SECTIONS.map(([id, label]) => (
              <a key={id} {...sectionLink(pathname, id)}>
                {label}
              </a>
            ))}
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
