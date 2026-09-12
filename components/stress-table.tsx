"use client";

import { asn, ms, times } from "@/lib/format";
import type { LatencyNode } from "@/lib/types";

interface Props {
  nodes: LatencyNode[];
  onSelect: (index: number) => void;
}

const ROWS = 25;

/**
 * The map's numbers as a table. This is the keyboard and screen-reader route
 * into the same data — a canvas cannot be tabbed through — and it is also just
 * the fastest way to read the ranking the colour ramp only suggests.
 */
export function StressTable({ nodes, onSelect }: Props) {
  const ranked = nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => b.node.stress - a.node.stress)
    .slice(0, ROWS);

  return (
    <details className="border-t border-hairline pt-4">
      <summary className="cursor-pointer text-xs font-medium text-ink">
        The {ROWS} anchors the map fits worst
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">
            Anchors ranked by how far the embedding&rsquo;s distances sit from
            their measured round-trip times.
          </caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 pr-4 font-medium">
                Anchor
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Off by
              </th>
              <th scope="col" className="py-1 pr-4 font-medium">
                Really
              </th>
              <th scope="col" className="py-1 font-medium">
                Path length
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ node, index }) => (
              <tr key={node.id} className="border-t border-hairline">
                <th scope="row" className="py-1.5 pr-4 font-normal">
                  <button
                    type="button"
                    onClick={() => onSelect(index)}
                    className="text-left text-ink hover:text-signal hover:underline"
                  >
                    {node.city || node.hostname}
                    <span className="ml-1.5 text-muted">
                      {node.country} · {asn(node.asn)}
                    </span>
                  </button>
                </th>
                <td className="tabular py-1.5 pr-4 text-ink">
                  {ms(node.stress)}
                </td>
                <td className="tabular py-1.5 pr-4 text-muted">
                  {node.bias >= 0 ? "+" : ""}
                  {ms(node.bias)}
                </td>
                <td className="tabular py-1.5 text-muted">
                  {times(node.detourRatio)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
