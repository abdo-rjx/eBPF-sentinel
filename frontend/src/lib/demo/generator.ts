import type { SentinelWindow } from '@/types';

const NORMAL_COMMS = [
  'bash',
  'node',
  'chrome',
  'python3',
  'systemd',
  'dockerd',
  'clang',
  'git',
  'sshd',
  'nginx',
  'postgres',
  'redis',
];

const BAD_COMMS = [
  'simulate_ransomware',
  'c2_beacon_exec',
  'evil_payload',
  'nc_shell',
  'miner',
  'keylogger',
];

function pickComm(isAnomaly: boolean): string {
  const pool = isAnomaly ? BAD_COMMS : NORMAL_COMMS;
  return pool[Math.floor(Math.random() * pool.length)] ?? 'bash';
}

export function generateMockWindow(id: number, isAnomaly = false): SentinelWindow {
  const comm = pickComm(isAnomaly);
  const pid = Math.floor(1000 + Math.random() * 25000);
  const now = Date.now() * 1e6;
  const anomalyScore = isAnomaly
    ? parseFloat((-0.12 - Math.random() * 0.25).toFixed(4))
    : parseFloat((0.05 + Math.random() * 0.2).toFixed(4));

  // Dev-only sanity: negative score must mean anomalous (matches sklearn convention).
  console.assert(!isAnomaly || anomalyScore < 0, 'generator violated anomaly sign convention');

  return {
    id,
    pid,
    ppid: Math.floor(100 + Math.random() * 900),
    comm,
    window_start_ns: now - 5000 * 1e6,
    window_end_ns: now,
    num_execve: isAnomaly ? Math.floor(15 + Math.random() * 30) : Math.floor(Math.random() * 3),
    num_distinct_children: isAnomaly ? Math.floor(5 + Math.random() * 15) : Math.floor(Math.random() * 2),
    num_file_opens: isAnomaly ? Math.floor(400 + Math.random() * 600) : Math.floor(2 + Math.random() * 20),
    num_file_renames: isAnomaly ? Math.floor(350 + Math.random() * 500) : 0,
    num_file_deletes: isAnomaly ? Math.floor(200 + Math.random() * 400) : 0,
    num_distinct_files_touched: isAnomaly
      ? Math.floor(500 + Math.random() * 500)
      : Math.floor(1 + Math.random() * 15),
    num_connect: comm.includes('beacon') ? Math.floor(30 + Math.random() * 50) : Math.floor(Math.random() * 4),
    num_distinct_dest_ips: comm.includes('beacon')
      ? Math.floor(20 + Math.random() * 35)
      : Math.floor(Math.random() * 2),
    num_setuid: isAnomaly ? Math.floor(1 + Math.random() * 4) : 0,
    syscall_rate: isAnomaly
      ? parseFloat((200 + Math.random() * 500).toFixed(1))
      : parseFloat((1 + Math.random() * 15).toFixed(1)),
    anomaly_score: anomalyScore,
    is_anomalous: isAnomaly,
    created_at: new Date().toISOString(),
  };
}

export function seedMockWindows(count = 12): SentinelWindow[] {
  return Array.from({ length: count }, (_, i) => generateMockWindow(100 - i, i === 2 || i === 9));
}

export function makeMockWindow(id: number): SentinelWindow {
  return generateMockWindow(id, Math.random() < 0.2);
}
