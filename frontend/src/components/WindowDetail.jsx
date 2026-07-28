export default function WindowDetail({ window: w }) {
  if (!w) return <p>Select a window to view details.</p>;
  return (
    <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8 }}>
      <h3>PID {w.pid} — {w.comm}</h3>
      <p>Anomaly score: <strong>{w.anomaly_score.toFixed(4)}</strong> {w.is_anomalous ? '\u26a0\ufe0f' : '\u2705'}</p>
      <p>Window: {new Date(w.window_start_ns / 1e6).toLocaleTimeString()} – {new Date(w.window_end_ns / 1e6).toLocaleTimeString()}</p>
      <table>
        <tbody>
          {Object.entries({
            execve: w.num_execve, children: w.num_distinct_children,
            'file opens': w.num_file_opens, renames: w.num_file_renames,
            deletes: w.num_file_deletes, 'distinct files': w.num_distinct_files_touched,
            connects: w.num_connect, 'distinct IPs': w.num_distinct_dest_ips,
            setuid: w.num_setuid, 'syscall rate': w.syscall_rate.toFixed(1),
          }).map(([k, v]) => (
            <tr key={k}><td>{k}</td><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
