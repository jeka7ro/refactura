import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getTenantCleanCui, saveRealSpvDocument } from "./spvPortalSync";

export interface NativeUsbSyncResult {
  supported: boolean;
  ok: boolean;
  noStickFound?: boolean;
  wrongCertificate?: boolean;
  certSubject?: string | null;
  allowedCifs?: string[];
  rawTotal?: number;
  matchedTotal?: number;
  downloaded?: number;
  alreadySaved?: number;
  failed?: number;
  zileUsed?: number;
  emptyNotice?: string | null;
  lastError?: string | null;
  error?: string;
}

const HELPER_DIR = path.resolve(process.cwd(), "server", "native");
const HELPER_SRC = path.join(HELPER_DIR, "spv-usb-helper.swift");
const HELPER_BIN = path.join(HELPER_DIR, "spv-usb-helper");

function runProcess(
  cmd: string,
  args: string[],
  stdinText: string | null,
  timeoutMs: number
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error("Timpul de așteptare (90s) pentru citirea stick-ului USB a expirat."));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    if (stdinText !== null) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

async function ensureCompiledNativeHelper(): Promise<string> {
  const srcExists = fs.existsSync(HELPER_SRC);
  const binExists = fs.existsSync(HELPER_BIN);
  if (binExists && (!srcExists || fs.statSync(HELPER_BIN).mtimeMs >= fs.statSync(HELPER_SRC).mtimeMs)) {
    return HELPER_BIN;
  }
  if (!srcExists) {
    throw new Error("Lipsește sursa helperului nativ USB macOS.");
  }
  const compile = await runProcess("swiftc", ["-O", HELPER_SRC, "-o", HELPER_BIN], null, 60000);
  if (compile.code !== 0 || !fs.existsSync(HELPER_BIN)) {
    throw new Error(compile.stderr || "Nu s-a putut compila helperul USB macOS.");
  }
  return HELPER_BIN;
}

export async function syncSpvViaNativeUsbMac(
  tenantId: number,
  zile = 60
): Promise<NativeUsbSyncResult> {
  if (process.platform !== "darwin") {
    return { supported: false, ok: false };
  }

  const db = await getDb();
  if (!db) {
    return { supported: true, ok: false, error: "Baza de date indisponibilă." };
  }

  const cleanCui = await getTenantCleanCui(db, tenantId);
  if (!cleanCui) {
    return {
      supported: true,
      ok: false,
      error: "Profilul activ nu are CUI / CNP configurat în Setări.",
    };
  }

  const [existingRows]: any = await (db as any).execute(
    sql`SELECT numarInregistrare FROM spv_portal_documents WHERE tenantId = ${tenantId} AND fileUrl IS NOT NULL`
  );
  const existingIds = (existingRows || [])
    .map((r: any) => String(r?.numarInregistrare || "").trim())
    .filter(Boolean);

  const binPath = await ensureCompiledNativeHelper();
  const payload = JSON.stringify({
    cif: cleanCui,
    zile: Math.min(60, Math.max(1, Number(zile) || 60)),
    existingIds,
  });

  const execRes = await runProcess(binPath, [], payload, 90000);
  const rawOut = String(execRes.stdout || "").trim();
  if (!rawOut.startsWith("{")) {
    return {
      supported: true,
      ok: false,
      error:
        execRes.stderr?.trim() ||
        "Helperul USB macOS nu a returnat un răspuns JSON valid.",
    };
  }

  const helperJson: any = JSON.parse(rawOut);
  if (!helperJson?.ok) {
    console.log(
      `[SPV Native USB] tenant=${tenantId} cif=${cleanCui} ok=false cert=${helperJson?.certSubject || "-"} allowed=${Array.isArray(helperJson?.allowedCifs) ? helperJson.allowedCifs.join(",") : "-"} err=${helperJson?.error || "-"}`
    );
    return {
      supported: true,
      ok: false,
      noStickFound: Boolean(helperJson?.noStickFound),
      wrongCertificate: Boolean(helperJson?.wrongCertificate),
      certSubject: helperJson?.certSubject || null,
      allowedCifs: Array.isArray(helperJson?.allowedCifs) ? helperJson.allowedCifs : [],
      rawTotal: Number(helperJson?.rawTotal || 0),
      matchedTotal: Number(helperJson?.matchedTotal || 0),
      zileUsed: Number(helperJson?.zileUsed || 60),
      error: helperJson?.error || "Eroare la conectarea directă cu stick-ul USB.",
    };
  }

  const items = Array.isArray(helperJson.items) ? helperJson.items : [];
  let downloaded = 0;
  let alreadySaved = Number(helperJson.alreadySaved || 0);
  let failed = Number(helperJson.failed || 0);
  let lastError: string | null = helperJson.lastError ? String(helperJson.lastError) : null;

  for (const item of items) {
    const saved = await saveRealSpvDocument(db, tenantId, cleanCui, item);
    if (saved.ok) {
      if (saved.skippedDuplicate) {
        alreadySaved += 1;
      } else {
        downloaded += 1;
      }
    } else {
      failed += 1;
      lastError = saved.error;
    }
  }

  console.log(
    `[SPV Native USB] tenant=${tenantId} cif=${cleanCui} ok=true cert=${helperJson.certSubject || "-"} raw=${Number(helperJson.rawTotal || 0)} matched=${Number(helperJson.matchedTotal || 0)} downloaded=${downloaded} alreadySaved=${alreadySaved} failed=${failed} allowed=${Array.isArray(helperJson.allowedCifs) ? helperJson.allowedCifs.join(",") : "-"}`
  );

  return {
    supported: true,
    ok: true,
    certSubject: helperJson.certSubject || null,
    allowedCifs: Array.isArray(helperJson.allowedCifs) ? helperJson.allowedCifs : [],
    rawTotal: Number(helperJson.rawTotal || 0),
    matchedTotal: Number(helperJson.matchedTotal || 0),
    downloaded,
    alreadySaved,
    failed,
    zileUsed: Number(helperJson.zileUsed || 60),
    emptyNotice: helperJson.emptyNotice ? String(helperJson.emptyNotice) : null,
    lastError,
  };
}
