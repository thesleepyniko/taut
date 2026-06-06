// Taut userscript backend
// Implements TautBridge interface using GM_* APIs for userscript environment

import type { TautBridge, Unsubscribe } from '../shared/TautBridge'

declare function GM_getValue<T>(key: string, defaultValue?: T): T
declare function GM_setValue(key: string, value: unknown): void

import { bundledPlugins, defaultConfig, defaultUserCss } from './bundledData'

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
}

const pluginCodeCallbacks = new Set<PluginCodeCallback>()
const configTextCallbacks = new Set<(text: string) => void>()
const userCssCallbacks = new Set<(css: string) => void>()
