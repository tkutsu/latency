/**
 * The min-RTT matrix: building it, cleaning it, and measuring the way it
 * refuses to be a distance.
 *
 * Missing entries are NaN. They are common — an anchor can be down, or drop
 * every packet to one target — and they have to survive as "unknown" rather
 * than collapse to zero.
 */
export interface RttMatrix {
  size: number;
  /** Row-major, `size * size`, NaN where there is no measurement. */
  values: Float64Array;
}

export function createMatrix(size: number): RttMatrix {
  const values = new Float64Array(size * size).fill(Number.NaN);
  for (let i = 0; i < size; i += 1) values[i * size + i] = 0;
  return { size, values };
}

export function get(matrix: RttMatrix, i: number, j: number): number {
  return matrix.values[i * matrix.size + j];
}

export function set(
  matrix: RttMatrix,
  i: number,
  j: number,
  value: number,
): void {
  matrix.values[i * matrix.size + j] = value;
}

/**
 * Fold the two directions of every pair into one distance by taking the
 * smaller. Forward and reverse min-RTT disagree — different queue depths,
 * sometimes different paths — and the smaller of the two is the closer thing
 * to "how far apart these two are", since it carries less queueing.
 */
export function symmetrise(directed: RttMatrix): RttMatrix {
  const { size } = directed;
  const out = createMatrix(size);
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      const forward = get(directed, i, j);
      const reverse = get(directed, j, i);
      const both = [forward, reverse].filter((v) => Number.isFinite(v));
      if (both.length === 0) continue;
      const value = Math.min(...both);
      set(out, i, j, value);
      set(out, j, i, value);
    }
  }
  return out;
}

/** Indices with measurements to at least `minRatio` of the other nodes. */
export function wellCoveredIndices(
  matrix: RttMatrix,
  minRatio: number,
): number[] {
  const { size } = matrix;
  const needed = Math.ceil((size - 1) * minRatio);
  const kept: number[] = [];
  for (let i = 0; i < size; i += 1) {
    let measured = 0;
    for (let j = 0; j < size; j += 1) {
      if (i !== j && Number.isFinite(get(matrix, i, j))) measured += 1;
    }
    if (measured >= needed) kept.push(i);
  }
  return kept;
}

/** The square sub-matrix on `indices`, in the order given. */
export function submatrix(matrix: RttMatrix, indices: number[]): RttMatrix {
  const out = createMatrix(indices.length);
  for (let i = 0; i < indices.length; i += 1) {
    for (let j = 0; j < indices.length; j += 1) {
      set(out, i, j, get(matrix, indices[i], indices[j]));
    }
  }
  return out;
}

export function countMeasuredPairs(matrix: RttMatrix): number {
  const { size } = matrix;
  let pairs = 0;
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      if (Number.isFinite(get(matrix, i, j))) pairs += 1;
    }
  }
  return pairs;
}

/**
 * Fill the gaps with the shortest measured path between the two ends, the way
 * Isomap does. A filled entry is the best the measured graph can say about a
 * pair it never timed, and it is only ever used to give the embedding
 * something to hold on to — every stress figure this project reports is
 * computed against measured pairs alone.
 *
 * Throws if the graph is disconnected, because then no embedding is defined.
 */
export function completeByShortestPath(matrix: RttMatrix): RttMatrix {
  const { size } = matrix;
  const closure = createMatrix(size);
  closure.values.set(matrix.values);
  // Floyd–Warshall over the ms weights, with NaN standing in for infinity.
  const d = closure.values;
  for (let k = 0; k < size; k += 1) {
    const kRow = k * size;
    for (let i = 0; i < size; i += 1) {
      const ik = d[i * size + k];
      if (!Number.isFinite(ik)) continue;
      const iRow = i * size;
      for (let j = 0; j < size; j += 1) {
        const kj = d[kRow + j];
        if (!Number.isFinite(kj)) continue;
        const through = ik + kj;
        const direct = d[iRow + j];
        if (!Number.isFinite(direct) || through < direct) {
          d[iRow + j] = through;
        }
      }
    }
  }
  // Only the gaps take the closure's value. Left unguarded, Floyd–Warshall
  // would also pull every *measured* pair down to its fastest detour, which is
  // the metric closure of the matrix rather than the matrix — and fitting that
  // would quietly bake the triangle violations in before the embedding ever
  // saw them, then charge the difference to the map's stress.
  const out = createMatrix(size);
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      const measured = matrix.values[i * size + j];
      const filled = Number.isFinite(measured) ? measured : d[i * size + j];
      if (!Number.isFinite(filled)) {
        throw new Error(`Anchor graph is disconnected: ${i} cannot reach ${j}`);
      }
      out.values[i * size + j] = filled;
    }
  }
  return out;
}

/**
 * The share of measured pairs that some third anchor gets to faster than the
 * direct ping does.
 *
 * This is the honest wrinkle, stated as a number. Latency is not a metric:
 * routing detours mean A→C is regularly slower than A→B→C, and wherever that
 * happens no set of positions on a flat page can be right about all three.
 */
export function triangleViolationRate(matrix: RttMatrix): number {
  const { size, values } = matrix;
  let pairs = 0;
  let violations = 0;
  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      const direct = values[i * size + j];
      if (!Number.isFinite(direct)) continue;
      pairs += 1;
      for (let k = 0; k < size; k += 1) {
        if (k === i || k === j) continue;
        const ik = values[i * size + k];
        const kj = values[k * size + j];
        if (!Number.isFinite(ik) || !Number.isFinite(kj)) continue;
        if (ik + kj < direct) {
          violations += 1;
          break;
        }
      }
    }
  }
  return pairs === 0 ? 0 : violations / pairs;
}
