export interface SaveFileOptions {
  suggestedName: string;
  acceptMimeType: string;
  description: string;
  extensions: string[]; // ex: [".xml"], [".pdf"]
  pickerId?: string;
}

export function getNirPdfFilename(nirNumber?: string | null, nirId?: number | null): string {
  const raw = (nirNumber || "").trim();
  if (raw) {
    const prefix = /^nir/i.test(raw) ? raw : `NIR-${raw}`;
    return `${prefix.replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
  }
  return `NIR-${nirId || "document"}.pdf`;
}

export function getNirXmlFilename(
  cui?: string | null,
  nirNumber?: string | null,
  nirId?: number | null
): string {
  const safeCui = (cui || "").replace(/^RO/i, "").trim() || "EXPORT";
  const rawNir = (nirNumber || "").trim();
  if (rawNir) {
    const cleanNir = rawNir.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `F_${safeCui}_${cleanNir}.xml`;
  }
  if (nirId) {
    return `F_${safeCui}_NIR_${nirId}.xml`;
  }
  return `F_${safeCui}_NIR_ALL.xml`;
}

/**
 * Deschide întotdeauna fereastra nativă "Save As..." (în Chrome/Edge)
 * direct la click-ul utilizatorului, apoi preia conținutul și îl scrie în calea aleasă.
 * Returnează numele fișierului salvat sau `null` dacă utilizatorul a anulat dialogul.
 */
export async function saveWithFilePicker(
  options: SaveFileOptions,
  getData: () => Promise<Blob>
): Promise<string | null> {
  const win = window as any;

  if (typeof win.showSaveFilePicker === "function") {
    let fileHandle: any;
    try {
      fileHandle = await win.showSaveFilePicker({
        id: options.pickerId || "smart_invoice_save",
        suggestedName: options.suggestedName,
        types: [
          {
            description: options.description,
            accept: {
              [options.acceptMimeType]: options.extensions,
            },
          },
        ],
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return null; // Utilizatorul a apăsat Cancel în dialogul de salvare
      }
      throw err;
    }

    const blob = await getData();
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return fileHandle.name || options.suggestedName;
  }

  // Fallback pentru browsere care nu suportă File System Access API
  const blob = await getData();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = options.suggestedName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
  return options.suggestedName;
}

/**
 * Convertește un string XML în Blob codificat Windows-1250 (compatibil SAGA C / FoxPro).
 */
export function encodeWindows1250Blob(xmlString: string): Blob {
  const win1250Map: Record<number, number> = {
    0x0102: 0xc3, // Ă
    0x0103: 0xe3, // ă
    0x00c2: 0xc2, // Â
    0x00e2: 0xe2, // â
    0x00ce: 0xce, // Î
    0x00ee: 0xee, // î
    0x0218: 0xaa, // Ș -> Ş
    0x015e: 0xaa, // Ş
    0x0219: 0xba, // ș -> ş
    0x015f: 0xba, // ş
    0x021a: 0xde, // Ț -> Ţ
    0x0162: 0xde, // Ţ
    0x021b: 0xfe, // ț -> ţ
    0x0163: 0xfe, // ţ
    0x2013: 0x96, // –
    0x2014: 0x97, // —
    0x201c: 0x93, // “
    0x201d: 0x94, // ”
    0x201e: 0x84, // „
    0x20ac: 0x80, // €
  };

  const bytes = new Uint8Array(xmlString.length);
  for (let i = 0; i < xmlString.length; i++) {
    const code = xmlString.charCodeAt(i);
    if (code < 0x80) {
      bytes[i] = code;
    } else if (win1250Map[code] !== undefined) {
      bytes[i] = win1250Map[code];
    } else if (code <= 0xff) {
      bytes[i] = code;
    } else {
      bytes[i] = 0x3f; // '?'
    }
  }
  return new Blob([bytes], { type: "text/xml" });
}


