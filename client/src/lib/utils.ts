import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return "0";
  return new Intl.NumberFormat("ro-RO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const ZOD_FIELD_LABELS: Record<string, string> = {
  email: "Adresa de email",
  password: "Parola",
  confirmPassword: "Confirmarea parolei",
  phone: "Numărul de telefon",
  name: "Numele",
  clientName: "Numele clientului",
  cui: "CUI",
  clientCUI: "CUI client",
  issueDate: "Data emiterii",
  dueDate: "Data scadenței",
  lines: "Liniile documentului",
  description: "Descrierea",
  quantity: "Cantitatea",
  unitPrice: "Prețul unitar",
};

function formatZodIssue(issue: Record<string, any>): string {
  const rawField = Array.isArray(issue?.path) && issue.path.length > 0
    ? String(issue.path[issue.path.length - 1])
    : "";
  const fieldLabel = ZOD_FIELD_LABELS[rawField] || rawField;
  const code = String(issue?.code || "");
  const msg = String(issue?.message || "").trim();

  if (code === "too_small") {
    const min = issue?.minimum;
    if (issue?.type === "string" && min !== undefined) {
      return `${fieldLabel || "Câmpul"} trebuie să conțină cel puțin ${min} caractere.`;
    }
    if (issue?.type === "array" && min !== undefined) {
      return `${fieldLabel || "Lista"} trebuie să conțină cel puțin ${min} element(e).`;
    }
    if (min !== undefined) {
      return `${fieldLabel || "Valoarea"} trebuie să fie cel puțin ${min}.`;
    }
  }

  if (code === "too_big" && issue?.maximum !== undefined) {
    if (issue?.type === "string") {
      return `${fieldLabel || "Câmpul"} poate avea cel mult ${issue.maximum} caractere.`;
    }
    return `${fieldLabel || "Valoarea"} nu poate depăși ${issue.maximum}.`;
  }

  if (
    (code === "invalid_string" || code === "invalid_format") &&
    (issue?.validation === "email" || issue?.format === "email")
  ) {
    return "Adresa de email nu este validă.";
  }

  if (code === "invalid_type" && (issue?.received === "undefined" || issue?.received === "null")) {
    return fieldLabel ? `Câmpul „${fieldLabel}” este obligatoriu.` : "Un câmp obligatoriu lipsește.";
  }

  if (msg) {
    if (/^required$/i.test(msg)) {
      return fieldLabel ? `Câmpul „${fieldLabel}” este obligatoriu.` : "Câmp obligatoriu.";
    }
    if (/invalid email/i.test(msg)) {
      return "Adresa de email nu este validă.";
    }
    const minCharsMatch = msg.match(/at least (\d+) character/i);
    if (minCharsMatch) {
      return `${fieldLabel || "Câmpul"} trebuie să conțină cel puțin ${minCharsMatch[1]} caractere.`;
    }
    return fieldLabel && !msg.toLowerCase().includes(fieldLabel.toLowerCase())
      ? `${fieldLabel}: ${msg}`
      : msg;
  }

  return "Datele introduse nu sunt valide.";
}

export function cleanErrorMessage(
  err: unknown,
  fallback = "A apărut o eroare."
): string {
  if (!err) return fallback;

  let raw = "";
  if (typeof err === "string") {
    raw = err;
  } else if (err instanceof Error) {
    raw = err.message || "";
  } else if (typeof err === "object" && "message" in err && typeof (err as any).message === "string") {
    raw = (err as any).message;
  }

  raw = raw.replace(/^TRPCClientError:\s*/i, "").trim();
  if (!raw) return fallback;

  const bracketIdx = raw.indexOf("[");
  if (bracketIdx >= 0 && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw.slice(bracketIdx));
      if (Array.isArray(parsed) && parsed.length > 0) {
        const formatted = parsed
          .filter(item => item && typeof item === "object")
          .map(item => formatZodIssue(item))
          .filter(Boolean);
        if (formatted.length > 0) {
          return Array.from(new Set(formatted)).join(" ");
        }
      }
    } catch {
      // Not a JSON array, continue with raw text
    }
  }

  return raw || fallback;
}
