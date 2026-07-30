import React from 'react';
import { AlertTriangle, Shield, TrendingUp, BarChart3, Info } from 'lucide-react';

const FEATURE_LABELS = {
  num_execve: 'Process Executions',
  num_distinct_children: 'Child Process Spawn',
  num_file_opens: 'File Opens',
  num_file_renames: 'File Renames',
  num_file_deletes: 'File Deletions',
  num_distinct_files_touched: 'Unique Files Accessed',
  num_connect: 'Socket Connections',
  num_distinct_dest_ips: 'Distinct Remote IPs',
  num_setuid: 'Setuid Attempts',
  syscall_rate: 'Syscall Density',
};

function computeAnalysis(windowData) {
  const BASELINE = {
    num_execve: { mean: 2.5, std: 3.0 },
    num_distinct_children: { mean: 0.3, std: 0.8 },
    num_file_opens: { mean: 5.0, std: 8.0 },
    num_file_renames: { mean: 0.1, std: 0.5 },
    num_file_deletes: { mean: 0.1, std: 0.5 },
    num_distinct_files_touched: { mean: 3.0, std: 4.0 },
    num_connect: { mean: 1.5, std: 3.0 },
    num_distinct_dest_ips: { mean: 0.3, std: 1.0 },
    num_setuid: { mean: 0.0, std: 0.1 },
    syscall_rate: { mean: 8.0, std: 10.0 },
  };

  const contributions = Object.keys(BASELINE).map((feature) => {
    const { mean, std } = BASELINE[feature];
    const value = windowData[feature] ?? 0;
    const z = std > 0 ? (value - mean) / std : 0;
    return {
      feature,
      label: FEATURE_LABELS[feature] || feature,
      value,
      baseline_mean: mean,
      baseline_std: std,
      z_score: Math.round(z * 1000) / 1000,
      severity: Math.abs(z) > 3 ? 'high' : Math.abs(z) > 1.5 ? 'medium' : 'low',
    };
  });

  contributions.sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));

  const topContributors = contributions.filter((c) => Math.abs(c.z_score) > 1.5);
  const maxAbsZ = Math.max(...contributions.map((c) => Math.abs(c.z_score)), 1);

  const summary = windowData.is_anomalous
    ? `${Math.max(topContributors.length, 1)} behavioral signal${topContributors.length > 1 ? 's' : ''} deviating from baseline. ${topContributors[0]?.label || ''} shows the highest anomaly contribution.`
    : 'Process behavior is within normal statistical bounds.';

  return { contributions, topContributors, maxAbsZ, summary };
}

export default function AIAnalysisPanel({ windowData }) {
  if (!windowData) return null;

  const analysis = computeAnalysis(windowData);
  const { contributions, topContributors, maxAbsZ, summary } = analysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Shield size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>ML Decision Summary</span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.6 }}>{summary}</p>
      </div>

      {topContributors.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={16} color="#ef4444" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fca5a5' }}>Top Anomaly Contributors</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topContributors.slice(0, 5).map((c) => (
              <div key={c.feature} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#f8fafc', marginBottom: '4px' }}>
                    {c.label}
                  </div>
                  <div style={{
                    height: '6px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(Math.abs(c.z_score) / maxAbsZ * 100, 100)}%`,
                      background: c.severity === 'high' ? '#ef4444' : '#f59e0b',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>
                    {c.value}
                  </div>
                  <div className="mono" style={{ fontSize: '0.6875rem', color: c.severity === 'high' ? '#ef4444' : '#f59e0b' }}>
                    z={c.z_score > 0 ? '+' : ''}{c.z_score}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <BarChart3 size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>Full Feature Vector Analysis</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {contributions.map((c) => {
            const isHighlight = Math.abs(c.z_score) > 1.5;
            return (
              <div key={c.feature} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                background: isHighlight ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                borderRadius: '4px',
                fontSize: '0.75rem',
              }}>
                <span style={{ color: isHighlight ? '#fca5a5' : '#94a3b8' }}>{c.label}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="mono" style={{ fontWeight: 600, color: '#f8fafc' }}>{c.value}</span>
                  <span className="mono" style={{
                    fontSize: '0.6875rem',
                    color: isHighlight ? '#ef4444' : '#64748b',
                    width: '52px',
                    textAlign: 'right',
                  }}>
                    z={c.z_score > 0 ? '+' : ''}{c.z_score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}