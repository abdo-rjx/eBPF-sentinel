import React, { useState, useEffect } from 'react';
import { Search, Command, ArrowRight, Star, ExternalLink, Bookmark, Layers } from 'lucide-react';

export default function CommandPaletteModal({
  isOpen,
  onClose,
  bookmarks = [],
  categories = [],
  onSelectBookmark,
  onSelectCategory,
  onToggleViewMode,
  onToggleStarredOnly
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredBookmarks = query.trim() 
    ? bookmarks.filter(b => 
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.domain.toLowerCase().includes(query.toLowerCase()) ||
        b.subcategory_name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : bookmarks.slice(0, 5);

  const matchingCategories = query.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : categories;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="cmd-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <input
            autoFocus
            type="text"
            className="cmd-search-input"
            placeholder="Type a command or search 1,400+ frontend links..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="absolute right-4 top-4 text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">
            ESC to close
          </kbd>
        </div>

        <div className="cmd-results">
          {/* Action Commands */}
          {!query && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1">
                Quick Actions
              </div>
              <div 
                className="cmd-item"
                onClick={() => {
                  onToggleStarredOnly();
                  onClose();
                }}
              >
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-400" />
                  <span>Show Starred Bookmarks</span>
                </div>
                <ArrowRight size={14} />
              </div>
              <div 
                className="cmd-item"
                onClick={() => {
                  onToggleViewMode('grid');
                  onClose();
                }}
              >
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-cyan-400" />
                  <span>Switch to Grid View</span>
                </div>
                <ArrowRight size={14} />
              </div>
            </div>
          )}

          {/* Bookmarks Search Results */}
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 py-1">
              Matching Resources ({filteredBookmarks.length})
            </div>
            {filteredBookmarks.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No matching resources found for "{query}"
              </div>
            ) : (
              filteredBookmarks.map((item, idx) => (
                <div
                  key={item.id}
                  className={`cmd-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectBookmark(item);
                    onClose();
                  }}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-medium text-slate-200 truncate">
                      {item.title}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {item.domain} • {item.subcategory_name}
                    </span>
                  </div>
                  <ExternalLink size={14} className="shrink-0 text-slate-500" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
