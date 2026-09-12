"use client";

import { useEffect, useState } from "react";
import type { Snapshot } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "ready"; snapshot: Snapshot }
  | { status: "error"; message: string };

/** Loads the snapshot baked into public/data by scripts/build-data.ts. */
export function useSnapshot(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Relative, so the export works from a domain root or a subpath.
        const response = await fetch("data/latest.json");
        if (!response.ok) {
          throw new Error(`snapshot responded with ${response.status}`);
        }
        const snapshot = (await response.json()) as Snapshot;
        if (!cancelled) setState({ status: "ready", snapshot });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "unknown error",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
