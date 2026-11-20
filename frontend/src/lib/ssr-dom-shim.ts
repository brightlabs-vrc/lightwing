// Minimal browser-global guards for SSR/Cloudflare Worker module evaluation.
// Dependencies such as @primer/live-region-element (via @primer/react) extend
// HTMLElement and call customElements.get/define at module top-level when
// TanStack Start imports route modules on the server (even with defaultSsr: false).
const g = globalThis as Record<string, unknown>

if (typeof g.HTMLElement === 'undefined') {
  g.HTMLElement = class HTMLElementShim {}
}

if (typeof g.customElements === 'undefined') {
  g.customElements = {
    get: () => undefined,
    define: () => {},
    whenDefined: () => Promise.resolve(),
  }
}
