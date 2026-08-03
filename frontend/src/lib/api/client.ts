import { API_BASE, API_TOKEN } from '@/lib/config';
import {
  analysisSchema,
  parseWindow,
  processesSchema,
  statsSchema,
  type WindowRecord,
} from '@/lib/api/schema';
import type { ProcessSummary, Stats, WindowAnalysis } from '@/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Query {
  [key: string]: string | number | boolean | undefined;
}

async function fetchJson<T>(path: string, query?: Query, timeoutMs = 8000): Promise<T> {
  const qs = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) qs.set(key, String(value));
    }
  }
  const q = qs.size > 0 ? `?${qs.toString()}` : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}${q}`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new ApiError(res.status, `GET ${path} → ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, `GET ${path} timed out`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getWindows(
  params?: { limit?: number; pid?: number; anomalousOnly?: boolean },
): Promise<WindowRecord[]> {
  const raw = await fetchJson<unknown[]>('/api/v1/windows', {
    limit: params?.limit ?? 100,
    pid: params?.pid,
    anomalous_only: params?.anomalousOnly ? true : undefined,
  });
  return raw
    .map(parseWindow)
    .filter((w): w is WindowRecord => w !== null);
}

export async function getWindow(id: number): Promise<WindowRecord | null> {
  const raw = await fetchJson<unknown>(`/api/v1/windows/${id}`);
  return parseWindow(raw);
}

export async function getAnalysis(id: number): Promise<WindowAnalysis | null> {
  const raw = await fetchJson<unknown>(`/api/v1/windows/${id}/analysis`);
  const r = analysisSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export async function getStats(): Promise<Stats | null> {
  const raw = await fetchJson<unknown>('/api/v1/stats');
  const r = statsSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export async function getProcesses(): Promise<ProcessSummary[]> {
  const raw = await fetchJson<unknown[]>('/api/v1/processes');
  const r = processesSchema.safeParse(raw);
  return r.success ? r.data : [];
}
