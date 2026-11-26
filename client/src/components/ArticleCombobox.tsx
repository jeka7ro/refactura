import { useState, useRef, useEffect, useMemo } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Check, X, Search } from "lucide-react";

export interface SagaArticleItem {
  id?: number;
  code: string;
  name: string;
  unit?: string | null;
  vatRate?: string | number | null;
  category?: string | null;
  accountingAccount?: string | null;
  knownPrices?: number[];
  lastPrice?: number | null;
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
          className={`relative flex items-center rounded-lg bg-[#f2f2f7] dark:bg-[#2c2c2e] border transition-all ${
            isOpen
              ? "bg-white dark:bg-[#2c2c2e] border-[var(--tenant-theme-color,#16a34a)] ring-2 ring-[var(--tenant-theme-color,#16a34a)]/20 shadow-xs"
              : "border-black/[0.08] dark:border-white/[0.10] hover:border-black/[0.15] dark:hover:border-white/[0.16]"
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
            className="w-full bg-transparent text-xs tabular-nums font-medium text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none pr-4 placeholder:font-sans placeholder:font-normal placeholder:text-[#8e8e93]"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className="text-[#8e8e93] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7] shrink-0"
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
          className="z-50 min-w-[280px] max-w-[420px] w-[var(--radix-popover-trigger-width)] bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] shadow-2xl rounded-2xl p-1.5 focus:outline-none text-xs overscroll-contain"
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-black/[0.05] dark:border-white/[0.07] text-[11.5px] text-[#6e6e73] dark:text-[#98989d] font-medium mb-1">
            <span>Nomenclator articole ({filteredArticles.length})</span>
            {search && (
              <span className="font-normal truncate max-w-[120px]">„{search}”</span>
            )}
          </div>

          <div
            ref={listRef}
            className="max-h-[220px] overflow-y-auto space-y-0.5 pr-0.5"
          >
            {filteredArticles.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#6e6e73] dark:text-[#98989d]">
                <p>Niciun articol găsit.</p>
                <p className="text-[11px] mt-1 text-[#8e8e93] tabular-nums">
                  Poți păstra codul tastat: <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{search}</strong>
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
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-colors text-xs ${
                      isActive
                        ? "bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7]"
                        : "text-[#1d1d1f] dark:text-[#ebebf5] hover:bg-[#f5f5f7] dark:hover:bg-white/[0.04]"
                    } ${isSelected ? "font-semibold text-[var(--tenant-theme-color,#16a34a)]" : ""}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="tabular-nums font-bold text-[var(--tenant-theme-color,#16a34a)] text-xs shrink-0">
                        {art.code}
                      </span>
                      <span className="truncate" title={art.name}>
                        {art.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {art.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#6e6e73] dark:text-[#98989d] border border-black/[0.06] dark:border-white/[0.08]">
                          {art.category}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--tenant-theme-color,#16a34a)]" />}
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
