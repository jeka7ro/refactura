import { useState, useRef, useEffect, useMemo } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Check, X, Search, Building2, User } from "lucide-react";

export interface PartnerItem {
  id: number;
  name: string;
  cui?: string | null;
  sagaCode?: string | null;
  isSupplier?: number | boolean | null;
  city?: string | null;
  address?: string | null;
  regCom?: string | null;
  country?: string | null;
  currency?: string | null;
}

interface PartnerComboboxProps {
  value: number | null;
  onChange: (id: number | null, partner?: PartnerItem) => void;
  partners: PartnerItem[];
  placeholder?: string;
  className?: string;
  filterType?: "all" | "client" | "supplier";
  disabled?: boolean;
}

const normalizeText = (str: string) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export default function PartnerCombobox({
  value,
  onChange,
  partners = [],
  placeholder = "Caută partener (nume, CUI sau cod SAGA)...",
  className = "",
  filterType = "all",
  disabled = false,
}: PartnerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected partner
  const selectedPartner = useMemo(() => {
    if (!value) return null;
    return partners.find((p) => p.id === value) || null;
  }, [value, partners]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    const q = normalizeText(search);
    const cleanSearchCui = q.replace(/^ro/i, "").trim();

    return partners
      .filter((p) => {
        // Filter type: client or supplier
        if (filterType === "client" && p.isSupplier === 1) return false;
        if (filterType === "supplier" && p.isSupplier !== 1) return false;

        if (!q) return true;

        const nameNorm = normalizeText(p.name || "");
        const cuiNorm = normalizeText(p.cui || "");
        const sagaNorm = normalizeText(p.sagaCode || "");
        const cityNorm = normalizeText(p.city || "");

        return (
          nameNorm.includes(q) ||
          cuiNorm.includes(q) ||
          (cleanSearchCui && cuiNorm.replace(/^ro/i, "").includes(cleanSearchCui)) ||
          sagaNorm.includes(q) ||
          cityNorm.includes(q)
        );
      })
      .slice(0, 45); // Max 45 items for optimal performance
  }, [partners, search, filterType]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredPartners]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current && filteredPartners.length > 0) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen, filteredPartners.length]);

  const handleSelect = (partner: PartnerItem) => {
    onChange(partner.id, partner);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredPartners.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && filteredPartners.length > 0) {
      e.preventDefault();
      handleSelect(filteredPartners[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Anchor asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          className={`w-full flex items-center justify-between text-left rounded-xl bg-white dark:bg-slate-900 border transition-all ${
            isOpen
              ? "border-primary ring-2 ring-primary/20 shadow-xs"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
          } h-10 px-3 ${className} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
            {selectedPartner ? (
              <div className="flex items-center gap-2 truncate text-xs">
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {selectedPartner.name}
                </span>
                {selectedPartner.cui && (
                  <span className="font-mono text-slate-500 text-[11px] shrink-0">
                    ({selectedPartner.cui})
                  </span>
                )}
                {selectedPartner.isSupplier === 1 ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                    Furnizor
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                    Client
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                {placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {selectedPartner && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                title="Deselectează partener"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </button>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={5}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[340px] max-w-[560px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95"
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tastează nume, CUI sau cod SAGA..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
              <span>{filteredPartners.length} rezultate afișate</span>
              <span>1853 parteneri în baza de date</span>
            </div>
          </div>

          {/* List items */}
          <div
            ref={listRef}
            className="max-h-[280px] overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-slate-800/60"
          >
            {filteredPartners.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Niciun partener găsit pentru "{search}".
              </div>
            ) : (
              filteredPartners.map((p, idx) => {
                const isSelected = selectedPartner?.id === p.id;
                const isActive = idx === activeIndex;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-colors flex items-start justify-between gap-3 text-xs ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800/80"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    } ${isSelected ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </span>
                        {p.isSupplier === 1 ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                            Furnizor
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                            Client
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {p.cui && <span>CUI: {p.cui}</span>}
                        {p.sagaCode && <span>• Cod: {p.sagaCode}</span>}
                        {p.city && <span className="truncate">• {p.city}</span>}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    )}
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
