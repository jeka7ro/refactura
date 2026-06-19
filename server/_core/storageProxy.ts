import { Express } from "express";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    try {
      const key = (req.params as any)[0];
      const signedUrl = await storageGetSignedUrl(key);
      res.redirect(307, signedUrl);
    } catch (error) {
      console.error("Storage proxy error:", error);
      res.status(500).json({ error: "Storage proxy error" });
    }
  });
}
