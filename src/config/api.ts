/**
 * Central API configuration. Backend is not yet connected — every service in
 * `src/services` currently resolves against local mock data. Once a backend
 * exists, point `API_BASE_URL` at it and swap the mock implementations for
 * `fetch`/`axios` calls using this same base configuration.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

export const API_TIMEOUT_MS = 15000;

/** Simulated network latency for mock services so loading states are visible. */
export const MOCK_LATENCY_MS = 450;

export function apiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}
