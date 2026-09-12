"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

// useLayoutEffect warns during the static export's prerender, where there is no
// layout to read anyway.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The element's CSS pixel size, tracked as it resizes.
 *
 * Measured synchronously on mount rather than waiting for the observer's first
 * delivery: ResizeObserver reports on the next frame, so a canvas that sizes
 * itself from this would otherwise paint one frame at nothing.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const box = element.getBoundingClientRect();
      setSize((current) =>
        current.width === box.width && current.height === box.height
          ? current
          : { width: box.width, height: box.height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
