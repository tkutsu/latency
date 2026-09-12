"use client";

import { useMemo, useState } from "react";
import { Legend } from "@/components/legend";
import { LatencyCanvas } from "@/components/latency-canvas";
import { MorphControl } from "@/components/morph-control";
import { NodePanel } from "@/components/node-panel";
import { StressTable } from "@/components/stress-table";
import { SummaryBar } from "@/components/summary-bar";
import { useMorph } from "@/hooks/use-morph";
import { useSnapshot } from "@/hooks/use-snapshot";
import { useTheme } from "@/hooks/use-theme";
import { landmarkLabels } from "@/lib/labels";
import { summarise } from "@/lib/summary";

export function LatencyApp() {
  const state = useSnapshot();
  const { theme, toggle: toggleTheme } = useTheme();
  const { morph, setMorph, playing, togglePlay } = useMorph();
  const [showStress, setShowStress] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const snapshot = state.status === "ready" ? state.snapshot : null;
  // Memoised because everything below keys off it, and a fresh [] each render
  // would rebuild the labels and the id index on every pixel of the morph.
  const nodes = useMemo(() => snapshot?.nodes ?? [], [snapshot]);
  const labels = useMemo(() => landmarkLabels(nodes), [nodes]);
  const summary = useMemo(
    () => (snapshot ? summarise(snapshot) : null),
    [snapshot],
  );
  const byId = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  // The cursor wins over the pin while it is over the map.
  const activeIndex = hovered ?? selected;
  const activeNode = activeIndex === null ? null : nodes[activeIndex];

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            Latency Space
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            A map of Europe where distance is network latency, not geography.
            Drag the slider and the continent becomes the shape the internet
            actually has — measured anchor to anchor across the RIPE Atlas mesh.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          // The prerender cannot know which theme the reader has.
          suppressHydrationWarning
          className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs text-muted transition-colors hover:border-signal hover:text-signal"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      {summary ? <SummaryBar summary={summary} /> : null}

      <div className="grid flex-1 gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="flex min-h-[30rem] flex-col gap-3 lg:min-h-[44rem]">
          <div className="relative flex-1 overflow-hidden rounded-xl border border-hairline">
            {state.status === "loading" ? (
              <p className="absolute inset-0 grid place-items-center text-sm text-muted">
                Reading the mesh…
              </p>
            ) : null}
            {state.status === "error" ? (
              <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted">
                The snapshot could not be loaded ({state.message}).
              </p>
            ) : null}
            {summary ? (
              <LatencyCanvas
                nodes={nodes}
                labels={labels}
                morph={morph}
                theme={theme}
                showStress={showStress}
                stressDomain={summary.stressDomain}
                activeIndex={activeIndex}
                onHover={setHovered}
                onSelect={setSelected}
              />
            ) : null}
          </div>

          <MorphControl
            morph={morph}
            onMorph={setMorph}
            playing={playing}
            onTogglePlay={togglePlay}
          />

          {summary ? (
            <Legend
              theme={theme}
              showStress={showStress}
              onToggle={() => setShowStress((current) => !current)}
              domain={summary.stressDomain}
            />
          ) : null}
        </section>

        <aside className="flex flex-col gap-5 lg:border-l lg:border-hairline lg:pl-5">
          <NodePanel
            node={activeNode}
            byId={byId}
            pinned={hovered === null && selected !== null}
            onClear={() => setSelected(null)}
          />
        </aside>
      </div>

      {nodes.length > 0 ? (
        <StressTable nodes={nodes} onSelect={setSelected} />
      ) : null}

      <footer className="border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
        <p>
          Positions on the right of the slider solve for a plane where the gap
          between two anchors is the round trip measured between them. Positions
          on the left are where the anchors are, converted to milliseconds at the
          speed of light in fibre — 200,000 km/s, there and back, so 100 km reads
          as 1 ms. That is the floor physics sets, which is why nothing ever
          moves inward.
        </p>
        <p className="mt-2">
          No arrangement of dots can be right about all of it. Thirty anchors in
          Amsterdam sit under a millisecond apart and still disagree by fifteen
          about how far away Athens is, so the triangle inequality breaks before
          the map is even drawn. The stress layer is where that lands.
        </p>
        <p className="mt-2">
          Data: the{" "}
          <a
            className="underline hover:text-ink"
            href="https://atlas.ripe.net/"
            rel="noreferrer"
            target="_blank"
          >
            RIPE Atlas
          </a>{" "}
          anchoring mesh, read at build time. Source on{" "}
          <a
            className="underline hover:text-ink"
            href="https://github.com/tkutsu/latency"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
