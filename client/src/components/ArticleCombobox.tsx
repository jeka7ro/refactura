import { useState, useRef, useEffect, useMemo } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Check, X, Search } from "lucide-react";

export interface SagaArticleItem {
  id?: number;
  code: string;
  name: string;
  unit?: string;
  vatRate?: string | number | null;
  category?: string;
  accountingAccount?: string;
}

interface ArticleComboboxProps {
  value: string;
  onChange: (code: string, article?: SagaArticleItem) => void;
  articles: SagaArticleItem[];
  placeholder?: string;
  className?: string;
}

const normalizeText = (str: string) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export default function ArticleCombobox({
  value,
  onChange,
  articles = [],
  placeholder = "Caută cod/articol...",
  className = "",
}: ArticleComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Keep search in sync with value when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch(value || "");
    }
  }, [value, isOpen]);

  // Find exact matched article
  const currentArticle = useMemo(() => {
    if (!value) return null;
    const clean = value.trim().toLowerCase();
    return articles.find(
      (a) =>
        a.code.toLowerCase() === clean ||
        a.name.toLowerCase() === clean ||
        `${a.code} - ${a.name}`.toLowerCase() === clean
    );
  }, [value, articles]);

  // Filtered articles based on search query
  const filteredArticles = useMemo(() => {
    const q = normalizeText(search);
    if (!q) {
      // Return first 40 articles
      return articles.slice(0, 40);
    }

    return articles
      .filter((a) => {
        const c = normalizeText(a.code);
        const n = normalizeText(a.name);
        const cat = normalizeText(a.category || "");
        return c.includes(q) || n.includes(q) || cat.includes(q);
      })
      .slice(0, 40);
  }, [articles, search]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredArticles]);

  useEffect(() => {
    if (isOpen && listRef.current && filteredArticles.length > 0) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen, filteredArticles.length]);

  const handleSelect = (art: SagaArticleItem) => {
    onChange(art.code, art);
    setSearch(art.code);
    setIsOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          className={`relative flex items-center rounded-lg bg-white dark:bg-slate-800 border transition-all ${
            isOpen
              ? "border-teal-500 ring-1 ring-teal-500/20 shadow-xs"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          } h-7 px-2 ${className}`}
          title={currentArticle ? `${currentArticle.code} — ${currentArticle.name}` : value}
        >
          <input
            ref={inputRef}
            type="text"
            value={search}
            placeholder={placeholder}
            onClick={() => {
              setIsOpen(true);
              inputRef.current?.select();
            }}
            onFocus={() => {
              setIsOpen(true);
              inputRef.current?.select();
            }}
            onChange={(e) => {
              const val = e.target.value;
              setSearch(val);
              if (!isOpen) setIsOpen(true);
              const clean = val.trim();
              const exact = articles.find(
                (a) =>
                  a.code.toLowerCase() === clean.toLowerCase() ||
                  a.name.toLowerCase() === clean.toLowerCase()
              );
              if (exact) {
                onChange(exact.code, exact);
              } else {
                onChange(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!isOpen) {
                  setIsOpen(true);
                } else {
                  setActiveIndex((prev) =>
                    prev < filteredArticles.length - 1 ? prev + 1 : prev
                  );
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (isOpen && filteredArticles[activeIndex]) {
                  handleSelect(filteredArticles[activeIndex]);
                }
              }
            }}
            className="w-full bg-transparent text-xs font-mono font-medium text-slate-900 dark:text-white focus:outline-none pr-4 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 min-w-[280px] max-w-[420px] w-[var(--radix-popover-trigger-width)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-1.5 focus:outline-none text-xs"
        >
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
            <span>Nomenclator Articole ({filteredArticles.length})</span>
            {search && (
              <span className="font-normal lowercase truncate max-w-[120px]">„{search}”</span>
            )}
          </div>

          <div
            ref={listRef}
            className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5"
          >
            {filteredArticles.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                <p>Niciun articol găsit.</p>
                <p className="text-[11px] mt-1 text-slate-500 font-mono">
                  Poți păstra codul tastat: <strong>{search}</strong>
                </p>
              </div>
            ) : (
              filteredArticles.map((art, idx) => {
                const isSelected =
                  art.code.toLowerCase() === value.trim().toLowerCase();
                const isActive = idx === activeIndex;

                return (
                  <div
                    key={art.id ?? `${art.code}-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(art);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    } ${isSelected ? "font-semibold text-teal-600 dark:text-teal-400" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-xs shrink-0">
                        {art.code}
                      </span>
                      <span className="truncate" title={art.name}>
                        {art.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {art.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                          {art.category}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
