import type { Severity } from '@/types';

/** FEATURE_COLUMNS order + labels mirrored from backend ml/explain.py. */
export const FEATURES: Array<{ key: string; label: string }> = [
  { key: 'num_execve', label: 'Process Executions' },
  { key: 'num_distinct_children', label: 'Child Process Spawn' },
  { key: 'num_file_opens', label: 'File Opens' },
  { key: 'num_file_renames', label: 'File Renames' },
  { key: 'num_file_deletes', label: 'File Deletions' },
  { key: 'num_distinct_files_touched', label: 'Unique Files Accessed' },
  { key: 'num_connect', label: 'Socket Connections' },
  { key: 'num_distinct_dest_ips', label: 'Distinct Remote IPs' },
  { key: 'num_setuid', label: 'Setuid Attempts' },
  { key: 'syscall_rate', label: 'Syscall Density' },
];

export interface ThreatSignature {
  id: string;
  name: string;
  severity: Exclude<Severity, 'benign'>;
  tactics: string[];
  syscalls: string[];
  /** Feature keys that spike for this signature. */
  features: string[];
  /** Hand-authored normalized 0..1 vector in FEATURE_COLUMNS order, for the radar. */
  vector: number[];
  blurb: string;
  howDetected: string[];
  windowNote: string;
}

export const THREATS: ThreatSignature[] = [
  {
    id: 'ransomware',
    name: 'Ransomware Encryption Burst',
    severity: 'critical',
    tactics: ['Data Destruction', 'Encryption'],
    syscalls: ['openat', 'rename', 'unlink'],
    features: ['num_file_renames', 'num_file_deletes', 'num_distinct_files_touched', 'num_file_opens'],
    vector: [0.6, 0.5, 0.9, 1.0, 0.95, 1.0, 0.1, 0.05, 0.1, 0.95],
    blurb: 'Mass file churn with no network activity — a process encrypting or destroying everything it can touch.',
    howDetected: [
      'Rename and delete density far above any baseline process in a 5s window.',
      'Thousands of distinct files touched by a single pid.',
      'Syscall density spike while socket activity stays near zero.',
    ],
    windowNote: 'Usually peaks within 1–3 windows once encryption starts.',
  },
  {
    id: 'c2-beacon',
    name: 'C2 Beaconing',
    severity: 'critical',
    tactics: ['Command & Control', 'Discovery'],
    syscalls: ['connect', 'accept'],
    features: ['num_connect', 'num_distinct_dest_ips'],
    vector: [0.7, 0.4, 0.5, 0.0, 0.0, 0.4, 1.0, 0.9, 0.0, 0.6],
    blurb: 'Periodic connect() calls to a rotating set of remote IPs — a bot phoning home.',
    howDetected: [
      'Repeated socket connections to many distinct destination IPs.',
      'Beaconing cadence: connect spikes that repeat across consecutive windows.',
      'Low file activity paired with sustained socket churn.',
    ],
    windowNote: 'Signals repeat every few windows; cadence itself is the tell.',
  },
  {
    id: 'cryptominer',
    name: 'Cryptominer',
    severity: 'suspicious',
    tactics: ['Execution', 'Resource Hijacking'],
    syscalls: ['execve', 'openat', 'connect'],
    features: ['num_execve', 'syscall_rate', 'num_file_opens'],
    vector: [0.8, 0.6, 0.7, 0.1, 0.1, 0.5, 0.7, 0.6, 0.0, 0.85],
    blurb: 'Sustained compute-driven syscall density with steady connections to a mining pool.',
    howDetected: [
      'Sustained syscall density well above baseline for a long-lived process.',
      'Child-process fan-out during binary execution.',
      'Steady connect() rate to a small, persistent pool of IPs.',
    ],
    windowNote: 'Long-running — deviates across most windows, not one spike.',
  },
  {
    id: 'reverse-shell',
    name: 'Reverse Shell',
    severity: 'critical',
    tactics: ['Execution', 'Persistence'],
    syscalls: ['execve', 'connect'],
    features: ['num_execve', 'num_distinct_children', 'num_connect'],
    vector: [0.95, 0.7, 0.4, 0.0, 0.0, 0.3, 0.85, 0.4, 0.2, 0.7],
    blurb: 'A shell binary spawning and immediately dialing an external address.',
    howDetected: [
      'execve spike followed by a long-lived outbound connect.',
      'Unusual parent→child shape: a shell under a non-shell parent.',
      'High syscall density concentrated at process startup.',
    ],
    windowNote: 'Fires within the window that contains the connect().',
  },
  {
    id: 'setuid-privesc',
    name: 'Setuid Privilege Escalation',
    severity: 'suspicious',
    tactics: ['Privilege Escalation'],
    syscalls: ['setuid', 'execve'],
    features: ['num_setuid', 'num_execve'],
    vector: [0.6, 0.3, 0.3, 0.05, 0.05, 0.2, 0.2, 0.1, 1.0, 0.4],
    blurb: 'A setuid() call is rare and high-signal on its own — especially when it precedes a fresh exec.',
    howDetected: [
      'Any setuid() syscall is an immediate deviation from baseline.',
      'setuid attempt coupled with a fresh execve in the same window.',
      'Baseline processes never call setuid, so the z-score is unambiguous.',
    ],
    windowNote: 'Single-window event; unlikely to repeat.',
  },
  {
    id: 'exfiltration',
    name: 'Data Exfiltration',
    severity: 'suspicious',
    tactics: ['Collection', 'Exfiltration'],
    syscalls: ['openat', 'connect'],
    features: ['num_file_opens', 'num_connect', 'num_distinct_dest_ips'],
    vector: [0.5, 0.4, 0.9, 0.2, 0.3, 0.8, 0.9, 0.8, 0.0, 0.5],
    blurb: 'Bulk file reads immediately followed by outbound transfers to multiple hosts.',
    howDetected: [
      'Large file-open volume immediately preceding outbound connects.',
      'Rapid destination-IP fan-out consistent with staging data for transfer.',
      'High file-access + network combination that is rare in baseline.',
    ],
    windowNote: 'Best seen across two windows: read, then transfer.',
  },
];
