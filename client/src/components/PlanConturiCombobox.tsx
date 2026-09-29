import { useState, useRef, useEffect, useMemo } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown, Check, X, Search } from "lucide-react";

export interface PlanContItem {
  cod: string;
  denumire: string;
  shortLabel?: string;
}

export const POPULAR_NIR_ACCOUNTS: PlanContItem[] = [
  { cod: "371", denumire: "MĂRFURI", shortLabel: "Mărfuri" },
  { cod: "301", denumire: "MATERII PRIME", shortLabel: "Materii prime" },
  { cod: "3021", denumire: "MATERIALE AUXILIARE", shortLabel: "Materiale auxiliare" },
  { cod: "3022", denumire: "COMBUSTIBILI", shortLabel: "Combustibili" },
  { cod: "3024", denumire: "PIESE DE SCHIMB", shortLabel: "Piese de schimb" },
  { cod: "3028", denumire: "ALTE MAT. CONSUMABILE", shortLabel: "Consumabile" },
  { cod: "303", denumire: "OBIECTE DE INVENTAR", shortLabel: "Obiecte inventar" },
  { cod: "381", denumire: "AMBALAJE", shortLabel: "Ambalaje" },
  { cod: "345", denumire: "PRODUSE FINITE", shortLabel: "Produse finite" },
  { cod: "341", denumire: "SEMIFABRICATE", shortLabel: "Semifabricate" },
  { cod: "4091", denumire: "AVANSURI FURNIZORI STOCURI", shortLabel: "Avansuri" },
  { cod: "605", denumire: "ENERGIE SI APA", shortLabel: "Utilități" },
  { cod: "628", denumire: "ALTE CHELTUIELI CU SERVICIILE", shortLabel: "Servicii terți" },
  { cod: "628.01", denumire: "ALTE CHELT CU SERVICIILE EXECUTATE DE TERTI DEDUCTIBIL", shortLabel: "Servicii terți" },
  { cod: "628.02", denumire: "ALTE CHELT CU SERVICIILE - NEDEDUCTIBIL", shortLabel: "Servicii (neded.)" },
  { cod: "627", denumire: "CHELTUIELI CU SERVICIILE BANCARE", shortLabel: "Servicii bancare" },
  { cod: "626", denumire: "CHELTUIELI POSTALE SI TELECOMUNICATII", shortLabel: "Poștă & Telecom" },
  { cod: "611", denumire: "CHELTUIELI CU INTRETINEREA SI REPARATIILE", shortLabel: "Întreținere & Rep." },
  { cod: "612", denumire: "CHELTUIELI CU CHIRIILE", shortLabel: "Chirii" },
  { cod: "613", denumire: "CHELTUIELI CU ASIGURARILE", shortLabel: "Asigurări" },
  { cod: "623", denumire: "CHELTUIELI DE PROTOCOL, RECLAMA SI PUBLICITATE", shortLabel: "Protocol & Recl." },
];

const normalizeText = (str: string) => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

export const getCleanShortLabel = (account: { cod: string; denumire: string; shortLabel?: string }): string => {
  if (account.shortLabel) return account.shortLabel;
  const pop = POPULAR_NIR_ACCOUNTS.find(
    (p) => p.cod === account.cod || p.cod === account.cod.split(".")[0]
  );
  if (pop && pop.shortLabel) {
    if (account.cod.includes(".")) {
      const sub = account.cod.split(".")[1];
      return `${pop.shortLabel} .${sub}`;
    }
    return pop.shortLabel;
  }
  let clean = account.denumire
    .replace(/^ALTE\s+CHELT(?:UIELI)?\s+(?:CU\s+)?(?:SERVICIILE\s+)?(?:EXECUTATE\s+DE\s+TERTI\s+)?/i, "Servicii ")
    .replace(/^CHELTUIELI\s+(?:CU\s+|DE\s+)?/i, "")
    .trim();
  if (clean.length > 22) {
    clean = clean.substring(0, 21) + "…";
  }
  return clean;
};

interface PlanConturiComboboxProps {
  value: string;
  onChange: (cod: string, denumire: string) => void;
  accounts: PlanContItem[];
  placeholder?: string;
  size?: "md" | "sm";
  className?: string;
  title?: string;
  displayMode?: "code" | "name" | "both";
}

export default function PlanConturiCombobox({
  value,
  onChange,
  accounts = [],
  placeholder = "Cont (ex: 371)",
  size = "md",
  className = "",
  title,
  displayMode = "code",
}: PlanConturiComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Current selected account (matched by code or name)
  const selectedAccount = useMemo(() => {
    if (!value) return null;
    const clean = value.trim();
    // 1. Direct match in popular accounts
    const popDirect = POPULAR_NIR_ACCOUNTS.find(
      (a) =>
        a.cod === clean ||
        a.denumire.toLowerCase() === clean.toLowerCase() ||
        a.shortLabel?.toLowerCase() === clean.toLowerCase()
    );
    if (popDirect) return popDirect;

    // 2. Direct match in accounts
    const match = accounts.find(
      (a) =>
        a.cod === clean ||
        a.denumire.toLowerCase() === clean.toLowerCase() ||
        a.shortLabel?.toLowerCase() === clean.toLowerCase()
    );
    if (match) {
      return {
        ...match,
        shortLabel: getCleanShortLabel(match),
      };
    }

    return null;
  }, [value, accounts]);

  // Sync internal search when value changes from outside (and dropdown is closed)
  useEffect(() => {
    if (!isOpen) {
      if (displayMode === "name") {
        setSearch(
          selectedAccount
            ? selectedAccount.shortLabel || getCleanShortLabel(selectedAccount)
            : value || ""
        );
      } else if (displayMode === "both") {
        if (selectedAccount) {
          const lbl = selectedAccount.shortLabel || getCleanShortLabel(selectedAccount);
          setSearch(`${selectedAccount.cod} · ${lbl}`);
        } else {
          setSearch(value || "");
        }
      } else {
        setSearch(selectedAccount ? selectedAccount.cod : value || "");
      }
    }
  }, [value, selectedAccount, isOpen, displayMode]);

  // Smart filtering and scoring
  const filteredAccounts = useMemo(() => {
    let rawQuery = normalizeText(search);
    if (rawQuery.includes("·")) rawQuery = rawQuery.split("·")[0].trim();
    else if (rawQuery.includes("—")) rawQuery = rawQuery.split("—")[0].trim();
    const query = rawQuery;

    if (!query) {
      // Empty query: Show popular NIR accounts first, then standard synthesis accounts
      const popularCodes = new Set(POPULAR_NIR_ACCOUNTS.map((p) => p.cod));
      const others = accounts.filter((a) => !popularCodes.has(a.cod)).slice(0, 40);
      return [...POPULAR_NIR_ACCOUNTS, ...others];
    }

    const scored: Array<{ item: PlanContItem; score: number }> = [];

    for (const a of accounts) {
      const codeNorm = a.cod.toLowerCase();
      const nameNorm = normalizeText(a.denumire);
      let score = 0;

      if (codeNorm === query) {
        score = 1000;
      } else if (codeNorm.startsWith(query)) {
        score = 500 - codeNorm.length * 10;
      } else if (nameNorm.startsWith(query)) {
        score = 350 - a.cod.length * 5;
      } else if (nameNorm.includes(query)) {
        score = 200 - a.cod.length * 5;
      } else if (codeNorm.includes("." + query)) {
        score = 100 - a.cod.length * 6;
      }

      if (score > 0) {
        scored.push({ item: a, score });
      }
    }

    // Also include popular NIR accounts if not already found
    for (const p of POPULAR_NIR_ACCOUNTS) {
      const exists = scored.some((s) => s.item.cod === p.cod);
      if (!exists) {
        const codeNorm = p.cod.toLowerCase();
        const nameNorm = normalizeText(p.denumire);
        const shortNorm = p.shortLabel ? normalizeText(p.shortLabel) : "";
        let score = 0;
        if (codeNorm === query) score = 1000;
        else if (codeNorm.startsWith(query)) score = 500 - codeNorm.length * 10;
        else if (shortNorm && shortNorm.startsWith(query)) score = 400;
        else if (nameNorm.startsWith(query)) score = 350;
        else if (nameNorm.includes(query) || (shortNorm && shortNorm.includes(query))) score = 200;
        if (score > 0) scored.push({ item: p, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 50).map((s) => s.item);
  }, [search, accounts]);

  // Reset activeIndex when query or results change
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen]);

  const handleSelect = (account: PlanContItem) => {
    const lbl = account.shortLabel || getCleanShortLabel(account) || account.denumire;
    onChange(account.cod, lbl);
    if (displayMode === "name") {
      setSearch(lbl);
    } else if (displayMode === "both") {
      setSearch(`${account.cod} · ${lbl}`);
    } else {
      setSearch(account.cod);
    }
    setIsOpen(false);
  };

  const isSmall = size === "sm";

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          className={`flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border transition-all ${
            isOpen
              ? "border-[var(--tenant-theme-color,#16a34a)] ring-2 ring-[var(--tenant-theme-color,#16a34a)]/20 shadow-xs"
              : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          } ${isSmall ? "h-7 px-2" : "h-8 px-2.5"} ${className}`}
          title={title || (selectedAccount ? `${selectedAccount.cod} — ${selectedAccount.denumire}` : value)}
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
              const codePrefix = clean.split(/[·\-—\s]/)[0].trim();
              const exact = accounts.find(
                (a) =>
                  a.cod.toLowerCase() === clean.toLowerCase() ||
                  a.cod.toLowerCase() === codePrefix.toLowerCase() ||
                  a.denumire.toLowerCase() === clean.toLowerCase() ||
                  a.shortLabel?.toLowerCase() === clean.toLowerCase()
              );
              if (exact) {
                onChange(exact.cod, exact.shortLabel || exact.denumire);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
                if (displayMode === "name") {
                  setSearch(
                    selectedAccount
                      ? selectedAccount.shortLabel || getCleanShortLabel(selectedAccount)
                      : value || ""
                  );
                } else if (displayMode === "both") {
                  if (selectedAccount) {
                    const lbl = selectedAccount.shortLabel || getCleanShortLabel(selectedAccount);
                    setSearch(`${selectedAccount.cod} · ${lbl}`);
                  } else {
                    setSearch(value || "");
                  }
                } else {
                  setSearch(value || "");
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!isOpen) {
                  setIsOpen(true);
                } else {
                  setActiveIndex((prev) => Math.min(prev + 1, filteredAccounts.length - 1));
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (isOpen) {
                  setActiveIndex((prev) => Math.max(prev - 1, 0));
                }
              } else if (e.key === "Enter") {
                if (isOpen && filteredAccounts.length > 0 && filteredAccounts[activeIndex]) {
                  e.preventDefault();
                  handleSelect(filteredAccounts[activeIndex]);
                }
              }
            }}
            className={`w-full bg-transparent text-slate-900 dark:text-white focus:outline-none truncate ${
              displayMode === "name"
                ? `font-medium ${isSmall ? "text-xs text-left" : "text-sm text-left"}`
                : `font-bold font-mono ${isSmall ? "text-xs text-left pl-1" : "text-sm text-left pl-1"}`
            }`}
          />

          {/* Selected account badge description in md size for code mode */}
          {displayMode === "code" && !isSmall && selectedAccount && !isOpen && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-sans font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 truncate max-w-[130px]">
              {selectedAccount.denumire}
            </span>
          )}

          {/* Selected account code badge in md size for name mode */}
          {displayMode === "name" && !isSmall && selectedAccount && !isOpen && (
            <span
              style={{
                backgroundColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 12%, transparent)",
                borderColor: "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 30%, transparent)",
                color: "var(--tenant-theme-color, #16a34a)",
              }}
              className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border shrink-0"
            >
              {selectedAccount.cod}
            </span>
          )}

          {/* Clear button if search is not empty */}
          {search && isOpen && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                setSearch("");
                onChange("", "");
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
              title="Șterge"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              style={isOpen ? { color: "var(--tenant-theme-color, #16a34a)" } : {}}
            />
          </button>
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={`z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${
            isSmall ? "w-80 min-w-[340px]" : "w-80 sm:w-96 min-w-[360px]"
          }`}
          style={{ maxHeight: "350px" }}
        >
          {/* Quick chips for popular NIR accounts */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Conturi Frecvente NIR
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {filteredAccounts.length} rezultate
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {POPULAR_NIR_ACCOUNTS.map((pop) => {
                const isSelected =
                  value === pop.cod || (selectedAccount && selectedAccount.cod === pop.cod);
                return (
                  <button
                    key={pop.cod}
                    type="button"
                    onClick={() => handleSelect(pop)}
                    style={
                      isSelected
                        ? {
                            backgroundColor: "var(--tenant-theme-color, #16a34a)",
                            borderColor: "var(--tenant-theme-color, #16a34a)",
                            color: "#ffffff",
                          }
                        : {}
                    }
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? "shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                    }`}
                  >
                    <span className="font-mono font-bold">{pop.cod}</span>{" "}
                    <span className="text-[10px] font-normal opacity-85">
                      {pop.shortLabel || pop.denumire}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Accounts */}
          <div
            ref={listRef}
            className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60"
            style={{ maxHeight: "250px" }}
          >
            {filteredAccounts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Niciun cont găsit pentru „{search}”.
              </div>
            ) : (
              filteredAccounts.map((account, idx) => {
                const isSelected =
                  value === account.cod || (selectedAccount && selectedAccount.cod === account.cod);
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={account.cod}
                    type="button"
                    onClick={() => handleSelect(account)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    style={
                      isActive
                        ? {
                            backgroundColor:
                              "color-mix(in srgb, var(--tenant-theme-color, #16a34a) 8%, transparent)",
                          }
                        : {}
                    }
                    className={`w-full text-left p-2.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isActive
                        ? ""
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    } ${
                      isSelected
                        ? "font-semibold"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        style={
                          isSelected
                            ? {
                                backgroundColor: "var(--tenant-theme-color, #16a34a)",
                                borderColor: "var(--tenant-theme-color, #16a34a)",
                                color: "#ffffff",
                              }
                            : {}
                        }
                        className={`px-1.5 py-0.5 rounded font-mono font-bold text-xs shrink-0 border ${
                          isSelected
                            ? ""
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {account.cod}
                      </span>
                      <span
                        className="text-xs truncate font-medium"
                        style={
                          isSelected
                            ? { color: "var(--tenant-theme-color, #16a34a)" }
                            : {}
                        }
                      >
                        {account.shortLabel || account.denumire}
                      </span>
                    </div>

                    {isSelected && (
                      <Check
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--tenant-theme-color, #16a34a)" }}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
