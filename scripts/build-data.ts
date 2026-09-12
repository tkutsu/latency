/**
 * Assembles the snapshot the site draws, and archives it.
 *
 * Walks the RIPE Atlas anchoring mesh, folds ~300,000 pings into a min-RTT
 * matrix over the European anchors, solves for the positions that matrix
 * implies, and writes the result reduced to coordinates — geographic and
 * embedded — plus the residual each node carries.
 *
 * Snapshots are kept rather than overwritten: the network reshaping itself
 * over time is the interesting mode, and the raw mesh is far too expensive to
 * go back and re-read.
 *
 * Run with: pnpm build:data
 * Set ATLAS_CACHE=.cache/atlas to reuse fetched columns while iterating.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import {
  CONCURRENCY,
  fetchLatestPings,
  fetchLiveAnchors,
  fetchMeshPingMeasurements,
  mapWithConcurrency,
  type AtlasAnchor,
  type PingToTarget,
} from "@/lib/atlas/client";
import { isEuropean } from "@/lib/europe";
import {
  completeByShortestPath,
  countMeasuredPairs,
  createMatrix,
  set,
  submatrix,
  symmetrise,
  triangleViolationRate,
  wellCoveredIndices,
} from "@/lib/matrix";
import { alignTo } from "@/lib/align";
import { embed, type Coordinates } from "@/lib/mds";
import { centreOf, KM_PER_MS, projectToMs } from "@/lib/projection";
import { residualsPerNode, round, totalStress, toWorstPairs } from "@/lib/stress";
import type { LatencyNode, Snapshot, SnapshotIndex } from "@/lib/types";

const DATA_DIR = new URL("../public/data/", import.meta.url);
const SNAPSHOT_DIR = new URL("snapshots/", DATA_DIR);
const CACHE_DIR = process.env.ATLAS_CACHE;

/**
 * An anchor needs measurements to most of the mesh before its position means
 * anything. Below this it is placed by too few constraints and would drift
 * wherever the solver liked, so it is dropped rather than drawn as a guess.
 */
const MIN_COVERAGE = 0.6;

/**
 * Floors that fail the build instead of publishing over a good deployment.
 * Europe has had 500-odd live anchors for years; a tenth of that means Atlas
 * answered with something broken.
 */
const LEAST_CREDIBLE_NODES = 150;
const LEAST_CREDIBLE_COVERAGE = 0.5;

async function main() {
  const observedAt = new Date().toISOString();
  console.log("Reading the Atlas anchor list…");
  const [anchors, meshPings] = await Promise.all([
    fetchLiveAnchors(),
    fetchMeshPingMeasurements(),
  ]);

  const european = anchors
    .filter((anchor) => {
      const [longitude, latitude] = anchor.geometry!.coordinates;
      return isEuropean(anchor.country!, latitude, longitude);
    })
    // Deterministic order, so a rebuild that changes nothing writes the same
    // file.
    .sort((a, b) => a.id - b.id)
    .filter((anchor) => meshPings.has(anchor.id));

  console.log(
    `${anchors.length} live anchors, ${european.length} in Europe with a mesh ping`,
  );
  if (european.length < LEAST_CREDIBLE_NODES) {
    throw new Error(`Only ${european.length} European anchors came back`);
  }

  // Results are keyed by probe id, not anchor id.
  const rowOf = new Map<number, number>();
  european.forEach((anchor, index) => rowOf.set(anchor.probe, index));

  console.log(`Reading ${european.length} mesh columns…`);
  const directed = createMatrix(european.length);
  let done = 0;
  await mapWithConcurrency(european, CONCURRENCY, async (target, column) => {
    const pings = await readColumn(meshPings.get(target.id)!);
    for (const ping of pings) {
      const row = rowOf.get(ping.probeId);
      if (row === undefined || row === column || ping.minMs === null) continue;
      // Row pings column: the source is the probe, the target is this anchor.
      set(directed, row, column, ping.minMs);
    }
    done += 1;
    if (done % 50 === 0) console.log(`  ${done}/${european.length}`);
  });

  const measured = symmetrise(directed);
  const kept = wellCoveredIndices(measured, MIN_COVERAGE);
  const dropped = european.length - kept.length;
  console.log(`${kept.length} anchors well covered, ${dropped} dropped`);
  if (kept.length < LEAST_CREDIBLE_NODES) {
    throw new Error(`Only ${kept.length} anchors had usable coverage`);
  }

  const nodes = kept.map((index) => european[index]);
  const trimmed = submatrix(measured, kept);
  const pairCount = countMeasuredPairs(trimmed);
  const possiblePairs = (kept.length * (kept.length - 1)) / 2;
  const coverage = pairCount / possiblePairs;
  console.log(
    `${pairCount} measured pairs (${(coverage * 100).toFixed(1)}% of the mesh)`,
  );
  if (coverage < LEAST_CREDIBLE_COVERAGE) {
    throw new Error(`Mesh coverage of ${(coverage * 100).toFixed(1)}% is too thin`);
  }

  console.log("Embedding…");
  const geographic = projectAll(nodes);
  const solved = embed(completeByShortestPath(trimmed));
  const { coordinates: embedded, alignment } = alignTo(solved, geographic);
  console.log(
    `Oriented to geography: ${((alignment.angle * 180) / Math.PI).toFixed(1)}°${
      alignment.reflected ? ", mirrored" : ""
    }`,
  );

  console.log("Scoring the residuals…");
  const places = nodes.map((anchor) => toPlace(anchor));
  const residuals = residualsPerNode(trimmed, embedded, places);
  const ids = nodes.map((anchor) => anchor.id);
  const violations = triangleViolationRate(trimmed);
  const stress = totalStress(trimmed, embedded);
  console.log(
    `RMS gap ${stress.toFixed(2)} ms; ${(violations * 100).toFixed(1)}% of pairs beaten by a detour`,
  );

  const snapshot: Snapshot = {
    observedAt,
    nodeCount: nodes.length,
    droppedCount: dropped,
    pairCount,
    totalStress: round(stress, 3),
    triangleViolationRate: round(violations, 4),
    kmPerMs: KM_PER_MS,
    nodes: nodes.map((anchor, index): LatencyNode => {
      const place = places[index];
      const residual = residuals[index];
      return {
        id: anchor.id,
        probeId: anchor.probe,
        hostname: anchor.hostname,
        city: (anchor.city ?? "").trim(),
        country: (anchor.country ?? "").toUpperCase(),
        asn: anchor.as_v4,
        latitude: round(place.latitude, 4),
        longitude: round(place.longitude, 4),
        geographic: {
          x: round(geographic.x[index], 2),
          y: round(geographic.y[index], 2),
        },
        embedded: {
          x: round(embedded.x[index], 2),
          y: round(embedded.y[index], 2),
        },
        stress: round(residual.stress, 2),
        bias: round(residual.bias, 2),
        detourRatio: round(residual.detourRatio, 2),
        measuredPairs: residual.measuredPairs,
        worstPairs: toWorstPairs(residual.worst, ids),
      };
    }),
  };

  await writeSnapshot(snapshot);
  console.log(`Wrote ${snapshot.nodeCount} nodes for ${observedAt}`);
}

function toPlace(anchor: AtlasAnchor) {
  const [longitude, latitude] = anchor.geometry!.coordinates;
  return { latitude, longitude };
}

function projectAll(anchors: AtlasAnchor[]): Coordinates {
  const places = anchors.map(toPlace);
  const centre = centreOf(places);
  const x = new Float64Array(places.length);
  const y = new Float64Array(places.length);
  places.forEach((place, index) => {
    const point = projectToMs(place.latitude, place.longitude, centre);
    x[index] = point.x;
    y[index] = point.y;
  });
  return { x, y };
}

/** Columns are cached during development; a rebuild in CI always refetches. */
async function readColumn(measurementId: number): Promise<PingToTarget[]> {
  if (!CACHE_DIR) return fetchLatestPings(measurementId);
  const path = new URL(`${measurementId}.json`, `file://${process.cwd()}/${CACHE_DIR}/`);
  try {
    return JSON.parse(await readFile(path, "utf8")) as PingToTarget[];
  } catch {
    const pings = await fetchLatestPings(measurementId);
    await mkdir(new URL(".", path), { recursive: true });
    await writeFile(path, JSON.stringify(pings));
    return pings;
  }
}

async function writeSnapshot(snapshot: Snapshot) {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const day = snapshot.observedAt.slice(0, 10);
  const file = `${day}.json`;
  const body = JSON.stringify(snapshot);
  await writeFile(new URL(file, SNAPSHOT_DIR), body);
  // What the client loads. A copy rather than a redirect, so the page needs
  // one request and no knowledge of the archive.
  await writeFile(new URL("latest.json", DATA_DIR), body);

  const files = (await readdir(SNAPSHOT_DIR))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const index: SnapshotIndex = {
    snapshots: await Promise.all(
      files.map(async (name) => {
        const kept = JSON.parse(
          await readFile(new URL(name, SNAPSHOT_DIR), "utf8"),
        ) as Snapshot;
        return {
          file: `snapshots/${name}`,
          observedAt: kept.observedAt,
          nodeCount: kept.nodeCount,
        };
      }),
    ),
  };
  await writeFile(new URL("index.json", DATA_DIR), JSON.stringify(index));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
