import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import { memo, useEffect, useRef, type MutableRefObject } from "react";
import { AccessibilityInfo, AppState, PixelRatio, StyleSheet, View, type ViewStyle } from "react-native";
import { FRAG, VERT } from "@/components/ai/orbShader";
import { ease, ORB_STATES, type OrbMood } from "@/lib/motion";
import { orbThemeById, paletteArray, type OrbThemeId } from "@/lib/orbThemes";

/** Live audio levels (0–1) that drive the orb during voice: the microphone and Pyrius's own voice. */
export interface AudioLevels {
  input: number;
  output: number;
}

export type MobileOrbMood = OrbMood | "speaking";

interface Props {
  mood: MobileOrbMood;
  /** Diameter of the sphere in points; the canvas around it holds the halo and the orbit. */
  sphere: number;
  theme: OrbThemeId;
  /** Change this number to fire a short success pulse. */
  pulseKey?: number;
  /** Updated by the voice session; read every frame, so it never re-renders the orb. */
  levels?: MutableRefObject<AudioLevels>;
  style?: ViewStyle;
}

/** Shader constant R in orbShader.ts: the sphere is 56% of the canvas. */
const SPHERE = 0.56;
/** Largest backing buffer in pixels; beyond that the canvas is drawn smaller and scaled up (it's a soft glow). */
const MAX_BUFFER = 640;

const TARGETS: Record<MobileOrbMood, { energy: number; glow: number; listen: number; dim: number }> = {
  ...ORB_STATES,
  speaking: { energy: 0.45, glow: 0.8, listen: 0, dim: 0 },
};

function compile(gl: ExpoWebGLRenderingContext) {
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
 * The Pyrius orb: the web app's own fragment shader (src/components/ai/orbShader.ts) rendered with
 * expo-gl, with the same eased states and theme palettes as LiveOrb. In voice mode the real audio
 * levels push the ripples (listening) and the inner currents (speaking).
 */
export const Orb = memo(function Orb({ mood, sphere, theme, pulseKey = 0, levels, style }: Props) {
  const stage = sphere / SPHERE;
  const scale = Math.max(1, (stage * PixelRatio.get()) / MAX_BUFFER);
  const moodRef = useRef(mood);
  const paletteTarget = useRef(paletteArray(orbThemeById(theme).palette));
  const pulse = useRef(0);
  const cleanup = useRef<() => void>(() => {});
  const lastTheme = useRef(theme);
  moodRef.current = mood;

  useEffect(() => {
    paletteTarget.current = paletteArray(orbThemeById(theme).palette);
    if (lastTheme.current !== theme) pulse.current = Math.max(pulse.current, 0.55);
    lastTheme.current = theme;
  }, [theme]);

  useEffect(() => {
    if (pulseKey) pulse.current = 1;
  }, [pulseKey]);

  useEffect(() => () => cleanup.current(), []);

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    let prog: WebGLProgram;
    try {
      prog = compile(gl);
    } catch (err) {
      console.warn("Orb shader unavailable", err);
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
    const pal = Float32Array.from(paletteTarget.current);
    const cur = { ...TARGETS[moodRef.current] };
    let time = Math.random() * 40;
    let last = Date.now();
    let raf = 0;
    let running = true;
    let reduced = false;

    const draw = () => {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.time, time);
      gl.uniform1f(U.energy, cur.energy);
      gl.uniform1f(U.glow, cur.glow);
      gl.uniform1f(U.listen, cur.listen);
      gl.uniform1f(U.pulse, pulse.current);
      gl.uniform1f(U.dim, cur.dim);
      gl.uniform2f(U.light, 0, 0);
      gl.uniform1f(U.theme, 0);
      gl.uniform3fv(U.pal, pal);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.flush();
      gl.endFrameEXP?.();
    };

    const frame = () => {
      if (!running) return;
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const base = TARGETS[moodRef.current];
      const lv = levels?.current;
      // Real audio only: the microphone widens the ripples, Pyrius's voice speeds the currents.
      const input = lv ? Math.min(1, lv.input * 2.2) : 0;
      const output = lv ? Math.min(1, lv.output * 2.2) : 0;
      const target = {
        energy: moodRef.current === "speaking" ? base.energy + output * 0.55 : base.energy,
        glow: Math.min(1, base.glow + (moodRef.current === "listening" ? input * 0.25 : moodRef.current === "speaking" ? output * 0.2 : 0)),
        listen: moodRef.current === "listening" && lv ? 0.35 + input * 0.65 : base.listen,
        dim: base.dim,
      };
      time += dt * (0.55 + cur.energy * 1.1 + cur.listen * 0.4);
      cur.energy = ease(cur.energy, target.energy, 2.6, dt);
      cur.glow = ease(cur.glow, target.glow, 3, dt);
      cur.listen = ease(cur.listen, target.listen, 4, dt);
      cur.dim = ease(cur.dim, target.dim, 3, dt);
      pulse.current = Math.max(0, pulse.current - dt * 0.9);
      const palT = paletteTarget.current;
      for (let i = 0; i < pal.length; i++) pal[i] = ease(pal[i], palT[i], 2.8, dt);
      draw();
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      last = Date.now();
      raf = requestAnimationFrame(frame);
    };

    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      reduced = r;
      if (r) {
        Object.assign(cur, TARGETS[moodRef.current]);
        draw();
      }
    }, () => {});
    // No drawing while the app is in the background.
    const sub = AppState.addEventListener("change", (s) => {
      running = s === "active";
      if (running && !reduced) start();
      else cancelAnimationFrame(raf);
    });

    draw();
    start();
    cleanup.current = () => {
      running = false;
      cancelAnimationFrame(raf);
      sub.remove();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      GLView.destroyContextAsync(gl).catch(() => {});
    };
  };

  return (
    <View pointerEvents="none" style={[{ width: stage, height: stage }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <GLView
        msaaSamples={0}
        onContextCreate={onContextCreate}
        style={[
          styles.gl,
          { width: stage / scale, height: stage / scale, left: (stage - stage / scale) / 2, top: (stage - stage / scale) / 2, transform: [{ scale }] },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  gl: { position: "absolute", backgroundColor: "transparent" },
});
