/**
 * Reading the RIPE Atlas anchoring mesh.
 *
 * Every endpoint used here is open — no API key, because keys are only needed
 * to *create* measurements, and this project only reads ones that already
 * exist. All of it runs at build time; none of it is reachable from the
 * browser. The mesh costs several hundred requests to assemble, which is fine
 * once a week from CI and would be abuse from a page load.
 *
 * There is no endpoint that returns the matrix. It is assembled from three:
 *
 *   /anchors/                       — who the anchors are and where they sit
 *   /anchor-measurements/           — which measurement is the mesh ping
 *   /measurements/<id>/latest/      — one column: everyone's ping to one anchor
 */
import { z } from "zod";

const BASE = "https://atlas.ripe.net/api/v2";
const PAGE_SIZE = 500;
const TIMEOUT_MS = 120_000;
const ATTEMPTS = 4;
const RETRY_DELAY_MS = 2_000;

/**
 * How many columns to have in flight at once. Atlas has no published rate
 * limit on reads, and its fair-use terms ask for restraint rather than a
 * number; six keeps a full rebuild to a few minutes without ever looking like
 * a flood.
 */
export const CONCURRENCY = 6;

const anchorSchema = z.object({
  id: z.number(),
  probe: z.number(),
  fqdn: z.string(),
  hostname: z.string(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  as_v4: z.number().nullable(),
  as_v6: z.number().nullable(),
  is_disabled: z.boolean(),
  date_decommissioned: z.string().nullable(),
  geometry: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]).rest(z.number()),
    })
    .nullable(),
});

export type AtlasAnchor = z.infer<typeof anchorSchema>;

const anchorMeasurementSchema = z.object({
  is_mesh: z.boolean(),
  is_active: z.boolean(),
  type: z.string(),
  /** ".../anchors/937/" */
  target: z.string(),
  /** ".../measurements/7714918/" */
  measurement: z.string(),
});

const measurementSchema = z.object({
  id: z.number(),
  af: z.number().nullable(),
});

/**
 * One ping result. `min` is −1 when every packet was lost, and the whole field
 * is absent on an error result, so it has to be optional as well as nullable.
 */
const pingResultSchema = z.object({
  prb_id: z.number(),
  min: z.number().nullable().optional(),
});

function pagedSchema<T extends z.ZodType>(results: T) {
  return z.object({
    count: z.number(),
    next: z.string().nullable(),
    results: z.array(results),
  });
}

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "latency-space/0.1 (+https://latency.themos.dev)",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Atlas responded with status ${response.status}`);
      }
      if (!response.ok) {
        // A 4xx that is not rate limiting will not fix itself.
        throw Object.assign(
          new Error(`Atlas responded with status ${response.status}`),
          { fatal: true },
        );
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof Error && "fatal" in error) throw error;
      lastError = error;
      // Back off, since a 429 or a 503 means asking again immediately is worse
      // than waiting.
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw new Error(`Atlas request failed after ${ATTEMPTS} attempts: ${url}`, {
    cause: lastError,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Walk every page of a paginated endpoint. */
async function fetchAllPages<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.infer<T>[]> {
  const results: z.infer<T>[] = [];
  let url: string | null = `${BASE}${path}?page_size=${PAGE_SIZE}`;
  while (url) {
    const page = pagedSchema(schema).parse(await fetchJson(url));
    results.push(...page.results);
    url = page.next;
  }
  return results;
}

/** Anchors that are still alive and have a position. */
export async function fetchLiveAnchors(): Promise<AtlasAnchor[]> {
  const anchors = await fetchAllPages("/anchors/", anchorSchema);
  return anchors.filter(
    (anchor) =>
      !anchor.is_disabled &&
      anchor.date_decommissioned === null &&
      anchor.geometry !== null &&
      anchor.country !== null,
  );
}

/**
 * Target anchor id → the IPv4 mesh ping measurement aimed at it.
 *
 * `/anchor-measurements/` cannot be filtered by type — the parameter is
 * silently ignored — so all ~12,700 entries come back and the filtering
 * happens here. Each anchor has four mesh measurements (ping and traceroute,
 * v4 and v6) and the endpoint does not say which address family, so the
 * candidate ids are resolved in bulk against `/measurements/`. IPv4 is the
 * choice because every anchor has it where 7% of the European ones have no
 * IPv6 at all, and mixing the two would put two different networks on one map.
 */
export async function fetchMeshPingMeasurements(): Promise<Map<number, number>> {
  const entries = await fetchAllPages(
    "/anchor-measurements/",
    anchorMeasurementSchema,
  );

  const candidates = new Map<number, number[]>();
  for (const entry of entries) {
    if (!entry.is_mesh || !entry.is_active || entry.type !== "ping") continue;
    const target = idFromUrl(entry.target);
    const measurement = idFromUrl(entry.measurement);
    if (target === null || measurement === null) continue;
    const list = candidates.get(target) ?? [];
    list.push(measurement);
    candidates.set(target, list);
  }

  const families = await fetchAddressFamilies(
    [...candidates.values()].flat(),
  );

  const chosen = new Map<number, number>();
  for (const [target, measurements] of candidates) {
    const ipv4 = measurements.filter((id) => families.get(id) === 4);
    // Lowest id, so the pick is stable when an anchor has been re-measured.
    if (ipv4.length > 0) chosen.set(target, Math.min(...ipv4));
  }
  return chosen;
}

/** `id__in` takes a batch, which turns ~1,100 lookups into a handful. */
async function fetchAddressFamilies(
  ids: number[],
): Promise<Map<number, number>> {
  const families = new Map<number, number>();
  const batchSize = 200;
  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    const url = `${BASE}/measurements/?id__in=${batch.join(",")}&fields=id,af&page_size=${batchSize}`;
    const page = pagedSchema(measurementSchema).parse(await fetchJson(url));
    for (const measurement of page.results) {
      if (measurement.af !== null) families.set(measurement.id, measurement.af);
    }
  }
  return families;
}

export interface PingToTarget {
  probeId: number;
  /** Min RTT in ms; null where nothing came back. */
  minMs: number | null;
}

/**
 * One column of the matrix: the most recent ping every anchor made to this
 * one. `latest/` is a single request per target, which is what makes a full
 * mesh affordable — the alternative, the results endpoint with a time window,
 * is an order of magnitude more data for the same answer.
 */
export async function fetchLatestPings(
  measurementId: number,
): Promise<PingToTarget[]> {
  const raw = await fetchJson(`${BASE}/measurements/${measurementId}/latest/`);
  const rows = z.array(pingResultSchema).parse(raw);
  return rows.map((row) => ({
    probeId: row.prb_id,
    // −1 means total packet loss, which is not a distance.
    minMs:
      row.min === null || row.min === undefined || row.min < 0 ? null : row.min,
  }));
}

function idFromUrl(url: string): number | null {
  const match = /\/(\d+)\/?$/.exec(url);
  return match ? Number(match[1]) : null;
}

/** Run `task` over `items`, `limit` at a time, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
