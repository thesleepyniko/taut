// Persistent cache with per-item TTL and fetch deduplication for plugin use

export interface TautCache<T> {
  load(): void
  get(key: string): T | undefined
  set(key: string, value: T): void
  fetch(key: string, fetcher: () => Promise<T>): Promise<T>
  clear(): void
}

type CacheEntry<T> = { value: T; ts: number }

export function createCache<T>(
  cacheKey: string,
  options: { ttl: number; maxSize?: number }
): TautCache<T> {
  const { ttl, maxSize } = options
  const STORAGE_KEY = `taut_cache_${cacheKey}`

  const memory = new Map<string, CacheEntry<T>>()
  const pending = new Map<string, Promise<T>>()

  function fresh(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.ts < ttl
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Object.fromEntries(memory))
      )
    } catch {}
  }

  function write(key: string, value: T) {
    memory.set(key, { value, ts: Date.now() })
    if (maxSize !== undefined && memory.size > maxSize) {
      for (const k of [...memory.keys()].slice(0, 100)) memory.delete(k)
    }
    persist()
  }

  return {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const data = JSON.parse(raw) as Record<string, CacheEntry<T>>
        for (const [k, entry] of Object.entries(data)) {
          if (entry && typeof entry.ts === 'number' && fresh(entry)) {
            memory.set(k, entry)
          }
        }
      } catch {}
    },

    get(key) {
      const entry = memory.get(key)
      if (!entry) return undefined
      if (!fresh(entry)) {
        memory.delete(key)
        return undefined
      }
      return entry.value
    },

    set(key, value) {
      write(key, value)
    },

    async fetch(key, fetcher) {
      const entry = memory.get(key)
      if (entry && fresh(entry)) return entry.value

      const existing = pending.get(key)
      if (existing) return existing

      const promise = (async () => {
        try {
          const value = await fetcher()
          write(key, value)
          return value
        } finally {
          pending.delete(key)
        }
      })()

      pending.set(key, promise)
      return promise
    },

    clear() {
      memory.clear()
      pending.clear()
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    },
  }
}
