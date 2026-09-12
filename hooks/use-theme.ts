"use client";

import { useCallback, useState } from "react";
import type { Theme } from "@/lib/palette";

const STORAGE_KEY = "latency-theme";

/**
 * Reads the theme the inline script in app/layout.tsx already stamped onto
 * <html>, so the canvas draws in the right palette on the very first frame
 * rather than painting dark and then flipping.
 *
 * Read during the first render rather than in an effect after it: an effect
 * would mean one committed frame in the wrong palette. The prerendered HTML
 * cannot know the reader's theme, so anything rendered from this value carries
 * suppressHydrationWarning.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "dark";
    const stamped = document.documentElement.dataset.theme;
    return stamped === "light" ? "light" : "dark";
  });

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // A blocked localStorage is not a reason to refuse to change theme.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
