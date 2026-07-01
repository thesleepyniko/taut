// Persistent cache with per-item TTL and fetch deduplication for plugin use

type CacheEntry<T> = { value: T; ts: number }

export class Cache<T> {
  private storageKey: string
  private ttl: number
  private maxSize?: number
  private memory = new Map<string, CacheEntry<T>>()
  private pending = new Map<string, Promise<T>>()

  constructor(cacheKey: string, options: { ttl: number; maxSize?: number }) {
    this.storageKey = `taut_cache_${cacheKey}`
    this.ttl = options.ttl
    this.maxSize = options.maxSize
  }

  private fresh(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.ts < this.ttl
  }

  private persist() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(Object.fromEntries(this.memory))
      )
    } catch {}
  }

  private write(key: string, value: T) {
    this.memory.set(key, { value, ts: Date.now() })
    if (this.maxSize !== undefined && this.memory.size > this.maxSize) {
      for (const k of [...this.memory.keys()].slice(0, 100)) {
        this.memory.delete(k)
      }
    }
    this.persist()
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return
      const data = JSON.parse(raw) as Record<string, CacheEntry<T>>
      for (const [k, entry] of Object.entries(data)) {
        if (entry && typeof entry.ts === 'number' && this.fresh(entry)) {
          this.memory.set(k, entry)
        }
      }
    } catch {}
  }

  get(key: string): T | undefined {
    const entry = this.memory.get(key)
    if (!entry) return undefined
    if (!this.fresh(entry)) {
      this.memory.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: T): void {
    this.write(key, value)
  }

  async fetch(key: string, fetcher: () => Promise<T>): Promise<T> {
    const entry = this.memory.get(key)
    if (entry && this.fresh(entry)) return entry.value

    const existing = this.pending.get(key)
    if (existing) return existing

    const promise = (async () => {
      try {
        const value = await fetcher()
        this.write(key, value)
        return value
      } finally {
        this.pending.delete(key)
      }
    })()

    this.pending.set(key, promise)
    return promise
  }

  clear(): void {
    this.memory.clear()
    this.pending.clear()
    try {
      localStorage.removeItem(this.storageKey)
    } catch {}
  }
}
