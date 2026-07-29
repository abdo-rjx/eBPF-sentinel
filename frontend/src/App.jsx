import React, { useState } from 'react';
import { useEventStream } from './hooks/useEventStream';
import AnomalyTimeline from './components/AnomalyTimeline';
import ProcessTable from './components/ProcessTable';
import WindowDetail from './components/WindowDetail';
import SimulationGuide from './components/SimulationGuide';
import { ShieldAlert, Cpu, Activity, AlertTriangle, Zap, Server, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

export default function App() {
  const { windows, connectionState, stats } = useEventStream(`${API_BASE}/api/v1/stream`, API_TOKEN);
  const [selectedWindow, setSelectedWindow] = useState(null);

  const hasCriticalThreat = stats.anomalyCount > 0;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 🟢 TOP HEADER BAR */}
      <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            background: hasCriticalThreat ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
            border: `1px solid ${hasCriticalThreat ? '#ef4444' : '#38bdf8'}`,
            padding: '10px',
            borderRadius: '10px',
            color: hasCriticalThreat ? '#ef4444' : '#38bdf8',
            boxShadow: hasCriticalThreat ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 15px rgba(56, 189, 248, 0.2)'
          }}>
            <ShieldAlert size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                eBPF Sentinel <span style={{ color: '#38bdf8', fontWeight: 400, fontSize: '1rem' }}>| EDR Dashboard</span>
              </h1>
              <span className="badge badge-normal" style={{ fontSize: '0.6875rem' }}>
                CO-RE Kernel v1.0
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
              Unsupervised Kernel Behavioral Anomaly Detection & Threat Isolation Engine
            </p>
          </div>
        </div>

        {/* System Connection Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '6px 12px',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: '#cbd5e1'
          }}>
            <div className={connectionState === 'connected' ? 'pulse-green' : connectionState === 'demo_mode' ? 'pulse-green' : 'pulse-red'} />
            <span style={{ fontWeight: 500 }}>
              {connectionState === 'connected' ? 'Kernel SSE Stream Active' : connectionState === 'demo_mode' ? 'Live Telemetry Demo Mode' : 'Reconnecting to Host...'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
            color: '#94a3b8'
          }}>
            <Server size={14} />
            <span className="mono">Fedora / x86_64</span>
          </div>
        </div>
      </header>

      {/* 📊 KPI METRIC CARDS */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        
        {/* Threat Status Card */}
        <div className={`glass-panel ${hasCriticalThreat ? 'glass-panel-danger' : ''}`} style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>System Threat Level</span>
            {hasCriticalThreat ? <AlertTriangle size={18} color="#ef4444" /> : <ShieldAlert size={18} color="#10b981" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: hasCriticalThreat ? '#ef4444' : '#10b981' }}>
              {hasCriticalThreat ? 'THREAT DETECTED' : 'SYSTEM NOMINAL'}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Max Anomaly Score: <span className="mono" style={{ fontWeight: 600, color: hasCriticalThreat ? '#ef4444' : '#10b981' }}>{stats.maxAnomalyScore ? stats.maxAnomalyScore.toFixed(4) : '0.0000'}</span>
          </p>
        </div>

        {/* Monitored Processes */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Active Monitored Windows</span>
            <Cpu size={18} color="#38bdf8" />
          </div>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
            {stats.totalCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            5-second rolling window samples
          </p>
        </div>

        {/* Anomalies Flagged */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Total Anomaly Outliers</span>
            <Zap size={18} color={hasCriticalThreat ? '#ef4444' : '#f59e0b'} />
          </div>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 700, color: hasCriticalThreat ? '#ef4444' : '#f8fafc' }}>
            {stats.anomalyCount}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Isolation Forest score &lt; -0.05
          </p>
        </div>

        {/* Syscall Rate */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Avg Syscall Density</span>
            <Activity size={18} color="#10b981" />
          </div>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc' }}>
            {stats.avgSyscallRate} <span style={{ fontSize: '1rem', fontWeight: 400, color: '#94a3b8' }}>/sec</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
            Aggregated kernel event throughput
          </p>
        </div>

      </section>

      {/* 🧪 SIMULATION TRIGGER BANNER */}
      <SimulationGuide />

      {/* 📈 REAL-TIME ANOMALY TIMELINE CHART */}
      <AnomalyTimeline windows={windows} />

      {/* 🔍 LIVE PROCESS TELEMETRY TABLE */}
      <ProcessTable windows={windows} onSelectWindow={setSelectedWindow} />

      {/* 🕵️ PROCESS WINDOW INSPECTOR MODAL */}
      {selectedWindow && (
        <WindowDetail windowData={selectedWindow} onClose={() => setSelectedWindow(null)} />
      )}

      {/* 🛡️ FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b', fontSize: '0.75rem' }}>
        <div>
          eBPF Sentinel Security Engine • Host-Based Kernel Behavioral Intrusion Detection
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>C / libbpf CO-RE</span>
          <span>FastAPI</span>
          <span>scikit-learn Isolation Forest</span>
          <span>React + Recharts</span>
        </div>
      </footer>

    </div>
  );
}
