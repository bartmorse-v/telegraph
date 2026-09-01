"use client";

import { useEffect, useRef } from "react";

/**
 * Polls only while there is something to watch.
 *
 * Passing `null` for the interval stops the timer entirely. Nothing here costs
 * API tokens, but a fixed 5-second poll running forever buries real events in
 * hundreds of no-op request lines — which makes the log useless exactly when
 * you need to watch something happen.
 */
export function usePoll(fn: () => void | Promise<void>, intervalMs: number | null): void {
  // Kept in a ref so a changing callback does not restart the timer, which
  // would otherwise fire a request on every render.
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    void saved.current();
    if (intervalMs === null) return;
    const timer = setInterval(() => void saved.current(), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
}
