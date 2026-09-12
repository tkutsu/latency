"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Seconds for a full sweep from geography to latency space. */
const SWEEP_SECONDS = 3.2;

/**
 * The morph value and its animation.
 *
 * The page introduces itself with one sweep out to latency space and then stops
 * — the deformation is the argument, and it should be seen once without being
 * asked for. After that it only moves when the reader moves it, or loops while
 * Play is held on. Touching the slider takes over from the animation, because a
 * control that fights the hand on it is broken.
 */
export function useMorph(): {
  morph: number;
  setMorph: (value: number) => void;
  playing: boolean;
  togglePlay: () => void;
} {
  const [morph, setMorphState] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The animation reads the current value every frame, and reading it from
  // state inside the loop would mean either a stale closure or restarting the
  // loop on every frame. The ref is the loop's copy; state is the render's.
  const current = useRef(0);
  // True for the intro only: the sweep parks at latency space instead of
  // bouncing back.
  const stopAtEnd = useRef(true);
  const direction = useRef(1);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      stopAtEnd.current = false;
      return;
    }
    const timer = window.setTimeout(() => setPlaying(true), 550);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();

    const step = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;

      let next = current.current + (elapsed / SWEEP_SECONDS) * direction.current;
      if (next >= 1) {
        next = 1;
        if (stopAtEnd.current) {
          stopAtEnd.current = false;
          setPlaying(false);
        } else {
          direction.current = -1;
        }
      } else if (next <= 0) {
        next = 0;
        direction.current = 1;
      }

      current.current = next;
      setMorphState(next);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const setMorph = useCallback((value: number) => {
    stopAtEnd.current = false;
    setPlaying(false);
    current.current = value;
    setMorphState(value);
  }, []);

  const togglePlay = useCallback(() => {
    stopAtEnd.current = false;
    setPlaying((current) => !current);
  }, []);

  return { morph, setMorph, playing, togglePlay };
}
