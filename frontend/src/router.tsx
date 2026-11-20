import './lib/ssr-dom-shim'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPendingMs: 0,
    defaultPendingMinMs: 150,
    scrollRestoration: true,
  })
}

export const router = getRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
