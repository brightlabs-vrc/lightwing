/**
 * Deno Deploy entrypoint for the Lightwing frontend.
 *
 * Serves the built SPA from ./dist and reverse-proxies /api/auth/* to the
 * Encore backend so that session cookies are set as first-party on the
 * frontend host (SameSite=Lax) instead of cross-origin (SameSite=None).
 *
 * Usage:
 *   1. Build the frontend:  pnpm --dir frontend build
 *   2. Deploy to Deno Deploy with this file as the entrypoint.
 *   3. Set env var: ENCORE_API_BASE_URL=https://production-kutwa.encr.app
 *
 * The dist/ directory must be deployed alongside this file. On Deno Deploy,
 * this is done by including the dist/ folder in the deployment.
 */

import { handler as authProxy } from "./api-proxy.ts";

const DIST_DIR = "./dist";

/**
 * Map of pre-built asset filenames to their content types.
 * In production, Deno Deploy serves these from the deployed dist/ folder.
 */
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
  const ext = path.substring(path.lastIndexOf("."));
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function serializeHtml(html: string): Uint8Array {
  return new TextEncoder().encode(html);
}

/**
 * Serve the SPA. In production, this reads from the deployed dist/ folder.
 * For local testing, you can run: deno run --allow-read --allow-net main.ts
 */
async function serveIndex(): Promise<Response> {
  try {
    const indexPath = new URL("./dist/index.html", import.meta.url);
    const raw = await Deno.readTextFile(indexPath);
    return new Response(serializeHtml(raw), {
      headers: { "Content-Type": "text/html" },
    });
  } catch {
    // Fallback for environments where fs access isn't available (e.g. some
    // Deno Deploy configurations). The actual dist/ content is served by
    // Deno Deploy's static file serving when configured.
    const fallbackHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lightwing Frontend</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" crossorigin src="/assets/index.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index.css">
  </body>
</html>`;
    return new Response(serializeHtml(fallbackHtml), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

/**
 * Serve a static file from the dist/ directory.
 */
async function serveStatic(path: string): Promise<Response | null> {
  try {
    const filePath = new URL(`./dist${path}`, import.meta.url);
    const content = await Deno.readFile(filePath);
    return new Response(content, {
      headers: {
        "Content-Type": getMimeType(path),
        "Cache-Control": path.endsWith(".html") ? "no-cache" : "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return null;
  }
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Proxy auth requests to Encore
  if (path.startsWith("/api/auth")) {
    return authProxy(req);
  }

  // Serve the SPA index.html for the root path
  if (path === "/" || path === "/index.html") {
    return serveIndex();
  }

  // Serve static assets from dist/
  const staticResponse = await serveStatic(path);
  if (staticResponse) {
    return staticResponse;
  }

  // SPA fallback: serve index.html for any unknown path so client-side
  // routing (TanStack Router) can handle it.
  if (path.startsWith("/assets/")) {
    return new Response("Not found", { status: 404 });
  }

  return serveIndex();
}

// Deno Deploy uses this export as the request handler.
export const main = handleRequest;

// Allow local testing: deno run --allow-read --allow-net main.ts
if (import.meta.main) {
  const port = parseInt(Deno.env.get("PORT") ?? "8000");
  const listener = await Deno.listen({ port });
  console.log(`Frontend server running on http://localhost:${port}`);

  for await (const conn of listener) {
    const req = await Deno.serveHttp(conn);
    handleRequest(req.request).then((res) => req.respond(res));
  }
}
