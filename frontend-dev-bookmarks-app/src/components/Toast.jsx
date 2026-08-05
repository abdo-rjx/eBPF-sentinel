import React from 'react';
import { Check, Sparkles } from 'lucide-react';

export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div className="toast-notification">
      <Check size={18} className="text-cyan-400" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}
