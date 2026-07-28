const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

export async function fetchWindows(limit = 100, anomalousOnly = false) {
  const params = new URLSearchParams({ limit });
  if (anomalousOnly) params.set('anomalous_only', 'true');
  const resp = await fetch(`${API_BASE}/api/v1/windows?${params}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}
