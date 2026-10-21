import "dotenv/config";
import express from "express";
import { createServer } from "http";
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
import { requireFileAuth, requireUploadAccess } from "../fileAuth";
import { registerSagaSyncRoute } from "../sagaSyncRoute";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Rutele de import/export/upload cer autentificare; tenantul vine din sesiune, nu din request.
  app.use("/api/saga", requireFileAuth);
  app.use("/api/saga-sync", requireFileAuth);
  app.use("/api/upload-invoice", requireFileAuth);
  app.use("/api/upload-contract", requireFileAuth);
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

  // Serve local uploads (facturi și contracte doar pentru utilizatori autentificați)
  const uploadsDir = path.resolve(process.cwd(), "dist/public/uploads");
  app.use("/uploads/invoices", requireUploadAccess("invoices"), express.static(path.join(uploadsDir, "invoices")));
  app.use("/uploads/contracts", requireUploadAccess("contracts"), express.static(path.join(uploadsDir, "contracts")));
  app.use("/uploads", express.static(uploadsDir));

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
