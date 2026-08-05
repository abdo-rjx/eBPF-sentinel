import React from 'react';
import { Search, Command, Menu, Download, Sparkles } from 'lucide-react';

const GithubIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function Header({
  searchQuery,
  setSearchQuery,
  onOpenCmdPalette,
  onExportBookmarks,
  toggleSidebar,
  searchInputRef
}) {
  return (
    <header className="top-header">
      <div className="flex items-center gap-3">
        <button 
          className="btn-icon lg:hidden"
          onClick={toggleSidebar}
          title="Toggle Navigation Menu"
        >
          <Menu size={20} />
        </button>

        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search 1,400+ frontend resources (Press '/' to focus)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="keyboard-kbd">/</kbd>
        </div>
      </div>

      <div className="header-actions">
        <button 
          className="btn-icon"
          onClick={onOpenCmdPalette}
          title="Open Command Palette (Cmd + K)"
        >
          <Command size={18} />
        </button>

        <button
          className="btn-icon"
          onClick={onExportBookmarks}
          title="Export Starred Bookmarks"
        >
          <Download size={18} />
        </button>

        <a
          href="https://github.com/dypsilon/frontend-dev-bookmarks"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-icon"
          title="View Original GitHub Repository"
        >
          <GithubIcon size={18} />
        </a>
      </div>
    </header>
  );
}
