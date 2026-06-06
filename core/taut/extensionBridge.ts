// Taut extension backend
// Implements TautBridge using WebExtension storage

import type { TautBridge, Unsubscribe } from '../shared/TautBridge'
import { bundledPlugins, defaultConfig, defaultUserCss } from './bundledData'

const CONFIG_KEY = 'taut-config'
const CSS_KEY = 'taut-user-css'

type PluginCodeCallback = (name: string, code: string) => void

// Relay helpers

let msgId = 0

function storageGet(key: string, fallback: string): Promise<string> {
  return new Promise((resolve) => {
    const id = ++msgId
    const handler = (e: MessageEvent) => {
      if (
        !e.data?.__taut ||
        e.data.type !== 'storage:response' ||
        e.data.id !== id
      )
        return
      window.removeEventListener('message', handler)
      resolve(e.data.value ?? fallback)
    }
    window.addEventListener('message', handler)
    window.postMessage({ __taut: true, type: 'storage:get', id, key })
  })
}

function storageSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    const id = ++msgId
    const handler = (e: MessageEvent) => {
      if (
        !e.data?.__taut ||
        e.data.type !== 'storage:response' ||
        e.data.id !== id
      )
        return
      window.removeEventListener('message', handler)
      resolve()
    }
    window.addEventListener('message', handler)
    window.postMessage({ __taut: true, type: 'storage:set', id, key, value })
  })
}

// Track our own writes so we can suppress the same-tab storage:changed echo.
const lastWritten = new Map<string, string>()

window.addEventListener('message', (e: MessageEvent) => {
  if (!e.data?.__taut || e.data.type !== 'storage:changed') return
  const { key, newValue } = e.data as { key: string; newValue: string }

  if (lastWritten.get(key) === newValue) {
    lastWritten.delete(key)
    return
  }

  if (key === CONFIG_KEY) for (const cb of configTextCallbacks) cb(newValue)
  if (key === CSS_KEY) for (const cb of userCssCallbacks) cb(newValue)
})

const pluginCodeCallbacks = new Set<PluginCodeCallback>()
const configTextCallbacks = new Set<(text: string) => void>()
const userCssCallbacks = new Set<(css: string) => void>()

export const extensionBridge: TautBridge = {
  env: 'extension',

  PATHS: null,

  async start(): Promise<void> {
    if (!(await storageGet(CONFIG_KEY, ''))) {
      await storageSet(CONFIG_KEY, defaultConfig)
    }
    if (!(await storageGet(CSS_KEY, ''))) {
      await storageSet(CSS_KEY, defaultUserCss)
    }
  },

  async startPlugins(): Promise<void> {
    for (const [name, code] of Object.entries(bundledPlugins)) {
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
    return storageGet(CONFIG_KEY, defaultConfig)
  },

  async writeConfigText(text: string): Promise<boolean> {
    try {
      lastWritten.set(CONFIG_KEY, text)
      await storageSet(CONFIG_KEY, text)
      for (const cb of configTextCallbacks) cb(text)
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
    return storageGet(CSS_KEY, defaultUserCss)
  },

  async writeUserCss(text: string): Promise<boolean> {
    try {
      lastWritten.set(CSS_KEY, text)
      await storageSet(CSS_KEY, text)
      for (const cb of userCssCallbacks) cb(text)
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
    return globalThis.fetch(input, init)
  },
}
