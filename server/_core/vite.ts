import express, { Express } from "express";
import { Server } from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
      headers: {
        "Cache-Control": "no-store",
      },
    },
    appType: "custom",
  });

  app.use((req, res, next) => {
    if (
      req.path.startsWith("/src/") ||
      req.path.startsWith("/@") ||
      req.path.endsWith(".tsx") ||
      req.path.endsWith(".ts") ||
      req.path.endsWith(".css")
    ) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    }
    next();
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientPath = path.resolve(__dirname, "../../client/index.html");
      let template = await fs.promises.readFile(clientPath, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res
        .status(200)
        .set({
          "Content-Type": "text/html",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        })
        .end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");
  app.use(express.static(distPath));
  app.use("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
