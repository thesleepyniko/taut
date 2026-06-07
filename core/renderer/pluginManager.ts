// Taut Client (the plugin manager)
// Runs in the browser page context
// Loads and manages plugins via TautBridge

import { findExportPromise, findByPropsPromise } from './webpack'
import {
  reactPromise,
  findComponentPromise,
  patchComponentPromise,
} from './react'
import { setStyle, removeStyle } from './css'
import { TypedEventTarget, deepEqual } from './helpers'

import {
  TautPlugin,
  type TautPluginConstructor,
  type TautPluginConfig,
} from '../Plugin'
import type { TautBridge } from '../shared/TautBridge'
import type { ConfigStore } from './configStore'

const global = globalThis as any
global.TautPlugin = TautPlugin

async function makeTautAPI(bridge: TautBridge) {
  const TautAPI = {
    setStyle,
    removeStyle,
    findExport: await findExportPromise,
    findByProps: await findByPropsPromise,
    findComponent: await findComponentPromise,
    patchComponent: await patchComponentPromise,
    fetch: bridge.fetch.bind(bridge),
    commonModules: {
      react: await reactPromise,
    },
  }
  global.TautAPI = TautAPI
  console.log('[Taut] TautAPI initialized', TautAPI)
  return TautAPI
}
export type TautAPI = Awaited<ReturnType<typeof makeTautAPI>>

export class PluginManager extends TypedEventTarget<{
  pluginInfoChanged: PluginInfo
}> {
  readonly tautAPIPromise: Promise<TautAPI>
  plugins = new Map<
    string,
    {
      PluginClass: TautPluginConstructor
      instance: TautPlugin | null
    }
  >()
  private prevPluginConfigs = new Map<string, TautPluginConfig>()

  constructor(
    protected bridge: TautBridge,
    protected configStore: ConfigStore
  ) {
    super()
    this.tautAPIPromise = makeTautAPI(bridge)

    this.bridge.onPluginCode(async (name, code) => {
      await this.loadPluginCode(name, code)
    })

    this.configStore.onConfigChange((newConfig) => {
      for (const [name, pluginConfig] of Object.entries(newConfig.plugins)) {
        if (deepEqual(this.prevPluginConfigs.get(name), pluginConfig)) continue
        this.prevPluginConfigs.set(name, structuredClone(pluginConfig))
        this.updatePluginConfig(name, pluginConfig)
      }
    })
  }

  async loadPluginCode(name: string, code: string): Promise<boolean> {
    console.log(`[Taut] Loading plugin: ${name}`)

    try {
      const result = new Function(`return ${code}`)()
      const PluginClass =
        result.prototype instanceof TautPlugin
          ? (result as TautPluginConstructor)
          : (result.default as TautPluginConstructor)

      if (
        typeof PluginClass !== 'function' ||
        !(PluginClass.prototype instanceof TautPlugin)
      ) {
        throw new Error(`Plugin class ${name} does not extend TautPlugin`)
      }

      await this.configStore.ensurePluginConfig(name, PluginClass.defaultConfig)
      const config = this.configStore.getConfig().plugins[name] ?? {
        enabled: false,
      }

      const existing = this.plugins.get(name)
      if (existing && existing.instance) {
        try {
          existing.instance.stop()
        } catch (err) {
          console.error(`[Taut] Error stopping existing plugin ${name}:`, err)
        }
      }

      let instance: TautPlugin | null = null

      if (config.enabled) {
        // Wait for React before instantiating plugins (they may use JSX)
        await reactPromise

        try {
          instance = new PluginClass(await this.tautAPIPromise, config)
          instance.start()
          console.log(`[Taut] Plugin ${name} started successfully`)
        } catch (err) {
          console.error(`[Taut] Error starting plugin ${name}:`, err)
        }
      }

      this.prevPluginConfigs.set(name, structuredClone(config))
      this.plugins.set(name, { PluginClass, instance })
      this.emit('pluginInfoChanged', this.getPluginInfo())
      console.log(`[Taut] Plugin ${name} loaded`)
      return true
    } catch (err) {
      console.error(`[Taut] Plugin ${name} failed to load:`, err)
      return false
    }
  }

  async updatePluginConfig(name: string, newConfig: TautPluginConfig) {
    console.log(`[Taut] Updating config for plugin: ${name}`)

    const existing = this.plugins.get(name)
    if (!existing) {
      console.warn(`[Taut] Plugin ${name} not loaded, cannot update config`)
      return
    }

    if (existing.instance) {
      try {
        existing.instance.stop()
      } catch (err) {
        console.error(`[Taut] Error stopping plugin ${name}:`, err)
      }
      existing.instance = null
    }

    let instance: TautPlugin | null = null

    if (newConfig.enabled) {
      // Wait for React before instantiating plugins (they may use JSX)
      await reactPromise

      try {
        instance = new existing.PluginClass(
          await this.tautAPIPromise,
          newConfig
        )
        instance.start()
        console.log(
          `[Taut] Plugin ${name} started successfully with new config`
        )
      } catch (err) {
        console.error(
          `[Taut] Error starting plugin ${name} with new config:`,
          err
        )
      }
    }

    this.plugins.set(name, {
      PluginClass: existing.PluginClass,
      instance,
    })

    this.emit('pluginInfoChanged', this.getPluginInfo())
    console.log(`[Taut] Plugin ${name} config updated`)
  }

  getPluginInfo() {
    return [...this.plugins.entries()].map(([id, plugin]) => ({
      id,
      name: plugin.PluginClass.pluginName,
      description: plugin.PluginClass.description,
      authors: plugin.PluginClass.authors,
      enabled: plugin.instance !== null,
    }))
  }
}
export type PluginInfo = ReturnType<PluginManager['getPluginInfo']>
