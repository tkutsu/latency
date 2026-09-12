/**
 * Which nodes get their name drawn.
 *
 * A label on every anchor would be 523 labels over a cloud that is mostly
 * Frankfurt, so instead a fixed short list of cities carries the map's
 * orientation — enough to see that the north-east corner is Helsinki and
 * Moscow both before and after the morph. The list is fixed rather than
 * derived so the same places stay labelled between snapshots.
 */
import type { LatencyNode } from "@/lib/types";

/**
 * Spread around the edges and the core, because the job is orientation. Aliases
 * cover the ways Atlas spells a place: operators type the city field by hand,
 * so Frankfurt arrives as "Frankfurt", "Frankfurt am Main" and "Frankfurt,
 * Germany".
 */
const LANDMARKS: { label: string; matches: string[] }[] = [
  { label: "Amsterdam", matches: ["amsterdam"] },
  { label: "Frankfurt", matches: ["frankfurt"] },
  { label: "London", matches: ["london"] },
  { label: "Paris", matches: ["paris"] },
  { label: "Madrid", matches: ["madrid"] },
  { label: "Milan", matches: ["milan", "milano"] },
  { label: "Stockholm", matches: ["stockholm"] },
  { label: "Helsinki", matches: ["helsinki"] },
  { label: "Moscow", matches: ["moscow", "moskva"] },
  { label: "Istanbul", matches: ["istanbul"] },
  { label: "Athens", matches: ["athens", "athina"] },
  { label: "Lisbon", matches: ["lisbon", "lisboa"] },
  { label: "Reykjavík", matches: ["reykjavik"] },
  { label: "Dublin", matches: ["dublin"] },
  { label: "Warsaw", matches: ["warsaw", "warszawa"] },
  { label: "Bucharest", matches: ["bucharest", "bucuresti"] },
  { label: "Vienna", matches: ["vienna", "wien"] },
  { label: "Kyiv", matches: ["kyiv", "kiev"] },
  { label: "Sofia", matches: ["sofia"] },
  { label: "Oslo", matches: ["oslo"] },
];

/** Lowercase, unaccented, so "Düsseldorf" and "Dusseldorf" are one place. */
export function normaliseCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface Label {
  /** Index into the node array. */
  index: number;
  text: string;
}

/**
 * One node per landmark: the anchor in that city the embedding fits best.
 *
 * A label's job here is orientation, so it has to sit on a node that is where
 * the city is. Picking by measurement count instead put "Lisbon" on the one
 * Lisbon anchor the layout misses by 22 ms, which dragged the name clean
 * across the map and made the picture look broken when it was not.
 */
export function landmarkLabels(nodes: LatencyNode[]): Label[] {
  const labels: Label[] = [];
  for (const landmark of LANDMARKS) {
    let best = -1;
    for (let index = 0; index < nodes.length; index += 1) {
      const city = normaliseCity(nodes[index].city);
      if (!landmark.matches.some((match) => city.startsWith(match))) continue;
      if (best === -1 || nodes[index].stress < nodes[best].stress) best = index;
    }
    if (best !== -1) labels.push({ index: best, text: landmark.label });
  }
  return labels;
}
