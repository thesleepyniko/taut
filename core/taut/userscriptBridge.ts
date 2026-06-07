// Taut userscript backend
// Implements TautBridge interface using GM_* APIs for userscript environment

import type { TautBridge, Unsubscribe } from '../shared/TautBridge'

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void
declare function GM_xmlhttpRequest(details: {
  method?: string
  url: string
  headers?: Record<string, string>
  data?: string
  onload?: (response: {
    status: number
    statusText: string
    responseText: string
    responseHeaders: string
  }) => void
  onerror?: (response: { error: string }) => void
}): void

import { bundledPlugins, emptyConfig, defaultUserCss } from './bundledData'

const CONFIG_KEY = 'taut-config'
const USER_CSS_KEY = 'taut-user-css'

type PluginCodeCallback = (name: string, code: string) => void

export const UserscriptBackend: TautBridge = {
  env: 'userscript',

  PATHS: null,

  async start(): Promise<void> {
    if (!GM_getValue(CONFIG_KEY)) {
      GM_setValue(CONFIG_KEY, emptyConfig)
    }
    if (!GM_getValue(USER_CSS_KEY)) {
      GM_setValue(USER_CSS_KEY, defaultUserCss)
    }
  },

  async startPlugins(): Promise<void> {
    const plugins = bundledPlugins

    for (const [name, code] of Object.entries(plugins)) {
      for (const cb of pluginCodeCallbacks) {
        try {
          cb(name, code)
        } catch (err) {
          console.error(
            `[Taut] Error in onPluginCode callback for ${name}:`,
            err
          )
        }
      }
    }
  },

  onPluginCode(cb: PluginCodeCallback): Unsubscribe {
    pluginCodeCallbacks.add(cb)
    return () => pluginCodeCallbacks.delete(cb)
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
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: (init?.method ?? 'GET').toUpperCase(),
        url,
        headers,
        data: typeof init?.body === 'string' ? init.body : undefined,
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

const pluginCodeCallbacks = new Set<PluginCodeCallback>()
const configTextCallbacks = new Set<(text: string) => void>()
const userCssCallbacks = new Set<(css: string) => void>()
