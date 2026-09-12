"use client";

import { ms, observedOn, percent, times } from "@/lib/format";
import type { Summary } from "@/lib/summary";

/**
 * Four numbers, because the map on its own is a shape and a shape can be
 * argued with. These are what it rests on.
 */
export function SummaryBar({ summary }: { summary: Summary }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      <Stat
        value={times(summary.medianDetourRatio)}
        label="the speed of light"
        hint="median path, against a straight fibre"
      />
      <Stat
        value={ms(summary.totalStress)}
        label="the map is off by"
        hint="RMS over every measured pair"
      />
      <Stat
        value={percent(summary.triangleViolationRate)}
        label="of pairs have a shortcut"
        hint="a third anchor gets there faster"
      />
      <Stat
        value={String(summary.nodeCount)}
        label="anchors"
        hint={observedOn(summary.observedAt)}
      />
    </dl>
  );
}

function Stat({
  value,
  label,
  hint,
}: {
  value: string;
  label: string;
  hint: string;
}) {
  return (
    <div>
      <dd className="text-xl leading-none font-semibold text-ink">{value}</dd>
      <dt className="mt-1 text-xs text-ink">{label}</dt>
      <dd className="text-[0.68rem] leading-tight text-muted">{hint}</dd>
    </div>
  );
}
