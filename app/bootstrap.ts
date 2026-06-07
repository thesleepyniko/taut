// Taut Bootstrap
// Wires up the backend, config store, and starts plugins

import { PluginManager } from './pluginManager'
import { addSettingsTab } from './settings'
import { ConfigStore } from './configStore'
import { setStyle } from './api/css'
import type { TautBridge } from '../shared/TautBridge'

const global = globalThis as any

/**
 * Main entry point for Taut initialization.
 */
export async function bootstrap(
  bridge: TautBridge = global.TautBridge
): Promise<void> {
  if (!bridge) {
    throw new Error('[Taut] TautBridge not found')
  }

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
  const pluginsPromise = bridge.startPlugins()

  // Setup settings tab
  const settingsPromise = addSettingsTab(pluginManager, configStore)

  await Promise.all([pluginsPromise, settingsPromise])
  console.log('[Taut] Taut initialized')
}
