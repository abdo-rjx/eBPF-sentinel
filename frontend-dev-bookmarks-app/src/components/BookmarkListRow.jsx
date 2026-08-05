import React from 'react';
import { ExternalLink, Star, Copy } from 'lucide-react';

export default function BookmarkListRow({
  item,
  isStarred,
  onToggleStar,
  onCopyLink,
  onSelectDetail
}) {
  const faviconUrl = item.domain 
    ? `https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`
    : null;

  return (
    <div className="list-row">
      <div className="list-main">
        <button
          className={`action-icon-btn ${isStarred ? 'starred' : ''}`}
          onClick={() => onToggleStar(item.id)}
          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
        </button>

        {faviconUrl && (
          <img 
            src={faviconUrl} 
            alt="" 
            className="w-4 h-4 rounded-sm opacity-80"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="list-title"
        >
          {item.title}
        </a>

        <span className="list-desc" onClick={() => onSelectDetail(item)}>
          {item.description}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="domain-badge hidden md:inline-flex">
          {item.domain}
        </span>

        <span className="subcat-tag text-xs hidden lg:inline">
          {item.subcategory_name}
        </span>

        <div className="flex items-center gap-1">
          <button
            className="action-icon-btn"
            onClick={() => onCopyLink(item.url)}
            title="Copy Link"
          >
            <Copy size={15} />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="action-icon-btn"
            title="Open in new tab"
          >
            <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}
