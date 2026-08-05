import React from 'react';
import { Bookmark, Sparkles, Folder, Layers, Star, Code } from 'lucide-react';

export default function HeroBanner({
  selectedCategoryObj,
  selectedSubcategoryObj,
  showStarredOnly,
  totalMatching,
  datasetMeta
}) {
  let title = "Frontend Development Directory";
  let description = "A curated collection of top-tier frontend resources, frameworks, architectural patterns, browser APIs, UI components, and modern web tooling.";
  let badgeText = "Curated & Battle-Tested";

  if (showStarredOnly) {
    title = "Your Starred Bookmarks";
    description = "Your personal collection of saved tools, articles, and libraries.";
    badgeText = "Saved Items";
  } else if (selectedSubcategoryObj) {
    title = selectedSubcategoryObj.name;
    description = `Handpicked resources for ${selectedSubcategoryObj.name} in ${selectedCategoryObj?.name || 'Frontend'}.`;
    badgeText = selectedCategoryObj?.name || "Subcategory";
  } else if (selectedCategoryObj) {
    title = selectedCategoryObj.name;
    description = selectedCategoryObj.description;
    badgeText = "Category";
  }

  return (
    <div className="hero-banner">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <span className="pill-btn active text-xs font-semibold uppercase tracking-wider">
          <Sparkles size={14} />
          {badgeText}
        </span>
        <span className="text-xs text-slate-400 font-mono">
          License: {datasetMeta?.license || "CC BY 4.0"}
        </span>
      </div>

      <h1 className="hero-title">
        {title}
      </h1>
      
      <p className="hero-desc">
        {description}
      </p>

      <div className="stats-row">
        <div className="stat-box">
          <span className="stat-value">{totalMatching}</span>
          <span className="stat-label">Matching Items</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">1,396+</span>
          <span className="stat-label">Total Curated Links</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">8</span>
          <span className="stat-label">Top Categories</span>
        </div>
        <div className="stat-box">
          <span className="stat-value">60+</span>
          <span className="stat-label">Subtopics</span>
        </div>
      </div>
    </div>
  );
}
