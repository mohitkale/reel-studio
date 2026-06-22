import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and the first client render, then true after
 * hydration. Built on useSyncExternalStore so it does not call setState in an
 * effect. Use to gate client-only values (e.g. resolved theme) and avoid
 * hydration mismatches.
 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
