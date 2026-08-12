/**
 * Deno Deploy entrypoint for the Lightwing frontend.
 *
 * Serves the built SPA from the frontend dist/ directory and reverse-proxies
 * /api/auth/* to the Encore backend so that session cookies are set as
 * first-party on the frontend host (SameSite=Lax) instead of cross-origin.
 *
 * Usage:
 *   1. Build the frontend:  pnpm --dir frontend build
 *   2. Deploy to Deno Deploy with this file as the entrypoint.
 *   3. Set env var: ENCORE_API_BASE_URL=https://production-kutwa.encr.app
 *
 * The frontend dist/ directory must be deployed alongside this file, or its
 * location specified via the FRONTEND_DIST_DIR environment variable.
 */

import { Hono } from "npm:hono";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { handler as authProxy } from "./api-proxy.ts";

const DIST_DIR = process.env.FRONTEND_DIST_DIR ?? "../frontend/dist";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

function getMimeType(path: string): string {
  const ext = extname(path);
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

const app = new Hono();

// Proxy auth requests to Encore
app.all("/api/auth/*", (c) => {
  return authProxy(c.req.raw);
});

// Serve static assets from dist/
app.get("/assets/*", async (c) => {
  const filepath = `${DIST_DIR}${c.req.path}`;
  try {
    const content = await readFile(filepath);
    return new Response(content, {
      headers: {
        "Content-Type": getMimeType(filepath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});

// SPA fallback: serve index.html for all other paths
app.all("*", async (c) => {
  try {
    const html = await readFile(`${DIST_DIR}/index.html`, "utf-8");
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});

const handler = app.fetch;

// Deno Deploy uses this export as the request handler.
export { handler };

// Allow local testing: deno run --allow-read --allow-net --allow-env main.ts
if (import.meta.main) {
  const port = parseInt(process.env.PORT ?? "8000");
  console.log(`Frontend server running on http://localhost:${port}`);
  createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const headers = new Headers(req.headers as Record<string, string>);
    const response = await handler(new Request(url.toString(), {
      method: req.method,
      headers,
    }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  }).listen(port);
}
