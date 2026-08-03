import { THREATS } from '@/lib/data/threats';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import styles from './ThreatMatrix.module.css';

const ABBREV: Record<string, string> = {
  num_execve: 'EXEC',
  num_distinct_children: 'CHLD',
  num_file_opens: 'OPEN',
  num_file_renames: 'RENM',
  num_file_deletes: 'DEL',
  num_distinct_files_touched: 'FILES',
  num_connect: 'CONN',
  num_distinct_dest_ips: 'IP',
  num_setuid: 'UID',
  syscall_rate: 'RATE',
};

export function ThreatMatrix() {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className="sr-only">
          Threat signatures mapped to tactics, syscalls, spiking features, and severity
        </caption>
        <thead>
          <tr>
            <th scope="col">Signature</th>
            <th scope="col">Tactics</th>
            <th scope="col">Syscalls</th>
            <th scope="col">Features</th>
            <th scope="col">Severity</th>
          </tr>
        </thead>
        <tbody>
          {THREATS.map((t) => (
            <tr key={t.id}>
              <th scope="row" className={styles.name}>{t.name}</th>
              <td className={styles.muted}>{t.tactics.join(' / ')}</td>
              <td className={styles.mono}>{t.syscalls.map((s) => `${s}()`).join(' ')}</td>
              <td className={styles.mono}>
                {t.features
                  .map((f) => ABBREV[f])
                  .filter((x): x is string => Boolean(x))
                  .join(' ')}
              </td>
              <td><SeverityBadge severity={t.severity} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
