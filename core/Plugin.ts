// Taut Plugin Base Class
// Abstract class and types that all Taut plugins must extend
// Defines the TautAPI interface available to plugins

import type { TautAPI } from './renderer/pluginManager'
export type { TautAPI } from './renderer/pluginManager'
export type { ComponentType, componentReplacer } from './renderer/react'

export interface TautPluginConfig {
  enabled: boolean
  [key: string]: unknown
}

/**
 * Abstract base class that all Taut plugins must extend.
 * Plugins are instantiated in the browser context with access to the TautAPI.
 */
export abstract class TautPlugin {
  /** The display name of the plugin. */
  static readonly pluginName: string
  /** A short description of the plugin in mrkdwn format. */
  static readonly description: string
  /** The authors of the plugin in mrkdwn format, using <@user_id> syntax. */
  static readonly authors: string

  /**
   * @param api - The TautAPI instance for plugin communication
   * @param config - The plugin's configuration from config.jsonc
   */
  constructor(
    protected api: TautAPI,
    protected config: TautPluginConfig
  ) {}

  /**
   * Called when the plugin should start.
   * Subclasses must implement this method.
   */
  abstract start(): void

  /**
   * Called when the plugin should stop and clean up.
   * Subclasses should override this to perform cleanup.
   */
  stop(): void {
    // Default implementation does nothing
  }

  /**
   * Log a message with the plugin's name prefix.
   * @param args - Something to log
   */
  protected log = this._log.bind(this)
  protected _log(...args: any[]) {
    console.log(
      `[Taut] [${(this.constructor as typeof TautPlugin).pluginName}]`,
      ...args
    )
  }
}

export default TautPlugin
export interface TautPluginConstructor {
  new (api: TautAPI, config: any): TautPlugin
  readonly pluginName: string
  readonly description: string
  readonly authors: string
  readonly defaultConfig?: string
}
