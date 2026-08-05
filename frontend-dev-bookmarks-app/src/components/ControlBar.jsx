import React from 'react';
import { LayoutGrid, List, Layers, Filter, ArrowUpDown } from 'lucide-react';

const resourceTypes = [
  { id: 'all', label: 'All Types' },
  { id: 'repository', label: 'GitHub Repos' },
  { id: 'tool', label: 'Tools & Libs' },
  { id: 'video', label: 'Videos & Talks' },
  { id: 'article', label: 'Articles & Guides' },
  { id: 'spec', label: 'Specs & Docs' },
  { id: 'podcast', label: 'Podcasts' }
];

export default function ControlBar({
  selectedType,
  setSelectedType,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy
}) {
  return (
    <div className="control-bar">
      <div className="filter-group">
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1 mr-1">
          <Filter size={14} /> Type:
        </span>
        {resourceTypes.map((t) => (
          <button
            key={t.id}
            className={`pill-btn ${selectedType === t.id ? 'active' : ''}`}
            onClick={() => setSelectedType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <ArrowUpDown size={14} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-md px-2 py-1.5 outline-none cursor-pointer hover:border-slate-700"
          >
            <option value="relevance">Default Order</option>
            <option value="title-asc">Title (A - Z)</option>
            <option value="title-desc">Title (Z - A)</option>
            <option value="domain">Domain Name</option>
            <option value="category">Category</option>
          </select>
        </div>

        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <LayoutGrid size={16} />
            <span className="hidden sm:inline">Grid</span>
          </button>

          <button
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Dense List View"
          >
            <List size={16} />
            <span className="hidden sm:inline">List</span>
          </button>

          <button
            className={`toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
            title="Grouped by Topic View"
          >
            <Layers size={16} />
            <span className="hidden sm:inline">Grouped</span>
          </button>
        </div>
      </div>
    </div>
  );
}
