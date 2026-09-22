import { useEffect, useState } from "react";

/**
 * Recharts assigns internal SVG ids (clipPath/gradient) from a module-level
 * counter that resets between the server and client render passes, which
 * produces a hydration mismatch. Gate chart rendering on this until mounted
 * so the chart only ever renders client-side.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Intentional: this is the standard client-mount-detection pattern and
    // has no non-effect alternative — the whole point is to flip after the
    // first client render, which is exactly what triggers a hydration diff.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}
