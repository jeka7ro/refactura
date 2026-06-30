// RefacturaRO — Central data store with mock data
// Design: Slate Command Center — professional B2B SaaS

export type Currency = "RON" | "EUR" | "USD" | "GBP" | "CHF";
export type Language = "ro" | "en" | "de" | "fr";
export type Country = "RO" | "DE" | "FR" | "GB" | "US";
export type InvoiceStatus =
  | "imported"
  | "re-invoiced"
  | "partial"
  | "pending"
  | "storno";
export type ReInvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type IntegrationSource = "SmartBill" | "SPV" | "Oblio" | "Manual";

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  vatRate: number; // percentage e.g. 19
  currency: Currency;
}

export interface Invoice {
  id: string;
  number: string;
  source: IntegrationSource;
  supplierName: string;
  supplierCUI: string;
  date: string;
  dueDate: string;
  currency: Currency;
  total: number;
  totalVAT: number;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  importedAt: string;
}

export interface ReInvoiceLine extends InvoiceLine {
  originalUnitPrice: number;
  markupPercent?: number; // optional markup over original
}

export interface ReInvoice {
  id: string;
  number: string;
  sourceInvoiceId: string;
  sourceInvoiceNumber: string;
  clientId: string;
  clientName: string;
  date: string;
  dueDate: string;
  currency: Currency;
  total: number;
  totalVAT: number;
  status: ReInvoiceStatus;
  lines: ReInvoiceLine[];
  notes?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  cui: string;
  regCom: string;
  address: string;
  city: string;
  county: string;
  country: Country;
  email: string;
  phone: string;
  currency: Currency;
  language: Language;
  contactPerson?: string;
  iban?: string;
  bank?: string;
  createdAt: string;
  totalInvoiced: number;
  invoiceCount: number;
}

export interface Integration {
  id: string;
  name: IntegrationSource;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  companyId?: string;
  lastSync?: string;
  syncCount?: number;
  status: "connected" | "disconnected" | "error";
  description: string;
  logoColor: string;
}

export interface CompanySettings {
  name: string;
  cui: string;
  regCom: string;
  address: string;
  city: string;
  county: string;
  country: Country;
  email: string;
  phone: string;
  iban: string;
  bank: string;
  defaultCurrency: Currency;
  defaultLanguage: Language;
  defaultVatRate: number;
  invoicePrefix: string;
  invoiceStartNumber: number;
  defaultDueDays: number;
  defaultMarkupPercent: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const mockInvoices: Invoice[] = [
  {
    id: "inv-001",
    number: "SB-2024-001245",
    source: "SmartBill",
    supplierName: "Dedeman SRL",
    supplierCUI: "RO123456",
    date: "2024-11-15",
    dueDate: "2024-12-15",
    currency: "RON",
    total: 12450.0,
    totalVAT: 1985.5,
    status: "re-invoiced",
    importedAt: "2024-11-16T08:30:00Z",
    lines: [
      {
        id: "l1",
        description: "Ciment Portland CEM I 42.5R, saci 25kg",
        quantity: 200,
        unitPrice: 28.5,
        unit: "sac",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "l2",
        description: "Nisip de construcții 0-4mm, big bag 1t",
        quantity: 15,
        unitPrice: 185.0,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "l3",
        description: "Plasă sudată Ø6 2x3m",
        quantity: 50,
        unitPrice: 42.0,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
    ],
  },
  {
    id: "inv-002",
    number: "SPV-2024-0089",
    source: "SPV",
    supplierName: "Leroy Merlin România SRL",
    supplierCUI: "RO987654",
    date: "2024-11-20",
    dueDate: "2024-12-20",
    currency: "RON",
    total: 8320.0,
    totalVAT: 1327.06,
    status: "partial",
    importedAt: "2024-11-21T09:15:00Z",
    lines: [
      {
        id: "l4",
        description: "Vopsea lavabilă albă 15L Dulux",
        quantity: 30,
        unitPrice: 145.0,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "l5",
        description: "Gresie porțelanată 60x60 Gri Antracit",
        quantity: 120,
        unitPrice: 38.5,
        unit: "mp",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "l6",
        description: "Adeziv gresie C2TE 25kg",
        quantity: 40,
        unitPrice: 52.0,
        unit: "sac",
        vatRate: 19,
        currency: "RON",
      },
    ],
  },
  {
    id: "inv-003",
    number: "OBL-2024-00312",
    source: "Oblio",
    supplierName: "Knauf România SRL",
    supplierCUI: "RO456789",
    date: "2024-11-22",
    dueDate: "2024-12-22",
    currency: "EUR",
    total: 3200.0,
    totalVAT: 608.0,
    status: "pending",
    importedAt: "2024-11-23T10:00:00Z",
    lines: [
      {
        id: "l7",
        description: "Plăci gips-carton GKB 12.5mm 1.2x2.6m",
        quantity: 100,
        unitPrice: 18.0,
        unit: "buc",
        vatRate: 19,
        currency: "EUR",
      },
      {
        id: "l8",
        description: "Profil CW 75/3m",
        quantity: 200,
        unitPrice: 4.5,
        unit: "buc",
        vatRate: 19,
        currency: "EUR",
      },
      {
        id: "l9",
        description: "Profil UW 75/3m",
        quantity: 100,
        unitPrice: 4.2,
        unit: "buc",
        vatRate: 19,
        currency: "EUR",
      },
    ],
  },
  {
    id: "inv-004",
    number: "SB-2024-001301",
    source: "SmartBill",
    supplierName: "Saint-Gobain România SRL",
    supplierCUI: "RO321654",
    date: "2024-11-25",
    dueDate: "2024-12-25",
    currency: "RON",
    total: 18750.0,
    totalVAT: 2992.44,
    status: "imported",
    importedAt: "2024-11-26T07:45:00Z",
    lines: [
      {
        id: "l10",
        description: "Vată minerală bazaltică 10cm 1.2x0.6m",
        quantity: 300,
        unitPrice: 38.5,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "l11",
        description: "Polistiren expandat EPS 100 10cm",
        quantity: 200,
        unitPrice: 42.0,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
    ],
  },
  {
    id: "inv-005",
    number: "MAN-2024-0015",
    source: "Manual",
    supplierName: "Baumit România SRL",
    supplierCUI: "RO654321",
    date: "2024-11-28",
    dueDate: "2024-12-28",
    currency: "RON",
    total: 5600.0,
    totalVAT: 893.28,
    status: "imported",
    importedAt: "2024-11-28T14:20:00Z",
    lines: [
      {
        id: "l12",
        description: "Tencuială decorativă Baumit Granopor 25kg",
        quantity: 80,
        unitPrice: 42.0,
        unit: "sac",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "l13",
        description: "Grund Baumit UniPrimer 10L",
        quantity: 40,
        unitPrice: 56.0,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
    ],
  },
];

export const mockClients: Client[] = [
  {
    id: "cli-001",
    name: "Construct Pro SRL",
    cui: "RO11223344",
    regCom: "J40/1234/2018",
    address: "Str. Industriilor nr. 15",
    city: "București",
    county: "Ilfov",
    country: "RO",
    email: "office@constructpro.ro",
    phone: "+40 21 123 4567",
    currency: "RON",
    language: "ro",
    contactPerson: "Andrei Popescu",
    iban: "RO49AAAA1B31007593840000",
    bank: "BCR",
    createdAt: "2024-01-15",
    totalInvoiced: 45200.0,
    invoiceCount: 8,
  },
  {
    id: "cli-002",
    name: "Renovart Design SRL",
    cui: "RO55667788",
    regCom: "J40/5678/2020",
    address: "Bd. Unirii nr. 42, et. 3",
    city: "Cluj-Napoca",
    county: "Cluj",
    country: "RO",
    email: "contact@renovart.ro",
    phone: "+40 264 456 789",
    currency: "EUR",
    language: "ro",
    contactPerson: "Maria Ionescu",
    iban: "RO49AAAA1B31007593840001",
    bank: "ING",
    createdAt: "2024-03-10",
    totalInvoiced: 28750.0,
    invoiceCount: 5,
  },
  {
    id: "cli-003",
    name: "Alpine Build GmbH",
    cui: "DE123456789",
    regCom: "HRB 12345",
    address: "Hauptstraße 89",
    city: "München",
    county: "Bayern",
    country: "DE",
    email: "info@alpinebuild.de",
    phone: "+49 89 123 456",
    currency: "EUR",
    language: "de",
    contactPerson: "Klaus Weber",
    iban: "DE89370400440532013000",
    bank: "Deutsche Bank",
    createdAt: "2024-05-20",
    totalInvoiced: 15600.0,
    invoiceCount: 3,
  },
  {
    id: "cli-004",
    name: "Habitat Construct SRL",
    cui: "RO99887766",
    regCom: "J32/890/2019",
    address: "Str. Victoriei nr. 8",
    city: "Timișoara",
    county: "Timiș",
    country: "RO",
    email: "office@habitatconstruct.ro",
    phone: "+40 256 789 012",
    currency: "RON",
    language: "ro",
    contactPerson: "Ion Dumitrescu",
    createdAt: "2024-02-28",
    totalInvoiced: 67800.0,
    invoiceCount: 12,
  },
];

export const mockReInvoices: ReInvoice[] = [
  {
    id: "ri-001",
    number: "RF-2024-0001",
    sourceInvoiceId: "inv-001",
    sourceInvoiceNumber: "SB-2024-001245",
    clientId: "cli-001",
    clientName: "Construct Pro SRL",
    date: "2024-11-18",
    dueDate: "2024-12-18",
    currency: "RON",
    total: 14540.0,
    totalVAT: 2318.0,
    status: "paid",
    createdAt: "2024-11-18T10:00:00Z",
    lines: [
      {
        id: "rl1",
        description: "Ciment Portland CEM I 42.5R, saci 25kg",
        quantity: 200,
        unitPrice: 33.0,
        originalUnitPrice: 28.5,
        markupPercent: 15.79,
        unit: "sac",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "rl2",
        description: "Nisip de construcții 0-4mm, big bag 1t",
        quantity: 15,
        unitPrice: 215.0,
        originalUnitPrice: 185.0,
        markupPercent: 16.22,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "rl3",
        description: "Plasă sudată Ø6 2x3m",
        quantity: 50,
        unitPrice: 50.0,
        originalUnitPrice: 42.0,
        markupPercent: 19.05,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
    ],
  },
  {
    id: "ri-002",
    number: "RF-2024-0002",
    sourceInvoiceId: "inv-002",
    sourceInvoiceNumber: "SPV-2024-0089",
    clientId: "cli-004",
    clientName: "Habitat Construct SRL",
    date: "2024-11-22",
    dueDate: "2024-12-22",
    currency: "RON",
    total: 9650.0,
    totalVAT: 1539.5,
    status: "sent",
    createdAt: "2024-11-22T11:30:00Z",
    lines: [
      {
        id: "rl4",
        description: "Vopsea lavabilă albă 15L Dulux",
        quantity: 30,
        unitPrice: 165.0,
        originalUnitPrice: 145.0,
        markupPercent: 13.79,
        unit: "buc",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "rl5",
        description: "Gresie porțelanată 60x60 Gri Antracit",
        quantity: 120,
        unitPrice: 45.0,
        originalUnitPrice: 38.5,
        markupPercent: 16.88,
        unit: "mp",
        vatRate: 19,
        currency: "RON",
      },
      {
        id: "rl6",
        description: "Adeziv gresie C2TE 25kg",
        quantity: 40,
        unitPrice: 60.0,
        originalUnitPrice: 52.0,
        markupPercent: 15.38,
        unit: "sac",
        vatRate: 19,
        currency: "RON",
      },
    ],
  },
  {
    id: "ri-003",
    number: "RF-2024-0003",
    sourceInvoiceId: "inv-003",
    sourceInvoiceNumber: "OBL-2024-00312",
    clientId: "cli-002",
    clientName: "Renovart Design SRL",
    date: "2024-11-25",
    dueDate: "2024-12-25",
    currency: "EUR",
    total: 3750.0,
    totalVAT: 712.5,
    status: "draft",
    createdAt: "2024-11-25T14:00:00Z",
    lines: [
      {
        id: "rl7",
        description: "Plăci gips-carton GKB 12.5mm 1.2x2.6m",
        quantity: 100,
        unitPrice: 21.0,
        originalUnitPrice: 18.0,
        markupPercent: 16.67,
        unit: "buc",
        vatRate: 19,
        currency: "EUR",
      },
      {
        id: "rl8",
        description: "Profil CW 75/3m",
        quantity: 200,
        unitPrice: 5.2,
        originalUnitPrice: 4.5,
        markupPercent: 15.56,
        unit: "buc",
        vatRate: 19,
        currency: "EUR",
      },
      {
        id: "rl9",
        description: "Profil UW 75/3m",
        quantity: 100,
        unitPrice: 4.9,
        originalUnitPrice: 4.2,
        markupPercent: 16.67,
        unit: "buc",
        vatRate: 19,
        currency: "EUR",
      },
    ],
  },
];

export const mockIntegrations: Integration[] = [
  {
    id: "int-smartbill",
    name: "SmartBill",
    enabled: true,
    apiKey: "sb_live_••••••••••••••••",
    companyId: "RO12345678",
    lastSync: "2024-11-28T14:30:00Z",
    syncCount: 47,
    status: "connected",
    description:
      "Importă automat facturile emise și primite din SmartBill. Sincronizare în timp real.",
    logoColor: "#0066CC",
  },
  {
    id: "int-spv",
    name: "SPV",
    enabled: true,
    apiKey: "spv_••••••••••",
    companyId: "RO12345678",
    lastSync: "2024-11-28T12:00:00Z",
    syncCount: 23,
    status: "connected",
    description:
      "Sistemul de Plăți și Verificări ANAF — importă e-Factura din spațiul privat virtual.",
    logoColor: "#003087",
  },
  {
    id: "int-oblio",
    name: "Oblio",
    enabled: false,
    status: "disconnected",
    description:
      "Conectare cu Oblio pentru import facturi furnizori și sincronizare bază clienți.",
    logoColor: "#FF6B35",
  },
];

export const mockCompanySettings: CompanySettings = {
  name: "",
  cui: "",
  regCom: "",
  address: "",
  city: "",
  county: "",
  country: "RO",
  email: "",
  phone: "",
  iban: "",
  bank: "",
  defaultCurrency: "RON",
  defaultLanguage: "ro",
  defaultVatRate: 19,
  invoicePrefix: "RF",
  invoiceStartNumber: 1,
  defaultDueDays: 30,
  defaultMarkupPercent: 15,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number, currency: Currency): string {
  const formatters: Record<Currency, Intl.NumberFormat> = {
    RON: new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }),
    EUR: new Intl.NumberFormat("ro-RO", { style: "currency", currency: "EUR" }),
    USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
    GBP: new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }),
    CHF: new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF" }),
  };
  return formatters[currency].format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(
  dateStr: string | null | undefined | Date
): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  imported: "Importată",
  "re-invoiced": "Re-facturată",
  partial: "Parțial",
  pending: "În așteptare",
  storno: "Storno",
};

export const reInvoiceStatusLabels: Record<ReInvoiceStatus, string> = {
  draft: "Ciornă",
  sent: "Trimisă",
  paid: "Achitată",
  overdue: "Restantă",
};

export const invoiceStatusColors: Record<InvoiceStatus, string> = {
  imported: "bg-blue-50 text-blue-600 border-blue-200",
  "re-invoiced": "bg-emerald-50 text-emerald-600 border-emerald-200",
  partial: "bg-amber-50 text-amber-600 border-amber-200",
  pending: "bg-slate-50 text-slate-500 border-slate-200",
  storno: "bg-rose-50 text-rose-600 border-rose-200",
};

export const reInvoiceStatusColors: Record<ReInvoiceStatus, string> = {
  draft: "bg-slate-50 text-slate-500 border-slate-200",
  sent: "bg-blue-50 text-blue-600 border-blue-200",
  paid: "bg-emerald-50 text-emerald-600 border-emerald-200",
  overdue: "bg-rose-50 text-rose-600 border-rose-200",
};

export const sourceColors: Record<IntegrationSource, string> = {
  SmartBill: "bg-blue-50 text-blue-700 border-blue-200",
  SPV: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Oblio: "bg-orange-50 text-orange-700 border-orange-200",
  Manual: "bg-slate-50 text-slate-600 border-slate-200",
};

export const currencies: Currency[] = ["RON", "EUR", "USD", "GBP", "CHF"];
export const languages: { code: Language; label: string }[] = [
  { code: "ro", label: "Română" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
];
export const countries: { code: Country; label: string; flag: string }[] = [
  { code: "RO", label: "România", flag: "🇷🇴" },
  { code: "DE", label: "Germania", flag: "🇩🇪" },
  { code: "FR", label: "Franța", flag: "🇫🇷" },
  { code: "GB", label: "Marea Britanie", flag: "🇬🇧" },
  { code: "US", label: "SUA", flag: "🇺🇸" },
];
