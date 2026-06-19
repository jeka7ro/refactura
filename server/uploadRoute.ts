import { Express, Request, Response } from "express";
import multer, { FileFilterCallback } from "multer";
import { storagePut } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const extOk = /\.(pdf|xml)$/i.test(file.originalname);
    if (extOk) {
      cb(null, true);
    } else {
      cb(new Error("Doar fișiere PDF și XML sunt acceptate"));
    }
  },
});

export function registerUploadRoute(app: Express) {
  app.post(
    "/api/upload-invoice",
    upload.array("file", 20),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          res.status(400).json({ error: "Niciun fișier primit" });
          return;
        }

        const results = [];
        for (const file of files) {
          const ext = file.originalname.split(".").pop()?.toLowerCase() || "bin";
          const contentType = ext === "pdf" ? "application/pdf" : "text/xml";
          const key = `invoices/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
          const { key: fileKey, url: fileUrl } = await storagePut(key, file.buffer, contentType);
          results.push({ fileKey, fileUrl, fileName: file.originalname, fileSize: file.size });
        }

        if (results.length === 1) {
          res.json(results[0]);
          return;
        }
        res.json(results);
      } catch (err: any) {
        console.error("Upload error:", err);
        res.status(500).json({ error: err.message || "Eroare la upload" });
      }
    }
  );
}
