"use client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { ArrowRight, ArrowUp, Bell, BookmarkCheck, Hotel } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LiveOrb } from "@/components/ai/LiveOrb";
import { OrbThemePicker } from "@/components/settings/OrbThemePicker";
import { Price } from "@/components/ui/Price";
import type { OrbMood } from "@/lib/motion";
import { savePendingPrompt } from "@/lib/pendingPrompt";
import { demoCars, demoFlights, demoHotels } from "@/lib/providers/demo";
import { sampleHistory, suggestedTarget } from "@/lib/tracking/simulator";
import { FiltersProvider, FragmentView } from "./filters";
import { ConversationView, MkCarCard, MkChart, MkFlightCard, MkHotelCard, TypedSentence } from "./parts";
import { Compare, Faq, FinalCta, Pricing } from "./sections";
import { FRAGMENTS, rangeLabel, SCRIPTS, scriptById } from "./scripts";
import { carryDraft, DRAFT_KEY, useTryHref } from "./useTryHref";

/** The orb canvas box in CSS px; the sphere is 56% of it (shader constant). */
const ORB_BOX = 600;
const SPHERE = ORB_BOX * 0.56;
/** Conversation beats in the #product scene: user, ai, user, ai, cards. */
const BEATS = [0.06, 0.2, 0.36, 0.5, 0.64];

declare global {
  interface Window {
    __ready?: boolean;
  }
}

export function Landing() {
  const router = useRouter();
  const tryHref = useTryHref();
  const root = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const orbEl = useRef<HTMLDivElement>(null);
  const fragWrap = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const [scriptId, setScriptId] = useState<(typeof SCRIPTS)[number]["id"]>("japan");
  const [draft, setDraft] = useState("");
  const [today, setToday] = useState<Date | null>(null);
  const [staticMode, setStaticMode] = useState(false);
  const [typed, setTyped] = useState(0);
  const [typing, setTyping] = useState(false);
  const [shown, setShown] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [mood, setMood] = useState<OrbMood>("idle");
  const [orbScale, setOrbScale] = useState(1);
  const targetBeat = useRef(0);
  const shownRef = useRef(0);
  const jumping = useRef(false);

  const script = scriptById(scriptId);

  useEffect(() => {
    setToday(new Date());
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    jumping.current = new URLSearchParams(window.location.search).has("jump");
    setStaticMode(reduced);
    if (reduced) {
      window.__ready = true;
    }
  }, []);

  // Trip data comes from the app's own demo provider, so the site shows what the app shows.
  const data = useMemo(() => {
    if (!today) return null;
    const q = script.search(today);
    const flights = demoFlights({ originCode: q.origin, destinationCode: q.dest, departDate: q.depart, returnDate: q.ret, adults: q.adults, children: 0, currency: "CAD" });
    const total = (f: (typeof flights)[number]) => f.outbound.durationMin + (f.inbound?.durationMin ?? 0);
    const cheapest = flights[0];
    const fastest = [...flights].sort((a, b) => total(a) - total(b)).find((f) => f.id !== cheapest.id) ?? flights[1];
    const hotel = demoHotels({ destinationCode: q.dest, checkIn: q.depart, checkOut: q.ret, guests: q.adults, rooms: 1, currency: "CAD" })[1];
    const car = demoCars({ destinationCode: q.dest, pickUp: q.depart, dropOff: q.ret, currency: "CAD" })[0];
    const history = sampleHistory(cheapest.id, cheapest.totalPrice, new Date(`${q.depart}T12:00:00`).toISOString(), 22);
    return { q, flights, cheapest, fastest, hotel, car, history, target: suggestedTarget(cheapest.totalPrice), range: rangeLabel(q.depart, q.ret) };
  }, [today, script]);

  const turns = useMemo(() => (data ? script.convo({ range: data.range }) : []), [data, script]);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  // Type the sentence at reading speed once its scene starts; it then stays.
  useEffect(() => {
    if (!typing) return;
    if (jumping.current || staticMode) {
      setTyped(script.sentence.length);
      return;
    }
    setTyped(0);
    const id = setInterval(() => {
      setTyped((n) => {
        if (n >= script.sentence.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 34);
    return () => clearInterval(id);
  }, [typing, script.sentence, staticMode]);

  // Advance the conversation one beat at a time, never faster than it can be read.
  const pump = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = (n: number) => {
    shownRef.current = n;
    setShown(n);
  };
  const advance = () => {
    if (pump.current) return;
    const step = () => {
      const s = shownRef.current;
      if (s >= targetBeat.current) {
        pump.current = null;
        setThinking(false);
        return;
      }
      if (jumping.current) {
        reveal(s + 1);
        pump.current = setTimeout(step, 0);
        return;
      }
      if (turnsRef.current[s]?.role === "ai") {
        setThinking(true);
        pump.current = setTimeout(() => {
          setThinking(false);
          reveal(s + 1);
          pump.current = setTimeout(step, 420);
        }, 760);
        return;
      }
      reveal(s + 1);
      pump.current = setTimeout(step, 360);
    };
    step();
  };
  useEffect(() => () => {
    if (pump.current) clearTimeout(pump.current);
  }, []);

  useEffect(() => {
    if (staticMode) {
      reveal(BEATS.length);
      setTyped(script.sentence.length);
    }
  }, [staticMode, script.sentence.length]);

  // ---------- Smooth scroll + scroll-driven film ----------
  useLayoutEffect(() => {
    if (staticMode || !data) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const jump = new URLSearchParams(window.location.search).get("jump");
    if (jump !== null) history.scrollRestoration = "manual";

    let lenis: Lenis | null = null;
    if (jump === null) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      lenisRef.current = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }
    function tick(t: number) {
      lenis?.raf(t * 1000);
    }

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add({ desktop: "(min-width: 900px)", mobile: "(max-width: 899px)" }, (c) => {
        const desktop = Boolean(c.conditions?.desktop);
        const W = () => window.innerWidth;
        const H = () => window.innerHeight;
        const s = (d: number) => d / SPHERE;

        // Orb positions (offsets from viewport centre) for each moment of the story.
        const HERO = () => (desktop ? { x: W() * 0.21, y: H() * 0.04, k: s(Math.min(W() * 0.34, H() * 0.6, 520)) } : { x: 0, y: -H() * 0.23, k: s(Math.min(W() * 0.5, 230)) });
        const MID = () => (desktop ? { x: 0, y: -H() * 0.06, k: s(Math.min(W() * 0.2, H() * 0.36, 340)) } : { x: 0, y: H() * 0.08, k: s(W() * 0.38) });
        const CALM = () => (desktop ? { x: 0, y: -H() * 0.12, k: s(Math.min(W() * 0.22, H() * 0.38, 360)) } : { x: 0, y: -H() * 0.12, k: s(W() * 0.46) });
        const COLOR = () => (desktop ? { x: 0, y: H() * 0.17, k: s(Math.min(W() * 0.24, H() * 0.38, 360)) } : { x: 0, y: H() * 0.2, k: s(Math.min(W() * 0.52, H() * 0.3)) });
        const OUT = () => ({ x: 0, y: -H() * 0.62, k: CALM().k * 0.6 });
        const END = () => (desktop ? { x: 0, y: -H() * 0.31, k: s(Math.min(W() * 0.14, H() * 0.2, 220)) } : { x: 0, y: -H() * 0.33, k: s(Math.min(W() * 0.26, H() * 0.14)) });
        const DOCK = () => {
          const dock = document.querySelector<HTMLElement>(".mkf-dock");
          const sec = document.getElementById("product");
          if (!dock || !sec) return { x: 0, y: 0, k: 0.1 };
          const app = document.querySelector<HTMLElement>(".mkf-app");
          const prev = app?.style.transform ?? "";
          if (app) app.style.transform = "none";
          const r = dock.getBoundingClientRect();
          const sr = sec.getBoundingClientRect();
          if (app) app.style.transform = prev;
          return { x: r.left + r.width / 2 - W() / 2, y: r.top - sr.top + r.height / 2 - H() / 2, k: s(r.height * 1.05) };
        };
        const frags = gsap.utils.toArray<HTMLElement>(".mkf-frag");
        const basePos = (el: HTMLElement) => {
          const f = FRAGMENTS.find((x) => x.key === el.dataset.k)!;
          return desktop ? { x: (f.x / 100) * W(), y: (f.y / 100) * H() } : { x: (f.mx / 100) * W(), y: (f.my / 100) * H() };
        };
        // Each scene gets its own arrangement: every piece keeps roughly its place around the orb
        // but is moved (closer, further, or a little round) until it clears the copy, the header,
        // the screen edges and the other pieces. A piece with no room sits that scene out.
        type Box = { l: number; r: number; t: number; b: number };
        const hit = (p: Box, q: Box) => p.l < q.r && p.r > q.l && p.t < q.b && p.b > q.t;
        const pad = (r: DOMRect, dy: number, m = 16): Box => ({ l: r.left - m, r: r.right + m, t: r.top + dy - m, b: r.bottom + dy + m });
        const headerZone: Box = { l: 0, r: W(), t: 0, b: desktop ? 86 : 74 };
        const layout = (center: { x: number; y: number }, ks: number[], zones: Box[]) => {
          const out = new Map<HTMLElement, { x: number; y: number }>();
          const taken: Box[] = [];
          const items = frags
            .filter((el) => getComputedStyle(el).display !== "none")
            .map((el) => ({ el, ff: el.querySelector<HTMLElement>(".ff")! }))
            .map((i) => ({ ...i, w: i.ff.offsetWidth, h: i.ff.offsetHeight }))
            .sort((p, q) => q.w * q.h - p.w * p.h);
          for (const { el, w, h } of items) {
            const base = basePos(el);
            search: for (const k of ks) {
              for (const deg of [0, 10, -10, 20, -20, 32, -32]) {
                const t = (deg * Math.PI) / 180;
                const x = (base.x * Math.cos(t) - base.y * Math.sin(t)) * k;
                const y = (base.x * Math.sin(t) + base.y * Math.cos(t)) * k;
                const cx = W() / 2 + center.x + x;
                const cy = H() / 2 + center.y + y;
                const r = { l: cx - w / 2 - 6, r: cx + w / 2 + 6, t: cy - h / 2 - 6, b: cy + h / 2 + 6 };
                if (r.l < 8 || r.r > W() - 8 || r.t < 0 || r.b > H() - 4) continue;
                if (zones.some((z) => hit(r, z)) || taken.some((z) => hit(r, z))) continue;
                out.set(el, { x, y });
                taken.push(r);
                break search;
              }
            }
          }
          return out;
        };
        const heroZones = [headerZone, ...[...document.querySelectorAll(".mkf-hero__copy > *")].map((n) => pad(n.getBoundingClientRect(), window.scrollY))];
        const howTop = document.getElementById("how")!.getBoundingClientRect().top;
        const howZones = [headerZone, ...[...document.querySelectorAll(".mkf-how__copy, .mkf-composer")].map((n) => pad(n.getBoundingClientRect(), -howTop))];
        const heroAt = layout(HERO(), desktop ? [0.72, 0.66, 0.8, 0.6, 0.88, 0.54, 0.96] : [0.9, 0.84, 0.96, 0.78, 1.02, 0.72], heroZones);
        const howAt = layout(MID(), [1, 1.06, 0.94, 1.12, 0.88, 1.2, 0.82, 1.3, 0.74], howZones);
        const fragPos = (el: HTMLElement) => howAt.get(el) ?? basePos(el);
        frags.forEach((el) => {
          const p = fragPos(el);
          const h = heroAt.get(el) ?? p;
          el.style.setProperty("--fx", `${p.x}px`);
          el.style.setProperty("--fy", `${p.y}px`);
          el.style.setProperty("--hx", `${h.x}px`);
          el.style.setProperty("--hy", `${h.y}px`);
        });

        // ===== PINNED SCENES FIRST (creation order = refresh order) =====

        // #how — the form dissolves into a sentence
        const phraseCount = script.phrases.length;
        const windowOf = (i: number) => 0.2 + i * 0.1;
        const howTl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            id: "how",
            trigger: "#how",
            start: "top top",
            end: () => `+=${H() * 2.3}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              if (p > 0.03) setTyping(true);
              root.current?.querySelectorAll<HTMLElement>("[data-phrase]").forEach((el) => {
                el.dataset.on = String(p > windowOf(Number(el.dataset.phrase)));
              });
              const active = p > 0.16 && p < 0.86;
              setMood((m) => (m === "listening" ? m : active ? "thinking" : "idle"));
            },
          },
        });
        howTl.fromTo(".mkf-how__a", { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0);
        howTl.fromTo(".mkf-how__composer", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.02);
        const used = new Set<string>();
        script.phrases.forEach((ph, i) => {
          const el = frags.find((f) => f.dataset.k === ph.frag);
          if (!el) return;
          used.add(ph.frag);
          howTl.to(el, { x: () => -fragPos(el).x, y: () => -fragPos(el).y, scale: 0.15, autoAlpha: 0, filter: "blur(6px)", duration: 0.11 }, windowOf(i));
        });
        frags
          .filter((el) => !used.has(el.dataset.k!))
          .forEach((el, i) => {
            howTl.to(el, { x: () => -fragPos(el).x, y: () => -fragPos(el).y, scale: 0.15, autoAlpha: 0, filter: "blur(6px)", duration: 0.14 }, 0.2 + phraseCount * 0.1 + 0.03 + i * 0.012);
          });
        howTl.to(".mkf-how__a", { autoAlpha: 0, y: -24, duration: 0.06 }, 0.7);
        howTl.fromTo(".mkf-how__b", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.08 }, 0.74);
        howTl.to(".mkf-how__composer", { y: -16, autoAlpha: 0, duration: 0.08 }, 0.92);

        // #product — the orb docks, the conversation and real cards arrive
        const prodTl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: "#product",
            start: "top top",
            end: () => `+=${H() * 2.6}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress;
              const beat = BEATS.filter((b) => p >= b).length;
              if (beat > targetBeat.current) {
                targetBeat.current = beat;
                advance();
              }
            },
          },
        });
        prodTl.to({}, { duration: 1 }, 0);
        const prodST = prodTl.scrollTrigger!;
        // A pinned section shifts its own element-based positions, so later steps use scroll numbers.
        const P = () => prodST.start;

        // #journey — horizontal run on desktop, the satellite links the screens
        if (desktop) {
          const track = document.querySelector<HTMLElement>(".mkf-track")!;
          const path = document.querySelector<SVGPathElement>(".mkf-route path")!;
          const sat = document.querySelector<HTMLElement>(".mkf-sat")!;
          const svg = document.querySelector<SVGSVGElement>(".mkf-route")!;
          const len = path.getTotalLength();
          const chart = document.querySelector<SVGPathElement>(".mkf-journey .mk-chart__line");
          const placeSat = (p: number) => {
            const pt = path.getPointAtLength(len * p);
            sat.style.transform = `translate3d(${pt.x * (svg.clientWidth / 3000)}px, ${pt.y * (svg.clientHeight / 600)}px, 0)`;
          };
          gsap.to(track, {
            x: () => -(track.scrollWidth - W()),
            ease: "none",
            scrollTrigger: {
              trigger: "#journey",
              start: "top top",
              end: () => `+=${track.scrollWidth - W()}`,
              pin: true,
              scrub: 0.8,
              invalidateOnRefresh: true,
              onRefresh: (self) => placeSat(self.progress),
              onUpdate: (self) => {
                const p = self.progress;
                placeSat(p);
                if (chart) chart.style.strokeDashoffset = String(1 - gsap.utils.clamp(0, 1, (p - 0.38) / 0.24));
              },
            },
          });
        }

        // #color — the orb holds still while the visitor picks its color
        const colorST = ScrollTrigger.create({ trigger: "#color", start: "top top", end: () => `+=${H() * 0.9}`, pin: true, invalidateOnRefresh: true });
        const C = () => colorST.start;

        // ===== AMBIENT: the orb's journey (created after the pins) =====
        type Station = () => { x: number; y: number; k: number };
        type Span = Pick<ScrollTrigger.Vars, "trigger" | "start" | "end">;
        const set = (o: { x: number; y: number; k: number }) => ({ x: o.x, y: o.y });
        // The form pieces live in their own layer above the orb, so they can be used; it moves with it.
        const movers = [wrap.current, fragWrap.current];
        gsap.set(movers, set(HERO()));
        gsap.set(orbEl.current, { scale: HERO().k });
        const leg = (span: Span, from: Station, to: Station) => {
          const st = { ...span, scrub: 0.8, invalidateOnRefresh: true };
          gsap.fromTo(movers, { x: () => from().x, y: () => from().y }, { x: () => to().x, y: () => to().y, ease: "none", immediateRender: false, scrollTrigger: st });
          gsap.fromTo(orbEl.current, { scale: () => from().k }, { scale: () => to().k, ease: "none", immediateRender: false, scrollTrigger: { ...st }, onUpdate: function () {
            const k = Number(gsap.getProperty(orbEl.current, "scale"));
            setOrbScale((prev) => (Math.abs(prev - k) > 0.12 ? Math.round(k * 8) / 8 : prev));
          } });
        };
        // The pieces move from their hero places to their scene places as the orb moves to centre,
        // and the ones that only fit one of the two fade in or out on the way.
        const fragBox = root.current!.querySelector<HTMLElement>(".mkf-frags")!;
        gsap.set(fragBox, { "--t": 0 });
        gsap.fromTo(fragBox, { "--t": 0 }, { "--t": 1, ease: "none", immediateRender: false, scrollTrigger: { trigger: "#how", start: "top bottom", end: "top top", scrub: 0.8 } });
        const into = { trigger: "#how", start: "top 70%", end: "top 15%", scrub: 0.6 };
        frags.forEach((el) => {
          const ff = el.querySelector<HTMLElement>(".ff");
          if (!ff) return;
          const inHero = heroAt.has(el);
          const inHow = howAt.has(el);
          if (!inHero && !inHow) gsap.set(ff, { autoAlpha: 0 });
          else if (!inHero) gsap.fromTo(ff, { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", scrollTrigger: { ...into } });
          else if (!inHow) gsap.fromTo(ff, { autoAlpha: 1 }, { autoAlpha: 0, ease: "none", immediateRender: false, scrollTrigger: { ...into } });
        });
        leg({ trigger: "#how", start: "top bottom", end: "top top" }, HERO, MID);

        // The app rises while the orb travels into its composer, then hands over to the small orb.
        gsap.fromTo(".mkf-product__copy > *", { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, stagger: 0.1, ease: "power2.out", scrollTrigger: { start: () => P() - H() * 0.8, end: () => P() - H() * 0.1, scrub: 0.6, invalidateOnRefresh: true } });
        gsap.fromTo(".mkf-app", { autoAlpha: 0, y: 80, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, ease: "power2.out", scrollTrigger: { start: () => P() - H() * 0.85, end: () => P() - H() * 0.05, scrub: 0.6, invalidateOnRefresh: true } });
        leg({ start: () => P() - H(), end: () => P() }, MID, DOCK);
        const handoff = { start: () => P() - H() * 0.04, end: () => P() + H() * 0.08, scrub: true, invalidateOnRefresh: true };
        gsap.fromTo(".mkf-orbwrap__orb", { autoAlpha: 1 }, { autoAlpha: 0, ease: "none", immediateRender: false, scrollTrigger: handoff });
        gsap.fromTo(".mkf-dock-orb", { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", scrollTrigger: { ...handoff } });

        // It returns for the color scene, then settles over the calm line.
        gsap.fromTo(".mkf-orbwrap__orb", { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", immediateRender: false, scrollTrigger: { start: () => C() - H() * 0.9, end: () => C() - H() * 0.25, scrub: true, invalidateOnRefresh: true } });
        leg({ start: () => C() - H(), end: () => C() }, () => ({ ...COLOR(), y: H() * 0.55 }), COLOR);
        leg({ trigger: "#calm", start: "top bottom", end: "top top" }, COLOR, CALM);

        // Out of the way for pricing, the comparison and the FAQ; back for the final call.
        leg({ trigger: "#pricing", start: "top bottom", end: "top 20%" }, CALM, OUT);
        gsap.fromTo(".mkf-orbwrap__orb", { autoAlpha: 1 }, { autoAlpha: 0, ease: "none", immediateRender: false, scrollTrigger: { trigger: "#pricing", start: "top 75%", end: "top 25%", scrub: true } });
        gsap.fromTo(".mkf-orbwrap__orb", { autoAlpha: 0 }, { autoAlpha: 1, ease: "none", immediateRender: false, scrollTrigger: { trigger: "#start", start: "top bottom", end: "top 30%", scrub: true } });
        leg({ trigger: "#start", start: "top bottom", end: "top top" }, () => ({ ...END(), y: H() * 0.55 }), END);

        // At the end the orb travels up with the page as the footer arrives.
        // The footer sits outside this component's scope, so pass the element itself.
        const footer = document.querySelector<HTMLElement>(".mk-footer");
        if (footer) {
          const foot = { trigger: footer, start: "top bottom", end: "bottom bottom", scrub: true, invalidateOnRefresh: true };
          // On the inner layer, so the lagging #start leg on the wrapper can't overwrite it.
          gsap.fromTo(".mkf-orbwrap__orb", { y: 0 }, { y: () => -footer.offsetHeight, ease: "none", immediateRender: false, scrollTrigger: foot });
          gsap.fromTo(".mkf-stage", { autoAlpha: 1 }, { autoAlpha: 0, ease: "none", immediateRender: false, scrollTrigger: { ...foot } });
        }

        // Calm scene: settle the orb.
        ScrollTrigger.create({
          trigger: "#calm",
          start: "top center",
          end: "bottom top",
          onToggle: (self) => setMood(self.isActive ? "success" : "idle"),
        });
      });
    }, root);

    // Arrival motion for regular sections.
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")), { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    root.current?.querySelectorAll(".mkf-rise").forEach((el) => io.observe(el));

    const goto = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const el = document.getElementById(id);
      if (!el) return;
      if (lenis) lenis.scrollTo(el, { duration: 1.6 });
      else el.scrollIntoView();
    };
    window.addEventListener("mk:goto", goto);

    // Dev contract: ?jump=<scrollY> lands settled; __ready gates screenshots.
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (jump !== null) {
        window.scrollTo(0, Number(jump) || 0);
        ScrollTrigger.update();
      } else if (window.location.hash) {
        const el = document.getElementById(window.location.hash.slice(1));
        if (el) lenis?.scrollTo(el, { immediate: true });
      }
      window.__ready = true;
    });

    return () => {
      window.removeEventListener("mk:goto", goto);
      io.disconnect();
      ctx.revert();
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenisRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticMode, data, scriptId]);

  // Pointer: parallax + ambient light, desktop only.
  useEffect(() => {
    if (staticMode || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    let ev: PointerEvent | null = null;
    const on = (e: PointerEvent) => {
      ev = e;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!ev || !root.current) return;
          root.current.style.setProperty("--px", ((ev.clientX / window.innerWidth) * 2 - 1).toFixed(3));
          root.current.style.setProperty("--py", ((ev.clientY / window.innerHeight) * 2 - 1).toFixed(3));
          root.current.style.setProperty("--mx", `${ev.clientX}px`);
          root.current.style.setProperty("--my", `${ev.clientY}px`);
        });
    };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [staticMode]);

  // ---------- Trip picker (the hero CTA) ----------
  const pick = (id: (typeof SCRIPTS)[number]["id"]) => {
    const sc = scriptById(id);
    setScriptId(id);
    setDraft(sc.sentence);
    setTyped(0);
    setTyping(false);
    if (pump.current) clearTimeout(pump.current);
    pump.current = null;
    reveal(0);
    setThinking(false);
    targetBeat.current = 0;
    try {
      sessionStorage.setItem(DRAFT_KEY, sc.sentence);
    } catch {}
  };
  const updateDraft = (v: string) => {
    setDraft(v);
    try {
      sessionStorage.setItem(DRAFT_KEY, v);
    } catch {}
  };
  const go = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (draft.trim()) savePendingPrompt(draft);
    router.push(tryHref);
  };

  const ready = Boolean(data);

  return (
    <div className="mkf" ref={root} data-static={staticMode}>
      {/* ===== Fixed stage: the orb and the form it absorbs ===== */}
      <div className="mkf-stage" aria-hidden="true">
        <div className="mkf-light" />
        <svg className="mkf-orbits" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="600" cy="400" rx="520" ry="150" transform="rotate(-9 600 400)" />
          <ellipse cx="600" cy="400" rx="380" ry="105" transform="rotate(-9 600 400)" strokeDasharray="2 8" />
        </svg>
        <div className="mkf-orbwrap" ref={wrap}>
          <div className="mkf-orbwrap__orb">
            <div className="mkf-orb" ref={orbEl}>
              <LiveOrb mood={mood} displayScale={orbScale} maxBuffer={1100} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== 1. Hook ===== */}
      <section className="mkf-hero" id="top" aria-labelledby="hero-title">
        <div className="mkf-hero__copy">
          <p className="mk-eyebrow">
            <i /> AI travel concierge
          </p>
          <h1 id="hero-title" className="mkf-hero__title">
            Flight search, <em>reimagined.</em>
          </h1>
          <p className="mkf-hero__sub">Tell Pyrius the trip you have in mind, in your own words. It asks what matters, then lays out flights you can compare, save and track.</p>
          <form className="mkf-ask" onSubmit={go}>
            <label htmlFor="mk-trip" className="sr-only">
              Describe your trip
            </label>
            <input
              id="mk-trip"
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              placeholder="Describe your trip…"
              autoComplete="off"
              maxLength={300}
            />
            <button type="submit" className="mk-btn mk-btn--primary">
              Try Pyrius
              <ArrowRight />
            </button>
          </form>
          <div className="mkf-chips" role="group" aria-label="Example trips">
            {SCRIPTS.map((sc) => (
              <button key={sc.id} type="button" aria-pressed={scriptId === sc.id && draft === sc.sentence} onClick={() => pick(sc.id)}>
                {sc.chip}
              </button>
            ))}
          </div>
          <p className="mkf-hero__note">Free to start. Whatever you write here is waiting for you in Pyrius after you sign up.</p>
        </div>
      </section>

      {/* The old search form, in working pieces. Above the orb, below the copy; it moves with the orb. */}
      <div className="mkf-fraglayer" role="group" aria-label="Search filters">
        <div className="mkf-fragwrap" ref={fragWrap}>
          <FiltersProvider>
            <div className="mkf-frags">
              {FRAGMENTS.map((f) => (
                <div key={f.key} className="mkf-frag" data-k={f.key} data-mobile={f.mobile} style={{ ["--d" as string]: f.depth }}>
                  <div className="mkf-frag__drift">
                    <FragmentView k={f.key} />
                  </div>
                </div>
              ))}
            </div>
          </FiltersProvider>
        </div>
      </div>

      {/* ===== 2. From search to conversation ===== */}
      <section className="mkf-how" id="how" aria-labelledby="how-a">
        <div className="mkf-how__copy mkf-how__a">
          <p className="mk-eyebrow">The old way</p>
          <h2 id="how-a" className="mkf-h2">
            Search engines hand you <em>a form.</em>
          </h2>
          <p>Origin, destination, dates, travelers, stops, bags, sort order. Then a new tab to compare, and the same search again with different dates.</p>
        </div>
        <div className="mkf-how__copy mkf-how__b">
          <p className="mk-eyebrow">The Pyrius way</p>
          <h2 className="mkf-h2">
            Stop searching. <em>Start describing.</em>
          </h2>
          <p>Say it the way you&apos;d say it to a friend. Pyrius turns one sentence into the search, and asks only for what&apos;s missing.</p>
        </div>
        <div className="mkf-how__composer">
          <div className="mkf-composer">
            <span className="mkf-composer__text">
              <TypedSentence sentence={script.sentence} phrases={script.phrases} chars={typed} />
            </span>
            <span className="mkf-composer__send">
              <ArrowUp />
            </span>
          </div>
        </div>
      </section>

      {/* ===== 3. The product comes to life ===== */}
      <section className="mkf-product" id="product" aria-labelledby="product-title">
        <div className="mkf-product__copy">
          <p className="mk-eyebrow">The new way</p>
          <h2 id="product-title" className="mkf-h2">
            Your trip, <em>understood.</em>
          </h2>
          <p>Pyrius asks only what it still needs — where you&apos;re leaving from, who&apos;s coming — then shows flights side by side: times, stops, duration, baggage and the total price.</p>
          <p className="mkf-note">Illustrative example. Prices on this page are not live fares.</p>
        </div>
        <div className="mkf-app" role="img" aria-label="Pyrius conversation turning a trip description into flight options">
          <div className="mkf-app__bar">
            <span className="mkf-app__dots">
              <i />
              <i />
              <i />
            </span>
            <span className="mkf-app__title">{data ? `${data.q.origin === "YYZ" ? "Toronto" : "Montréal"} → ${data.q.dest === "HND" ? "Tokyo" : data.q.dest === "CUN" ? "Cancún" : "Lisbon"}` : "Pyrius"}</span>
            <span className="mkf-app__demo">Illustrative</span>
          </div>
          <div className="mkf-app__feed">
            <ConversationView turns={turns} shown={Math.min(shown, turns.length)} thinking={thinking} />
            {data && shown > turns.length - 1 && shown >= BEATS.length && (
              <div className="mkf-app__cards">
                <MkFlightCard f={data.cheapest} best compact />
                <MkFlightCard f={data.fastest} compact />
              </div>
            )}
          </div>
          <div className="mkf-app__composer">
            <span className="mkf-dock">
              <span className="mkf-dock-orb">
                <LiveOrb mood={thinking ? "thinking" : "idle"} interactive={false} />
              </span>
            </span>
            <span className="mkf-app__placeholder">Reply, or ask for changes…</span>
            <span className="mkf-composer__send mkf-composer__send--idle">
              <ArrowUp />
            </span>
          </div>
        </div>
      </section>

      {/* ===== 4. Beyond discovery ===== */}
      <section className="mkf-journey" id="journey" aria-labelledby="journey-title">
        <div className="mkf-track">
          <svg className="mkf-route" viewBox="0 0 3000 600" preserveAspectRatio="none" aria-hidden="true">
            <path d="M120,470 C520,470 640,140 980,150 S1460,470 1820,440 S2340,130 2900,160" />
          </svg>
          <span className="mkf-sat" aria-hidden="true" />
          <div className="mkf-panel mkf-panel--intro">
            <p className="mk-eyebrow">After the search</p>
            <h2 id="journey-title" className="mkf-h2">
              One conversation. <em>The whole trip.</em>
            </h2>
            <p>Keep the options worth keeping, follow their prices, and line up a place to stay and a car — without starting over.</p>
          </div>
          <div className="mkf-panel mkf-rise">
            <div className="mkf-panel__label">
              <BookmarkCheck /> Save
            </div>
            <h3>Keep what&apos;s worth keeping.</h3>
            <p>Save any offer in one tap and come back to compare.</p>
            <div className="mkf-panel__visual">
              {data && <MkFlightCard f={data.cheapest} saved />}
              <div className="mkf-toast">
                <span>
                  <BookmarkCheck />
                </span>
                Saved to your offers
              </div>
            </div>
          </div>
          <div className="mkf-panel mkf-rise">
            <div className="mkf-panel__label">
              <Bell /> Track
            </div>
            <h3>Watch the price, not the tabs.</h3>
            <p>Set a target price and follow its history on one chart.</p>
            <div className="mkf-panel__visual mkf-track-card">
              {data && (
                <>
                  <div className="mkf-track-card__stats">
                    <div>
                      <span>Saved at</span>
                      <Price amount={data.cheapest.totalPrice} currency="CAD" size="sm" />
                    </div>
                    <div>
                      <span>Your target</span>
                      <Price amount={data.target} currency="CAD" size="sm" />
                    </div>
                    <em>Illustrative</em>
                  </div>
                  <MkChart history={data.history} target={data.target} />
                </>
              )}
            </div>
          </div>
          <div className="mkf-panel mkf-rise">
            <div className="mkf-panel__label">
              <Hotel /> Stay &amp; drive
            </div>
            <h3>Then the rest of the trip.</h3>
            <p>Hotels, apartments and rental cars for the same dates. When you&apos;re ready, you book directly with the provider.</p>
            <div className="mkf-panel__visual mkf-stay">
              {data && (
                <>
                  <MkHotelCard h={data.hotel} />
                  <MkCarCard c={data.car} />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5. Make it yours ===== */}
      <section className="mkf-color" id="color" aria-labelledby="color-title">
        <div className="mkf-color__top">
          <h2 id="color-title" className="mkf-color__title">
            See what Pyrius does with your trip.
          </h2>
          <Link href={tryHref} className="mk-btn mk-btn--primary" onClick={carryDraft}>
            Try Pyrius
            <ArrowRight />
          </Link>
        </div>
        <div className="mkf-color__pick">
          <OrbThemePicker preview={staticMode} />
          <p className="mkf-color__hint">Pick a color. The whole app follows.</p>
        </div>
      </section>

      {/* ===== 6. The new mindset ===== */}
      <section className="mkf-calm" id="calm" aria-labelledby="calm-title">
        <h2 id="calm-title" className="mkf-calm__title mkf-rise">
          Less searching. <em>More going.</em>
        </h2>
        <p className="mkf-rise">One sentence instead of a form.</p>
      </section>

      {/* ===== 7. Plans, the obvious choice, questions, and the last word ===== */}
      <Pricing tryHref={tryHref} />
      <Compare tryHref={tryHref} />
      <Faq />
      <FinalCta draft={draft} onDraft={updateDraft} onSubmit={go} />
      {!ready && <span className="sr-only">Loading</span>}
    </div>
  );
}
