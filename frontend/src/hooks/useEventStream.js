import { useEffect, useRef, useState } from 'react';

// Fallback mock telemetry generator for live demo preview when backend is not actively running
function generateMockWindow(id, isAnomaly = false) {
  const comms = isAnomaly 
    ? ['simulate_ransomware', 'c2_beacon_exec', 'evil_payload', 'nc_shell'] 
    : ['bash', 'node', 'chrome', 'python3', 'systemd', 'dockerd', 'clang', 'git'];
  const comm = comms[Math.floor(Math.random() * comms.length)];
  const pid = Math.floor(1000 + Math.random() * 25000);
  const now = Date.now() * 1e6;

  return {
    id: id || Math.floor(Math.random() * 100000),
    pid: pid,
    ppid: Math.floor(100 + Math.random() * 900),
    comm: comm,
    window_start_ns: now - 5000 * 1e6,
    window_end_ns: now,
    num_execve: isAnomaly ? Math.floor(15 + Math.random() * 30) : Math.floor(Math.random() * 3),
    num_distinct_children: isAnomaly ? Math.floor(5 + Math.random() * 15) : Math.floor(Math.random() * 2),
    num_file_opens: isAnomaly ? Math.floor(400 + Math.random() * 600) : Math.floor(2 + Math.random() * 20),
    num_file_renames: isAnomaly ? Math.floor(350 + Math.random() * 500) : 0,
    num_file_deletes: isAnomaly ? Math.floor(200 + Math.random() * 400) : 0,
    num_distinct_files_touched: isAnomaly ? Math.floor(500 + Math.random() * 500) : Math.floor(1 + Math.random() * 15),
    num_connect: comm.includes('beacon') ? Math.floor(30 + Math.random() * 50) : Math.floor(Math.random() * 4),
    num_distinct_dest_ips: comm.includes('beacon') ? Math.floor(20 + Math.random() * 35) : Math.floor(Math.random() * 2),
    num_setuid: isAnomaly ? Math.floor(1 + Math.random() * 4) : 0,
    syscall_rate: isAnomaly ? parseFloat((200 + Math.random() * 500).toFixed(1)) : parseFloat((1 + Math.random() * 15).toFixed(1)),
    anomaly_score: isAnomaly ? parseFloat((-0.12 - Math.random() * 0.25).toFixed(4)) : parseFloat((0.05 + Math.random() * 0.2).toFixed(4)),
    is_anomalous: isAnomaly,
    created_at: new Date().toISOString()
  };
}

export function useEventStream(url, token) {
  const [windows, setWindows] = useState([]);
  const [connectionState, setConnectionState] = useState('connecting'); // 'connected' | 'reconnecting' | 'demo_mode'
  const [stats, setStats] = useState({
    totalCount: 0,
    anomalyCount: 0,
    maxAnomalyScore: 0,
    avgSyscallRate: 0
  });

  const esRef = useRef(null);

  useEffect(() => {
    let mockInterval = null;

    if (!url || url.includes('undefined')) {
      console.warn('Backend URL missing or invalid. Falling back to Demo Telemetry Stream Mode.');
      setConnectionState('demo_mode');
      
      // Seed mock data
      const initialMocks = Array.from({ length: 15 }, (_, i) => 
        generateMockWindow(100 - i, i === 3 || i === 12)
      );
      setWindows(initialMocks);

      mockInterval = setInterval(() => {
        const isAnomaly = Math.random() < 0.2; // 20% chance of anomaly pulse
        const newMock = generateMockWindow(Date.now(), isAnomaly);
        setWindows((prev) => [newMock, ...prev].slice(0, 200));
      }, 3500);

      return () => clearInterval(mockInterval);
    }

    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const es = new EventSource(fullUrl);
    esRef.current = es;

    es.onopen = () => {
      setConnectionState('connected');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setWindows((prev) => [data, ...prev].slice(0, 200));
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    es.onerror = () => {
      setConnectionState('reconnecting');
    };

    return () => {
      es.close();
      if (mockInterval) clearInterval(mockInterval);
    };
  }, [url, token]);

  // Recalculate runtime aggregated stats whenever windows update
  useEffect(() => {
    if (windows.length === 0) return;
    
    const anomalyCount = windows.filter(w => w.is_anomalous).length;
    const scores = windows.map(w => w.anomaly_score);
    const minScore = Math.min(...scores); // Most anomalous score (lowest value)
    const avgRate = windows.reduce((acc, w) => acc + w.syscall_rate, 0) / windows.length;

    setStats({
      totalCount: windows.length,
      anomalyCount: anomalyCount,
      maxAnomalyScore: minScore,
      avgSyscallRate: Math.round(avgRate)
    });
  }, [windows]);

  return { windows, connectionState, stats, setWindows };
}
