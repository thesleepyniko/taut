// Taut userscript backend
// Implements TautBridge interface using GM_* APIs for userscript environment

import { emptyConfig, defaultUserCss } from '../app/bundledData'
import type { TautBridge, TautCookie, Unsubscribe } from '../shared/TautBridge'

declare const __TAUT_LOADER_VERSION__: string

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_xmlhttpRequest(details: {
  method?: string
  url: string
  headers?: Record<string, string>
  data?: string
  anonymous?: boolean
  onload?: (response: {
    status: number
    statusText: string
    responseText: string
    responseHeaders: string
  }) => void
  onerror?: (response: { error: string }) => void
}): void

type GMCookie = {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  expirationDate?: number
  sameSite?: string
}
declare const GM_cookie:
  | undefined
  | {
      list(
        details: {
          url?: string
          domain?: string
          name?: string
          path?: string
        },
        cb: (cookies: GMCookie[], error?: string) => void
      ): void
      set(
        details: GMCookie & { url: string },
        cb: (error?: string) => void
      ): void
      delete(
        details: { url?: string; name: string },
        cb: (error?: string) => void
      ): void
    }

const CONFIG_KEY = 'taut-config'
const USER_CSS_KEY = 'taut-user-css'
const SECRET_PREFIX = 'taut-secret:'

const configTextCallbacks = new Set<(text: string) => void>()
const userCssCallbacks = new Set<(css: string) => void>()

const gmCookie = typeof GM_cookie !== 'undefined' ? GM_cookie : null

const cookies: TautBridge['cookies'] = gmCookie
  ? {
      get: ({ url, name }) =>
        new Promise((resolve) =>
          gmCookie.list({ url, name }, (list) =>
            resolve((list?.[0] as TautCookie) ?? null)
          )
        ),
      getAll: (details) =>
        new Promise((resolve) =>
          gmCookie.list(details, (list) =>
            resolve((list as TautCookie[]) ?? [])
          )
        ),
      set: (cookie) =>
        new Promise((resolve) =>
          gmCookie.set(cookie as GMCookie & { url: string }, (err) =>
            resolve(!err)
          )
        ),
      remove: ({ url, name }) =>
        new Promise((resolve) =>
          gmCookie.delete({ url, name }, (err) => resolve(!err))
        ),
    }
  : null

export const userscriptBridge: TautBridge = {
  loader: 'userscript' as const,
  loaderVersion: __TAUT_LOADER_VERSION__,
  bridgeVersion: 2,

  cookies,

  async readSecret(key: string): Promise<string | null> {
    return GM_getValue(SECRET_PREFIX + key, null)
  },

  async writeSecret(key: string, value: string): Promise<boolean> {
    try {
      GM_setValue(SECRET_PREFIX + key, value)
      return true
    } catch {
      return false
    }
  },

  warnOutdated() {
    alert(
      '[Taut] Your Taut userscript is outdated. Please update it from https://taut.jer.app/taut.user.js'
    )
  },

  PATHS: null,

  async start(): Promise<void> {
    if (!GM_getValue(CONFIG_KEY)) {
      GM_setValue(CONFIG_KEY, emptyConfig)
    }
    if (!GM_getValue(USER_CSS_KEY)) {
      GM_setValue(USER_CSS_KEY, defaultUserCss)
    }
  },

  async readConfigText(): Promise<string> {
    return GM_getValue(CONFIG_KEY, emptyConfig) as string
  },

  async writeConfigText(text: string): Promise<boolean> {
    try {
      GM_setValue(CONFIG_KEY, text)
      return true
    } catch {
      return false
    }
  },

  onConfigTextChange(cb: (text: string) => void): Unsubscribe {
    configTextCallbacks.add(cb)
    return () => configTextCallbacks.delete(cb)
  },

  async readUserCss(): Promise<string> {
    return GM_getValue(USER_CSS_KEY, defaultUserCss) as string
  },

  async writeUserCss(text: string): Promise<boolean> {
    try {
      GM_setValue(USER_CSS_KEY, text)
      return true
    } catch {
      return false
    }
  },

  onUserCssChange(cb: (css: string) => void): Unsubscribe {
    userCssCallbacks.add(cb)
    return () => userCssCallbacks.delete(cb)
  },

  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url
    const headers: Record<string, string> = {}
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headers[k] = v
        })
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) headers[k] = v
      } else {
        Object.assign(headers, init.headers)
      }
    }
    const hasCookie = Object.keys(headers)
      .map((h) => h.toLowerCase())
      .includes('cookie')
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: (init?.method ?? 'GET').toUpperCase(),
        url,
        headers,
        data: typeof init?.body === 'string' ? init.body : undefined,
        anonymous: hasCookie,
        onload(r) {
          const responseHeaders = new Headers()
          for (const line of r.responseHeaders.trim().split('\r\n')) {
            const idx = line.indexOf(':')
            if (idx > 0)
              responseHeaders.append(
                line.slice(0, idx).trim(),
                line.slice(idx + 1).trim()
              )
          }
          resolve(
            new Response(r.responseText, {
              status: r.status,
              statusText: r.statusText,
              headers: responseHeaders,
            })
          )
        },
        onerror(r) {
          reject(new Error(r.error))
        },
      })
    })
  },
}
