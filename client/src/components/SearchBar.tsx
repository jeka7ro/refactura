// SearchBar — unified search component for all pages
// Rounded, blue icon, shows "X din Y" badge when typing

import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filteredCount?: number;
  totalCount?: number;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Caută...",
  filteredCount,
  totalCount,
  className = "",
}: SearchBarProps) {
  const hasQuery = value.trim().length > 0;
  const showBadge =
    hasQuery && filteredCount !== undefined && totalCount !== undefined;

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Search icon */}
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none z-10" />

      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full pl-9 pr-10 h-9 text-sm rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder:text-slate-400 transition-all"
      />

      {/* Clear button */}
      {hasQuery && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Șterge căutarea"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Results badge — appears below the input when typing */}
      {showBadge && (
        <div className="absolute -bottom-6 left-3.5 flex items-center gap-1 pointer-events-none">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold shadow-sm">
            {filteredCount} din {totalCount}
          </span>
        </div>
      )}
    </div>
  );
}
