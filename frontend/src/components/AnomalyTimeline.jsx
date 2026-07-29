import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, ShieldAlert, Zap } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isAnomaly = data.is_anomalous;

    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        border: `1px solid ${isAnomaly ? '#ef4444' : 'rgba(56, 189, 248, 0.3)'}`,
        boxShadow: isAnomaly ? '0 0 20px rgba(239, 68, 68, 0.3)' : '0 10px 25px rgba(0,0,0,0.5)',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#f8fafc',
        backdropFilter: 'blur(12px)',
        fontSize: '0.8125rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: isAnomaly ? '#fca5a5' : '#38bdf8' }} className="mono">
            {data.comm} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(PID: {data.pid})</span>
          </span>
          <span className={`badge ${isAnomaly ? 'badge-danger' : 'badge-normal'}`}>
            {isAnomaly ? '🚨 ANOMALY' : 'NORMAL'}
          </span>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
          <div><span style={{ color: '#94a3b8' }}>Anomaly Score:</span> <span className="mono" style={{ fontWeight: 600, color: isAnomaly ? '#ef4444' : '#10b981' }}>{data.score}</span></div>
          <div><span style={{ color: '#94a3b8' }}>Syscall Rate:</span> <span className="mono">{data.rate}/s</span></div>
          <div><span style={{ color: '#94a3b8' }}>File Opens:</span> <span className="mono">{data.opens}</span></div>
          <div><span style={{ color: '#94a3b8' }}>File Renames:</span> <span className="mono">{data.renames}</span></div>
          <div><span style={{ color: '#94a3b8' }}>Net Connects:</span> <span className="mono">{data.connects}</span></div>
          <div><span style={{ color: '#94a3b8' }}>Time:</span> <span className="mono">{label}</span></div>
        </div>
      </div>
    );
  }
  return null;
};

export default function AnomalyTimeline({ windows }) {
  const [viewCount, setViewCount] = useState(40);

  const chartData = [...windows].slice(0, viewCount).reverse().map((w) => ({
    time: new Date(w.window_start_ns / 1e6).toLocaleTimeString(),
    score: parseFloat(w.anomaly_score.toFixed(4)),
    comm: w.comm,
    pid: w.pid,
    rate: Math.round(w.syscall_rate),
    opens: w.num_file_opens,
    renames: w.num_file_renames,
    connects: w.num_connect,
    is_anomalous: w.is_anomalous,
  }));

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '8px', borderRadius: '8px', color: '#38bdf8' }}>
            <Activity size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Real-Time Isolation Forest Anomaly Timeline</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Scores below threshold line indicate statistical behavioral outliers</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {[20, 40, 80].map((count) => (
            <button
              key={count}
              onClick={() => setViewCount(count)}
              className={`btn-ghost ${viewCount === count ? 'active' : ''}`}
            >
              Last {count}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 280 }}>
        {chartData.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            Awaiting kernel events...
          </div>
        ) : (
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="dangerGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={-0.05} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'THREAT THRESHOLD', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#38bdf8" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#scoreGradient)" 
                isAnimationActive={false} 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
