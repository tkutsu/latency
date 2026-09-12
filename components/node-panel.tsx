"use client";

import { asn, km, ms, times } from "@/lib/format";
import { fibreFloorMs } from "@/lib/projection";
import type { LatencyNode } from "@/lib/types";

interface Props {
  node: LatencyNode | null;
  byId: Map<number, LatencyNode>;
  /** Kept open by a click, rather than following the cursor. */
  pinned: boolean;
  onClear: () => void;
}

/**
 * One anchor, read out. The worst pairs are the point of it: they name the
 * specific routes that stop the map from being true, which is more use than a
 * single stress figure.
 */
export function NodePanel({ node, byId, pinned, onClear }: Props) {
  if (!node) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Hover an anchor for where it sits, how far the map misses by, and the
        pairs it gets most wrong. Click to keep the panel open.
      </p>
    );
  }

  const displacement = Math.hypot(
    node.embedded.x - node.geographic.x,
    node.embedded.y - node.geographic.y,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {node.city || node.hostname}
            <span className="ml-2 font-normal text-muted">{node.country}</span>
          </h2>
          <p className="text-[0.7rem] text-muted">
            {node.hostname} · {asn(node.asn)}
          </p>
        </div>
        {pinned ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[0.7rem] text-muted underline hover:text-ink"
          >
            clear
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Figure
          label="Moved"
          value={ms(displacement)}
          hint="how far latency space puts it from its real position"
        />
        <Figure
          label="Map misses by"
          value={ms(node.stress)}
          hint="RMS gap across its measured pairs"
        />
        <Figure
          label="Really"
          value={`${node.bias >= 0 ? "+" : ""}${ms(node.bias)}`}
          hint={
            node.bias >= 0
              ? "further out than it looks"
              : "closer in than it looks"
          }
        />
        <Figure
          label="Path length"
          value={times(node.detourRatio)}
          hint="median RTT over the speed of light in fibre"
        />
      </dl>

      <div>
        <h3 className="text-[0.7rem] font-medium tracking-wide text-muted uppercase">
          Worst pairs
        </h3>
        <ul className="mt-1.5 space-y-1.5">
          {node.worstPairs.map((pair) => {
            const other = byId.get(pair.id);
            const gap = pair.measuredMs - pair.drawnMs;
            return (
              <li key={pair.id} className="text-xs leading-snug">
                <span className="text-ink">
                  {other?.city || other?.hostname || `anchor ${pair.id}`}
                </span>{" "}
                <span className="tabular text-muted">
                  {ms(pair.measuredMs)} measured, {ms(pair.drawnMs)} drawn
                  {" — "}
                  {gap >= 0 ? "short by " : "long by "}
                  {ms(Math.abs(gap))}
                </span>
                <span className="tabular block text-[0.68rem] text-muted">
                  {km(pair.km)} apart · fibre floor {ms(fibreFloorMs(pair.km))}
                  {" · "}
                  {times(pair.measuredMs / Math.max(fibreFloorMs(pair.km), 0.1))}
                  {" the floor"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <dt className="text-[0.7rem] text-muted">{label}</dt>
      <dd className="tabular text-sm text-ink">{value}</dd>
      <dd className="text-[0.68rem] leading-tight text-muted">{hint}</dd>
    </div>
  );
}
