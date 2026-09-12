"use client";

interface Props {
  morph: number;
  onMorph: (value: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
}

/**
 * The whole interaction. Left is where the anchors are, right is where the
 * network puts them; everything between is a linear blend, so a slow drag
 * reads as the continent deforming rather than as two pictures cutting.
 */
export function MorphControl({ morph, onMorph, playing, onTogglePlay }: Props) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-pressed={playing}
        className="w-20 shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-signal hover:text-signal"
      >
        {playing ? "Pause" : "Play"}
      </button>

      <div className="flex-1">
        <div className="flex justify-between text-[0.7rem] font-medium tracking-wide text-muted uppercase">
          <span className={morph < 0.5 ? "text-ink" : undefined}>
            Geography
          </span>
          <span className={morph >= 0.5 ? "text-ink" : undefined}>Latency</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.002}
          value={morph}
          onChange={(event) => onMorph(Number(event.target.value))}
          className="morph-range mt-1"
          aria-label="Morph from geographic positions to latency positions"
          aria-valuetext={`${Math.round(morph * 100)}% latency space`}
        />
      </div>

      <span className="tabular w-12 shrink-0 text-right text-xs text-muted">
        {Math.round(morph * 100)}%
      </span>
    </div>
  );
}
