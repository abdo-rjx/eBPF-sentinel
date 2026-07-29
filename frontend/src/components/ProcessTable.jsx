import React, { useState } from 'react';
import { Search, Filter, ShieldAlert, ChevronRight, Eye, Terminal } from 'lucide-react';

export default function ProcessTable({ windows, onSelectWindow }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'anomalous' | 'high_rate'

  // Filter windows based on search and selected filter
  const filteredWindows = windows.filter((w) => {
    const matchesSearch = 
      w.comm.toLowerCase().includes(searchTerm.toLowerCase()) || 
      w.pid.toString().includes(searchTerm);

    if (!matchesSearch) return false;

    if (filterType === 'anomalous') return w.is_anomalous;
    if (filterType === 'high_rate') return w.syscall_rate > 50;
    return true;
  });

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '8px', borderRadius: '8px', color: '#38bdf8' }}>
            <Terminal size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>Live Process Telemetry Stream</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Aggregated 5-second process window vectors from kernel tracepoints</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search PID or process..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 12px 6px 32px',
                color: '#f8fafc',
                fontSize: '0.8125rem',
                outline: 'none'
              }}
            />
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(15, 23, 42, 0.6)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setFilterType('all')}
              className={`btn-ghost ${filterType === 'all' ? 'active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              All ({windows.length})
            </button>
            <button
              onClick={() => setFilterType('anomalous')}
              className={`btn-ghost ${filterType === 'anomalous' ? 'active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '4px 8px', color: filterType === 'anomalous' ? '#ef4444' : undefined }}
            >
              🚨 Threats ({windows.filter(w => w.is_anomalous).length})
            </button>
          </div>
        </div>
      </div>

      {/* Process Table */}
      <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>PID / PPID</th>
              <th>Process Command</th>
              <th>File Renames</th>
              <th>Deletes</th>
              <th>Net Sockets</th>
              <th>Syscall Density</th>
              <th>Anomaly Score</th>
              <th>Threat Risk</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWindows.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                  No process telemetry matching current criteria.
                </td>
              </tr>
            ) : (
              filteredWindows.map((w, index) => {
                const timeStr = new Date(w.window_start_ns / 1e6).toLocaleTimeString();
                const isAnomaly = w.is_anomalous;

                return (
                  <tr key={index} className={isAnomaly ? 'anomalous-row' : ''}>
                    <td className="mono" style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{timeStr}</td>
                    <td className="mono" style={{ fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>{w.pid}</span>
                      <span style={{ color: '#64748b' }}> / {w.ppid}</span>
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: isAnomaly ? '#fca5a5' : '#38bdf8' }}>
                        {w.comm}
                      </span>
                    </td>
                    <td className="mono" style={{ color: w.num_file_renames > 20 ? '#ef4444' : '#cbd5e1' }}>
                      {w.num_file_renames}
                    </td>
                    <td className="mono" style={{ color: w.num_file_deletes > 10 ? '#ef4444' : '#cbd5e1' }}>
                      {w.num_file_deletes}
                    </td>
                    <td className="mono" style={{ color: w.num_connect > 10 ? '#ef4444' : '#cbd5e1' }}>
                      {w.num_connect}
                    </td>
                    <td className="mono" style={{ color: '#cbd5e1' }}>
                      {Math.round(w.syscall_rate)}/s
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: isAnomaly ? '#ef4444' : '#10b981' }}>
                      {w.anomaly_score.toFixed(4)}
                    </td>
                    <td>
                      <span className={`badge ${isAnomaly ? 'badge-danger' : w.anomaly_score < 0 ? 'badge-warning' : 'badge-normal'}`}>
                        {isAnomaly ? '🚨 CRITICAL' : w.anomaly_score < 0 ? '⚠️ SUSPICIOUS' : 'BENIGN'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectWindow(w)}
                        className="btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', gap: '4px' }}
                      >
                        <Eye size={14} /> Inspect
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
