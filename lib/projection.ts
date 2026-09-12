/**
 * Geography in milliseconds.
 *
 * The morph only means anything if both layouts are in the same units, so
 * geography is converted into the round-trip time light would need to cross
 * it. Light in fibre runs at about two thirds of c — 200,000 km/s — and a
 * ping covers the distance twice, which puts one millisecond of RTT at 100 km
 * of ground. Every "ms" on the geographic side of the morph is therefore the
 * floor physics sets, not an observation.
 */
export const KM_PER_MS = 100;

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km. */
export function haversineKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The fastest round trip a straight fibre over that distance could manage. */
export function fibreFloorMs(km: number): number {
  return km / KM_PER_MS;
}

export interface ProjectionCentre {
  latitude: number;
  longitude: number;
}

/**
 * Azimuthal equidistant, centred on the middle of the anchor cloud. Distances
 * from the centre are exact and distortion elsewhere stays mild at
 * continental scale — which matters here, because these coordinates are the
 * thing the latency embedding gets compared against. Output is in ms.
 */
export function projectToMs(
  latitude: number,
  longitude: number,
  centre: ProjectionCentre,
): { x: number; y: number } {
  const toRad = Math.PI / 180;
  const lat = latitude * toRad;
  const lon = longitude * toRad;
  const lat0 = centre.latitude * toRad;
  const lon0 = centre.longitude * toRad;

  const cosC =
    Math.sin(lat0) * Math.sin(lat) +
    Math.cos(lat0) * Math.cos(lat) * Math.cos(lon - lon0);
  const c = Math.acos(Math.max(-1, Math.min(1, cosC)));
  // k → 1 at the centre, where the 0/0 would otherwise bite.
  const k = Math.abs(c) < 1e-9 ? 1 : c / Math.sin(c);

  const xKm = EARTH_RADIUS_KM * k * Math.cos(lat) * Math.sin(lon - lon0);
  const yKm =
    EARTH_RADIUS_KM *
    k *
    (Math.cos(lat0) * Math.sin(lat) -
      Math.sin(lat0) * Math.cos(lat) * Math.cos(lon - lon0));

  // Screen y grows downward, so north is negative.
  return { x: xKm / KM_PER_MS, y: -yKm / KM_PER_MS };
}

/** Mean of the coordinates, used as the projection centre. */
export function centreOf(
  points: { latitude: number; longitude: number }[],
): ProjectionCentre {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const sum = points.reduce(
    (acc, p) => ({
      latitude: acc.latitude + p.latitude,
      longitude: acc.longitude + p.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  return {
    latitude: sum.latitude / points.length,
    longitude: sum.longitude / points.length,
  };
}
