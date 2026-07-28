import { useEventStream } from './hooks/useEventStream';
import AnomalyTimeline from './components/AnomalyTimeline';
import ProcessTable from './components/ProcessTable';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

export default function App() {
  const windows = useEventStream(`${API_BASE}/api/v1/stream`, API_TOKEN);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Sentinel — live behavioral anomaly detection</h1>
      <AnomalyTimeline windows={windows} />
      <ProcessTable windows={windows} />
    </div>
  );
}
