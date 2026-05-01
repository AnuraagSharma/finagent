"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates `delay` ms after the
 * last input change. Used to keep the analytics dashboard from firing a
 * network request on every keystroke in the filter inputs.
 */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
