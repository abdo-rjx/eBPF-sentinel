import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import dataset from './data/bookmarks.json';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HeroBanner from './components/HeroBanner';
import ControlBar from './components/ControlBar';
import BookmarkCard from './components/BookmarkCard';
import BookmarkListRow from './components/BookmarkListRow';
import BookmarkDetailModal from './components/BookmarkDetailModal';
import CommandPaletteModal from './components/CommandPaletteModal';
import Toast from './components/Toast';

import { ChevronDown, ChevronRight, BookmarkX, Layers } from 'lucide-react';

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('relevance');

  const [starredIds, setStarredIds] = useState(() => {
    try {
      const saved = localStorage.getItem('starred_bookmarks_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [expandedCategories, setExpandedCategories] = useState(['animation', 'appearance', 'architecture']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [activeDetailBookmark, setActiveDetailBookmark] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const searchInputRef = useRef(null);

  // Sync starred items with LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('starred_bookmarks_v1', JSON.stringify(starredIds));
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  }, [starredIds]);

  // Keyboard shortcut handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen(prev => !prev);
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        setIsCmdPaletteOpen(false);
        setActiveDetailBookmark(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const toggleStar = (id) => {
    setStarredIds(prev => {
      const exists = prev.includes(id);
      if (exists) {
        triggerToast('Removed from Starred Favorites');
        return prev.filter(item => item !== id);
      } else {
        triggerToast('Saved to Starred Favorites ⭐');
        return [...prev, id];
      }
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    triggerToast('Copied to clipboard!');
  };

  const toggleCategoryExpand = (catId) => {
    setExpandedCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  // Configure Fuse.js for fast client-side fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(dataset.bookmarks, {
      keys: ['title', 'description', 'domain', 'subcategory_name', 'tags'],
      threshold: 0.35,
      ignoreLocation: true
    });
  }, []);

  // Filtered and Sorted Bookmarks list computation
  const filteredBookmarks = useMemo(() => {
    let result = dataset.bookmarks;

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery.trim());
      result = searchResults.map(r => r.item);
    }

    // 2. Category Filter
    if (selectedCategory) {
      result = result.filter(b => b.category === selectedCategory);
    }

    // 3. Subcategory Filter
    if (selectedSubcategory) {
      result = result.filter(b => b.subcategory === selectedSubcategory);
    }

    // 4. Starred Only Filter
    if (showStarredOnly) {
      result = result.filter(b => starredIds.includes(b.id));
    }

    // 5. Resource Type Filter
    if (selectedType !== 'all') {
      result = result.filter(b => b.type === selectedType);
    }

    // 6. Sorting
    if (sortBy === 'title-asc') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'title-desc') {
      result = [...result].sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === 'domain') {
      result = [...result].sort((a, b) => (a.domain || '').localeCompare(b.domain || ''));
    } else if (sortBy === 'category') {
      result = [...result].sort((a, b) => a.category_name.localeCompare(b.category_name));
    }

    return result;
  }, [
    searchQuery,
    selectedCategory,
    selectedSubcategory,
    showStarredOnly,
    selectedType,
    sortBy,
    starredIds,
    fuse
  ]);

  // Grouped by subcategory for Grouped View mode
  const groupedBookmarks = useMemo(() => {
    const map = {};
    filteredBookmarks.forEach(item => {
      const key = item.subcategory_name || item.subcategory;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [filteredBookmarks]);

  // Export Starred Bookmarks as Markdown File
  const handleExportBookmarks = () => {
    const starredList = dataset.bookmarks.filter(b => starredIds.includes(b.id));
    if (starredList.length === 0) {
      triggerToast('No starred bookmarks to export yet! Click ⭐ on any link.');
      return;
    }

    let mdContent = `# My Starred Frontend Dev Bookmarks\n\n`;
    starredList.forEach((b, idx) => {
      mdContent += `${idx + 1}. **[${b.title}](${b.url})** - ${b.description || ''} *(${b.domain})*\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'starred-frontend-bookmarks.md';
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Exported Starred Bookmarks as Markdown!');
  };

  const activeCategoryObj = selectedCategory ? dataset.categories[selectedCategory] : null;

  let activeSubcategoryObj = null;
  if (activeCategoryObj && selectedSubcategory) {
    activeSubcategoryObj = activeCategoryObj.subcategories.find(s => s.id === selectedSubcategory);
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        dataset={dataset}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedSubcategory={selectedSubcategory}
        setSelectedSubcategory={setSelectedSubcategory}
        starredIds={starredIds}
        showStarredOnly={showStarredOnly}
        setShowStarredOnly={setShowStarredOnly}
        expandedCategories={expandedCategories}
        toggleCategoryExpand={toggleCategoryExpand}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Workspace */}
      <div className="main-content">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenCmdPalette={() => setIsCmdPaletteOpen(true)}
          onExportBookmarks={handleExportBookmarks}
          toggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          searchInputRef={searchInputRef}
        />

        <main className="content-body">
          {/* Hero Banner */}
          <HeroBanner
            selectedCategoryObj={activeCategoryObj}
            selectedSubcategoryObj={activeSubcategoryObj}
            showStarredOnly={showStarredOnly}
            totalMatching={filteredBookmarks.length}
            datasetMeta={dataset.meta}
          />

          {/* Controls: Type Filter, Sorting, View Modes */}
          <ControlBar
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />

          {/* Bookmarks Render Area */}
          {filteredBookmarks.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800 p-8">
              <BookmarkX size={48} className="mx-auto text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-300 mb-1">
                No matching bookmarks found
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                Try adjusting your search terms, selecting a different resource type, or clearing active category filters.
              </p>
              <button
                className="pill-btn active mx-auto"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  setSelectedSubcategory(null);
                  setSelectedType('all');
                  setShowStarredOnly(false);
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="bookmarks-grid">
              {filteredBookmarks.map((item) => (
                <BookmarkCard
                  key={item.id}
                  item={item}
                  isStarred={starredIds.includes(item.id)}
                  onToggleStar={toggleStar}
                  onCopyLink={copyToClipboard}
                  onSelectDetail={setActiveDetailBookmark}
                />
              ))}
            </div>
          ) : viewMode === 'list' ? (
            <div className="bookmarks-list">
              {filteredBookmarks.map((item) => (
                <BookmarkListRow
                  key={item.id}
                  item={item}
                  isStarred={starredIds.includes(item.id)}
                  onToggleStar={toggleStar}
                  onCopyLink={copyToClipboard}
                  onSelectDetail={setActiveDetailBookmark}
                />
              ))}
            </div>
          ) : (
            /* Grouped View */
            <div className="space-y-6">
              {Object.entries(groupedBookmarks).map(([subName, items]) => (
                <div key={subName} className="group-section">
                  <div className="group-header">
                    <h3 className="group-title text-cyan-400">
                      <Layers size={18} />
                      <span>{subName}</span>
                    </h3>
                    <span className="pill-btn text-xs">
                      {items.length} links
                    </span>
                  </div>

                  <div className="bookmarks-grid">
                    {items.map((item) => (
                      <BookmarkCard
                        key={item.id}
                        item={item}
                        isStarred={starredIds.includes(item.id)}
                        onToggleStar={toggleStar}
                        onCopyLink={copyToClipboard}
                        onSelectDetail={setActiveDetailBookmark}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Detail Modal */}
      <BookmarkDetailModal
        item={activeDetailBookmark}
        isStarred={activeDetailBookmark ? starredIds.includes(activeDetailBookmark.id) : false}
        onToggleStar={toggleStar}
        onCopyLink={copyToClipboard}
        onClose={() => setActiveDetailBookmark(null)}
      />

      {/* Command Palette Modal */}
      <CommandPaletteModal
        isOpen={isCmdPaletteOpen}
        onClose={() => setIsCmdPaletteOpen(false)}
        bookmarks={dataset.bookmarks}
        categories={Object.values(dataset.categories)}
        onSelectBookmark={setActiveDetailBookmark}
        onToggleViewMode={setViewMode}
        onToggleStarredOnly={() => setShowStarredOnly(prev => !prev)}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}
