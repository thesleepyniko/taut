// Taut Webpack Utilities
// Hooks into Slack's webpack runtime before it loads
// Captures module exports for discovery

const global = globalThis as any

// Module Registry & State

let __webpack_require__: any = null
const __webpackModuleRegistry = new Map<string | number, any>()

// Export Waiting

type ExportMatcher<T> = (exp: any) => exp is T
type SimpleMatcher = (exp: any) => boolean

const pendingMatchers = new Map<
  symbol,
  { matcher: SimpleMatcher; resolve: (exp: any) => void }
>()

/**
 * Wait for a webpack export matching the given filter to be loaded.
 * Resolves immediately if already found, otherwise waits for it to appear.
 */
export function waitForExport<T extends any>(
  matcher: ExportMatcher<T>
): Promise<T>
export function waitForExport<T extends any>(matcher: SimpleMatcher): Promise<T>
export function waitForExport(matcher: SimpleMatcher): Promise<any> {
  // Check existing exports first
  for (const [_id, exp] of __webpackModuleRegistry) {
    if (matcher(exp)) return Promise.resolve(exp)
    if (exp && typeof exp === 'object') {
      for (const key in exp) {
        if (!Object.prototype.hasOwnProperty.call(exp, key)) continue
        try {
          if (matcher(exp[key])) return Promise.resolve(exp[key])
        } catch {}
      }
    }
  }

  // Not found yet, register a pending matcher
  return new Promise((resolve) => {
    const id = Symbol()
    pendingMatchers.set(id, {
      matcher,
      resolve: (exp) => {
        pendingMatchers.delete(id)
        resolve(exp)
      },
    })
  })
}

function checkPendingMatchers(exports: any) {
  for (const [id, { matcher, resolve }] of pendingMatchers) {
    if (matcher(exports)) {
      resolve(exports)
      continue
    }
    if (exports && typeof exports === 'object') {
      for (const key in exports) {
        if (!Object.prototype.hasOwnProperty.call(exports, key)) continue
        try {
          if (matcher(exports[key])) {
            resolve(exports[key])
            break
          }
        } catch {}
      }
    }
  }
}

// Factory Wrapping

function wrapModuleFactory(
  moduleId: string | number,
  factory: Function
): Function {
  return function wrappedFactory(module: any, exports: any, require: any): any {
    const result = factory.call(exports, module, exports, require)

    const moduleExports = module.exports
    __webpackModuleRegistry.set(moduleId, moduleExports)
    checkPendingMatchers(moduleExports)

    return result
  }
}

// Push Interception

type PushFn = (...items: any[]) => number

function wrapWebpackPush(originalPush: PushFn): PushFn {
  return function wrappedPush(this: any, ...args: any[]): number {
    for (const chunk of args) {
      if (!Array.isArray(chunk) || chunk.length < 2) continue

      const [_chunkIds, modules, runtime] = chunk

      if (modules && typeof modules === 'object') {
        for (const moduleId of Object.keys(modules)) {
          const factory = modules[moduleId]
          if (typeof factory === 'function') {
            modules[moduleId] = wrapModuleFactory(moduleId, factory)
          }
        }
      }

      if (typeof runtime === 'function' && !__webpack_require__) {
        const originalRuntime = runtime
        chunk[2] = function wrappedRuntime(require: any) {
          if (!__webpack_require__) {
            __webpack_require__ = require
            global.__webpack_require__ = require
          }
          return originalRuntime(require)
        }
      }
    }

    return originalPush.apply(this, args)
  }
}

// Early Hook Installation

function installWebpackHook() {
  let backingArray: any[] | null = null
  let wrappedPush: PushFn | null = null

  Object.defineProperty(global, 'webpackChunkwebapp', {
    configurable: true,
    enumerable: true,
    get() {
      return backingArray
    },
    set(arr: any[]) {
      backingArray = arr

      let currentPush = arr.push.bind(arr)
      wrappedPush = wrapWebpackPush(currentPush)

      Object.defineProperty(arr, 'push', {
        configurable: true,
        enumerable: false,
        get() {
          return wrappedPush
        },
        set(newPush: PushFn) {
          currentPush = newPush
          wrappedPush = wrapWebpackPush(newPush)
        },
      })
    },
  })
}

installWebpackHook()

// When the 'load' event fires, all webpack chunks should be loaded
export const webpackLoaded = new Promise<void>((resolve) => {
  if (document.readyState === 'complete') {
    resolve()
  } else {
    window.addEventListener('load', () => resolve())
  }
})

function allExports(): [string, any][] {
  return Array.from(__webpackModuleRegistry.entries()).map(([id, exp]) => [
    String(id),
    exp,
  ])
}
export const allExportsPromise = (async () => {
  await webpackLoaded
  return allExports
})()

type filter = (exp: any) => boolean

function findExport(filter: filter, all?: false): any | null
function findExport(filter: filter, all: true): any[]
function findExport(filter: filter, all = false) {
  const results = new Set<any>()

  for (const [_id, exp] of __webpackModuleRegistry) {
    try {
      if (filter(exp)) {
        if (!all) return exp
        results.add(exp)
      }
    } catch {}
    for (const key in exp) {
      if (!Object.prototype.hasOwnProperty.call(exp, key)) continue
      try {
        const candidate = exp[key]
        if (filter(candidate)) {
          if (!all) return candidate
          results.add(candidate)
        }
      } catch {}
    }
  }
  return all ? [...results] : null
}
export const findExportPromise = (async () => {
  await webpackLoaded
  return findExport
})()

function findByProps(props: string[], all?: false): any | null
function findByProps(props: string[], all: true): any[]
function findByProps(props: string[], all = false) {
  const func = (exp: any) =>
    exp && typeof exp === 'object' && props.every((prop) => prop in exp)

  if (all) {
    return findExport(func, true)
  } else {
    return findExport(func)
  }
}
export const findByPropsPromise = (async () => {
  await webpackLoaded
  return findByProps
})()

// Debug Globals

global.__webpackModuleRegistry = __webpackModuleRegistry
global.allExports = allExports
global.findExport = findExport
global.findByProps = findByProps
