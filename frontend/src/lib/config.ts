export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

export const API_TOKEN = (import.meta.env.VITE_API_TOKEN as string | undefined) ?? '';

/**
 * Demo mode triggers when the SSE URL would contain "undefined" (i.e. no
 * token / base configured), mirroring the legacy hook behavior.
 */
export function isDemoMode(): boolean {
  return !API_TOKEN || API_TOKEN.includes('undefined') || API_BASE.includes('undefined');
}

/** Native EventSource cannot set an Authorization header; the backend accepts the token as a query param. */
export function streamUrl(): string {
  return `${API_BASE}/api/v1/stream?token=${encodeURIComponent(API_TOKEN)}`;
}
