import React from 'react';
import { 
  Bookmark, 
  Star, 
  Activity, 
  Palette, 
  Cpu, 
  Globe, 
  Users, 
  Code2, 
  Layout, 
  Wrench,
  ChevronRight,
  ChevronDown,
  Layers,
  Sparkles
} from 'lucide-react';

const iconMap = {
  Activity,
  Palette,
  Cpu,
  Globe,
  Users,
  Code2,
  Layout,
  Wrench
};

export default function Sidebar({
  dataset,
  selectedCategory,
  setSelectedCategory,
  selectedSubcategory,
  setSelectedSubcategory,
  starredIds,
  showStarredOnly,
  setShowStarredOnly,
  expandedCategories,
  toggleCategoryExpand,
  isOpen,
  setIsOpen
}) {
  const categories = Object.values(dataset.categories || {});
  const totalCount = dataset.meta?.total || 0;
  const starredCount = starredIds.length;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-logo">
          <Bookmark size={20} />
        </div>
        <div>
          <div className="brand-title">DevBookmarks</div>
          <div className="brand-subtitle">Curated Frontend Directory</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Overview</div>
        
        <div 
          className={`nav-item ${!selectedCategory && !showStarredOnly ? 'active' : ''}`}
          onClick={() => {
            setSelectedCategory(null);
            setSelectedSubcategory(null);
            setShowStarredOnly(false);
            if (window.innerWidth < 900) setIsOpen(false);
          }}
        >
          <div className="nav-item-left">
            <Layers size={16} />
            <span>All Resources</span>
          </div>
          <span className="nav-count">{totalCount}</span>
        </div>

        <div 
          className={`nav-item ${showStarredOnly ? 'active' : ''}`}
          onClick={() => {
            setShowStarredOnly(true);
            setSelectedCategory(null);
            setSelectedSubcategory(null);
            if (window.innerWidth < 900) setIsOpen(false);
          }}
        >
          <div className="nav-item-left">
            <Star size={16} className={starredCount > 0 ? "text-amber-400" : ""} />
            <span>Starred Bookmarks</span>
          </div>
          <span className="nav-count">{starredCount}</span>
        </div>

        <div className="nav-section-label">Categories ({categories.length})</div>

        {categories.map((cat) => {
          const IconComp = iconMap[cat.icon] || Bookmark;
          const isCatActive = selectedCategory === cat.id && !showStarredOnly;
          const isExpanded = expandedCategories.includes(cat.id);

          return (
            <div key={cat.id}>
              <div 
                className={`nav-item ${isCatActive ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedSubcategory(null);
                  setShowStarredOnly(false);
                  toggleCategoryExpand(cat.id);
                }}
              >
                <div className="nav-item-left">
                  <IconComp size={16} style={{ color: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="nav-count">{cat.total_bookmarks}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {isExpanded && (
                <div className="subcat-list">
                  {cat.subcategories.map((sub) => {
                    const isSubActive = selectedSubcategory === sub.id;
                    return (
                      <div
                        key={sub.id}
                        className={`subcat-item ${isSubActive ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCategory(cat.id);
                          setSelectedSubcategory(sub.id);
                          setShowStarredOnly(false);
                          if (window.innerWidth < 900) setIsOpen(false);
                        }}
                      >
                        <span className="truncate">{sub.name}</span>
                        <span className="text-xs opacity-60">{sub.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
