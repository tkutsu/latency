/**
 * Where the map cannot hold.
 *
 * Every figure here is computed against measured pairs only. Entries the
 * shortest-path completion invented are excluded: scoring the embedding
 * against its own filler would flatter it.
 */
import { get, type RttMatrix } from "@/lib/matrix";
import type { Coordinates } from "@/lib/mds";
import { fibreFloorMs, haversineKm } from "@/lib/projection";
import type { WorstPair } from "@/lib/types";

const WORST_PAIRS_KEPT = 5;

export interface NodeResiduals {
  /** RMS gap between drawn distance and measured RTT, ms. */
  stress: number;
  /** Mean of (measured − drawn), ms. Positive: really further out than drawn. */
  bias: number;
  /** Median measured RTT over the fibre floor for the same distance. */
  detourRatio: number;
  measuredPairs: number;
  /** Indices into the node array, worst first. */
  worst: { index: number; measuredMs: number; drawnMs: number; km: number }[];
}

export interface Place {
  latitude: number;
  longitude: number;
}

export function residualsPerNode(
  measured: RttMatrix,
  embedded: Coordinates,
  places: Place[],
): NodeResiduals[] {
  const n = measured.size;
  const out: NodeResiduals[] = [];

  for (let i = 0; i < n; i += 1) {
    let squaredSum = 0;
    let signedSum = 0;
    let counted = 0;
    const ratios: number[] = [];
    const candidates: NodeResiduals["worst"] = [];

    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const measuredMs = get(measured, i, j);
      if (!Number.isFinite(measuredMs)) continue;

      const drawnMs = Math.hypot(
        embedded.x[i] - embedded.x[j],
        embedded.y[i] - embedded.y[j],
      );
      const gap = measuredMs - drawnMs;
      squaredSum += gap * gap;
      signedSum += gap;
      counted += 1;

      const km = haversineKm(
        places[i].latitude,
        places[i].longitude,
        places[j].latitude,
        places[j].longitude,
      );
      const floor = fibreFloorMs(km);
      // Anchors in the same building have no meaningful floor to divide by.
      if (floor > 0.5) ratios.push(measuredMs / floor);

      candidates.push({ index: j, measuredMs, drawnMs, km });
    }

    candidates.sort(
      (a, b) =>
        Math.abs(b.measuredMs - b.drawnMs) - Math.abs(a.measuredMs - a.drawnMs),
    );

    out.push({
      stress: counted === 0 ? 0 : Math.sqrt(squaredSum / counted),
      bias: counted === 0 ? 0 : signedSum / counted,
      detourRatio: median(ratios),
      measuredPairs: counted,
      worst: candidates.slice(0, WORST_PAIRS_KEPT),
    });
  }

  return out;
}

/** RMS gap over every measured pair: how much the whole map lies, in ms. */
export function totalStress(
  measured: RttMatrix,
  embedded: Coordinates,
): number {
  const n = measured.size;
  let squaredSum = 0;
  let counted = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const measuredMs = get(measured, i, j);
      if (!Number.isFinite(measuredMs)) continue;
      const drawnMs = Math.hypot(
        embedded.x[i] - embedded.x[j],
        embedded.y[i] - embedded.y[j],
      );
      const gap = measuredMs - drawnMs;
      squaredSum += gap * gap;
      counted += 1;
    }
  }
  return counted === 0 ? 0 : Math.sqrt(squaredSum / counted);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Turn residual indices into the ids the client reads. */
export function toWorstPairs(
  worst: NodeResiduals["worst"],
  ids: number[],
): WorstPair[] {
  return worst.map((pair) => ({
    id: ids[pair.index],
    measuredMs: round(pair.measuredMs, 2),
    drawnMs: round(pair.drawnMs, 2),
    km: Math.round(pair.km),
  }));
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
