export function ms(value: number, digits = 1): string {
  return `${value.toFixed(digits)} ms`;
}

export function times(value: number): string {
  return `${value.toFixed(2)}×`;
}

export function percent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function km(value: number): string {
  return `${Math.round(value).toLocaleString("en-GB")} km`;
}

export function observedOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function asn(value: number | null): string {
  return value === null ? "unknown AS" : `AS${value}`;
}
