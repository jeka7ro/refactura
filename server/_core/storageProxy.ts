import { Express } from "express";
import { storageGetSignedUrl } from "../storage";
import { authenticateFileRequest } from "../fileAuth";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    try {
      const auth = await authenticateFileRequest(req);
      if (!auth) {
        return res.status(401).json({ error: "Neautentificat" });
      }
      const key = String((req.params as any)[0] || "");
      if (!key || key.includes("..") || key.includes("\0")) {
        return res.status(400).json({ error: "Cale invalidă" });
      }
      const signedUrl = await storageGetSignedUrl(key);
      res.redirect(307, signedUrl);
    } catch (error) {
      console.error("Storage proxy error:", error);
      res.status(500).json({ error: "Storage proxy error" });
    }
  });
}
