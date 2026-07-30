import React, { useState } from 'react';
import { useEventStream } from './hooks/useEventStream';
import AnomalyTimeline from './components/AnomalyTimeline';
import ProcessTable from './components/ProcessTable';
import ProcessDetailDrawer from './components/ProcessDetailDrawer';
import SimulationGuide from './components/SimulationGuide';
import { ShieldAlert, Cpu, Activity, AlertTriangle, Zap, Server, AlertOctagon, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

export default function App() {
  const { windows, processes, newProcesses, connectionState, stats } = useEventStream(`${API_BASE}/api/v1/stream`, API_TOKEN);
  const [selectedWindow, setSelectedWindow] = useState(null);

  const hasCriticalThreat = stats.anomalyProcesses > 0;
  const threatPct = stats.uniqueProcesses > 0 ? ((stats.anomalyProcesses / stats.uniqueProcesses) * 100).toFixed(1) : '0.0';

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <header className="glass-panel" style={{
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        border: hasCriticalThreat ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: hasCriticalThreat ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.12)',
            border: `1px solid ${hasCriticalThreat ? '#ef4444' : '#38bdf8'}`,
            padding: '8px', borderRadius: '8px',
            color: hasCriticalThreat ? '#ef4444' : '#38bdf8',
            boxShadow: hasCriticalThreat ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none',
          }}>
            {hasCriticalThreat ? <AlertOctagon size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Sentinel <span style={{ color: '#38bdf8', fontWeight: 400, fontSize: '0.875rem' }}>| EDR Analytics</span>
              </h1>
              <span className="badge badge-normal" style={{ fontSize: '0.625rem' }}>v1.0</span>
            </div>
            <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '1px' }}>
              Kernel Behavioral Anomaly Detection Engine
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(15, 23, 42, 0.8)', padding: '4px 10px',
            borderRadius: '16px', border: '1px solid var(--border-color)',
            fontSize: '0.6875rem', color: '#cbd5e1',
          }}>
            <div className={connectionState === 'connected' || connectionState === 'demo_mode' ? 'pulse-green' : 'pulse-red'} />
            <span style={{ fontWeight: 500 }}>
              {connectionState === 'connected' ? 'Live Kernel Stream' : connectionState === 'demo_mode' ? 'Demo Mode' : 'Reconnecting'}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(15, 23, 42, 0.6)', padding: '4px 10px',
            borderRadius: '6px', border: '1px solid var(--border-color)',
            fontSize: '0.6875rem', color: '#94a3b8',
          }}>
            <Server size={12} />
            <span className="mono">Linux/x86_64</span>
          </div>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div className={`glass-panel ${hasCriticalThreat ? 'glass-panel-danger' : ''}`} style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Threat Level</span>
            {hasCriticalThreat ? <AlertTriangle size={16} color="#ef4444" /> : <ShieldAlert size={16} color="#10b981" />}
          </div>
          <span style={{
            fontSize: '1.25rem', fontWeight: 700,
            color: hasCriticalThreat ? '#ef4444' : '#10b981',
          }}>
            {hasCriticalThreat ? 'THREAT' : 'NOMINAL'}
          </span>
          <p style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>
            {stats.anomalyProcesses} process{stats.anomalyProcesses !== 1 ? 'es' : ''} flagged
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Processes</span>
            <Users size={16} color="#38bdf8" />
          </div>
          <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
            {stats.uniqueProcesses}
          </span>
          <p style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>{stats.totalCount} window samples</p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Anomalies</span>
            <Zap size={16} color={hasCriticalThreat ? '#ef4444' : '#f59e0b'} />
          </div>
          <span className="mono" style={{
            fontSize: '1.5rem', fontWeight: 700,
            color: hasCriticalThreat ? '#ef4444' : '#f8fafc',
          }}>
            {stats.anomalyProcesses}
          </span>
          <p style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>
            {threatPct}% of unique processes
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Syscall Density</span>
            <Activity size={16} color="#10b981" />
          </div>
          <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
            {stats.avgSyscallRate}
            <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#94a3b8' }}>/s</span>
          </span>
          <p style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '2px' }}>Avg kernel event throughput</p>
        </div>
      </section>

      <SimulationGuide />

      <AnomalyTimeline windows={windows} />

      <ProcessTable processes={processes} newProcesses={newProcesses} onSelectWindow={setSelectedWindow} />

      {selectedWindow && (
        <ProcessDetailDrawer windowData={selectedWindow} onClose={() => setSelectedWindow(null)} />
      )}

      <footer style={{
        borderTop: '1px solid var(--border-color)', paddingTop: '14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        color: '#64748b', fontSize: '0.6875rem',
      }}>
        <div>eBPF Sentinel • Kernel Behavioral EDR</div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span>CO-RE / libbpf</span>
          <span>FastAPI</span>
          <span>Isolation Forest</span>
          <span>React + Recharts</span>
        </div>
      </footer>
    </div>
  );
}