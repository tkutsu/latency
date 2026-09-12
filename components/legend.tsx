"use client";

import { stressRamp, type StressDomain, type Theme } from "@/lib/palette";

interface Props {
  theme: Theme;
  showStress: boolean;
  onToggle: () => void;
  domain: StressDomain;
}

/**
 * The stress layer's key. Colour encodes one magnitude — how far a node's drawn
 * distances sit from its measured ones — so the legend is a ramp with its two
 * ends labelled. Both ends saturate, so the labels carry the inequality.
 */
export function Legend({ theme, showStress, onToggle, domain }: Props) {
  const ramp = stressRamp(theme);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          checked={showStress}
          onChange={onToggle}
          className="accent-signal"
        />
        Stress layer
      </label>

      {showStress ? (
        <div className="flex items-center gap-2">
          <span className="tabular text-[0.7rem] text-muted">
            ≤{domain.low} ms
          </span>
          <div
            className="h-2 w-32 rounded-full"
            style={{
              backgroundImage: `linear-gradient(to right, ${ramp.join(", ")})`,
            }}
          />
          <span className="tabular text-[0.7rem] text-muted">
            ≥{domain.high} ms off
          </span>
        </div>
      ) : null}
    </div>
  );
}
