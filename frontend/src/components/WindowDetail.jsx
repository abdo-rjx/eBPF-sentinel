import React, { useState } from 'react';
import { X, ShieldAlert, Cpu, FileText, Globe, Code, Layers, Clock } from 'lucide-react';

export default function WindowDetail({ windowData, onClose }) {
  const [activeTab, setActiveTab] = useState('metrics');

  if (!windowData) return null;

  const isAnomaly = windowData.is_anomalous;
  const timeFormatted = new Date(windowData.window_start_ns / 1e6).toLocaleString();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: isAnomaly ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
        boxShadow: isAnomaly ? '0 0 30px rgba(239, 68, 68, 0.25)' : '0 20px 40px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isAnomaly ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 23, 42, 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: isAnomaly ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
              padding: '8px',
              borderRadius: '8px',
              color: isAnomaly ? '#ef4444' : '#38bdf8'
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc' }}>
                  {windowData.comm}
                </h2>
                <span className={`badge ${isAnomaly ? 'badge-danger' : 'badge-normal'}`}>
                  {isAnomaly ? '🚨 ANOMALOUS PROCESS' : 'NORMAL BEHAVIOR'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                PID: <span className="mono">{windowData.pid}</span> | Parent PID (PPID): <span className="mono">{windowData.ppid}</span>
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.4)', padding: '0 20px' }}>
          <button 
            onClick={() => setActiveTab('metrics')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'metrics' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'metrics' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            10D Behavioral Vector
          </button>
          <button 
            onClick={() => setActiveTab('json')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'json' ? '2px solid #38bdf8' : '2px solid transparent',
              color: activeTab === 'json' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Raw Telemetry Payload
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'metrics' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Score Highlight Card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Isolation Forest Score</span>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: isAnomaly ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                    {windowData.anomaly_score.toFixed(4)}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Syscall Execution Density</span>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {Math.round(windowData.syscall_rate)} events/sec
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Capture Time</span>
                  <div className="mono" style={{ fontSize: '0.875rem', color: '#cbd5e1', marginTop: '6px' }}>
                    {timeFormatted}
                  </div>
                </div>
              </div>

              {/* Categorized Metric Groups */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* File Activity */}
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 600 }}>
                    <FileText size={16} /> File I/O Signal
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                    <MetricRow label="File Opens" value={windowData.num_file_opens} />
                    <MetricRow label="File Renames" value={windowData.num_file_renames} highlight={windowData.num_file_renames > 50} />
                    <MetricRow label="File Deletions" value={windowData.num_file_deletes} highlight={windowData.num_file_deletes > 20} />
                    <MetricRow label="Unique Files Touched" value={windowData.num_distinct_files_touched} />
                  </div>
                </div>

                {/* Network & Lineage */}
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '12px', fontSize: '0.875rem', fontWeight: 600 }}>
                    <Globe size={16} /> Network & Lineage Signal
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8125rem' }}>
                    <MetricRow label="Socket Connections" value={windowData.num_connect} highlight={windowData.num_connect > 15} />
                    <MetricRow label="Distinct Target IPs" value={windowData.num_distinct_dest_ips} />
                    <MetricRow label="Execve Commands" value={windowData.num_execve} />
                    <MetricRow label="Child Process Fan-Out" value={windowData.num_distinct_children} />
                    <MetricRow label="Setuid Switch Attempts" value={windowData.num_setuid} highlight={windowData.num_setuid > 0} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <pre style={{
              background: '#090d16',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              color: '#38bdf8',
              fontSize: '0.8125rem',
              overflowX: 'auto'
            }} className="mono">
              {JSON.stringify(windowData, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary">
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span className="mono" style={{ fontWeight: 600, color: highlight ? '#ef4444' : '#f8fafc' }}>
        {value} {highlight && '🚨'}
      </span>
    </div>
  );
}
