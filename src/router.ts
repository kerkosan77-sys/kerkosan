import { useEffect, useState } from 'react'

/** "#/analiz/abc" -> ["analiz", "abc"] */
export function parseHash(hash: string): string[] {
  return hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part))
}

export function navigate(path: string) {
  window.location.hash = `#/${path}`
}

export function useRoute(): string[] {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parseHash(hash)
}
