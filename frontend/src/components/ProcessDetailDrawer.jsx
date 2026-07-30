import React, { useState } from 'react';
import { X, ShieldAlert, Cpu, FileText, Globe, BarChart3, Activity } from 'lucide-react';
import AIAnalysisPanel from './AIAnalysisPanel';

export default function ProcessDetailDrawer({ windowData, onClose }) {
  const [activeTab, setActiveTab] = useState('analysis');

  if (!windowData) return null;

  const isAnomaly = windowData.is_anomalous;
  const timeFormatted = new Date(windowData.window_start_ns / 1e6).toLocaleString();

  const tabs = [
    { id: 'analysis', label: 'AI Analysis', icon: BarChart3 },
    { id: 'metrics', label: 'Behavioral Vector', icon: Activity },
  ];

  const MetricRow = ({ label, value, highlight }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px dashed rgba(255, 255, 255, 0.05)',
    }}>
      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{label}</span>
      <span className="mono" style={{
        fontWeight: 600, fontSize: '0.8125rem',
        color: highlight ? '#ef4444' : '#f8fafc',
      }}>
        {value}
      </span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div
        onClick={onClose}
        style={{ flex: 1, background: 'rgba(5, 8, 15, 0.6)', backdropFilter: 'blur(4px)' }}
      />
      <div className="glass-panel" style={{
        width: '560px', maxWidth: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column',
        borderLeft: isAnomaly ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(56, 189, 248, 0.2)',
        boxShadow: isAnomaly
          ? '-10px 0 40px rgba(239, 68, 68, 0.2)'
          : '-10px 0 40px rgba(0, 0, 0, 0.4)',
        borderRadius: 0,
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: isAnomaly ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 23, 42, 0.6)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              padding: '6px', borderRadius: '6px',
              background: isAnomaly ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: isAnomaly ? '#ef4444' : '#38bdf8', flexShrink: 0,
            }}>
              <ShieldAlert size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="mono" style={{
                  fontSize: '0.9375rem', fontWeight: 700, color: '#f8fafc',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {windowData.comm}
                </h2>
                <span className={`badge ${isAnomaly ? 'badge-danger' : 'badge-normal'}`} style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                  {isAnomaly ? 'ANOMALOUS' : 'NORMAL'}
                </span>
              </div>
              <p style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '1px' }}>
                PID: <span className="mono">{windowData.pid}</span> | PPID: <span className="mono">{windowData.ppid}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-color)',
          background: 'rgba(15, 23, 42, 0.4)', padding: '0 16px', flexShrink: 0,
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 14px', background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
                color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
                fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'analysis' ? (
            <AIAnalysisPanel windowData={windowData} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                background: 'rgba(15, 23, 42, 0.6)', padding: '14px',
                borderRadius: '8px', border: '1px solid var(--border-color)',
              }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase' }}>Anomaly Score</span>
                  <div className="mono" style={{
                    fontSize: '1.125rem', fontWeight: 700,
                    color: isAnomaly ? '#ef4444' : '#10b981', marginTop: '4px',
                  }}>
                    {windowData.anomaly_score.toFixed(4)}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase' }}>Syscall Rate</span>
                  <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {Math.round(windowData.syscall_rate)}/s
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase' }}>Capture Time</span>
                  <div className="mono" style={{ fontSize: '0.8125rem', color: '#cbd5e1', marginTop: '4px' }}>
                    {timeFormatted}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.4)', padding: '14px',
                  borderRadius: '8px', border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', marginBottom: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <FileText size={14} /> File I/O
                  </div>
                  <MetricRow label="File Opens" value={windowData.num_file_opens} />
                  <MetricRow label="File Renames" value={windowData.num_file_renames} highlight={windowData.num_file_renames > 50} />
                  <MetricRow label="File Deletions" value={windowData.num_file_deletes} highlight={windowData.num_file_deletes > 20} />
                  <MetricRow label="Unique Files" value={windowData.num_distinct_files_touched} />
                </div>
                <div style={{
                  background: 'rgba(15, 23, 42, 0.4)', padding: '14px',
                  borderRadius: '8px', border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', marginBottom: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <Globe size={14} /> Network & Process
                  </div>
                  <MetricRow label="Connections" value={windowData.num_connect} highlight={windowData.num_connect > 15} />
                  <MetricRow label="Distinct IPs" value={windowData.num_distinct_dest_ips} />
                  <MetricRow label="Execve" value={windowData.num_execve} />
                  <MetricRow label="Children" value={windowData.num_distinct_children} />
                  <MetricRow label="Setuid" value={windowData.num_setuid} highlight={windowData.num_setuid > 0} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-color)',
          background: 'rgba(15, 23, 42, 0.6)', flexShrink: 0,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button onClick={onClose} className="btn-primary" style={{ fontSize: '0.75rem', padding: '6px 14px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}