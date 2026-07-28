export default function ProcessTable({ windows }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>Time</th><th>PID</th><th>Command</th><th>Score</th><th>Anomalous</th>
        </tr>
      </thead>
      <tbody>
        {windows.slice(0, 50).map((w, i) => (
          <tr key={i} style={{ background: w.is_anomalous ? '#fee2e2' : 'transparent' }}>
            <td>{new Date(w.window_start_ns / 1e6).toLocaleTimeString()}</td>
            <td>{w.pid}</td>
            <td>{w.comm}</td>
            <td>{w.anomaly_score.toFixed(4)}</td>
            <td>{w.is_anomalous ? '\u26a0\ufe0f yes' : 'no'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
