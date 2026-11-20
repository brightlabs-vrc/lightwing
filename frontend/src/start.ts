import './lib/ssr-dom-shim'
import { createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => {
  return {
    defaultSsr: false,
  }
})
