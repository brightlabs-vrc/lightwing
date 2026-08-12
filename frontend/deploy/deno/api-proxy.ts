/// <reference lib="deno.ns" />
/**
 * Reverse proxy for /api/auth/* → Encore API.
 *
 * This makes auth requests same-origin from the browser's perspective so that
 * better-auth session cookies are set as first-party (SameSite=Lax) on the
 * frontend host. Without this proxy, cross-origin credentialed fetches require
 * SameSite=None + Secure, which breaks under Safari ITP and third-party cookie
 * restrictions.
 *
 * Deploy: Deno Deploy serves this alongside the static frontend. The proxy
 * forwards method, headers, body, and query string to the Encore API and
 * passes through the response (including Set-Cookie) unchanged — cookies are
 * therefore scoped to the frontend host, not the Encore origin.
 *
 * Env vars (Deno Deploy):
 *   - ENCORE_API_BASE_URL: public Encore API origin, e.g. https://production-kutwa.encr.app
 */

const ENCORE_API_BASE = Deno.env.get("ENCORE_API_BASE_URL");

if (!ENCORE_API_BASE) {
  console.error("ENCORE_API_BASE_URL is not set; auth proxy will not work");
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Only proxy /api/auth requests
  if (!url.pathname.startsWith("/api/auth")) {
    return new Response("Not found", { status: 404 });
  }

  if (!ENCORE_API_BASE) {
    return new Response("Service unavailable: ENCORE_API_BASE_URL not configured", {
      status: 503,
    });
  }

  // Build target URL: forward path + query to Encore
  const target = new URL(url.pathname + url.search, ENCORE_API_BASE);

  // Forward request headers, but drop host so the upstream sees its own host
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("keep-alive");

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.body,
      redirect: "manual",
    });

    // Pass through status, headers (including Set-Cookie), and body unchanged.
    // Do NOT rewrite Set-Cookie Domain — leaving it unset (or set to the
    // frontend host by the browser) is what makes the cookie first-party.
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch (err) {
    console.error("Auth proxy upstream fetch failed:", err);
    return new Response("Bad gateway", { status: 502 });
  }
}

// Deno Deploy entrypoint: this file is served as a route handler.
// Deno Deploy automatically picks up exported handlers from files in the
// project root or routes directory depending on deployment config.
export const handler = handleRequest;
