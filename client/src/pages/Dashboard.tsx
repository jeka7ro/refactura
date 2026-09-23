// Dashboard — RefacturaRO Executive Intelligence Command Center
// Design: Modern 3D Volumetric Analytics (ZoomCharts Style) + Apple/Linear Glassmorphism
// Accurate Multi-Source Engine: invoiceArchive (in/out) + emittedInvoices + reInvoices + clients

import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  FileOutput,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Download,
  RefreshCw,
  Loader2,
  Sparkles,
  Building2,
  Wallet,
  Calendar,
  Eye,
  Layers,
  BarChart3,
  LineChart,
  ChevronRight,
  ShieldCheck,
  Zap,
  Percent,
  Coins,
  ArrowRight,
  ChevronDown,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatCurrency,
  formatDate,
  type Currency,
} from "@/lib/store";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TimeHorizon = "7D" | "30D" | "3M" | "6M" | "1Y" | "ALL";
type ChartViewMode = "stream3d" | "bars3d" | "cashflow";
type PartnerTab = "clients" | "suppliers";

interface UnifiedInvoice {
  id: number;
  type: "primit" | "emis";
  number: string;
  partnerName: string;
  partnerCui: string;
  clientId?: number;
  date: string;
  dueDate: string;
  totalRon: number;
  rawTotal: number;
  totalVATRon: number;
  currency: string;
  status: string;
  source: string;
  fileUrl?: string | null;
  spvStatus?: string | null;
}

// BNR conversion reference for unified RON KPI
const DEFAULT_EUR_TO_RON = 5.2537;
const DEFAULT_USD_TO_RON = 4.5164;

function toRon(
  amount: number,
  currency: string,
  eurRate = DEFAULT_EUR_TO_RON,
  usdRate = DEFAULT_USD_TO_RON
): number {
  const cur = (currency || "RON").toUpperCase();
  if (cur === "EUR") return amount * eurRate;
  if (cur === "USD") return amount * usdRate;
  return amount;
}

// Custom 3D Isometric Bar for Recharts
function Custom3DBar(props: any) {
  const { fill, x, y, width, height } = props;
  if (height === undefined || height === null || isNaN(y) || isNaN(x)) return null;
  if (height === 0) return null;

  const isPositive = height > 0;
  const absHeight = Math.abs(height);
  const actualY = isPositive ? y : y;
  const depth = Math.min(Math.max(width * 0.28, 4), 10);

  const isGreen = fill?.includes("10b981") || fill === "#10b981" || fill?.includes("emerald");
  const isRed = fill?.includes("ef4444") || fill?.includes("f43f5e") || fill === "#ef4444";

  const frontColor = fill;
  const topColor = isGreen ? "#34d399" : isRed ? "#fb7185" : "#60a5fa";
  const sideColor = isGreen ? "#047857" : isRed ? "#be123c" : "#1d4ed8";

  // Determinare valoare numerică pentru afișare permanentă pe grafic
  const rawVal =
    props.value !== undefined
      ? props.value
      : props.dataKey && props.payload
      ? props.payload[props.dataKey]
      : isGreen
      ? props.payload?.emise
      : isRed
      ? props.payload?.primite
      : props.payload?.net;
  const val = rawVal !== undefined && rawVal !== null ? Number(rawVal) : null;

  return (
    <g className="transition-all duration-300">
      {/* 3D Drop Shadow */}
      <ellipse
        cx={x + width / 2 + depth / 2}
        cy={actualY + absHeight + 2}
        rx={width * 0.55}
        ry={3.5}
        fill="rgba(0,0,0,0.12)"
      />

      {/* Front Face */}
      <rect
        x={x}
        y={actualY}
        width={width}
        height={absHeight}
        rx={2.5}
        fill={frontColor}
      />

      {/* Top Cap (Specular reflection) */}
      <path
        d={`M ${x} ${actualY} L ${x + depth} ${actualY - depth * 0.6} L ${x + width + depth} ${actualY - depth * 0.6} L ${x + width} ${actualY} Z`}
        fill={topColor}
      />

      {/* Side Face (Depth shadow) */}
      <path
        d={`M ${x + width} ${actualY} L ${x + width + depth} ${actualY - depth * 0.6} L ${x + width + depth} ${actualY + absHeight - depth * 0.6} L ${x + width} ${actualY + absHeight} Z`}
        fill={sideColor}
      />

      {/* Valoare Permanentă Vizibilă deasupra coloanei 3D */}
      {val !== null && !isNaN(val) && Math.abs(val) > 0 && (
        <g className="pointer-events-none select-none">
          <rect
            x={x + width / 2 + depth / 2 - 19}
            y={actualY - depth * 0.6 - 19}
            width={38}
            height={16}
            rx={4}
            fill="#ffffff"
            stroke={isGreen ? "#10b981" : isRed ? "#f43f5e" : "#0284c7"}
            strokeWidth={1.2}
            className="filter drop-shadow-sm"
          />
          <text
            x={x + width / 2 + depth / 2}
            y={actualY - depth * 0.6 - 7}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={900}
            fill={isGreen ? "#047857" : isRed ? "#be123c" : "#0369a1"}
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {Math.abs(val) >= 1000
              ? `${(val / 1000).toFixed(1).replace(".0", "")}k`
              : Math.round(val)}
          </text>
        </g>
      )}
    </g>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>("6M");
  const [viewMode, setViewMode] = useState<ChartViewMode>("stream3d");
  const [partnerTab, setPartnerTab] = useState<PartnerTab>("clients");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<UnifiedInvoice | null>(null);

  // Data Queries
  const { data: archiveData, isLoading: loadingArchive } =
    trpc.invoiceArchive.list.useQuery({ limit: 1000 }, { enabled: !!user });
  const { data: emittedInvoices = [], isLoading: loadingEmitted } =
    trpc.emittedInvoice.list.useQuery(undefined, { enabled: !!user });
  const { data: reInvoices = [], isLoading: loadingReInv } =
    trpc.reinvoice.list.useQuery(undefined, { enabled: !!user });
  const { data: clients = [], isLoading: loadingClients } =
    trpc.clients.list.useQuery(undefined, { enabled: !!user });

  const findClientId = (name?: string, cui?: string) => {
    if (!clients || !Array.isArray(clients)) return null;
    const clean = (s?: string) => (s || "").replace(/^[A-Z]{2}/i, "").trim().toLowerCase();
    const cCui = clean(cui);
    const cName = (name || "").trim().toLowerCase();
    if (cCui) {
      const match = (clients as any[]).find((c: any) => clean(c.cui) === cCui);
      if (match) return match.id;
    }
    if (cName) {
      const match = (clients as any[]).find((c: any) => (c.name || "").trim().toLowerCase() === cName);
      if (match) return match.id;
    }
    return null;
  };
  const { data: currentTenant, isLoading: loadingTenant } =
    trpc.tenants.current.useQuery(undefined, { enabled: !!user });
  const { data: tenantsList = [] } =
    trpc.tenants.list.useQuery(undefined, { enabled: !!user });
  const { data: bnrData } = trpc.system.getBnrRates.useQuery(undefined, {
    staleTime: 10 * 60 * 1000,
  });

  const liveEurRate = bnrData?.rates?.EUR || DEFAULT_EUR_TO_RON;
  const liveUsdRate = bnrData?.rates?.USD || DEFAULT_USD_TO_RON;

  const switchTenantMutation = trpc.tenants.switchTenant.useMutation({
    onSuccess: () => {
      toast.success("Companie comutată cu succes!");
      utils.invalidate();
    },
    onError: (err) => {
      toast.error("Eroare la comutare companie: " + err.message);
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await utils.invalidate();
    setTimeout(() => setIsRefreshing(false), 600);
    toast.success("Date financiare actualizate în timp real!");
  };

  // 1. UNIFIED INVOICES ENGINE
  const allInvoices: UnifiedInvoice[] = useMemo(() => {
    const list: UnifiedInvoice[] = [];


    // A. Invoice Archive (Direction 'in' = Received, Direction 'out' = Emitted from SPV)
    const rawArchive = archiveData as unknown as { items?: any[] };
    const archiveItems = rawArchive?.items || [];

    archiveItems.forEach((i: any) => {
      const rawTot = parseFloat(i.total || "0");
      const cur = i.currency || "RON";
      const isPrimit = i.direction === "in";
      const vat = parseFloat(i.totalVAT || "0");

      list.push({
        id: i.id,
        type: isPrimit ? "primit" : "emis",
        number: i.invoiceNumber || `#${i.id}`,
        partnerName: isPrimit
          ? i.supplierName || "Furnizor SPV"
          : i.supplierName || i.customerName || "Client SPV",
        partnerCui: isPrimit
          ? i.supplierCUI || ""
          : i.customerCUI || i.supplierCUI || "",
        date: i.issueDate || i.createdAt || "",
        dueDate: i.dueDate || "",
        rawTotal: rawTot,
        totalRon: toRon(rawTot, cur, liveEurRate, liveUsdRate),
        totalVATRon: toRon(
          vat > 0 ? vat : (rawTot * 19) / 119,
          cur,
          liveEurRate,
          liveUsdRate
        ),
        currency: cur,
        status: rawTot < 0 ? "storno" : i.status || "pending",
        source: i.source || "spv_anaf",
        fileUrl:
          i.source === "spv_anaf" || i.fileUrl === "spv_import"
            ? `/api/pdf/archive/${i.id}`
            : i.fileUrl,
        spvStatus: i.spvStatus,
      });
    });

    // B. Platform Emitted Invoices
    (Array.isArray(emittedInvoices) ? emittedInvoices : []).forEach((e: any) => {
      const rawTot = parseFloat(e.total || "0");
      const cur = e.currency || "RON";
      const vat = parseFloat(e.totalVAT || "0");

      list.push({
        id: e.id,
        type: "emis",
        number: e.number || `FACT-${e.id}`,
        partnerName: e.clientName || "Client",
        partnerCui: e.clientCUI || "",
        clientId: e.clientId || undefined,
        date: e.issueDate || e.createdAt || "",
        dueDate: e.dueDate || "",
        rawTotal: rawTot,
        totalRon: toRon(rawTot, cur, liveEurRate, liveUsdRate),
        totalVATRon: toRon(
          vat > 0 ? vat : (rawTot * 19) / 119,
          cur,
          liveEurRate,
          liveUsdRate
        ),
        currency: cur,
        status:
          rawTot < 0
            ? "storno"
            : e.status === "sent"
            ? "sent"
            : e.status || "draft",
        source: "emitted",
        fileUrl:
          e.pdfUrl && e.pdfUrl !== "spv_import"
            ? e.pdfUrl
            : `/api/pdf/emitted/${e.id}`,
        spvStatus: e.spvStatus,
      });
    });

    // C. Re-Invoices
    (Array.isArray(reInvoices) ? reInvoices : []).forEach((r: any) => {
      const rawTot = parseFloat(r.total || "0");
      const cur = r.currency || "RON";
      const vat = parseFloat(r.totalVAT || "0");

      list.push({
        id: r.id,
        type: "emis",
        number: r.number || `RF-${r.id}`,
        partnerName: r.clientName || "Client Re-facturare",
        partnerCui: r.clientCUI || r.clientCui || "",
        date: r.issueDate || r.createdAt || "",
        dueDate: r.dueDate || "",
        rawTotal: rawTot,
        totalRon: toRon(rawTot, cur, liveEurRate, liveUsdRate),
        totalVATRon: toRon(
          vat > 0 ? vat : (rawTot * 19) / 119,
          cur,
          liveEurRate,
          liveUsdRate
        ),
        currency: cur,
        status: rawTot < 0 ? "storno" : r.status || "draft",
        source: "refactura",
        fileUrl:
          r.pdfUrl && r.pdfUrl !== "spv_import"
            ? r.pdfUrl
            : `/api/pdf/reinvoice/${r.id}`,
        spvStatus: r.spvStatus,
      });
    });

    return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [archiveData, emittedInvoices, reInvoices, liveEurRate, liveUsdRate]);

  // 2. TIMEFRAME FILTERING & METRICS ENGINE
  const {
    filteredInvoices,
    kpi,
    chartData,
    statusDistribution,
    topClients,
    topSuppliers,
    currencyBreakdown,
  } = useMemo(() => {
    const now = new Date();

    // Determine cutoff date based on timeHorizon
    let cutoff: Date | null = new Date();
    if (timeHorizon === "7D") {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeHorizon === "30D") {
      cutoff.setDate(now.getDate() - 30);
    } else if (timeHorizon === "3M") {
      cutoff.setMonth(now.getMonth() - 3);
    } else if (timeHorizon === "6M") {
      cutoff.setMonth(now.getMonth() - 6);
    } else if (timeHorizon === "1Y") {
      cutoff.setFullYear(now.getFullYear() - 1);
    } else {
      cutoff = null; // ALL
    }

    const filtered = cutoff
      ? allInvoices.filter((inv) => {
          if (!inv.date) return false;
          return new Date(inv.date) >= cutoff;
        })
      : allInvoices;

    // Previous period cutoff for trend calculation
    let prevPeriodInvoices: UnifiedInvoice[] = [];
    if (cutoff) {
      const durationMs = now.getTime() - cutoff.getTime();
      const prevCutoff = new Date(cutoff.getTime() - durationMs);
      prevPeriodInvoices = allInvoices.filter((inv) => {
        if (!inv.date) return false;
        const d = new Date(inv.date);
        return d >= prevCutoff && d < cutoff;
      });
    }

    // Totals
    let totalEmittedRon = 0;
    let countEmitted = 0;
    let totalReceivedRon = 0;
    let countReceived = 0;
    let vatCollectedRon = 0;
    let vatDeductibleRon = 0;

    const curMap: Record<string, { emitted: number; received: number }> = {};

    filtered.forEach((inv) => {
      const cur = (inv.currency || "RON").toUpperCase();
      if (!curMap[cur]) curMap[cur] = { emitted: 0, received: 0 };

      if (inv.type === "emis") {
        totalEmittedRon += inv.totalRon;
        countEmitted++;
        vatCollectedRon += inv.totalVATRon;
        curMap[cur].emitted += inv.rawTotal;
      } else {
        totalReceivedRon += inv.totalRon;
        countReceived++;
        vatDeductibleRon += inv.totalVATRon;
        curMap[cur].received += inv.rawTotal;
      }
    });

    // Previous totals for trend
    let prevEmittedRon = 0;
    let prevReceivedRon = 0;
    prevPeriodInvoices.forEach((inv) => {
      if (inv.type === "emis") prevEmittedRon += inv.totalRon;
      else prevReceivedRon += inv.totalRon;
    });

    const netCashflowRon = totalEmittedRon - totalReceivedRon;
    const netVatRon = vatCollectedRon - vatDeductibleRon;

    const marginPct =
      totalEmittedRon > 0
        ? ((netCashflowRon / totalEmittedRon) * 100).toFixed(1)
        : "0.0";

    const emittedGrowth =
      prevEmittedRon > 0
        ? (((totalEmittedRon - prevEmittedRon) / prevEmittedRon) * 100).toFixed(1)
        : null;

    const receivedGrowth =
      prevReceivedRon > 0
        ? (((totalReceivedRon - prevReceivedRon) / prevReceivedRon) * 100).toFixed(1)
        : null;

    // Overdue & Pending analysis
    const overdueCount = filtered.filter((inv) => {
      if (inv.status === "paid" || inv.status === "processed") return false;
      if (!inv.dueDate) return false;
      return new Date(inv.dueDate) < now;
    }).length;

    // 3. CHART AGGREGATION
    const chartMap: Record<
      string,
      { label: string; dateSort: string; emise: number; primite: number; net: number; count: number }
    > = {};

    const monthNames = [
      "Ian",
      "Feb",
      "Mar",
      "Apr",
      "Mai",
      "Iun",
      "Iul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    if (timeHorizon === "7D" || timeHorizon === "30D") {
      const daysCount = timeHorizon === "7D" ? 7 : 30;
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const dayOfWeekRo = ["D", "L", "M", "M", "J", "V", "S"][d.getDay()];
        const dayLabel = `${d.getDate()} ${monthNames[d.getMonth()]} (${dayOfWeekRo})`;
        chartMap[key] = {
          label: dayLabel,
          dateSort: key,
          emise: 0,
          primite: 0,
          net: 0,
          count: 0,
        };
      }

      filtered.forEach((inv) => {
        if (!inv.date) return;
        const key = inv.date.slice(0, 10);
        if (chartMap[key]) {
          if (inv.type === "emis") chartMap[key].emise += inv.totalRon;
          else chartMap[key].primite += inv.totalRon;
          chartMap[key].count++;
        }
      });
    } else {
      const monthsToLook =
        timeHorizon === "3M" ? 4 : timeHorizon === "6M" ? 6 : timeHorizon === "1Y" ? 12 : 18;

      for (let i = monthsToLook - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        chartMap[key] = {
          label,
          dateSort: key,
          emise: 0,
          primite: 0,
          net: 0,
          count: 0,
        };
      }

      filtered.forEach((inv) => {
        if (!inv.date) return;
        const key = inv.date.slice(0, 7);
        if (chartMap[key]) {
          if (inv.type === "emis") chartMap[key].emise += inv.totalRon;
          else chartMap[key].primite += inv.totalRon;
          chartMap[key].count++;
        }
      });
    }

    const chartDataArray = Object.values(chartMap)
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort))
      .map((item) => ({
        ...item,
        emise: Math.round(item.emise * 100) / 100,
        primite: Math.round(item.primite * 100) / 100,
        net: Math.round((item.emise - item.primite) * 100) / 100,
      }));

    // 4. STATUS DISTRIBUTION
    let paidCount = 0;
    let sentCount = 0;
    let pendingCount = 0;
    let overdueDistCount = 0;

    filtered.forEach((i) => {
      if (i.status === "paid" || i.status === "processed") {
        paidCount++;
      } else if (i.dueDate && new Date(i.dueDate) < now) {
        overdueDistCount++;
      } else if (i.status === "sent") {
        sentCount++;
      } else {
        pendingCount++;
      }
    });

    const statusDistributionData = [
      { name: "Încasate / Achitate", value: paidCount, color: "#10b981" },
      { name: "Trimise / În termen", value: sentCount, color: "#0284c7" },
      { name: "În procesare", value: pendingCount, color: "#f59e0b" },
      { name: "Restante", value: overdueDistCount, color: "#ef4444" },
    ].filter((s) => s.value > 0);

    // 5. TOP PARTNERS INTELLIGENCE
    const clientsVolume: Record<
      string,
      { name: string; cui: string; total: number; count: number }
    > = {};
    const suppliersVolume: Record<
      string,
      { name: string; cui: string; total: number; count: number }
    > = {};

    filtered.forEach((inv) => {
      if (inv.type === "emis") {
        const key = inv.partnerName.trim().toUpperCase() || "CLIENT NECUNOSCUT";
        if (!clientsVolume[key]) {
          clientsVolume[key] = {
            name: inv.partnerName,
            cui: inv.partnerCui,
            total: 0,
            count: 0,
          };
        }
        clientsVolume[key].total += inv.totalRon;
        clientsVolume[key].count++;
      } else {
        const key = inv.partnerName.trim().toUpperCase() || "FURNIZOR NECUNOSCUT";
        if (!suppliersVolume[key]) {
          suppliersVolume[key] = {
            name: inv.partnerName,
            cui: inv.partnerCui,
            total: 0,
            count: 0,
          };
        }
        suppliersVolume[key].total += inv.totalRon;
        suppliersVolume[key].count++;
      }
    });

    const sortedClients = Object.values(clientsVolume)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((c) => ({
        ...c,
        pct: totalEmittedRon > 0 ? (c.total / totalEmittedRon) * 100 : 0,
      }));

    const sortedSuppliers = Object.values(suppliersVolume)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((s) => ({
        ...s,
        pct: totalReceivedRon > 0 ? (s.total / totalReceivedRon) * 100 : 0,
      }));

    return {
      filteredInvoices: filtered,
      kpi: {
        totalEmittedRon,
        countEmitted,
        emittedGrowth,
        totalReceivedRon,
        countReceived,
        receivedGrowth,
        netCashflowRon,
        marginPct,
        vatCollectedRon,
        vatDeductibleRon,
        netVatRon,
        overdueCount,
      },
      chartData: chartDataArray,
      statusDistribution: statusDistributionData,
      topClients: sortedClients,
      topSuppliers: sortedSuppliers,
      currencyBreakdown: curMap,
    };
  }, [allInvoices, timeHorizon]);

  // Loading state
  if (loadingArchive || loadingEmitted || loadingReInv || loadingClients || loadingTenant) {
    return (
      <div className="flex flex-col h-[65vh] items-center justify-center gap-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center animate-pulse">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          Se încarcă centrul de comandă financiar...
        </p>
      </div>
    );
  }

  const activeCompanyName =
    currentTenant?.name || (user as any)?.tenantName || "Compania Ta";
  const activeCompanyCui =
    currentTenant?.cui || (user as any)?.tenantCUI || "";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── TOP BAR: Header & Multi-Tenant Executive Switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {activeCompanyName}
              </h1>
              {activeCompanyCui && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {String(activeCompanyCui).toUpperCase().startsWith("RO")
                    ? String(activeCompanyCui).toUpperCase()
                    : `RO${activeCompanyCui}`}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Conectat SPV / e-Factura
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls: Horizon & Refresh */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {/* Tenant Switcher dropdown (if superadmin or multi-tenant) */}
          {tenantsList.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Schimbă Compania</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Companii Disponibile
                </div>
                {tenantsList.map((t: any) => {
                  const isCurrent = t.id === currentTenant?.id;
                  return (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => switchTenantMutation.mutate({ tenantId: t.id })}
                      className="flex items-center justify-between cursor-pointer py-2 px-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {t.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {t.cui ? `CUI: ${t.cui}` : t.email}
                        </div>
                      </div>
                      {isCurrent && (
                        <Check className="w-4 h-4 text-blue-600 flex-shrink-0 ml-2" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Time Horizon Filter Pills */}
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            {(["7D", "30D", "3M", "6M", "1Y", "ALL"] as TimeHorizon[]).map((hz) => (
              <button
                key={hz}
                onClick={() => setTimeHorizon(hz)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all duration-200 ${
                  timeHorizon === hz
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {hz === "7D"
                  ? "7 Zile"
                  : hz === "30D"
                  ? "30 Zile"
                  : hz === "3M"
                  ? "3 Luni"
                  : hz === "6M"
                  ? "6 Luni"
                  : hz === "1Y"
                  ? "1 An"
                  : "Toate"}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            title="Reîmprospătează datele financiare"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 transition-all shadow-sm"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── SMART FINANCIAL KPI STRIP ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Venituri Emise */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Venituri (Facturi Emise)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600">
              <FileOutput className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(kpi.totalEmittedRon, "RON")}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {kpi.countEmitted} facturi emise
              {currencyBreakdown.EUR?.emitted > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  +{currencyBreakdown.EUR.emitted.toFixed(0)} EUR
                </span>
              )}
            </span>
            {kpi.emittedGrowth !== null && (
              <span
                className={`flex items-center font-bold text-[11px] ${
                  parseFloat(kpi.emittedGrowth) >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {parseFloat(kpi.emittedGrowth) >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {kpi.emittedGrowth}%
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: Cheltuieli Primite */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Cheltuieli (Facturi Primite)
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 flex items-center justify-center text-rose-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(kpi.totalReceivedRon, "RON")}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {kpi.countReceived} facturi furnizori
            </span>
            {kpi.receivedGrowth !== null && (
              <span
                className={`flex items-center font-bold text-[11px] ${
                  parseFloat(kpi.receivedGrowth) <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {parseFloat(kpi.receivedGrowth) <= 0 ? (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {kpi.receivedGrowth}%
              </span>
            )}
          </div>
        </div>

        {/* KPI 3: Cashflow Net */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sold Cashflow Net
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                kpi.netCashflowRon >= 0
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 border border-blue-200/60 dark:border-blue-800/60"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 border border-rose-200/60 dark:border-rose-800/60"
              }`}
            >
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`mt-2 text-2xl sm:text-3xl font-black tracking-tight ${
              kpi.netCashflowRon >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {kpi.netCashflowRon >= 0 ? "+" : ""}
            {formatCurrency(kpi.netCashflowRon, "RON")}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Marjă: <span className="font-bold text-slate-700 dark:text-slate-200">{kpi.marginPct}%</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                kpi.netCashflowRon >= 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {kpi.netCashflowRon >= 0 ? "Surplus" : "Deficit"}
            </span>
          </div>
        </div>

        {/* KPI 4: Balanță TVA Estimat */}
        <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Balanță TVA Estimat
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60 flex items-center justify-center text-purple-600">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatCurrency(Math.abs(kpi.netVatRon), "RON")}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {kpi.netVatRon >= 0 ? "TVA de plată" : "TVA de recuperat"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                kpi.netVatRon >= 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
              }`}
            >
              {kpi.netVatRon >= 0 ? "De plată" : "De recuperat"}
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN 3D VOLUMETRIC CHART SECTION ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Evoluție Financiară 3D & Cashflow
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                ZoomCharts 3D
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Comparație volumetrică în timp real între facturile emise (încasări) și
              facturile primite (cheltuieli)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <button
                onClick={() => setViewMode("stream3d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "stream3d"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Arie 3D</span>
              </button>
              <button
                onClick={() => setViewMode("bars3d")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "bars3d"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Coloane 3D</span>
              </button>
              <button
                onClick={() => setViewMode("cashflow")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  viewMode === "cashflow"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Cashflow Net</span>
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 text-xs mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-500 shadow-sm shadow-emerald-500/30 inline-block" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Venituri Emise
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-500 shadow-sm shadow-rose-500/30 inline-block" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Cheltuieli Primite
            </span>
          </div>
          {viewMode === "cashflow" && (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-md bg-blue-500 shadow-sm shadow-blue-500/30 inline-block" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Sold Net (+/-)
              </span>
            </div>
          )}
        </div>

        {/* Chart Canvas */}
        <div className="w-full h-[320px] sm:h-[380px]">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "stream3d" ? (
              <AreaChart
                data={chartData}
                margin={{ top: 20, right: 20, left: -10, bottom: 0 }}
              >
                <defs>
                  <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <linearGradient id="volumetricEmise" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="volumetricPrimite" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#ef4444" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.18)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                  }
                  dx={-5}
                />
                <Tooltip content={<CustomSmartTooltip />} />

                <Area
                  type="monotone"
                  dataKey="emise"
                  name="Venituri Emise"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#volumetricEmise)"
                  filter="url(#glowGreen)"
                  activeDot={{
                    r: 6,
                    stroke: "#10b981",
                    strokeWidth: 3,
                    fill: "#ffffff",
                  }}
                >
                  <LabelList
                    dataKey="emise"
                    position="top"
                    offset={10}
                    formatter={(v: any) => {
                      const num = Number(v);
                      if (!num || num <= 0) return "";
                      return num >= 1000
                        ? `${(num / 1000).toFixed(1).replace(".0", "")}k`
                        : `${Math.round(num)}`;
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      fill: "#059669",
                    }}
                  />
                </Area>
                <Area
                  type="monotone"
                  dataKey="primite"
                  name="Cheltuieli Primite"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fill="url(#volumetricPrimite)"
                  filter="url(#glowRed)"
                  activeDot={{
                    r: 5,
                    stroke: "#ef4444",
                    strokeWidth: 2,
                    fill: "#ffffff",
                  }}
                >
                  <LabelList
                    dataKey="primite"
                    position="bottom"
                    offset={10}
                    formatter={(v: any) => {
                      const num = Number(v);
                      if (!num || num <= 0) return "";
                      return num >= 1000
                        ? `${(num / 1000).toFixed(1).replace(".0", "")}k`
                        : `${Math.round(num)}`;
                    }}
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      fill: "#e11d48",
                    }}
                  />
                </Area>
              </AreaChart>
            ) : viewMode === "bars3d" ? (
              <BarChart
                data={chartData}
                margin={{ top: 38, right: 20, left: -10, bottom: 0 }}
                barGap={6}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.18)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                  }
                  dx={-5}
                />
                <Tooltip content={<CustomSmartTooltip />} />
                <Bar
                  dataKey="emise"
                  name="Venituri Emise"
                  fill="#10b981"
                  shape={<Custom3DBar />}
                />
                <Bar
                  dataKey="primite"
                  name="Cheltuieli Primite"
                  fill="#ef4444"
                  shape={<Custom3DBar />}
                />
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ top: 38, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="rgba(148,163,184,0.18)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                  }
                  dx={-5}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1.5} />
                <Tooltip content={<CustomSmartTooltip />} />
                <Bar
                  dataKey="net"
                  name="Sold Net"
                  fill="#0ea5e9"
                  shape={(barProps: any) => {
                    const isPos = (barProps.payload?.net || 0) >= 0;
                    return (
                      <Custom3DBar
                        {...barProps}
                        fill={isPos ? "#10b981" : "#ef4444"}
                      />
                    );
                  }}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── INTELLIGENCE WIDGETS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget 1: Top Parteneri (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Top Parteneri după Volum Financiar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clasament ponderat al celor mai importanți clienți și furnizori
              </p>
            </div>

            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
              <button
                onClick={() => setPartnerTab("clients")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  partnerTab === "clients"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Top Clienți ({topClients.length})
              </button>
              <button
                onClick={() => setPartnerTab("suppliers")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  partnerTab === "suppliers"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Top Furnizori ({topSuppliers.length})
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {(partnerTab === "clients" ? topClients : topSuppliers).length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Nu există date pentru perioada selectată.
              </div>
            ) : (
              (partnerTab === "clients" ? topClients : topSuppliers).map((partner, idx) => (
                <div key={partner.name + idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      {partnerTab === "clients" ? (
                        <Link
                          href={
                            findClientId(partner.name, partner.cui)
                              ? `/client/${findClientId(partner.name, partner.cui)}`
                              : `/clienti?search=${encodeURIComponent(partner.name)}`
                          }
                          className="font-bold text-slate-900 dark:text-white truncate hover:underline hover:text-primary transition-colors cursor-pointer"
                        >
                          {partner.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {partner.name}
                        </span>
                      )}
                      {partner.cui && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          ({partner.cui})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[11px] text-slate-400">
                        {partner.count} factur{partner.count > 1 ? "i" : "ă"}
                      </span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {formatCurrency(partner.total, "RON")}
                      </span>
                    </div>
                  </div>

                  {/* 3D Volumetric Progress Bar */}
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(Math.max(partner.pct, 3), 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        partnerTab === "clients"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm shadow-emerald-500/20"
                          : "bg-gradient-to-r from-rose-500 to-pink-500 shadow-sm shadow-rose-500/20"
                      }`}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Widget 2: Diagnostic SPV & Stare Facturi (1 Col) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Diagnostic Stare & SPV
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribuția facturilor în intervalul ales
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            {/* 3D Donut Ring */}
            <div className="relative w-full h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {filteredInvoices.length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Facturi
                </span>
              </div>
            </div>
          </div>

          {/* Status Breakdown Legend */}
          <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            {statusDistribution.map((st) => (
              <div
                key={st.name}
                className="flex items-center justify-between text-xs py-0.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: st.color }}
                  />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    {st.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {st.value}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({Math.round((st.value / (filteredInvoices.length || 1)) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RECENT INVOICES ACTIVITY FEED ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facturi Emise Recente */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Facturi Emise Recente (Vânzări)
              </h2>
              <p className="text-[11px] text-slate-500">
                Ultimele facturi emise către clienți
              </p>
            </div>
            <Link href="/facturi-emise-nou">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                Vezi toate <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {allInvoices
              .filter((i) => i.type === "emis")
              .slice(0, 5)
              .map((inv) => (
                <div
                  key={`${inv.source}-${inv.id}`}
                  className="px-6 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      <Link
                        href={
                          inv.clientId || findClientId(inv.partnerName, inv.partnerCui)
                            ? `/client/${inv.clientId || findClientId(inv.partnerName, inv.partnerCui)}`
                            : `/clienti?search=${encodeURIComponent(inv.partnerName)}`
                        }
                        className="hover:underline hover:text-primary transition-colors cursor-pointer"
                      >
                        {inv.partnerName}
                      </Link>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {inv.number}
                      </span>
                      <span>·</span>
                      <span>{formatDate(inv.date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === "paid" || inv.status === "processed"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : inv.status === "sent"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {inv.status === "paid" || inv.status === "processed"
                        ? "Încasat"
                        : inv.status === "sent"
                        ? "Trimis"
                        : "Ciornă"}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white min-w-[90px] text-right">
                      {formatCurrency(inv.rawTotal, inv.currency as Currency)}
                    </span>
                    {inv.fileUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 transition-colors cursor-pointer"
                        title="Vizualizează Factura PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Facturi Primite Recente */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Facturi Primite Recente (Achiziții)
              </h2>
              <p className="text-[11px] text-slate-500">
                Ultimele facturi de la furnizori
              </p>
            </div>
            <Link href="/facturi">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                Vezi toate <ChevronRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {allInvoices
              .filter((i) => i.type === "primit")
              .slice(0, 5)
              .map((inv) => (
                <div
                  key={`primita-${inv.id}`}
                  className="px-6 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {inv.partnerName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {inv.number}
                      </span>
                      <span>·</span>
                      <span>{formatDate(inv.date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === "paid" || inv.status === "processed"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                      }`}
                    >
                      {inv.status === "paid" || inv.status === "processed"
                        ? "Achitat"
                        : "În așteptare"}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white min-w-[90px] text-right">
                      {formatCurrency(inv.rawTotal, inv.currency as Currency)}
                    </span>
                    {inv.fileUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-400 transition-colors cursor-pointer"
                        title="Vizualizează Factura PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── IN-APP PDF PREVIEW MODAL ── */}
      <Dialog
        open={!!previewInvoice}
        onOpenChange={(open) => !open && setPreviewInvoice(null)}
      >
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {previewInvoice?.type === "emis"
                    ? "Factură Emisă"
                    : "Factură Primită"}{" "}
                  {previewInvoice?.number}
                </DialogTitle>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {previewInvoice?.partnerName} ·{" "}
                  {formatDate(previewInvoice?.date)} ·{" "}
                  {formatCurrency(
                    previewInvoice?.rawTotal || 0,
                    (previewInvoice?.currency || "RON") as Currency
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mr-6">
              {previewInvoice?.fileUrl && (
                <a
                  href={previewInvoice.fileUrl}
                  download={`Factura_${previewInvoice.number}.pdf`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                  title="Descarcă PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Descarcă</span>
                </a>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950/60 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
            {previewInvoice?.fileUrl ? (
              <iframe
                src={previewInvoice.fileUrl}
                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white shadow-sm"
                title={`Factura ${previewInvoice.number}`}
              />
            ) : (
              <div className="text-center text-slate-400 text-sm">
                Nu există fișier PDF asociat acestei facturi.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Custom Smart Interactive Tooltip
function CustomSmartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const emise = payload.find((p: any) => p.dataKey === "emise")?.value || 0;
    const primite = payload.find((p: any) => p.dataKey === "primite")?.value || 0;
    const net = payload.find((p: any) => p.dataKey === "net")?.value ?? (emise - primite);

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs min-w-[190px] space-y-2">
        <div className="font-bold text-slate-300 border-b border-slate-800 pb-1.5 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400">Sumar Perioadă</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-emerald-400 font-semibold">
            <span>Venituri Emise:</span>
            <span>{formatCurrency(emise, "RON")}</span>
          </div>
          <div className="flex items-center justify-between text-rose-400 font-semibold">
            <span>Cheltuieli Primite:</span>
            <span>{formatCurrency(primite, "RON")}</span>
          </div>
          <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between font-black">
            <span className="text-slate-300">Sold Net:</span>
            <span className={net >= 0 ? "text-emerald-400" : "text-rose-400"}>
              {net >= 0 ? "+" : ""}
              {formatCurrency(net, "RON")}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
