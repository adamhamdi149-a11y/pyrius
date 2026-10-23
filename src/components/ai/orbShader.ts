/**
 * Pyrius orb shader (WebGL 1 / GLSL ES 1.0 for the widest device support).
 * A translucent amber sphere lit from inside: two slow liquid currents, a deeper
 * refracted layer, a glassy rim with thickness, a soft reflection window that
 * follows the pointer, a refraction caustic, and the brand orbit — a tilted ring
 * with a travelling satellite that passes behind the sphere. All state arrives
 * through uniforms and is eased in JS so every transition glides.
 */

export const VERT = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;  // 0 idle -> 1 processing
uniform float uGlow;    // halo strength
uniform float uListen;  // 0..1 listening ripples
uniform float uPulse;   // 0..1 decaying success flash
uniform float uDim;     // 0..1 error desaturation
uniform float uLightTheme;
uniform vec2 uLight;    // pointer offset, -1..1

const float R = 0.56;   // sphere radius in half-canvas units (kept in sync with OrbStage)

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}

// Ember -> amber -> cream
vec3 ramp(float t) {
  vec3 c0 = vec3(0.16, 0.03, 0.005);
  vec3 c1 = vec3(0.62, 0.15, 0.02);
  vec3 c2 = vec3(1.0, 0.43, 0.12);
  vec3 c3 = vec3(1.0, 0.68, 0.4);
  vec3 c4 = vec3(1.0, 0.93, 0.84);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.28, t));
  c = mix(c, c2, smoothstep(0.24, 0.55, t));
  c = mix(c, c3, smoothstep(0.55, 0.8, t));
  c = mix(c, c4, smoothstep(0.8, 1.02, t));
  return c;
}

void main() {
  float s = 0.5 * min(uRes.x, uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / s;
  float px = 1.0 / s;
  float t = uTime;
  float detail = clamp((s - 18.0) / 50.0, 0.0, 1.0); // fine details fade out when docked small

  float rad = R * (1.0 + 0.012 * sin(t * 0.8) + 0.008 * uListen * sin(t * 9.0));
  float r = length(uv);

  // ---------- Sphere ----------
  vec4 sphere = vec4(0.0);
  if (r < rad + px) {
    vec2 p = uv / rad;
    float rho = min(length(p), 1.0);
    float z = sqrt(max(0.0, 1.0 - rho * rho));
    vec3 n = normalize(vec3(p, z));

    float a = t * (0.06 + 0.3 * uEnergy);
    vec3 q = n;
    q.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * q.xz;

    // Two slow liquid currents + a deeper layer seen through the glass
    float drift = t * (0.035 + 0.15 * uEnergy);
    float flowA = fbm(q * 1.05 + vec3(0.0, drift, 0.0));
    float flowB = fbm(q * 1.7 + flowA * 1.8 + vec3(drift * 0.6, 0.0, -drift));
    vec3 inner = refract(vec3(0.0, 0.0, -1.0), n, 0.74);
    float deep = fbm(inner * 2.3 + vec3(0.0, -drift * 1.5, drift));

    vec3 L = normalize(vec3(-0.42 + uLight.x * 0.45, 0.5 + uLight.y * 0.35, 0.78));
    float diff = clamp(dot(n, L), 0.0, 1.0);

    // Light from within: bright, slightly off-centre core that fades toward the glass
    vec2 cp = p - L.xy * 0.22;
    float core = exp(-dot(cp, cp) * 2.6);
    float heat = 0.08 + 0.44 * core + 0.34 * diff;
    heat += (flowB - 0.5) * 0.36;
    heat += (deep - 0.5) * 0.3 * z;
    heat += 0.1 * uPulse + 0.06 * uEnergy;
    vec3 col = ramp(clamp(heat, 0.0, 1.05));

    // Inner translucent shell: a second, smaller surface glowing through the outer glass
    float shellR = length(p - L.xy * 0.1) / (0.7 + 0.03 * sin(t * 0.6));
    float shell = smoothstep(1.0, 0.86, shellR);
    float shellEdge = smoothstep(0.82, 0.97, shellR) * (1.0 - smoothstep(0.97, 1.04, shellR));
    col = mix(col, col * 1.12 + vec3(0.06, 0.03, 0.0), shell * 0.55);
    col += vec3(1.0, 0.7, 0.42) * shellEdge * (0.07 + 0.12 * uEnergy) * detail;

    // Energy filaments (ridges of the current), mostly while thinking
    float ridge = 1.0 - smoothstep(0.0, 0.03 + 0.03 * uEnergy, abs(fbm(q * 2.6 + vec3(t * 0.3)) - 0.5));
    col += vec3(1.0, 0.82, 0.6) * ridge * (0.012 + 0.4 * uEnergy) * z * detail;

    // Glass thickness: a darker band inside the rim, then a thin bright rim
    float band = smoothstep(0.62, 0.9, rho) * (1.0 - smoothstep(0.9, 0.995, rho));
    col *= 1.0 - 0.32 * band;
    float rim = smoothstep(0.88, 0.995, rho);
    col += vec3(1.0, 0.55, 0.24) * rim * (0.5 + 0.25 * uEnergy);

    // Soft reflection window (follows the light) and a refraction caustic opposite it
    vec2 wp = (p - vec2(-0.34, 0.44) - uLight * vec2(0.18, 0.12)) * vec2(1.0, 1.7);
    float window = smoothstep(0.42, 0.0, length(wp));
    col = mix(col, vec3(1.0, 0.93, 0.86), window * window * 0.2 * detail);
    vec2 cc = p - vec2(0.36, -0.48) + uLight * 0.15;
    col += vec3(1.0, 0.72, 0.45) * exp(-dot(cc, cc) * 9.0) * 0.3;

    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    col += vec3(1.0, 0.97, 0.92) * pow(max(dot(n, H), 0.0), 180.0) * 0.55;

    float lum = dot(col, vec3(0.3, 0.55, 0.15));
    col = mix(col, vec3(lum) * vec3(1.0, 0.86, 0.78) * 0.78, uDim);

    float edge = smoothstep(rad + px, rad - px, r);
    sphere = vec4(col * edge, edge);
  }

  // ---------- Orbit ring + satellite (passes behind the sphere) ----------
  float ca = cos(-0.26);
  float sa = sin(-0.26);
  vec2 e = mat2(ca, sa, -sa, ca) * uv;
  vec2 ell = vec2(0.86, 0.19);
  float k = length(e / ell);
  float dEll = abs(k - 1.0) * min(ell.x, ell.y);
  float line = smoothstep(1.6 * px, 0.0, dEll) * smoothstep(0.0, 0.35, abs(e.x) / ell.x + 0.15);
  float sweep = t * (0.32 + 0.4 * uEnergy);
  vec2 satE = ell * vec2(cos(sweep), sin(sweep));
  float satD = length(e - satE);
  float sat = exp(-satD * satD / (0.0009 + 0.0004 * uEnergy)) + 0.35 * exp(-satD * satD / 0.006);
  float behind = step(0.0, e.y) * step(r, rad);          // back half hidden by the sphere
  float satBehind = step(0.0, satE.y) * step(r, rad);
  float ringA = line * (0.2 + 0.14 * uEnergy + 0.1 * uListen) * (1.0 - behind) * detail;
  float satA = clamp(sat, 0.0, 1.0) * (0.9 + 0.1 * uEnergy) * (1.0 - satBehind) * detail;
  vec3 ringC = mix(vec3(1.0, 0.68, 0.44), vec3(0.8, 0.7, 0.66), uDim);

  // ---------- Halo + listening ripples ----------
  float d = max(r - rad, 0.0);
  float glow = exp(-d * mix(5.6, 3.9, uEnergy)) * uGlow * mix(0.6, 0.4, uLightTheme);
  float phase = fract(t * 0.42);
  float ripple = uListen * (1.0 - phase) * smoothstep(0.022, 0.0, abs(d - phase * 0.38)) * 0.55;
  float ha = clamp((glow + ripple + uPulse * 0.28 * exp(-d * 5.0)) * smoothstep(1.0, 0.76, r), 0.0, 1.0);
  vec3 hc = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.58, 0.28), uListen);
  hc = mix(hc, vec3(0.75, 0.6, 0.55), uDim);

  // Composite back-to-front (premultiplied): halo, back ring, sphere, front ring, satellite
  vec4 outc = vec4(hc * ha, ha);
  float backRing = line * step(0.0, e.y) * 0.12 * detail;
  outc = vec4(ringC * backRing, backRing) + outc * (1.0 - backRing);
  outc = sphere + outc * (1.0 - sphere.a);
  outc = vec4(ringC * ringA, ringA) + outc * (1.0 - ringA);
  vec3 satC = vec3(1.0, 0.9, 0.8);
  outc = vec4(satC * satA, satA) + outc * (1.0 - satA);

  gl_FragColor = outc;
}
`;
