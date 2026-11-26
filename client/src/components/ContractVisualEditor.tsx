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
      <div className="apple-surface overflow-visible">
        {/* Row 1: Font, Size, Style & Colors */}
        <div className="p-2 sm:p-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {/* Font Family Selector */}
          <select
            value={activeFont}
            onChange={(e) => handleFontChange(e.target.value)}
            className="h-8 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] text-xs px-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
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
            className="h-8 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-[#f2f2f7] dark:bg-[#2c2c2e] text-[#1d1d1f] dark:text-[#f5f5f7] text-xs px-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
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

          <div className="h-5 w-px bg-black/[0.08] dark:bg-white/[0.10] mx-1" />

          {/* Text Formatting: B, I, U, S */}
          <div className="flex items-center gap-0.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => execCmd("bold")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] font-bold transition-colors cursor-pointer"
              title="Îngroșat (Ctrl+B)"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("italic")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] italic transition-colors cursor-pointer"
              title="Cursiv (Ctrl+I)"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("underline")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] underline transition-colors cursor-pointer"
              title="Subliniat (Ctrl+U)"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("strikeThrough")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] line-through transition-colors cursor-pointer"
              title="Tăiat"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-black/[0.08] dark:bg-white/[0.10] mx-1" />

          {/* Text Color Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowBgPicker(false);
              }}
              className="apple-btn-glass flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              title="Culoare text"
            >
              <Palette className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/20 dark:border-white/25 inline-block"
                style={{ backgroundColor: textColor }}
              />
            </button>

            {showColorPicker && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl shadow-2xl w-48 space-y-2">
                <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Culoare text
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { color: "#0f172a", name: "Negru" },
                    { color: "#1e3a8a", name: "Bleumarin" },
                    { color: "#334155", name: "Antracit" },
                    { color: "#475569", name: "Gri închis" },
                    { color: "#64748b", name: "Gri mediu" },
                    { color: "#94a3b8", name: "Gri deschis" },
                    { color: "#000000", name: "Negru pur" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => handleTextColor(c.color)}
                      style={{ backgroundColor: c.color }}
                      className="h-6 w-6 rounded-lg border border-black/15 dark:border-white/20 hover:scale-110 transition-transform cursor-pointer"
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
              className="apple-btn-glass flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              title="Culoare fundal text (Evidențiere)"
            >
              <Highlighter className="h-3.5 w-3.5 text-[#6e6e73] dark:text-[#98989d]" />
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/20 dark:border-white/25 inline-block"
                style={{ backgroundColor: bgColor === "transparent" ? "#ffffff" : bgColor }}
              />
            </button>

            {showBgPicker && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10] rounded-2xl shadow-2xl w-48 space-y-2">
                <div className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d]">
                  Fundal / evidențiere
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { color: "transparent", name: "Fără evidențiere" },
                    { color: "#fef08a", name: "Galben pal" },
                    { color: "#e5e5ea", name: "Gri pal" },
                    { color: "#f2f2f7", name: "Alb-gri deschis" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => handleBgColor(c.color)}
                      style={{ backgroundColor: c.color === "transparent" ? "#ffffff" : c.color }}
                      className="h-6 w-6 rounded-lg border border-black/15 dark:border-white/20 hover:scale-110 transition-transform relative flex items-center justify-center cursor-pointer"
                      title={c.name}
                    >
                      {c.color === "transparent" && <Minus className="h-3 w-3 text-[#8e8e93]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-black/[0.08] dark:bg-white/[0.10] mx-1 hidden sm:block" />

          {/* Alignments */}
          <div className="flex items-center gap-0.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => execCmd("justifyLeft")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Aliniere la Stânga"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("justifyCenter")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Aliniere Centrată"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("justifyRight")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Aliniere la Dreapta"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("justifyFull")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Aliniere Stânga-Dreapta (Justify)"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 bg-[#f2f2f7] dark:bg-[#2c2c2e] p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => execCmd("insertUnorderedList")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Listă cu Puncte"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("insertOrderedList")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Listă Numerotată"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("indent")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Mărește Indent"
            >
              <Indent className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd("outdent")}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#ebebf5] transition-colors cursor-pointer"
              title="Micșorează Indent"
            >
              <Outdent className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Table, Separator & Dynamic Variables Dropdown */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleInsertTable(3, 2)}
              className="apple-btn-glass inline-flex items-center h-8 text-xs px-3 font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              title="Inserează Tabel cu linii"
            >
              <TableIcon className="h-3.5 w-3.5 mr-1 text-[#6e6e73] dark:text-[#98989d]" />
              Tabel
            </button>

            <button
              type="button"
              onClick={() => execCmd("insertHorizontalRule")}
              className="apple-btn-glass inline-flex items-center justify-center h-8 w-8 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
              title="Linie despărțitoare"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            {/* Meniu Câmpuri Dinamice */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="apple-btn-glass inline-flex items-center h-8 text-xs px-3 gap-1.5 font-medium text-[#1d1d1f] dark:text-[#f5f5f7] cursor-pointer"
                  title="Inserează o variabilă la poziția cursorului"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>Inserează câmp</span>
                  <ChevronDown className="h-3 w-3 text-[#8e8e93]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" sideOffset={6} avoidCollisions={false} className="w-64 text-xs rounded-2xl p-1.5 z-50 max-h-[380px] overflow-y-auto shadow-2xl bg-white dark:bg-[#1c1c1e] border border-black/[0.08] dark:border-white/[0.10]">
                <DropdownMenuLabel className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] px-2 py-1">
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
                <DropdownMenuLabel className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] px-2 py-1">
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
                <DropdownMenuLabel className="text-[11px] font-medium text-[#6e6e73] dark:text-[#98989d] px-2 py-1">
                  Detalii contract
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
          MAIN PAPER SHEET (A4 VISUAL VIEW ON APPLE-DOC-STAGE)
          ═════════════════════════════════════════════════════════════════ */}
      <div className="apple-doc-stage rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-3 sm:p-6 flex justify-center">
        <div className="apple-doc-paper w-full max-w-[850px] bg-white text-[#1d1d1f] p-6 sm:p-10 space-y-6">
          {/* Header foaie contract */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-black/[0.10] text-xs">
            <div>
              <div className="font-extrabold text-[#1d1d1f] text-base tracking-tight uppercase">
                {tenantName}
              </div>
              <div className="text-[#6e6e73] text-[11px] mt-0.5 tabular-nums">
                CUI: {tenantCui} | IBAN: {tenantIban} | {tenantBank}
              </div>
            </div>

            <div className="text-right tabular-nums">
              <div className="text-xs font-bold text-primary">Nr. {docNumber}</div>
              <div className="text-[11px] text-[#6e6e73]">Data: {docDate}</div>
            </div>
          </div>

          {/* Editable Canvas Div (A4 paper always white with dark ink) */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={triggerContentChange}
            onPaste={handlePaste}
            className="min-h-[460px] focus:outline-none text-[#1d1d1f] leading-relaxed font-sans text-[13px] space-y-3"
            style={{
              fontFamily: activeFont,
              fontSize: activeFontSize,
            }}
          />

          {/* ═════════════════════════════════════════════════════════════════
              SIGNATURE BOXES AT THE BOTTOM OF THE CONTRACT
              ═════════════════════════════════════════════════════════════════ */}
          <div className="pt-8 border-t-2 border-black/[0.08] mt-8">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-xs font-bold tracking-tight text-[#1d1d1f] flex items-center gap-1.5">
                <FileSignature className="h-4 w-4 text-primary" />
                Semnăturile părților contractante:
              </span>
              <span className="text-[11px] text-[#6e6e73]">
                Puteți semna olografic pe ecran sau aplica un certificat digital eIDAS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: FURNIZOR / PRESTATOR */}
              <div className="rounded-xl border border-black/[0.08] bg-[#f8f8fa] p-4 flex flex-col justify-between min-h-[160px]">
                <div>
                  <div className="text-xs font-bold text-[#1d1d1f] uppercase">
                    FURNIZOR / PRESTATOR
                  </div>
                  <div className="text-[11px] font-semibold text-[#3a3a3c]">
                    {tenantName}
                  </div>
                  <div className="text-[10px] text-[#6e6e73]">
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
                      <div className="text-[10px] text-emerald-700 font-semibold flex items-center justify-center gap-1 mt-1">
                        <Check className="h-3 w-3" />
                        Semnat oficial
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[#8e8e93] text-xs italic">
                      [Nesemnat încă]
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-black/[0.07] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleOpenSignatureModal("supplier")}
                    className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-full border border-primary/30 text-primary bg-white hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <FileSignature className="h-3.5 w-3.5 mr-1" />
                    {supplierSignature ? "Re-semnează" : "Semnează olografic / digital"}
                  </button>

                  {supplierSignature && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSignature("supplier")}
                      className="h-7 text-xs text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full px-2 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Box 2: BENEFICIAR / CLIENT */}
              <div className="rounded-xl border border-black/[0.08] bg-[#f8f8fa] p-4 flex flex-col justify-between min-h-[160px]">
                <div>
                  <div className="text-xs font-bold text-[#1d1d1f] uppercase">
                    BENEFICIAR / CLIENT
                  </div>
                  <div className="text-[11px] font-semibold text-[#3a3a3c]">
                    {partnerName || "[Selectați Partenerul din antet]"}
                  </div>
                  <div className="text-[10px] text-[#6e6e73]">Reprezentant Legal / Împuternicit</div>
                </div>

                <div className="my-2 py-1 flex items-center justify-center min-h-[70px]">
                  {clientSignature ? (
                    <div className="relative group text-center">
                      <img
                        src={clientSignature}
                        alt="Semnătură Beneficiar"
                        className="max-h-16 max-w-[200px] object-contain mx-auto"
                      />
                      <div className="text-[10px] text-emerald-700 font-semibold flex items-center justify-center gap-1 mt-1">
                        <Check className="h-3 w-3" />
                        Semnat oficial
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-[#8e8e93] text-xs italic">
                      [Nesemnat încă]
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-black/[0.07] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleOpenSignatureModal("client")}
                    className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-full border border-primary/30 text-primary bg-white hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <FileSignature className="h-3.5 w-3.5 mr-1" />
                    {clientSignature ? "Re-semnează" : "Semnează olografic / digital"}
                  </button>

                  {clientSignature && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSignature("client")}
                      className="h-7 text-xs text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full px-2 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
