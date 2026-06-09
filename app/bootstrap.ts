// Taut Bootstrap
// Wires up the backend, config store, and starts plugins

import { PluginManager } from './pluginManager'
import { addSettingsTab } from './settings'
import { ConfigStore } from './configStore'
import { setStyle } from './api/css'
import { bundledPlugins } from './bundledData'
import type { TautBridge } from '../shared/TautBridge'

const global = globalThis as any

/**
 * Main entry point for Taut initialization.
 */
export async function bootstrap(bridge: TautBridge): Promise<void> {
  console.log('[Taut] Bootstrap starting...')

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
  console.log('[Taut] Taut initialized')
}
