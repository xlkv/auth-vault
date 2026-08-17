import React from 'react';
import { Search, X, Layers, Briefcase, User, Wallet, Users, MoreHorizontal } from 'lucide-react';
import { AccountCategory } from '../types/auth';

interface SearchAndFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: AccountCategory;
  onCategoryChange: (category: AccountCategory) => void;
  categoryCounts: Record<AccountCategory, number>;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  categoryCounts
}) => {
  const categories: { id: AccountCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All Accounts', icon: <Layers size={14} /> },
    { id: 'work', label: 'Work', icon: <Briefcase size={14} /> },
    { id: 'personal', label: 'Personal', icon: <User size={14} /> },
    { id: 'finance', label: 'Finance & Crypto', icon: <Wallet size={14} /> },
    { id: 'social', label: 'Social', icon: <Users size={14} /> },
    { id: 'other', label: 'Other', icon: <MoreHorizontal size={14} /> }
  ];

  return (
    <section className="search-filter-section">
      <div className="search-box-wrapper">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search accounts or issuers (e.g. GitHub, Google, Work)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="category-pills">
        {categories.map((cat) => {
          const count = categoryCounts[cat.id] || 0;
          if (cat.id !== 'all' && count === 0) return null; // hide empty categories to keep UI clean
          return (
            <button
              key={cat.id}
              className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => onCategoryChange(cat.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                {cat.icon}
                {cat.label} ({count})
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
