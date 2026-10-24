// Material You (Material 3) tonal palette generation.
// Tones are CIE L* (the same "tone" HCT uses); hue comes from the seed color.
// Everything is computed in JS and gamut-mapped to sRGB, so no CSS color-level-4 support is needed.

const RGB_TO_XYZ = [
  [0.4360747, 0.3850649, 0.1430804],
  [0.2225045, 0.7168786, 0.0606169],
  [0.0139322, 0.0971045, 0.7141733],
];
const XYZ_TO_RGB = [
  [3.1338561, -1.6168667, -0.4906146],
  [-0.9787684, 1.9161415, 0.033454],
  [0.0719453, -0.2289914, 1.4052427],
];
const WHITE_D50 = [0.96422, 1, 0.82521];
const EPS = 216 / 24389;
const KAPPA = 24389 / 27;

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function hexToRgb(hex) {
  let h = String(hex).replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

export function hexToLch(hex) {
  const lin = hexToRgb(hex).map((v) => toLinear(v / 255));
  const xyz = mul(RGB_TO_XYZ, lin).map((v, i) => v / WHITE_D50[i]);
  const f = xyz.map((t) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116));
  const L = 116 * f[1] - 16;
  const a = 500 * (f[0] - f[1]);
  const b = 200 * (f[1] - f[2]);
  return { L, C: Math.hypot(a, b), H: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

function lchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const xr = fx ** 3 > EPS ? fx ** 3 : (116 * fx - 16) / KAPPA;
  const yr = L > KAPPA * EPS ? fy ** 3 : L / KAPPA;
  const zr = fz ** 3 > EPS ? fz ** 3 : (116 * fz - 16) / KAPPA;
  return mul(XYZ_TO_RGB, [xr * WHITE_D50[0], yr * WHITE_D50[1], zr * WHITE_D50[2]]);
}

const inGamut = (v) => v.every((c) => c >= -0.0005 && c <= 1.0005);

/** LCH -> #rrggbb, reducing chroma until the color fits in sRGB (keeps tone and hue stable). */
export function lchToHex(L, C, H) {
  let rgb = lchToLinear(L, C, H);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(lchToLinear(L, mid, H))) lo = mid;
      else hi = mid;
    }
    rgb = lchToLinear(L, lo, H);
  }
  const [r, g, b] = rgb.map((c) => clamp01(toGamma(clamp01(c))) * 255);
  return rgbToHex(r, g, b);
}

/** WCAG relative luminance, 0..1 */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => toLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Builds a Material 3 "tonal spot" color scheme from a seed color.
 * Returns kebab-case role names -> hex, e.g. "primary-container".
 */
export function buildScheme(seedHex, dark) {
  const seed = hexToLch(seedHex);
  const hue = seed.C < 6 ? 260 : seed.H; // greys have no usable hue -> fall back to blue
  const P = (t) => lchToHex(t, 38, hue);
  const S = (t) => lchToHex(t, 16, hue);
  const T = (t) => lchToHex(t, 26, (hue + 60) % 360);
  const N = (t) => lchToHex(t, 5, hue);
  const NV = (t) => lchToHex(t, 9, hue);
  const E = (t) => lchToHex(t, 60, 28);

  const t = dark
    ? {
        primary: 80, onPrimary: 20, primaryContainer: 30, onPrimaryContainer: 90,
        secondary: 80, secondaryContainer: 30, onSecondaryContainer: 90,
        tertiary: 80, tertiaryContainer: 30, onTertiaryContainer: 90,
        surface: 6, onSurface: 90, onSurfaceVariant: 80,
        lowest: 4, low: 10, base: 12, high: 17, highest: 22,
        outline: 60, outlineVariant: 30, inverseSurface: 90, inverseOnSurface: 20, error: 80,
      }
    : {
        primary: 40, onPrimary: 100, primaryContainer: 90, onPrimaryContainer: 10,
        secondary: 40, secondaryContainer: 90, onSecondaryContainer: 10,
        tertiary: 40, tertiaryContainer: 90, onTertiaryContainer: 10,
        surface: 98, onSurface: 10, onSurfaceVariant: 30,
        lowest: 100, low: 96, base: 94, high: 92, highest: 90,
        outline: 50, outlineVariant: 80, inverseSurface: 20, inverseOnSurface: 95, error: 40,
      };

  return {
    primary: P(t.primary),
    "on-primary": P(t.onPrimary),
    "primary-container": P(t.primaryContainer),
    "on-primary-container": P(t.onPrimaryContainer),
    secondary: S(t.secondary),
    "secondary-container": S(t.secondaryContainer),
    "on-secondary-container": S(t.onSecondaryContainer),
    tertiary: T(t.tertiary),
    "tertiary-container": T(t.tertiaryContainer),
    "on-tertiary-container": T(t.onTertiaryContainer),
    surface: N(t.surface),
    "on-surface": N(t.onSurface),
    "on-surface-variant": NV(t.onSurfaceVariant),
    "surface-container-lowest": N(t.lowest),
    "surface-container-low": N(t.low),
    "surface-container": N(t.base),
    "surface-container-high": N(t.high),
    "surface-container-highest": N(t.highest),
    outline: NV(t.outline),
    "outline-variant": NV(t.outlineVariant),
    "inverse-surface": N(t.inverseSurface),
    "inverse-on-surface": N(t.inverseOnSurface),
    error: E(t.error),
    // Not Material roles: tinted scrims used for shortcut tiles on top of arbitrary backgrounds.
    "tile-dark": lchToHex(18, 10, hue),
    "tile-light": lchToHex(98, 4, hue),
  };
}

/**
 * Best-effort read of the browser's accent color. Chrome exposes no theme API to extensions,
 * but the CSS system color AccentColor follows the browser/OS color provider where supported.
 */
export function detectAccent() {
  try {
    if (!CSS.supports("color", "AccentColor")) return null;
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;visibility:hidden;color:AccentColor";
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    const m = c.match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    const hex = rgbToHex(+m[0], +m[1], +m[2]);
    return hexToLch(hex).C < 6 ? null : hex; // ignore greys
  } catch {
    return null;
  }
}
