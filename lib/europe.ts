/**
 * Which anchors count as European, and where they land on the plane.
 *
 * The country code alone is not enough: France, Spain and Portugal have
 * anchors in the Caribbean and the Indian Ocean, and Russia and Turkey reach
 * well into Asia. A generous bounding box drops those without hand-listing
 * them, and keeps the genuinely interesting edges — Iceland, the Azores,
 * Cyprus — that a tighter box would lose.
 */
const EUROPEAN_COUNTRIES = new Set([
  "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE",
  "DK", "EE", "ES", "FI", "FO", "FR", "GB", "GG", "GI", "GR", "HR", "HU",
  "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME",
  "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "RU", "SE", "SI", "SJ",
  "SK", "SM", "TR", "UA", "VA", "XK",
]);

const BOUNDS = {
  minLongitude: -32,
  maxLongitude: 45,
  minLatitude: 33,
  maxLatitude: 72,
};

export function isEuropean(
  country: string,
  latitude: number,
  longitude: number,
): boolean {
  return (
    EUROPEAN_COUNTRIES.has(country.toUpperCase()) &&
    longitude >= BOUNDS.minLongitude &&
    longitude <= BOUNDS.maxLongitude &&
    latitude >= BOUNDS.minLatitude &&
    latitude <= BOUNDS.maxLatitude
  );
}
