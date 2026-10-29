import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Table as TableIcon,
  Minus,
  Type,
  Palette,
  Highlighter,
  FileSignature,
  FileCheck,
  ShieldCheck,
  Check,
  Trash2,
  Undo2,
  Redo2,
  Copy,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ContractSignaturePadModal from "./ContractSignaturePadModal";
import { toast } from "sonner";

interface ContractVisualEditorProps {
  value: string;
  onChange: (html: string) => void;
  tenantName: string;
  tenantCui: string;
  tenantRegCom?: string;
  tenantIban: string;
  tenantBank: string;
  tenantRepresentative?: string;
  partnerName: string;
  partnerCui: string;
  partnerRegCom?: string;
  partnerContactName?: string;
  partnerPhone?: string;
  partnerEmail?: string;
  docNumber: string;
  docDate: string;
  docValue: string;
  docCurrency: string;
  onSetDocValue?: (val: string) => void;
  supplierSignature?: string | null;
  clientSignature?: string | null;
  signatureType?: string | null;
  signedAt?: string | null;
  onUpdateSignatures?: (signatures: {
    supplierSignature?: string | null;
    clientSignature?: string | null;
    signatureType?: "olografic" | "digital" | "hibrid";
    signedAt?: string | null;
    metadata?: any;
  }) => void;
}

export default function ContractVisualEditor({
  value,
  onChange,
  tenantName,
  tenantCui,
  tenantRegCom,
  tenantIban,
  tenantBank,
  tenantRepresentative,
  partnerName,
  partnerCui,
  partnerRegCom,
  partnerContactName,
  partnerPhone,
  partnerEmail,
  docNumber,
  docDate,
  docValue,
  docCurrency,
  onSetDocValue,
  supplierSignature,
  clientSignature,
  signatureType,
  signedAt,
  onUpdateSignatures,
}: ContractVisualEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Signature Modal state
  const [sigModalRole, setSigModalRole] = useState<"supplier" | "client">("supplier");
  const [sigModalOpen, setSigModalOpen] = useState(false);

  // Active toolbar formats
  const [activeFont, setActiveFont] = useState("Inter");
  const [activeFontSize, setActiveFontSize] = useState("13px");
  const [textColor, setTextColor] = useState("#0f172a");
  const [bgColor, setBgColor] = useState("transparent");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Referință pentru ultima valoare emisă din interiorul editorului (pentru a evita resetarea cursorului la tastare)
  const lastEmittedValueRef = useRef<string>("");

  // Sincronizează conținutul editorului când prop-ul `value` este actualizat din exterior (alegere partener, schimbare limbă, șablon etc.)
  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== undefined && value !== lastEmittedValueRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
      lastEmittedValueRef.current = value || "";
    }
  }, [value]);

  // Execute standard editor commands
  const execCmd = (command: string, arg: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, arg);
    triggerContentChange();
  };

  const triggerContentChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      lastEmittedValueRef.current = html;
      onChange(html);
    }
  }, [onChange]);

  // Change font family
  const handleFontChange = (font: string) => {
    setActiveFont(font);
    execCmd("fontName", font);
  };

  // Change font size
  const handleFontSizeChange = (size: string) => {
    setActiveFontSize(size);
    // document.execCommand fontSize only takes 1-7, so we wrap selection in span with style
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const span = document.createElement("span");
    span.style.fontSize = size;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      triggerContentChange();
    } catch {
      execCmd("fontSize", "3");
    }
  };

  // Change text color
  const handleTextColor = (color: string) => {
    setTextColor(color);
    execCmd("foreColor", color);
    setShowColorPicker(false);
  };

  // Change background highlight color
  const handleBgColor = (color: string) => {
    setBgColor(color);
    if (color === "transparent") {
      execCmd("removeFormat");
    } else {
      execCmd("hiliteColor", color);
    }
    setShowBgPicker(false);
  };

  // Clean paste from Word / Google Docs / PDF
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData("text/html");
    const plainText = clipboardData.getData("text/plain");

    if (htmlData) {
      // Clean Word metadata and mso artifacts
      let cleaned = htmlData
        .replace(/<!--[\s\S]*?-->/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<meta[^>]*>/gi, "")
        .replace(/<link[^>]*>/gi, "")
        .replace(/class="?Mso[a-zA-Z0-9]+"?/gi, "")
        .replace(/style="[^"]*mso-[^"]*"/gi, "")
        .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "")
        .replace(/<font[^>]*>/gi, "")
        .replace(/<\/font>/gi, "");

      // Execute insertHTML
      document.execCommand("insertHTML", false, cleaned);
      toast.info("Text importat și optimizat din clipboard");
    } else if (plainText) {
      // Split plain text by lines and wrap in paragraphs
      const formatted = plainText
        .split("\n\n")
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      document.execCommand("insertHTML", false, formatted);
    }

    triggerContentChange();
  };

  // Insert Table
  const handleInsertTable = (rows: number = 3, cols: number = 2) => {
    let tableHtml = `<table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; border: 1px solid #cbd5e1;">`;
    tableHtml += `<thead><tr style="background-color: #f1f5f9;">`;
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: bold; color: #1e293b;">Coloana ${c + 1}</th>`;
    }
    tableHtml += `</tr></thead><tbody>`;
    for (let r = 0; r < rows; r++) {
      tableHtml += `<tr>`;
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #334155;">Detaliu ${r + 1}.${c + 1}</td>`;
      }
      tableHtml += `</tr>`;
    }
    tableHtml += `</tbody></table><p><br/></p>`;

    execCmd("insertHTML", tableHtml);
    toast.success(`Tabel inserat (${rows}x${cols})`);
  };

  // Insert Variable Token
  const handleInsertVariable = (token: string, resolvedValue?: string) => {
    const textToInsert = resolvedValue ? `<strong>${resolvedValue}</strong>` : `{{${token}}}`;
    execCmd("insertHTML", `&nbsp;${textToInsert}&nbsp;`);
    toast.info(`Câmp inserat: ${token}`);
  };

  // Signatures management
  const handleOpenSignatureModal = (role: "supplier" | "client") => {
    setSigModalRole(role);
    setSigModalOpen(true);
  };

  const handleSaveSignature = (data: {
    signatureDataUrl: string;
    signatureType: "olografic" | "digital" | "hibrid";
    signatoryName: string;
    metadata?: any;
  }) => {
    if (!onUpdateSignatures) return;

    if (sigModalRole === "supplier") {
      onUpdateSignatures({
        supplierSignature: data.signatureDataUrl,
        clientSignature: clientSignature || null,
        signatureType: data.signatureType,
        signedAt: data.metadata?.timestamp || new Date().toISOString(),
        metadata: data.metadata,
      });
    } else {
      onUpdateSignatures({
        supplierSignature: supplierSignature || null,
        clientSignature: data.signatureDataUrl,
        signatureType: data.signatureType,
        signedAt: data.metadata?.timestamp || new Date().toISOString(),
        metadata: data.metadata,
      });
    }
  };

  const handleRemoveSignature = (role: "supplier" | "client") => {
    if (!onUpdateSignatures) return;
    if (role === "supplier") {
      onUpdateSignatures({
        supplierSignature: null,
        clientSignature: clientSignature || null,
      });
    } else {
      onUpdateSignatures({
        supplierSignature: supplierSignature || null,
        clientSignature: null,
      });
    }
    toast.info(`Semnătura ${role === "supplier" ? "Furnizorului" : "Beneficiarului"} a fost eliminată`);
  };

  return (
    <div className="space-y-4">
      {/* ═════════════════════════════════════════════════════════════════
          TOP TOOLBAR & QUICK ACTIONS
          ═════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {/* Row 1: Font, Size, Style & Colors */}
        <div className="p-2 sm:p-2.5 flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 text-xs">
          {/* Font Family Selector */}
          <select
            value={activeFont}
            onChange={(e) => handleFontChange(e.target.value)}
            className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs px-2.5 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="Inter, system-ui, sans-serif">Modern Sans (Inter)</option>
            <option value="Georgia, Merriweather, serif">Serif Tradițional (Georgia)</option>
            <option value="'Times New Roman', Times, serif">Times New Roman</option>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="Roboto, sans-serif">Roboto</option>
            <option value="ui-monospace, monospace">Monospace Legal</option>
          </select>

          {/* Font Size Selector */}
          <select
            value={activeFontSize}
            onChange={(e) => handleFontSizeChange(e.target.value)}
            className="h-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs px-2 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="10px">10 px</option>
            <option value="11px">11 px</option>
            <option value="12px">12 px</option>
            <option value="13px">13 px (Standard)</option>
            <option value="14px">14 px</option>
            <option value="16px">16 px (Titlu Secțiune)</option>
            <option value="18px">18 px</option>
            <option value="22px">22 px (Titlu Mare)</option>
          </select>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Text Formatting: B, I, U, S */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => execCmd("bold")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors"
              title="Îngroșat (Ctrl+B)"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("italic")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 italic transition-colors"
              title="Cursiv (Ctrl+I)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("underline")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 underline transition-colors"
              title="Subliniat (Ctrl+U)"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("strikeThrough")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 line-through transition-colors"
              title="Tăiat"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Text Color Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowBgPicker(false);
              }}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium"
              title="Culoare text"
            >
              <Palette className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              <span
                className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block"
                style={{ backgroundColor: textColor }}
              />
            </button>

            {showColorPicker && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-48 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Culoare Text:
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { color: "#0f172a", name: "Negru" },
                    { color: "#1e3a8a", name: "Bleumarin" },
                    { color: "#334155", name: "Slate Închis" },
                    { color: "#475569", name: "Gri Închis" },
                    { color: "#64748b", name: "Gri Mediu" },
                    { color: "#94a3b8", name: "Gri Muted" },
                    { color: "#000000", name: "Pure Black" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => handleTextColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className="h-6 w-6 rounded-lg border border-slate-200 hover:scale-110 transition-transform"
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Background Highlight Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowBgPicker(!showBgPicker);
                setShowColorPicker(false);
              }}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium"
              title="Culoare fundal text (Evidențiere)"
            >
              <Highlighter className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              <span
                className="h-3.5 w-3.5 rounded-full border border-slate-300 inline-block"
                style={{ backgroundColor: bgColor === "transparent" ? "#ffffff" : bgColor }}
              />
            </button>

            {showBgPicker && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl w-48 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Fundal / Evidențiere:
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { color: "transparent", name: "Fără evidențiere" },
                    { color: "#fef08a", name: "Galben Pal" },
                    { color: "#e2e8f0", name: "Gri Pal" },
                    { color: "#f1f5f9", name: "Alb-Gri Deschis" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => handleBgColor(c.color)}
                      style={{ backgroundColor: c.color === "transparent" ? "#ffffff" : c.color }}
                      className="h-6 w-6 rounded-lg border border-slate-300 hover:scale-110 transition-transform relative flex items-center justify-center"
                      title={c.name}
                    >
                      {c.color === "transparent" && <Minus className="h-3 w-3 text-slate-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          {/* Alignments */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => execCmd("justifyLeft")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Aliniere la Stânga"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("justifyCenter")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Aliniere Centrată"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("justifyRight")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Aliniere la Dreapta"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("justifyFull")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Aliniere Stânga-Dreapta (Justify)"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => execCmd("insertUnorderedList")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Listă cu Puncte"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("insertOrderedList")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Listă Numerotată"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("indent")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Mărește Indent"
            >
              <Indent className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("outdent")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Micșorează Indent"
            >
              <Outdent className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Table, Separator & Dynamic Variables Dropdown */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleInsertTable(3, 2)}
              className="h-8 text-xs rounded-xl px-2.5"
              title="Inserează Tabel cu linii"
            >
              <TableIcon className="h-3.5 w-3.5 mr-1 text-slate-600" />
              Tabel
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => execCmd("insertHorizontalRule")}
              className="h-8 text-xs rounded-xl px-2"
              title="Linie despărțitoare"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>

            {/* Meniu Câmpuri Dinamice (Curat, organizat, fără aglomerare) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs rounded-xl px-2.5 gap-1.5 font-medium border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                  title="Inserează o variabilă la poziția cursorului"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>Inserează Câmp</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={6} avoidCollisions={false} className="w-64 text-xs rounded-xl p-1.5 z-50 max-h-[380px] overflow-y-auto shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                  Beneficiar (Client)
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleInsertVariable("Client", partnerName || "[Partener]")}>
                  Beneficiar: {partnerName ? partnerName.slice(0, 18) + "..." : "Nume"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("CUI_Client", partnerCui || "-")}>
                  CUI Beneficiar ({partnerCui || "-"})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("J_Client", partnerRegCom || "-")}>
                  Reg. Com. / J Beneficiar ({partnerRegCom || "-"})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("Reprezentant_Client", partnerContactName || "Administrator")}>
                  Reprezentant ({partnerContactName || "Reprezentant"})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("Telefon_Client", partnerPhone || "-")}>
                  Telefon ({partnerPhone || "-"})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("Email_Client", partnerEmail || "-")}>
                  Email ({partnerEmail || "-"})
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                  Furnizor (Prestator)
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleInsertVariable("Furnizor", tenantName)}>
                  Furnizor: {tenantName.slice(0, 18)}...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("CUI_Furnizor", tenantCui)}>
                  CUI Furnizor ({tenantCui})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("J_Furnizor", tenantRegCom || "-")}>
                  Reg. Com. / J Furnizor ({tenantRegCom || "-"})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("IBAN", tenantIban)}>
                  IBAN Furnizor
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-slate-400 px-2 py-1">
                  Detalii Contract
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleInsertVariable("Număr_Contract", docNumber)}>
                  Număr Contract ({docNumber})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("Data_Contract", docDate)}>
                  Dată ({docDate})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleInsertVariable("Valoare", `${docValue} ${docCurrency}`)}>
                  Valoare ({docValue} {docCurrency})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════
          MAIN PAPER SHEET (A4 VISUAL VIEW)
          ═════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3 sm:p-6 shadow-inner flex justify-center">
        <div className="w-full max-w-[850px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-md p-6 sm:p-10 space-y-6">
          {/* Header foaie contract */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <div className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight uppercase">
                {tenantName}
              </div>
              <div className="text-slate-500 text-[11px] mt-0.5">
                CUI: {tenantCui} | IBAN: {tenantIban} | {tenantBank}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-primary">Nr. {docNumber}</div>
              <div className="text-[11px] text-slate-500">Data: {docDate}</div>
            </div>
          </div>

          {/* Editable Canvas Div */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={triggerContentChange}
            onPaste={handlePaste}
            className="min-h-[460px] focus:outline-none text-slate-800 dark:text-slate-200 leading-relaxed font-sans text-[13px] space-y-3"
            style={{
              fontFamily: activeFont,
              fontSize: activeFontSize,
            }}
          />

          {/* ═════════════════════════════════════════════════════════════════
              SIGNATURE BOXES AT THE BOTTOM OF THE CONTRACT
              ═════════════════════════════════════════════════════════════════ */}
          <div className="pt-8 border-t-2 border-slate-200 dark:border-slate-800 mt-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileSignature className="h-4 w-4 text-primary" />
                Semnăturile Părților Contractante:
              </span>
              <span className="text-[11px] text-slate-400">
                Puteți semna olografic pe ecran sau aplica un certificat digital eIDAS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: FURNIZOR / PRESTATOR */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 flex flex-col justify-between min-h-[160px]">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                    FURNIZOR / PRESTATOR
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {tenantName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Reprezentant: {tenantRepresentative || (tenantName.toUpperCase().includes("WOOD GLASS") ? "Șaran Vitalie" : tenantName.toUpperCase().includes("TRADE INVEST") ? "Elena Cazmal" : "Reprezentant Legal")}
                  </div>
                </div>

                <div className="my-2 py-1 flex items-center justify-center min-h-[70px]">
                  {supplierSignature ? (
                    <div className="relative group text-center">
                      <img
                        src={supplierSignature}
                        alt="Semnătură Furnizor"
                        className="max-h-16 max-w-[200px] object-contain mx-auto"
                      />
                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1 mt-1">
                        <Check className="h-3 w-3" />
                        Semnat oficial
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 text-xs italic">
                      [Nesemnat încă]
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSignatureModal("supplier")}
                    className="h-7 text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <FileSignature className="h-3.5 w-3.5 mr-1" />
                    {supplierSignature ? "Re-semnează" : "Semnează Olografic / Digital"}
                  </Button>

                  {supplierSignature && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSignature("supplier")}
                      className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Box 2: BENEFICIAR / CLIENT */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 flex flex-col justify-between min-h-[160px]">
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                    BENEFICIAR / CLIENT
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {partnerName || "[Selectați Partenerul din antet]"}
                  </div>
                  <div className="text-[10px] text-slate-400">Reprezentant Legal / Împuternicit</div>
                </div>

                <div className="my-2 py-1 flex items-center justify-center min-h-[70px]">
                  {clientSignature ? (
                    <div className="relative group text-center">
                      <img
                        src={clientSignature}
                        alt="Semnătură Beneficiar"
                        className="max-h-16 max-w-[200px] object-contain mx-auto"
                      />
                      <div className="text-[10px] text-emerald-600 font-semibold flex items-center justify-center gap-1 mt-1">
                        <Check className="h-3 w-3" />
                        Semnat oficial
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 text-xs italic">
                      [Nesemnat încă]
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSignatureModal("client")}
                    className="h-7 text-xs rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <FileSignature className="h-3.5 w-3.5 mr-1" />
                    {clientSignature ? "Re-semnează" : "Semnează Olografic / Digital"}
                  </Button>

                  {clientSignature && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSignature("client")}
                      className="h-7 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg px-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <ContractSignaturePadModal
        open={sigModalOpen}
        onOpenChange={setSigModalOpen}
        role={sigModalRole}
        partyName={sigModalRole === "supplier" ? tenantName : partnerName || "Beneficiar"}
        defaultSignatoryName={
          sigModalRole === "supplier"
            ? tenantRepresentative ||
              (tenantName.toUpperCase().includes("WOOD GLASS")
                ? "Șaran Vitalie"
                : tenantName.toUpperCase().includes("TRADE INVEST")
                ? "Elena Cazmal"
                : "Administrator")
            : partnerContactName
        }
        contractNumber={docNumber}
        onSaveSignature={handleSaveSignature}
      />
    </div>
  );
}
