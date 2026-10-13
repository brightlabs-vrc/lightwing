import { useEffect } from 'react'
import { PageHeadOptions, updateHeadMetadata } from '../lib/seo'

export function usePageHead(options: PageHeadOptions) {
  useEffect(() => {
    updateHeadMetadata(options)
  }, [options.title, options.description, options.image, options.type, options.url])
}
