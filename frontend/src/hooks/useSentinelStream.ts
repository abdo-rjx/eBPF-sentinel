import { useEffect, useRef, useState } from 'react';
import { isDemoMode, streamUrl } from '@/lib/config';
import { generateMockWindow, seedMockWindows } from '@/lib/demo/generator';
import { parseWindow } from '@/lib/api/schema';
import type { ConnectionState, SentinelWindow } from '@/types';

export interface StreamState {
  /** Newest-first, capped at 200. */
  windows: SentinelWindow[];
  connectionState: ConnectionState;
  /** Pids that appeared since the previous tick; auto-clears after 3s. */
  newProcesses: Set<number>;
}

const MAX_WINDOWS = 200;
const DEMO_INTERVAL_MS = 3500;
const NEW_PROCESS_HIGHLIGHT_MS = 3000;

/**
 * Transport layer for scored windows. Demo mode (no VITE_API_* configured)
 * synthesizes windows on a timer; otherwise it opens the SSE stream and
 * zod-guards every record — a malformed record is dropped, never the stream.
 */
export function useSentinelStream(): StreamState {
  const demo = isDemoMode();
  const [windows, setWindows] = useState<SentinelWindow[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    demo ? 'demo_mode' : 'connecting',
  );
  const [newProcesses, setNewProcesses] = useState<Set<number>>(new Set());
  const knownPids = useRef<Set<number>>(new Set());

  // Demo branch: seed then one window per interval, 20% anomalous.
  useEffect(() => {
    if (!demo) return;
    setWindows(seedMockWindows());
    let counter = 101;
    const timer = setInterval(() => {
      const isAnomaly = Math.random() < 0.2;
      setWindows((prev) => [generateMockWindow(counter++, isAnomaly), ...prev].slice(0, MAX_WINDOWS));
    }, DEMO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [demo]);

  // Live branch: native EventSource (token via query param — EventSource can't set headers).
  useEffect(() => {
    if (demo) return;
    const es = new EventSource(streamUrl());
    es.onopen = () => setConnectionState('connected');
    es.onmessage = (event) => {
      try {
        const parsed = parseWindow(JSON.parse(event.data) as unknown);
        if (parsed) setWindows((prev) => [parsed, ...prev].slice(0, MAX_WINDOWS));
      } catch {
        // Malformed JSON line: ignore, keep the stream alive.
      }
    };
    es.onerror = () => setConnectionState('reconnecting');
    return () => es.close();
  }, [demo]);

  // Highlight pids not present on the previous derivation.
  useEffect(() => {
    const pids = new Set(windows.map((w) => w.pid));
    const fresh = windows.filter((w) => !knownPids.current.has(w.pid));
    knownPids.current = pids;
    if (fresh.length === 0) return;
    setNewProcesses(new Set(fresh.map((w) => w.pid)));
    const timer = setTimeout(() => setNewProcesses(new Set()), NEW_PROCESS_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [windows]);

  return { windows, connectionState, newProcesses };
}
