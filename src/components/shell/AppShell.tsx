"use client";
import {
  Bookmark,
  ChevronsUpDown,
  LayoutDashboard,
  LineChart,
  Map,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { PointerFX } from "@/components/fx/PointerFX";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { initials } from "@/components/ui/primitives";
import { planById } from "@/lib/plans";
import { useStore } from "@/lib/store/AppStore";
import type { MessageKey } from "@/lib/i18n";

const NAV: { href: string; key: MessageKey; icon: typeof MessageCircle; count?: "saved" | "trackers" }[] = [
  { href: "/app", key: "nav.assistant", icon: Sparkles },
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/saved", key: "nav.saved", icon: Bookmark, count: "saved" },
  { href: "/tracking", key: "nav.tracking", icon: LineChart, count: "trackers" },
  { href: "/trips", key: "nav.trips", icon: Map },
];

export function AppShell({ children }: { children: ReactNode }) {
  const store = useStore();
  const { t, settings, subscription, conversations, activeId, auth } = store;
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("pyrius:sidebar") === "collapsed");
    } catch {}
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => setDrawer(false), [pathname, activeId]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("pyrius:sidebar", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };

  const newTrip = useCallback(() => {
    store.setActiveId(null);
    if (pathname !== "/app") router.push("/app");
    window.dispatchEvent(new Event("pyrius:new-trip"));
  }, [pathname, router, store]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        newTrip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newTrip]);

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));
  const name = settings.name || (auth.mode === "cloud" ? auth.email?.split("@")[0] : "") || "Guest traveler";
  const plan = planById(subscription.plan);
  // Every stored conversation, newest first; the list scrolls inside the sidebar.
  const recent = conversations;
  const active = conversations.find((c) => c.id === activeId);
  const recentRef = useRef<HTMLDivElement>(null);
  const [recentEdges, setRecentEdges] = useState({ top: false, bottom: false });

  // Fade the list's edges only where there's more to scroll to.
  useEffect(() => {
    const el = recentRef.current;
    if (!el) return;
    const measure = () => {
      const top = el.scrollTop > 2;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setRecentEdges((e) => (e.top === top && e.bottom === bottom ? e : { top, bottom }));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [recent.length]);

  const pageTitle =
    pathname === "/app" ? (active?.title ?? "Pyrius") : t((NAV.find((n) => n.href !== "/app" && pathname.startsWith(n.href))?.key ?? "nav.settings") as MessageKey);

  return (
    <div className="app" data-collapsed={collapsed} data-drawer={drawer}>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar__top">
          <Link href="/app" className="brand" onClick={() => store.setActiveId(null)} aria-label="Pyrius home">
            <LogoMark />
            <div className="brand__text">
              <div className="brand__name">Pyrius</div>
              <div className="brand__tag">{t("brand.tagline")}</div>
            </div>
          </Link>
          <button className="icon-btn sidebar__collapse" onClick={toggleCollapsed} aria-label={collapsed ? t("nav.expand") : t("nav.collapse")} title={collapsed ? t("nav.expand") : t("nav.collapse")}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </button>
          <button className="icon-btn topbar-only" onClick={() => setDrawer(false)} aria-label={t("nav.close")} style={{ display: drawer ? undefined : "none" }}>
            <X />
          </button>
        </div>

        <button className="sidebar__new" onClick={newTrip} title={t("nav.new")}>
          <Plus />
          <span>{t("nav.new")}</span>
          <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>

        <nav className="nav">
          {NAV.map(({ href, key, icon: Icon, count }) => {
            const n = count === "saved" ? store.saved.length : count === "trackers" ? store.trackers.length : 0;
            return (
              <Link key={href} href={href} className="nav__item" aria-current={isActive(href) ? "page" : undefined} title={collapsed ? t(key) : undefined}>
                <Icon />
                <span className="nav__label">{t(key)}</span>
                {n > 0 && <span className="nav__count">{n}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar__section">
          <div className="sidebar__label">{t("nav.recent")}</div>
          <div className="recent" ref={recentRef} data-more-above={recentEdges.top} data-more-below={recentEdges.bottom}>
            {recent.length === 0 && <p className="recent__empty">{t("nav.noRecent")}</p>}
            {recent.map((c) => (
              <div key={c.id} className="recent__item" data-active={pathname === "/app" && c.id === activeId}>
                <button
                  className="recent__link"
                  onClick={() => {
                    store.setActiveId(c.id);
                    if (pathname !== "/app") router.push("/app");
                  }}
                  title={c.title}
                >
                  {c.title}
                </button>
                <button className="icon-btn recent__del" aria-label={`Delete “${c.title}”`} onClick={() => setPendingDelete(c.id)}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar__bottom">
          {subscription.plan === "free" && (
            <Link href="/settings?section=subscription" className="upsell">
              <div className="upsell__row">
                <Sparkles />
                {t("plan.upgrade")}
              </div>
              <div className="upsell__sub">{t("plan.upgradeSub")}</div>
            </Link>
          )}
          <Link href="/settings" className="profile" title={t("nav.settings")} aria-current={pathname.startsWith("/settings") ? "page" : undefined}>
            <span className="avatar">{initials(settings.name, auth.mode === "cloud" ? auth.email : undefined)}</span>
            <span className="profile__text">
              <span className="profile__name">{name}</span>
              <span className="profile__plan">
                <b>{plan.name}</b> {t("plan.current")}
                {subscription.source === "demo" && <span className="badge badge--demo" style={{ height: 16, padding: "0 5px", fontSize: 10 }}>demo</span>}
              </span>
            </span>
            <ChevronsUpDown />
          </Link>
        </div>
      </aside>

      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />

      <div className="main">
        <PointerFX />
        <header className="topbar">
          <button className="icon-btn" onClick={() => setDrawer(true)} aria-label={t("nav.menu")} aria-expanded={drawer}>
            <Menu />
          </button>
          <div className="topbar__title">{pageTitle}</div>
          {pathname === "/app" ? (
            <button className="icon-btn" onClick={newTrip} aria-label={t("nav.new")}>
              <Plus />
            </button>
          ) : (
            <Link href="/settings" aria-label={t("nav.profile")} className="icon-btn">
              <span className="avatar">{initials(settings.name)}</span>
            </Link>
          )}
        </header>

        <div className="main__body">
          {children}
        </div>

        {pathname !== "/app" && (
          <nav className="bottomnav" aria-label="Primary mobile">
            {[
              { href: "/app", key: "nav.chat" as const, icon: MessageCircle },
              { href: "/dashboard", key: "nav.dashboard" as const, icon: LayoutDashboard },
              { href: "/saved", key: "nav.saved" as const, icon: Bookmark },
              { href: "/settings", key: "nav.profile" as const, icon: User },
            ].map(({ href, key, icon: Icon }) => (
              <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined}>
                <Icon />
                {key === "nav.saved" ? t("common.saved") : t(key)}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && store.deleteConversation(pendingDelete)}
        title="Delete this conversation?"
        description="The conversation is removed from your history. Saved offers and tracked prices stay where they are."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
