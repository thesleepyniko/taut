// Taut App Helpers
// Shared utilities for the Taut app

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false

  const aObject = a as Record<string, unknown>
  const bObject = b as Record<string, unknown>
  const aKeys = Object.keys(aObject)
  const bKeys = Object.keys(bObject)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObject, key)) return false
    if (!deepEqual(aObject[key], bObject[key])) return false
  }
  return true
}

export class TypedEventTarget<
  TEvents extends Record<string, unknown>,
> extends EventTarget {
  on<K extends keyof TEvents>(
    type: K,
    listener: (event: CustomEvent<TEvents[K]>) => void,
    options?: AddEventListenerOptions
  ) {
    this.addEventListener(type as string, listener as EventListener, options)
  }

  off<K extends keyof TEvents>(
    type: K,
    listener: (event: CustomEvent<TEvents[K]>) => void,
    options?: EventListenerOptions
  ) {
    this.removeEventListener(type as string, listener as EventListener, options)
  }

  emit<K extends keyof TEvents>(type: K, detail: TEvents[K]) {
    this.dispatchEvent(new CustomEvent(type as string, { detail }))
  }
}
