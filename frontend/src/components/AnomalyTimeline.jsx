import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnomalyTimeline({ windows }) {
  const data = [...windows].reverse().map((w) => ({
    time: new Date(w.window_start_ns / 1e6).toLocaleTimeString(),
    score: w.anomaly_score,
    comm: w.comm,
  }));

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: 'Anomaly score (lower = more anomalous)', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Line type="monotone" dataKey="score" stroke="#dc2626" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
