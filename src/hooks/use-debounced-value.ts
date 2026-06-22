import { useEffect, useState } from "react";

/** Returns a value that updates `delay` ms after the input stops changing. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // setState runs inside the timer callback, not synchronously in the effect.
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
