// Taut Userscript Backend
// Implements TautBridge interface using GM_* APIs for userscript environment

import type { TautBridge, Unsubscribe } from '../shared/TautBridge'

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void

interface GM_XHRResponse {
  status: number
  statusText: string
  responseHeaders: string
  response: ArrayBuffer
}

type GM_XHRMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'

declare function GM_xmlhttpRequest(details: {
  method: GM_XHRMethod
  url: string
  headers?: Record<string, string>
  data?: string
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text'
  onload?: (response: GM_XHRResponse) => void
  onerror?: (error: unknown) => void
}): void

declare const __TAUT_BUNDLED_PLUGINS__: Record<string, string>
declare const __TAUT_DEFAULT_CONFIG__: string
declare const __TAUT_DEFAULT_USER_CSS__: string
const bundledPlugins = __TAUT_BUNDLED_PLUGINS__
const defaultConfig = __TAUT_DEFAULT_CONFIG__
const defaultUserCss = __TAUT_DEFAULT_USER_CSS__

const CONFIG_KEY = 'taut-config'
const USER_CSS_KEY = 'taut-user-css'

type PluginCodeCallback = (name: string, code: string) => void

export const UserscriptBackend: TautBridge = {
  env: 'userscript',

  PATHS: null,

  async start(): Promise<void> {
    if (!GM_getValue(CONFIG_KEY)) {
      GM_setValue(CONFIG_KEY, defaultConfig)
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
    return GM_getValue(CONFIG_KEY, defaultConfig) as string
  },

  async writeConfigText(text: string): Promise<boolean> {
    try {
      GM_setValue(CONFIG_KEY, text)
      for (const cb of configTextCallbacks) {
        try {
          cb(text)
        } catch (err) {
          console.error('[Taut] Error in onConfigTextChange callback:', err)
        }
      }
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
      for (const cb of userCssCallbacks) {
        try {
          cb(text)
        } catch (err) {
          console.error('[Taut] Error in onUserCssChange callback:', err)
        }
      }
      return true
    } catch {
      return false
    }
  },

  onUserCssChange(cb: (css: string) => void): Unsubscribe {
    userCssCallbacks.add(cb)
    return () => userCssCallbacks.delete(cb)
  },

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    return new Promise((resolve, reject) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const method = init?.method || 'GET'
      const headers = init?.headers as Record<string, string> | undefined

      GM_xmlhttpRequest({
        method: method as
          | 'GET'
          | 'POST'
          | 'PUT'
          | 'DELETE'
          | 'HEAD'
          | 'OPTIONS'
          | 'PATCH',
        url,
        headers,
        data: init?.body as string | undefined,
        responseType: 'arraybuffer',
        onload(response) {
          const responseHeaders: Record<string, string> = {}
          response.responseHeaders.split('\r\n').forEach((line) => {
            const idx = line.indexOf(':')
            if (idx > 0) {
              const key = line.slice(0, idx).trim().toLowerCase()
              const value = line.slice(idx + 1).trim()
              responseHeaders[key] = value
            }
          })

          resolve(
            new Response(response.response as ArrayBuffer, {
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
            })
          )
        },
        onerror(error) {
          reject(new Error(`GM_xmlhttpRequest failed: ${error}`))
        },
      })
    })
  },
}

const pluginCodeCallbacks = new Set<PluginCodeCallback>()
const configTextCallbacks = new Set<(text: string) => void>()
const userCssCallbacks = new Set<(css: string) => void>()
