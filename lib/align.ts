/**
 * Pinning the embedding's orientation.
 *
 * MDS fixes distances, not direction: rotate the whole solution, or hold it up
 * to a mirror, and it fits exactly as well. Left alone, that means the map
 * arrives spun at random and every rebuild spins it somewhere else, which
 * would make the morph unreadable and successive snapshots incomparable.
 *
 * So the solution is turned to sit as close to the real geography as an
 * orthogonal transform can put it. Geography is the fixed reference every
 * snapshot is aligned against, which is what keeps them comparable — and it
 * makes the morph read as the continent deforming rather than the page
 * turning. Scale is deliberately left alone: the embedding is already in
 * milliseconds, and stretching it would hide how much further apart latency
 * puts things than distance does.
 */
import type { Coordinates } from "@/lib/mds";

export interface Alignment {
  /** Rotation angle, radians. */
  angle: number;
  /** Whether the solution had to be mirrored to fit. */
  reflected: boolean;
}

function centroid(values: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];
  return values.length === 0 ? 0 : sum / values.length;
}

/**
 * Orthogonal Procrustes in 2D, solved in closed form.
 *
 * Maximising tr(RM) over rotations and over reflections each reduce to an
 * arctangent, so the best of the two is a comparison of two hypotenuses — no
 * SVD needed at this size.
 */
export function alignTo(
  source: Coordinates,
  target: Coordinates,
): { coordinates: Coordinates; alignment: Alignment } {
  const n = source.x.length;
  const sourceCx = centroid(source.x);
  const sourceCy = centroid(source.y);
  const targetCx = centroid(target.x);
  const targetCy = centroid(target.y);

  // M = Σ sourceᵢ targetᵢᵀ over the centred coordinates.
  let m00 = 0;
  let m01 = 0;
  let m10 = 0;
  let m11 = 0;
  for (let i = 0; i < n; i += 1) {
    const sx = source.x[i] - sourceCx;
    const sy = source.y[i] - sourceCy;
    const tx = target.x[i] - targetCx;
    const ty = target.y[i] - targetCy;
    m00 += sx * tx;
    m01 += sx * ty;
    m10 += sy * tx;
    m11 += sy * ty;
  }

  const rotationFit = Math.hypot(m00 + m11, m01 - m10);
  const reflectionFit = Math.hypot(m00 - m11, m01 + m10);
  const reflected = reflectionFit > rotationFit;
  const angle = reflected
    ? Math.atan2(m01 + m10, m00 - m11)
    : Math.atan2(m01 - m10, m00 + m11);

  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const sx = source.x[i] - sourceCx;
    const sy = reflected ? -(source.y[i] - sourceCy) : source.y[i] - sourceCy;
    x[i] = cos * sx - sin * sy + targetCx;
    y[i] = sin * sx + cos * sy + targetCy;
  }

  return { coordinates: { x, y }, alignment: { angle, reflected } };
}
