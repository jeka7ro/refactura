import "dotenv/config";
import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import {
  registerUploadRoute,
  attachSagaFurnizoriImportRoute,
  attachSagaClientiImportRoute,
  attachSagaInvoicesImportRoute,
} from "../uploadRoute";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerAnafProxy } from "../anafProxy";
import { registerViesProxy } from "../viesProxy";
import { registerPdfRoute } from "../pdfRoute";
import { registerPublicApi } from "../publicApi";
import { requireFileAuth, requireUserAuth, requireUploadAccess } from "../fileAuth";
import { registerSagaSyncRoute } from "../sagaSyncRoute";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Rutele de import/export/upload cer autentificare; tenantul vine din sesiune, nu din request.
  app.use("/api/saga", requireUserAuth);
  app.use("/api/saga-sync", requireFileAuth);
  app.use("/api/upload-invoice", requireUserAuth);
  app.use("/api/upload-spv-document", requireUserAuth);
  app.use("/api/spv/import-real-document", requireUserAuth);
  app.use("/api/spv/bulk-download-pdf", requireFileAuth);
  app.use("/api/spv/connector-log", requireUserAuth);
  app.use("/api/spv-connector.zip", requireFileAuth);
  app.use("/api/upload-contract", requireUserAuth);
  app.use("/api/anaf", requireFileAuth);
  app.use("/api/vies", requireFileAuth);
  registerUploadRoute(app);
  attachSagaFurnizoriImportRoute(app);
  attachSagaClientiImportRoute(app);
  attachSagaInvoicesImportRoute(app);
  registerAnafProxy(app);
  registerViesProxy(app);
  registerPdfRoute(app);
  registerPublicApi(app);
  registerSagaSyncRoute(app);

  const { registerSpvAuth } = await import("../spvAuth");
  registerSpvAuth(app);

  const { startSpvCron } = await import("../spvCron");
  startSpvCron();

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve local uploads strictly behind authentication & tenant ownership checks
  // (placed BEFORE setupVite / serveStatic and never calling next() out of /uploads so static middlewares cannot bypass auth)
  const uploadsDir = path.resolve(process.cwd(), "dist/public/uploads");
  const clientUploadsDir = path.resolve(process.cwd(), "client/public/uploads");
  const uploadsRouter = express.Router();

  uploadsRouter.use((req, res, next) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: "Cale invalidă" });
      return;
    }
    if (decoded.includes("\0") || decoded.includes("\\")) {
      res.status(400).json({ error: "Cale invalidă" });
      return;
    }
    const normalized = decoded.replace(/\/+/g, "/");
    if (normalized.split("/").some(seg => seg === "..")) {
      res.status(400).json({ error: "Cale invalidă" });
      return;
    }
    const qIdx = req.url.indexOf("?");
    const qs = qIdx >= 0 ? req.url.slice(qIdx) : "";
    req.url = normalized + qs;
    next();
  });

  const serveProtectedSubdir = (sub: "invoices" | "contracts" | "spv_documents") => {
    const primaryRoot = path.resolve(uploadsDir, sub);
    const fallbackRoot = path.resolve(clientUploadsDir, sub);
    const staticPrimary = express.static(primaryRoot, { fallthrough: true });
    const staticFallback = express.static(fallbackRoot, { fallthrough: true });

    uploadsRouter.use(
      `/${sub}`,
      requireUploadAccess(sub),
      staticPrimary,
      staticFallback,
      (_req, res) => {
        res.status(404).json({ error: "Fișierul nu a fost găsit" });
      }
    );
  };

  serveProtectedSubdir("invoices");
  serveProtectedSubdir("contracts");
  serveProtectedSubdir("spv_documents");

  uploadsRouter.use(requireFileAuth, (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.status(404).json({ error: "Fișierul nu a fost găsit" });
      return;
    }
    const rel = req.path.replace(/^\/+/, "");
    if (!rel.startsWith("logos/")) {
      res.status(404).json({ error: "Fișierul nu a fost găsit" });
      return;
    }
    const logoName = rel.slice("logos/".length);
    if (!logoName || logoName.includes("/") || logoName.includes("\\") || logoName.includes("..")) {
      res.status(404).json({ error: "Fișierul nu a fost găsit" });
      return;
    }
    for (const root of [uploadsDir, clientUploadsDir]) {
      const logosRoot = path.resolve(root, "logos");
      const candidate = path.resolve(logosRoot, logoName);
      if (candidate.startsWith(logosRoot + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.sendFile(candidate);
        return;
      }
    }
    res.status(404).json({ error: "Fișierul nu a fost găsit" });
  });

  app.use("/uploads", uploadsRouter);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
