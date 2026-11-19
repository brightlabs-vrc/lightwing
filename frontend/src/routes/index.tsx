import { createFileRoute, redirect } from '@tanstack/react-router'
import { buildSeoMeta } from '../lib/seo'

export const Route = createFileRoute('/')({
  ssr: 'data-only',
  head: () => ({
    meta: buildSeoMeta({
      title: 'Competitive Events',
      description: 'Explore competitive racing events on UmaKeiba.',
    }),
  }),
  beforeLoad: () => {
    throw redirect({
      to: '/events',
    })
  },
})
