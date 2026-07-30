import { useEffect, useRef, useState } from 'react';

function pickComm(isAnomaly) {
  const normal = ['bash', 'node', 'chrome', 'python3', 'systemd', 'dockerd', 'clang', 'git', 'sshd', 'nginx', 'postgres', 'redis'];
  const bad = ['simulate_ransomware', 'c2_beacon_exec', 'evil_payload', 'nc_shell', 'miner', 'keylogger'];
  return (isAnomaly ? bad : normal)[Math.floor(Math.random() * (isAnomaly ? bad : normal).length)];
}

function generateMockWindow(id, isAnomaly = false) {
  const comm = pickComm(isAnomaly);
  const pid = Math.floor(1000 + Math.random() * 25000);
  const now = Date.now() * 1e6;
  return {
    id: id || Math.floor(Math.random() * 100000), pid,
    ppid: Math.floor(100 + Math.random() * 900), comm,
    window_start_ns: now - 5000 * 1e6, window_end_ns: now,
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
    is_anomalous: isAnomaly, created_at: new Date().toISOString(),
  };
}

function buildProcessList(wins) {
  const map = new Map();
  for (const w of wins) {
    const curr = map.get(w.pid);
    if (!curr || curr.id < w.id) map.set(w.pid, { ...w });
  }
  return Array.from(map.values()).sort((a, b) => b.id - a.id);
}

function computeStats(wins, pList) {
  const anomalyProcs = pList.filter(p => p.is_anomalous);
  const anomalyWindows = wins.filter(w => w.is_anomalous);
  const scores = wins.map(w => w.anomaly_score);
  const minScore = scores.length ? Math.min(...scores) : 0;
  const avgRate = wins.length ? wins.reduce((acc, w) => acc + w.syscall_rate, 0) / wins.length : 0;
  return {
    totalCount: wins.length,
    uniqueProcesses: pList.length,
    anomalyCount: anomalyWindows.length,
    anomalyProcesses: anomalyProcs.length,
    maxAnomalyScore: minScore,
    avgSyscallRate: Math.round(avgRate),
  };
}

export function useEventStream(url, token) {
  const [windows, setWindows] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [newProcesses, setNewProcesses] = useState(new Set());
  const [connectionState, setConnectionState] = useState('connecting');
  const [stats, setStats] = useState({
    totalCount: 0, uniqueProcesses: 0, anomalyCount: 0,
    anomalyProcesses: 0, maxAnomalyScore: 0, avgSyscallRate: 0,
  });

  const knownPids = useRef(new Set());

  useEffect(() => {
    if (windows.length === 0) return;
    const pList = buildProcessList(windows);

    const unseen = pList.filter(p => !knownPids.current.has(p.pid));
    for (const p of unseen) knownPids.current.add(p.pid);

    setProcesses(pList);
    setStats(computeStats(windows, pList));

    if (unseen.length > 0) {
      const pids = new Set(unseen.map(p => p.pid));
      setNewProcesses(pids);
      const timer = setTimeout(() => setNewProcesses(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [windows]);

  useEffect(() => {
    let mockInterval = null;

    if (!url || url.includes('undefined')) {
      setConnectionState('demo_mode');
      const initial = Array.from({ length: 12 }, (_, i) => generateMockWindow(100 - i, i === 2 || i === 9));
      setWindows(initial);

      let counter = 101;
      mockInterval = setInterval(() => {
        const isAnomaly = Math.random() < 0.2;
        setWindows(prev => [generateMockWindow(counter++, isAnomaly), ...prev].slice(0, 200));
      }, 3500);

      return () => clearInterval(mockInterval);
    }

    const fullUrl = token ? `${url}?token=${encodeURIComponent(token)}` : url;
    const es = new EventSource(fullUrl);

    es.onopen = () => setConnectionState('connected');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setWindows(prev => [data, ...prev].slice(0, 200));
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };
    es.onerror = () => setConnectionState('reconnecting');

    return () => es.close();
  }, [url, token]);

  return { windows, processes, newProcesses, connectionState, stats, setWindows };
}