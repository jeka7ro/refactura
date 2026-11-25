import { Express } from "express";
import { eq } from "drizzle-orm";
import { storageGetSignedUrl } from "../storage";
import { authenticateFileRequest, canAccessTenantOwner } from "../fileAuth";
import { getDb } from "../db";
import { invoiceArchive } from "../../drizzle/schema";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    try {
      const auth = await authenticateFileRequest(req);
      if (!auth) {
        return res.status(401).json({ error: "Neautentificat" });
      }
      const key = String((req.params as any)[0] || "").replace(/^\/+/, "");
      if (!key || key.includes("..") || key.includes("\\") || key.includes("\0")) {
        return res.status(400).json({ error: "Cale invalidă" });
      }
      if (auth.role !== "superadmin") {
        const db = await getDb();
        if (!db) {
          return res.status(500).json({ error: "DB unavailable" });
        }
        const owners = await db
          .select({ tenantId: invoiceArchive.tenantId })
          .from(invoiceArchive)
          .where(eq(invoiceArchive.fileUrl, `/manus-storage/${key}`));
        if (owners.length === 0) {
          return res.status(404).json({ error: "Fișierul nu a fost găsit" });
        }
        const distinctOwnerTenantIds = Array.from(
          new Set(owners.map((o) => Number(o.tenantId)))
        );
        for (const ownerTenantId of distinctOwnerTenantIds) {
          if (!(await canAccessTenantOwner(db, auth, ownerTenantId))) {
            return res.status(404).json({ error: "Fișierul nu a fost găsit" });
          }
        }
      }
      const signedUrl = await storageGetSignedUrl(key);
      res.redirect(307, signedUrl);
    } catch (error) {
      console.error("Storage proxy error:", error);
      res.status(500).json({ error: "Storage proxy error" });
    }
  });
}
