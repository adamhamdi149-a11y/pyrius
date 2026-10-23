"use client";
import { useEffect, useRef, useState } from "react";
import { ease, finePointer, ORB_STATES, prefersReducedMotion, type OrbMood } from "@/lib/motion";
import { orbThemeById, paletteArray } from "@/lib/orbThemes";
import { useStore } from "@/lib/store/AppStore";
import { cx } from "@/lib/utils";
import { Orb } from "./Orb";
import { FRAG, VERT } from "./orbShader";

interface Props {
  mood: OrbMood;
  /** Change this number to fire a short success pulse. */
  pulseKey?: number;
  /** Light follows the pointer on fine-pointer devices. */
  interactive?: boolean;
  /** Displayed size multiplier, so the buffer matches what's on screen (used while docked). */
  displayScale?: number;
  className?: string;
}

const MOOD_TO_CSS = { idle: "idle", thinking: "thinking", listening: "listening", success: "idle", error: "idle" } as const;

function compile(gl: WebGLRenderingContext) {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  return prog;
}

/**
 * The live Pyrius orb. A single full-canvas fragment shader; all motion is
 * eased in JS so state changes (idle → thinking → success) always glide.
 */
export function LiveOrb({ mood, pulseKey = 0, interactive = true, displayScale = 1, className }: Props) {
  const { settings, ready } = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  // Target palette for the selected orb theme; the render loop eases toward it. Before the
  // store has loaded, start from the accent the pre-paint script restored, so reloads don't flash.
  const paletteTarget = useRef(
    paletteArray(orbThemeById(typeof document !== "undefined" ? document.documentElement.dataset.accent : settings.orbTheme).palette),
  );
  const themeChanged = useRef<(flare: boolean) => void>(() => {});
  const [fallback, setFallback] = useState(false);
  const moodRef = useRef(mood);
  const scaleRef = useRef(displayScale);
  const pulse = useRef(0);
  const redraw = useRef<() => void>(() => {});
  moodRef.current = mood;
  scaleRef.current = displayScale;

  useEffect(() => {
    if (pulseKey) {
      pulse.current = 1;
      redraw.current();
    }
  }, [pulseKey]);

  useEffect(() => redraw.current(), [mood, displayScale]);

  const lastTheme = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    paletteTarget.current = paletteArray(orbThemeById(settings.orbTheme).palette);
    // Flare only on a real change, not when the saved theme is first restored.
    themeChanged.current(Boolean(lastTheme.current && lastTheme.current !== settings.orbTheme));
    lastTheme.current = settings.orbTheme;
  }, [settings.orbTheme, ready]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const gl = el.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: "low-power" });
    if (!gl) {
      setFallback(true);
      return;
    }
    let prog: WebGLProgram;
    try {
      prog = compile(gl);
    } catch (err) {
      console.warn("Orb shader unavailable, using CSS orb.", err);
      setFallback(true);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const U = { res: u("uRes"), time: u("uTime"), energy: u("uEnergy"), glow: u("uGlow"), listen: u("uListen"), pulse: u("uPulse"), dim: u("uDim"), light: u("uLight"), theme: u("uLightTheme"), pal: u("uPal") };
    // Current palette, starting at the selected theme so the first frame is already correct.
    const pal = Float32Array.from(paletteTarget.current);

    const reduced = prefersReducedMotion();
    const start = ORB_STATES[moodRef.current];
    const cur = { ...start, lx: 0, ly: 0 };
    const pointer = { x: 0, y: 0 };
    let time = reduced ? 14 : Math.random() * 40;
    let last = performance.now();
    let raf = 0;
    let visible = true;

    const resize = () => {
      // Layout size (ignores CSS transforms) × the scale it is displayed at × DPR, in 16px steps.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(48, Math.min(720, Math.round((el.offsetWidth * scaleRef.current * dpr) / 16) * 16));
      if (el.width !== px || el.height !== px) {
        el.width = px;
        el.height = px;
      }
      gl.viewport(0, 0, el.width, el.height);
    };

    const draw = () => {
      resize();
      gl.uniform2f(U.res, el.width, el.height);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.energy, cur.energy);
      gl.uniform1f(U.glow, cur.glow);
      gl.uniform1f(U.listen, cur.listen);
      gl.uniform1f(U.pulse, pulse.current);
      gl.uniform1f(U.dim, cur.dim);
      gl.uniform2f(U.light, cur.lx, cur.ly);
      gl.uniform1f(U.theme, document.documentElement.dataset.theme === "light" ? 1 : 0);
      gl.uniform3fv(U.pal, pal);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = ORB_STATES[moodRef.current];
      // Speed of time itself follows energy, so currents visibly quicken while thinking.
      time += dt * (0.55 + cur.energy * 1.1 + cur.listen * 0.4);
      cur.energy = ease(cur.energy, target.energy, 2.6, dt);
      cur.glow = ease(cur.glow, target.glow, 3, dt);
      cur.listen = ease(cur.listen, target.listen, 4, dt);
      cur.dim = ease(cur.dim, target.dim, 3, dt);
      cur.lx = ease(cur.lx, pointer.x, 3.5, dt);
      cur.ly = ease(cur.ly, pointer.y, 3.5, dt);
      pulse.current = Math.max(0, pulse.current - dt * 0.9);
      // Theme colours glide (~1 s) while shape, motion and the clock carry on untouched.
      const palTarget = paletteTarget.current;
      for (let i = 0; i < pal.length; i++) pal[i] = ease(pal[i], palTarget[i], 2.8, dt);
      draw();
      if (visible) raf = requestAnimationFrame(frame);
    };

    // A theme change brings a short inner flare; with reduced motion the colours switch in one still frame.
    themeChanged.current = (flare) => {
      if (reduced) {
        pal.set(paletteTarget.current);
        draw();
      } else if (flare) {
        pulse.current = Math.max(pulse.current, 0.55);
      }
    };

    // Reduced motion: no animation loop, just a fresh still frame on each state change.
    redraw.current = () => {
      if (!reduced) return;
      Object.assign(cur, ORB_STATES[moodRef.current]);
      pulse.current = 0;
      draw();
    };

    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const span = Math.max(420, r.width * scaleRef.current * 3);
      pointer.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / span));
      pointer.y = Math.max(-1, Math.min(1, -(e.clientY - (r.top + r.height / 2)) / span));
    };
    if (interactive && finePointer() && !reduced) window.addEventListener("pointermove", onPointer, { passive: true });

    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(el);

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      setFallback(true);
    };
    el.addEventListener("webglcontextlost", onLost);

    // Draw one frame right away so the orb is visible before the animation loop starts.
    draw();
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      el.removeEventListener("webglcontextlost", onLost);
      redraw.current = () => {};
      themeChanged.current = () => {};
      // Free GPU resources but keep the context: React may re-run this effect on the same
      // canvas (StrictMode, remounts), and a deliberately lost context can't be reused.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [interactive]);

  return (
    <div className={cx("live-orb", className)} data-mood={mood} aria-hidden="true">
      {fallback ? (
        <div className="live-orb__fallback">
          <Orb state={MOOD_TO_CSS[mood]} />
        </div>
      ) : (
        <canvas ref={canvas} className="live-orb__canvas" />
      )}
    </div>
  );
}
