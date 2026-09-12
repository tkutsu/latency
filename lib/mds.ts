/**
 * Solving for positions whose distances are the measured latencies.
 *
 * Two stages, because neither is enough alone: classical MDS gets the global
 * arrangement right in one shot but minimises the wrong thing (it fits squared
 * distances through an eigendecomposition), and SMACOF minimises exactly the
 * right thing but will settle into whatever local minimum it starts near. So
 * classical goes first and SMACOF refines it.
 *
 * Input is a complete matrix in ms; output is positions in ms.
 */
import { get, type RttMatrix } from "@/lib/matrix";

export interface Coordinates {
  x: Float64Array;
  y: Float64Array;
}

/**
 * Classical (Torgerson) MDS: double-centre the squared distances and take the
 * two leading eigenvectors.
 */
export function classicalMds(matrix: RttMatrix): Coordinates {
  const n = matrix.size;
  const squared = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const d = get(matrix, i, j);
      squared[i * n + j] = d * d;
    }
  }

  const rowMeans = new Float64Array(n);
  let grandMean = 0;
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let j = 0; j < n; j += 1) sum += squared[i * n + j];
    rowMeans[i] = sum / n;
    grandMean += sum;
  }
  grandMean /= n * n;

  // b = -0.5 * (d² - rowMean_i - rowMean_j + grandMean)
  const b = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      b[i * n + j] =
        -0.5 * (squared[i * n + j] - rowMeans[i] - rowMeans[j] + grandMean);
    }
  }

  return topTwoEigenvectors(b, n);
}

/**
 * The two leading eigenvectors of a symmetric matrix, by block iteration.
 *
 * Iterating one vector at a time and deflating the winner does not work here,
 * for two separate reasons, both of which this project hit:
 *
 * Power iteration converges on the eigenvalue of largest *magnitude*, and this
 * matrix has big negative ones — latency violates the triangle inequality
 * hard enough that the double-centred form is nowhere near positive
 * semi-definite. Shifting by the spectral radius fixes that: every eigenvalue
 * of `b + σI` is then non-negative, so "largest magnitude" and "largest
 * algebraic" become the same question.
 *
 * The second reason is degeneracy. When the top two eigenvalues are equal —
 * any layout with a rotational symmetry — the leading eigenvector is not
 * unique, deflating one arbitrary member of that eigenspace leaves the
 * iteration with no gap to climb, and the second axis comes back as zero. The
 * whole map collapses onto a line. Iterating both vectors together and
 * re-orthonormalising each step converges on the two-dimensional invariant
 * subspace instead, which is well defined whether or not the eigenvalues
 * inside it are.
 */
function topTwoEigenvectors(b: Float64Array, n: number): Coordinates {
  const shift = spectralRadius(b, n);

  // Two fixed, independent starting vectors: successive snapshots should
  // differ because the network did, not because the seed did.
  let first: Float64Array = new Float64Array(n);
  let second: Float64Array = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    first[i] = Math.sin(i + 1);
    second[i] = Math.cos((i + 1) * 0.7);
  }
  orthonormalise(first, second);

  for (let iteration = 0; iteration < 2000; iteration += 1) {
    const nextFirst = multiply(b, n, first, shift);
    const nextSecond = multiply(b, n, second, shift);
    if (!orthonormalise(nextFirst, nextSecond)) break;
    const settled =
      1 - Math.abs(dot(nextFirst, first)) < 1e-13 &&
      1 - Math.abs(dot(nextSecond, second)) < 1e-13;
    first = nextFirst;
    second = nextSecond;
    if (settled) break;
  }

  // The subspace is right but the basis within it is arbitrary. Diagonalising
  // b restricted to it turns that basis into the actual eigenvectors, which is
  // what puts the largest spread on the first axis.
  return diagonaliseWithin(b, n, first, second);
}

/** Largest |eigenvalue|, which is the smallest shift that makes b + σI PSD. */
function spectralRadius(b: Float64Array, n: number): number {
  let v: Float64Array = new Float64Array(n);
  for (let i = 0; i < n; i += 1) v[i] = Math.sin(i + 1);
  normalise(v);
  let radius = 0;
  for (let iteration = 0; iteration < 2000; iteration += 1) {
    const next = multiply(b, n, v, 0);
    const norm = length(next);
    if (norm < 1e-12) return 0;
    for (let i = 0; i < n; i += 1) next[i] /= norm;
    const settled = 1 - Math.abs(dot(next, v)) < 1e-13;
    v = next;
    radius = norm;
    if (settled) break;
  }
  return radius;
}

function multiply(
  b: Float64Array,
  n: number,
  v: Float64Array,
  shift: number,
): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let j = 0; j < n; j += 1) sum += b[i * n + j] * v[j];
    out[i] = sum + shift * v[i];
  }
  return out;
}

/** Gram–Schmidt, in place. False if the pair has collapsed to one direction. */
function orthonormalise(a: Float64Array, b: Float64Array): boolean {
  const aNorm = length(a);
  if (aNorm < 1e-12) return false;
  for (let i = 0; i < a.length; i += 1) a[i] /= aNorm;

  const projection = dot(a, b);
  for (let i = 0; i < b.length; i += 1) b[i] -= projection * a[i];
  const bNorm = length(b);
  if (bNorm < 1e-12) return false;
  for (let i = 0; i < b.length; i += 1) b[i] /= bNorm;
  return true;
}

/**
 * Diagonalise b within the plane spanned by the two vectors, and return the
 * coordinates scaled by the square root of the eigenvalues — which is what
 * makes the distances between them the ones classical MDS asks for.
 */
function diagonaliseWithin(
  b: Float64Array,
  n: number,
  u: Float64Array,
  v: Float64Array,
): Coordinates {
  const bu = multiply(b, n, u, 0);
  const bv = multiply(b, n, v, 0);
  const a11 = dot(u, bu);
  const a12 = dot(u, bv);
  const a22 = dot(v, bv);

  // Closed-form eigen of a symmetric 2x2.
  const mean = (a11 + a22) / 2;
  const spread = Math.hypot((a11 - a22) / 2, a12);
  const values = [mean + spread, mean - spread];
  const angle = 0.5 * Math.atan2(2 * a12, a11 - a22);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const axes: [number, number][] = [
    [cos, sin],
    [-sin, cos],
  ];
  const coordinates = axes.map(([cu, cv], axis) => {
    const scale = Math.sqrt(Math.max(0, values[axis]));
    const out = new Float64Array(n);
    for (let i = 0; i < n; i += 1) out[i] = (cu * u[i] + cv * v[i]) * scale;
    return out;
  });

  return { x: coordinates[0], y: coordinates[1] };
}

function length(v: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function normalise(v: Float64Array): void {
  const norm = length(v);
  if (norm === 0) return;
  for (let i = 0; i < v.length; i += 1) v[i] /= norm;
}

function dot(a: Float64Array, b: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

/**
 * SMACOF: majorise raw stress, Σ(‖xᵢ−xⱼ‖ − δᵢⱼ)², by repeated Guttman
 * transform. Each step is guaranteed not to make the fit worse, so there is
 * no step size to tune.
 */
export function smacof(
  matrix: RttMatrix,
  initial: Coordinates,
  { maxIterations = 800, tolerance = 1e-9 } = {},
): Coordinates {
  const n = matrix.size;
  const delta = matrix.values;
  let x = Float64Array.from(initial.x);
  let y = Float64Array.from(initial.y);
  let previousStress = rawStress(delta, n, x, y);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const nextX = new Float64Array(n);
    const nextY = new Float64Array(n);
    for (let i = 0; i < n; i += 1) {
      let sumX = 0;
      let sumY = 0;
      for (let j = 0; j < n; j += 1) {
        if (i === j) continue;
        const dx = x[i] - x[j];
        const dy = y[i] - y[j];
        const d = Math.hypot(dx, dy);
        // Coincident points contribute no direction to move along.
        if (d < 1e-12) continue;
        const ratio = delta[i * n + j] / d;
        sumX += ratio * dx;
        sumY += ratio * dy;
      }
      nextX[i] = sumX / n;
      nextY[i] = sumY / n;
    }
    x = nextX;
    y = nextY;

    const stress = rawStress(delta, n, x, y);
    if (previousStress - stress <= tolerance * Math.max(1, previousStress)) {
      previousStress = stress;
      break;
    }
    previousStress = stress;
  }

  return { x, y };
}

function rawStress(
  delta: Float64Array,
  n: number,
  x: Float64Array,
  y: Float64Array,
): number {
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = Math.hypot(x[i] - x[j], y[i] - y[j]);
      const gap = d - delta[i * n + j];
      total += gap * gap;
    }
  }
  return total;
}

/** Classical MDS then SMACOF, which is how this project embeds. */
export function embed(matrix: RttMatrix): Coordinates {
  return smacof(matrix, classicalMds(matrix));
}
