/**
 * Colour, and the one thing it encodes.
 *
 * Position already carries the whole argument of this map, so colour is spent
 * on exactly one thing: per-node stress, the gap between where the map puts a
 * node and where its measurements want it. That is a magnitude, so it gets a
 * single-hue sequential ramp — orange, kept clear of the blue the interface
 * uses, so data never wears chrome's colour or the reverse.
 *
 * Both ramps are selected per mode rather than flipped, and both pass the
 * ordinal checks against this app's own surfaces: monotone lightness, adjacent
 * gaps of at least 0.06, a low end that still clears 2:1 against the surface
 * (these are small marks — a node that recedes into the background is a node
 * you cannot read), and a single hue.
 */
export type Theme = "light" | "dark";

const RAMPS: Record<Theme, string[]> = {
  // Low magnitude nearest the surface, high magnitude brightest.
  dark: ["#5c4030", "#8b5531", "#b56c33", "#d78a41", "#edaf6c", "#ffd3a4"],
  light: ["#dc9f62", "#c8813f", "#b16729", "#95501e", "#763c16", "#57290f"],
};

export function stressRamp(theme: Theme): string[] {
  return RAMPS[theme];
}

export interface Chrome {
  surface: string;
  ink: string;
  muted: string;
  hairline: string;
  signal: string;
  /** A node with the stress layer switched off. */
  node: string;
  /** The line drawn from a node to a pair it gets wrong. */
  link: string;
}

export const CHROME: Record<Theme, Chrome> = {
  dark: {
    surface: "#0b0d12",
    ink: "#e8ebf2",
    muted: "#8b93a7",
    hairline: "#1e2230",
    signal: "#4da3ff",
    node: "#6f7a92",
    link: "#4da3ff",
  },
  light: {
    surface: "#f7f7f4",
    ink: "#14161c",
    muted: "#626a7d",
    hairline: "#e0e0d8",
    signal: "#1668c7",
    node: "#9aa0ae",
    link: "#1668c7",
  },
};

/** The stress range the ramp spans, in ms. Outside it, the ramp saturates. */
export interface StressDomain {
  low: number;
  high: number;
}

/**
 * Stress in ms → a colour on the ramp.
 *
 * The ramp spans the middle of the distribution rather than zero-to-maximum.
 * Node stress is heavily skewed — the best anchor misses by 5 ms, the median by
 * 9, and one anchor in Amsterdam by 105 — so anchoring the ramp at either
 * extreme would spend almost all of it on values nothing has and leave the
 * whole continent one indistinguishable shade. Both ends saturate instead, and
 * the legend gives the two numbers so the compression is stated rather than
 * hidden.
 */
export function stressColour(
  stress: number,
  domain: StressDomain,
  theme: Theme,
): string {
  const ramp = stressRamp(theme);
  const span = domain.high - domain.low;
  const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (stress - domain.low) / span));
  const scaled = t * (ramp.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(ramp.length - 1, lower + 1);
  return mix(ramp[lower], ramp[upper], scaled - lower);
}

/** Linear blend of two hex colours. Along one hue, sRGB is close enough. */
export function mix(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const channel = (i: number) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)})`;
}

function parseHex(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
