import React from 'react';
import { ExternalLink, Star, Copy, PlayCircle, BookOpen, Wrench, Radio } from 'lucide-react';

const GithubIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const typeIcons = {
  repository: GithubIcon,
  video: PlayCircle,
  spec: BookOpen,
  tool: Wrench,
  podcast: Radio,
  article: BookOpen,
  social: ExternalLink
};

export default function BookmarkCard({
  item,
  isStarred,
  onToggleStar,
  onCopyLink,
  onSelectDetail
}) {
  const TypeIcon = typeIcons[item.type] || ExternalLink;
  const faviconUrl = item.domain 
    ? `https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`
    : null;

  return (
    <div className="bookmark-card">
      <div>
        <div className="card-top">
          <div className="domain-badge">
            {faviconUrl ? (
              <img 
                src={faviconUrl} 
                alt="" 
                className="domain-icon"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <TypeIcon size={14} />
            )}
            <span>{item.domain || 'web'}</span>
          </div>

          <div className="card-actions">
            <button
              className={`action-icon-btn ${isStarred ? 'starred' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(item.id);
              }}
              title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
            </button>

            <button
              className="action-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink(item.url);
              }}
              title="Copy URL"
            >
              <Copy size={15} />
            </button>
          </div>
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="card-title"
          onClick={(e) => {
            // Allow middle click / new tab natively, but if clicked inside card trigger modal optional
          }}
        >
          {item.title}
        </a>

        {item.description && (
          <p className="card-desc" onClick={() => onSelectDetail(item)}>
            {item.description}
          </p>
        )}
      </div>

      <div className="card-footer">
        <span className="subcat-tag">
          {item.subcategory_name || item.subcategory}
        </span>
        <span className="type-pill">
          {item.type}
        </span>
      </div>
    </div>
  );
}
