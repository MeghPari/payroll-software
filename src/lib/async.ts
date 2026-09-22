import { MOCK_LATENCY_MS } from "@/config/api";

/** Resolves after a simulated network delay so UI loading states are exercised in mock mode. */
export function mockDelay<T>(value: T, ms: number = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
