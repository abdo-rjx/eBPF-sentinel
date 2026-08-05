import React from 'react';
import { X, ExternalLink, Star, Copy, Share2, Tag, Globe, Folder, Check } from 'lucide-react';

export default function BookmarkDetailModal({
  item,
  isStarred,
  onToggleStar,
  onCopyLink,
  onClose,
  relatedItems = []
}) {
  if (!item) return null;

  const markdownSnippet = `[${item.title}](${item.url}) - ${item.description}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="cmd-modal p-6 max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="domain-badge">
                <Globe size={12} />
                {item.domain}
              </span>
              <span className="type-pill uppercase font-mono text-[10px]">
                {item.type}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">
              {item.title}
            </h2>
          </div>

          <button 
            onClick={onClose}
            className="action-icon-btn p-1.5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-1 tracking-wider">
              Description
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/60 p-3.5 rounded-lg border border-slate-800/80">
              {item.description || "No description provided."}
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 p-3 rounded-lg border border-slate-800/50">
            <div className="flex items-center gap-2">
              <Folder size={14} className="text-cyan-400" />
              <span>{item.category_name} / <strong>{item.subcategory_name}</strong></span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-1.5 tracking-wider">
              Markdown Snippet
            </h4>
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-md border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto">
              <code className="flex-1 truncate">{markdownSnippet}</code>
              <button 
                className="btn-icon w-7 h-7 shrink-0"
                onClick={() => onCopyLink(markdownSnippet)}
                title="Copy Markdown"
              >
                <Copy size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800 gap-3">
          <button
            className={`pill-btn ${isStarred ? 'active' : ''}`}
            onClick={() => onToggleStar(item.id)}
          >
            <Star size={15} fill={isStarred ? 'currentColor' : 'none'} />
            <span>{isStarred ? 'Saved in Favorites' : 'Add to Favorites'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              className="pill-btn"
              onClick={() => onCopyLink(item.url)}
            >
              <Copy size={15} />
              <span>Copy Link</span>
            </button>

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pill-btn active bg-cyan-500/20 text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/30"
            >
              <span>Visit Website</span>
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
