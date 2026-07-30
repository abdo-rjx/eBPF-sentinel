import React, { useState } from 'react';
import { Search, ShieldAlert, Eye, Terminal, AlertTriangle, Shield } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' },
  suspicious: { label: 'SUSPICIOUS', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)' },
  benign: { label: 'BENIGN', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' },
};

function getSeverity(w) {
  if (w.is_anomalous) return 'critical';
  if (w.anomaly_score < 0) return 'suspicious';
  return 'benign';
}

export default function ProcessTable({ processes = [], newProcesses, onSelectWindow }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const byComm = {};
  for (const p of processes) {
    const key = p.comm;
    if (!byComm[key]) byComm[key] = [];
    byComm[key].push(p);
  }

  const consolidated = Object.entries(byComm).map(([comm, group]) => {
    const latest = group.reduce((a, b) => a.id > b.id ? a : b);
    const anomalyCount = group.filter(p => p.is_anomalous).length;
    return { ...latest, instanceCount: group.length, anomalyCount };
  });

  const filtered = consolidated.filter((p) => {
    const matchesSearch =
      p.comm.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pid.toString().includes(searchTerm);
    if (!matchesSearch) return false;
    if (filterType === 'anomalous') return p.is_anomalous;
    return true;
  });

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '8px', borderRadius: '8px', color: '#38bdf8' }}>
            <Terminal size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Active Processes</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Unique processes — latest telemetry per process</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="PID or process name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                padding: '6px 10px 6px 30px', color: '#f8fafc',
                fontSize: '0.75rem', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '3px', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            {[
              { key: 'all', label: `All (${consolidated.length})` },
              { key: 'anomalous', label: `Threats (${consolidated.filter(p => p.is_anomalous).length})`, color: '#ef4444' },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilterType(btn.key)}
                className={`btn-ghost ${filterType === btn.key ? 'active' : ''}`}
                style={{ fontSize: '0.6875rem', padding: '3px 8px', color: filterType === btn.key && btn.color ? btn.color : undefined }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: '440px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>PID</th>
              <th>Process</th>
              <th>Instances</th>
              <th>File Ops</th>
              <th>Net</th>
              <th>Syscalls/s</th>
              <th>Score</th>
              <th>Verdict</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '0.8125rem' }}>
                  No processes matching current criteria.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const severity = getSeverity(p);
                const cfg = SEVERITY_CONFIG[severity];
                const isNew = newProcesses?.has(p.pid);

                return (
                  <tr
                    key={p.pid}
                    className={severity === 'critical' ? 'anomalous-row' : ''}
                    style={isNew ? { animation: 'fadeInGlow 2s ease-out' } : undefined}
                  >
                    <td className="mono" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>
                      {isNew && <span style={{ color: '#38bdf8', marginRight: 6, fontSize: '0.6875rem' }}>NEW</span>}
                      {p.pid}
                    </td>
                    <td>
                      <span className="mono" style={{
                        fontWeight: 600, fontSize: '0.8125rem',
                        color: severity === 'critical' ? '#fca5a5' : '#38bdf8',
                      }}>
                        {p.comm}
                      </span>
                    </td>
                    <td className="mono" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      {p.instanceCount}
                    </td>
                    <td className="mono" style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>
                      {p.num_file_opens}O/{p.num_file_renames}R/{p.num_file_deletes}D
                    </td>
                    <td className="mono" style={{ color: p.num_connect > 10 ? '#ef4444' : '#cbd5e1', fontSize: '0.75rem' }}>
                      {p.num_connect}c
                    </td>
                    <td className="mono" style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>
                      {Math.round(p.syscall_rate)}
                    </td>
                    <td className="mono" style={{
                      fontWeight: 600, fontSize: '0.8125rem',
                      color: severity === 'critical' ? '#ef4444' : severity === 'suspicious' ? '#f59e0b' : '#10b981',
                    }}>
                      {p.anomaly_score.toFixed(4)}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '9999px', fontSize: '0.6875rem',
                        fontWeight: 600, letterSpacing: '0.05em',
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                      }}>
                        {severity === 'critical' ? <ShieldAlert size={11} /> : severity === 'suspicious' ? <AlertTriangle size={11} /> : <Shield size={11} />}
                        {cfg.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectWindow(p)}
                        className="btn-ghost"
                        style={{ padding: '3px 8px', fontSize: '0.6875rem', gap: '4px' }}
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}