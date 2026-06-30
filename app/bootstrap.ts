// Taut Bootstrap
// Wires up the backend, config store, and starts plugins

import { PluginManager } from './pluginManager'
import { addSettingsTab } from './settings'
import { ConfigStore } from './configStore'
import { setStyle } from './api/css'
import { bundledPlugins } from './bundledData'
import { AccountSwitcher } from './api/accountSwitcher'
import type { TautBridge } from '../shared/TautBridge'

const global = globalThis as any

/**
 * Main entry point for Taut initialization.
 */
export async function bootstrap(bridge: TautBridge): Promise<void> {
  console.log('[Taut] Bootstrap starting...')

  // must stay before any await
  AccountSwitcher.applyPendingSwitch()

  await bridge.start()

  const configStore = new ConfigStore(bridge)
  await configStore.init()
  console.log('[Taut] ConfigStore initialized', configStore)
  global.configStore = configStore

  setStyle('user', configStore.getUserCssText())
  configStore.onUserCssChange((css) => setStyle('user', css))

  // Initialize plugins
  const pluginManager = new PluginManager(bridge, configStore)
  global.__tautPluginManager = pluginManager

  for (const [name, code] of Object.entries(bundledPlugins)) {
    pluginManager.loadPluginCode(name, code)
  }

  await addSettingsTab(pluginManager, configStore)

  // try to capture the logged-in account
  // not sure what to wait for but this works lol
  // TODO: figure out a better way to do this
  pluginManager.tautAPIPromise
    .then(async (api) => {
      if (!api.accounts.supported) return
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          if (await api.accounts.captureCurrent()) return
        } catch (e) {
          console.error('[Taut] Account capture failed:', e)
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    })
    .catch((e) => console.error('[Taut] Account capture failed:', e))

  console.log('[Taut] Taut initialized')
}
