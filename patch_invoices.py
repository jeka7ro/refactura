import os
import re

def patch_file(filepath, is_emitted):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Imports
    if 'import { Select' not in content:
        content = content.replace(
            'import { Link, useLocation } from "wouter";',
            'import { Link, useLocation } from "wouter";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";'
        )

    # 2. State
    state_block = """  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [customTo, setCustomTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; });

  const getDateRange = (p: string): [string, string] | null => {
    const now = new Date();
    const fmt = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${yr}-${mo}-${da}`;
    };
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    switch (p) {
      case "today": { const t = fmt(now); return [t, t]; }
      case "week": { const d = startOfDay(now); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); const end = new Date(d); end.setDate(end.getDate() + 6); return [fmt(d), fmt(end)]; }
      case "month": { const s = new Date(now.getFullYear(), now.getMonth(), 1); const e = new Date(now.getFullYear(), now.getMonth() + 1, 0); return [fmt(s), fmt(e)]; }
      case "lastMonth": { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return [fmt(s), fmt(e)]; }
      case "year": return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
      case "lastYear": return [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`];
      case "custom": return customFrom && customTo ? [customFrom, customTo] : null;
      default: return null;
    }
  };"""
    if 'setPeriod' not in content:
        content = content.replace('  const [statusFilter, setStatusFilter] = useState("all");', state_block)

    # 3. Filtering logic
    filter_logic = """    if (statusFilter !== "all")
      rows = rows.filter(r => r.status === statusFilter);
    if (period !== "all") {
      const range = getDateRange(period);
      if (range) {
        const [start, end] = range;
        const startDate = new Date(start).getTime();
        const endDate = new Date(end).getTime() + 86400000;
        rows = rows.filter(r => {
          if (!r.issueDate) return false;
          const d = new Date(r.issueDate).getTime();
          return d >= startDate && d < endDate;
        });
      }
    }"""
    if 'period !== "all"' not in content:
        content = content.replace(
            '    if (statusFilter !== "all")\n      rows = rows.filter(r => r.status === statusFilter);',
            filter_logic
        )

    # 4. Replace Toolbar
    if is_emitted:
        toolbar_regex = re.compile(r'\{\/\* Toolbar \*\/\}.*?\{\/\* Table \*\/\}', re.DOTALL)
        new_toolbar = """{/* Search & Filtre */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/50 flex flex-col gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 w-full">
            <div style={{ position: "relative" }} className="flex-1 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ paddingLeft: 26, paddingRight: search ? 60 : 10, borderRadius: 9999, width: "100%", height: 32, border: "1px solid #e2e8f0", outline: "none", fontSize: 12 }}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                placeholder="Caută factură, client..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#2563eb", color: "white", borderRadius: 9999, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                  {filtered.length}/{data.length}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 w-full gap-2">
            <Select value={period} onValueChange={val => { setPeriod(val as any); const range = getDateRange(val); if (range && val !== "custom") { setCustomFrom(range[0]); setCustomTo(range[1]); } setPage(1); }}>
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <SelectValue placeholder="Perioadă" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate dățile</SelectItem>
                <SelectItem value="today">Azi</SelectItem>
                <SelectItem value="week">Săpt. curentă</SelectItem>
                <SelectItem value="month">Luna curentă</SelectItem>
                <SelectItem value="lastMonth">Luna trecută</SelectItem>
                <SelectItem value="year">Anul curent</SelectItem>
                <SelectItem value="lastYear">Anul trecut</SelectItem>
                <SelectItem value="custom">Personalizat...</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={val => { setStatusFilter(val as any); setPage(1); }}>
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate ({counts.all})</SelectItem>
                <SelectItem value="draft">Ciornă ({counts.draft})</SelectItem>
                <SelectItem value="sent">Emise ({counts.sent})</SelectItem>
                <SelectItem value="paid">Achitate ({counts.paid})</SelectItem>
                <SelectItem value="overdue">Restanțe ({counts.overdue})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 w-fit mt-1">
              <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(1); }} className="h-6 px-1.5 text-xs bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[100px]" />
              <span className="text-[10px] text-slate-400 font-bold">-</span>
              <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPage(1); }} className="h-6 px-1.5 text-xs bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[100px]" />
            </div>
          )}
        </div>

        {/* Table */}"""
        if '{/* Search & Filtre */}' not in content:
            content = toolbar_regex.sub(new_toolbar, content)
            
    else: # ReInvoicesSent
        # Also fix the button
        btn_regex = re.compile(r'<button className="flex items-center gap-1\.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm">\s*<Plus className="w-3\.5 h-3\.5" />\s*Re-Factură nouă\s*</button>', re.DOTALL)
        new_btn = '<button className="flex items-center justify-center sm:gap-1.5 w-10 h-10 sm:w-auto sm:h-8 sm:px-3 rounded-full sm:rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm flex-shrink-0"><Plus className="w-5 h-5 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">Re-Factură nouă</span></button>'
        content = btn_regex.sub(new_btn, content)
        
        toolbar_regex = re.compile(r'\{\/\* Toolbar \*\/\}.*?\{\/\* Tabel \*\/\}', re.DOTALL)
        new_toolbar = """{/* Search & Filtre */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/50 flex flex-col gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3 w-full">
            <div style={{ position: "relative" }} className="flex-1 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
              <input
                style={{ paddingLeft: 26, paddingRight: search ? 60 : 10, borderRadius: 9999, width: "100%", height: 32, border: "1px solid #e2e8f0", outline: "none", fontSize: 12 }}
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white dark:border-slate-700"
                placeholder="Caută factură, client..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#2563eb", color: "white", borderRadius: 9999, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                  {filtered.length}/{reInvoices.length}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 w-full gap-2">
            <Select value={period} onValueChange={val => { setPeriod(val as any); const range = getDateRange(val); if (range && val !== "custom") { setCustomFrom(range[0]); setCustomTo(range[1]); } setPage(1); }}>
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <SelectValue placeholder="Perioadă" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate dățile</SelectItem>
                <SelectItem value="today">Azi</SelectItem>
                <SelectItem value="week">Săpt. curentă</SelectItem>
                <SelectItem value="month">Luna curentă</SelectItem>
                <SelectItem value="lastMonth">Luna trecută</SelectItem>
                <SelectItem value="year">Anul curent</SelectItem>
                <SelectItem value="lastYear">Anul trecut</SelectItem>
                <SelectItem value="custom">Personalizat...</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={val => { setStatusFilter(val as any); setPage(1); }}>
              <SelectTrigger className="h-8 w-full rounded-full text-xs font-bold border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate</SelectItem>
                <SelectItem value="draft">Ciornă</SelectItem>
                <SelectItem value="pending">În Așteptare</SelectItem>
                <SelectItem value="sent">Trimisă</SelectItem>
                <SelectItem value="paid">Achitată</SelectItem>
                <SelectItem value="overdue">Restanță</SelectItem>
                <SelectItem value="cancelled">Anulată</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 p-1 rounded-full border border-slate-200 dark:border-slate-700 w-fit mt-1">
              <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setPage(1); }} className="h-6 px-1.5 text-xs bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[100px]" />
              <span className="text-[10px] text-slate-400 font-bold">-</span>
              <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setPage(1); }} className="h-6 px-1.5 text-xs bg-transparent text-slate-600 dark:text-slate-300 outline-none w-[100px]" />
            </div>
          )}
        </div>

        {/* Tabel */}"""
        if '{/* Search & Filtre */}' not in content:
            content = toolbar_regex.sub(new_toolbar, content)

    with open(filepath, 'w') as f:
        f.write(content)

patch_file('client/src/pages/EmittedInvoices.tsx', True)
patch_file('client/src/pages/ReInvoicesSent.tsx', False)
print("Done")
