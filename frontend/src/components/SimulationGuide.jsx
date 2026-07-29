import React, { useState } from 'react';
import { Terminal, Play, ShieldAlert, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export default function SimulationGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const commands = [
    {
      title: 'Simulate Ransomware Attack (File Thrashing)',
      desc: 'Creates 500 temporary files, rapidly renames them to .locked, and deletes them in an isolated folder.',
      cmd: 'python test/simulate_ransomware.py'
    },
    {
      title: 'Simulate C2 Beaconing (Network Anomaly)',
      desc: 'Rapidly attempts socket connections to loopback target ports to simulate C2 heartbeat beaconing.',
      cmd: 'python test/simulate_beaconing.py'
    }
  ];

  const handleCopy = (cmd, index) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="glass-panel" style={{ padding: '16px 20px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '6px', borderRadius: '6px', color: '#38bdf8' }}>
            <Play size={18} />
          </div>
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>
              🧪 Security Live Demo & Synthetic Attack Trigger Guide
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
              Click to view commands for triggering real-time dashboard alerts
            </span>
          </div>
        </div>

        <button className="btn-ghost" style={{ padding: '4px' }}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {commands.map((item, idx) => (
            <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#38bdf8', marginBottom: '4px' }}>
                {item.title}
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '10px' }}>
                {item.desc}
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#090d16', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <code className="mono" style={{ fontSize: '0.75rem', color: '#f8fafc' }}>
                  {item.cmd}
                </code>
                <button
                  onClick={() => handleCopy(item.cmd, idx)}
                  className="btn-ghost"
                  style={{ padding: '4px 6px', fontSize: '0.75rem', gap: '4px' }}
                >
                  {copiedIndex === idx ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedIndex === idx ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
