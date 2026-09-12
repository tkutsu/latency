/**
 * One RIPE Atlas anchor, placed twice: where it is, and where the network
 * thinks it is.
 */
export interface LatencyNode {
  /** Atlas anchor id. */
  id: number;
  /** Anchor probe id — what the ping results are keyed by. */
  probeId: number;
  /** e.g. "gr-ath-as5408". */
  hostname: string;
  city: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** Autonomous system the anchor sits in. */
  asn: number | null;
  latitude: number;
  longitude: number;
  /**
   * True position, projected to the plane and scaled into milliseconds of
   * round trip at the speed of light in fibre — the same units the embedding
   * uses, so the two layouts are directly comparable.
   */
  geographic: Point;
  /** Where min-RTT to everything else says it belongs. */
  embedded: Point;
  /**
   * How badly the embedding fails this node: the RMS gap, in ms, between its
   * drawn distances and the measured RTTs. High means latency space could not
   * hold it flat.
   */
  stress: number;
  /**
   * Signed mean gap, in ms. Positive: the node is drawn closer than its
   * measurements want, so it is really further out than it looks. Negative:
   * drawn too far.
   */
  bias: number;
  /**
   * Median measured RTT divided by the fastest RTT physics allows over the
   * same distances. 1 would be light down a straight fibre; real paths are
   * two to four times that.
   */
  detourRatio: number;
  /** How many of the other nodes this one has a measured RTT with. */
  measuredPairs: number;
  /** The pairs this node's placement gets most wrong, worst first. */
  worstPairs: WorstPair[];
}

export interface Point {
  x: number;
  y: number;
}

/** A pair whose drawn distance is a long way from its measured RTT. */
export interface WorstPair {
  /** Anchor id of the other end. */
  id: number;
  /** Measured min RTT, ms. */
  measuredMs: number;
  /** Distance between the two embedded positions, in ms. */
  drawnMs: number;
  /** Great-circle distance, km. */
  km: number;
}

export interface SnapshotMeta {
  /** When the mesh was read, ISO. */
  observedAt: string;
  /** Anchors that survived the coverage cut. */
  nodeCount: number;
  /** Anchors dropped for too few usable measurements. */
  droppedCount: number;
  /** Measured, symmetrised anchor pairs the embedding was fitted to. */
  pairCount: number;
  /** RMS gap over every measured pair, in ms: how much the map lies overall. */
  totalStress: number;
  /**
   * Share of measured triples where going via a third anchor beats the direct
   * path. This is why no flat map of latency can be exact.
   */
  triangleViolationRate: number;
  /** Scale used to put geography in milliseconds: km per ms of round trip. */
  kmPerMs: number;
}

export interface Snapshot extends SnapshotMeta {
  nodes: LatencyNode[];
}

/** `public/data/index.json` — every snapshot kept, oldest first. */
export interface SnapshotIndex {
  snapshots: { file: string; observedAt: string; nodeCount: number }[];
}
