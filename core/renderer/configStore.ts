// Taut Config Store
// In-memory store for config.jsonc and user.css with change notifications
// Uses jsonc-parser for safe JSONC modifications that preserve comments

import type { TautBridge } from '../shared/TautBridge'
import { initJsonc, type JsoncParser } from './cdn'

export interface TautConfig {
  plugins: Record<string, { enabled: boolean } & Record<string, unknown>>
}

type Listener<T> = (value: T) => void
type Unsubscribe = () => void

export class ConfigStore {
  private configText = ''
  private userCssText = ''
  private config: TautConfig = { plugins: {} }
  private configListeners = new Set<Listener<TautConfig>>()
  private configTextListeners = new Set<Listener<string>>()
  private cssListeners = new Set<Listener<string>>()
  private jsonc!: JsoncParser

  constructor(private bridge: TautBridge) {}

  async init(): Promise<void> {
    this.jsonc = await initJsonc()
    this.configText = await this.bridge.readConfigText()
    this.userCssText = await this.bridge.readUserCss()
    this.config = this.parseConfig(this.configText)

    this.bridge.onConfigTextChange((text) => {
      this.configText = text
      this.config = this.parseConfig(text)
      this.notifyConfigTextListeners()
      this.notifyConfigListeners()
    })

    this.bridge.onUserCssChange((css) => {
      this.userCssText = css
      this.notifyCssListeners()
    })
  }

  private parseConfig(text: string): TautConfig {
    try {
      const parsed = this.jsonc.parse(text, undefined, {
        allowTrailingComma: true,
      }) as TautConfig | null
      return parsed && typeof parsed === 'object' ? parsed : { plugins: {} }
    } catch {
      return { plugins: {} }
    }
  }

  getConfig(): TautConfig {
    return this.config
  }

  getConfigText(): string {
    return this.configText
  }

  getUserCssText(): string {
    return this.userCssText
  }

  onConfigChange(listener: Listener<TautConfig>): Unsubscribe {
    this.configListeners.add(listener)
    return () => this.configListeners.delete(listener)
  }

  onConfigTextChange(listener: Listener<string>): Unsubscribe {
    this.configTextListeners.add(listener)
    return () => this.configTextListeners.delete(listener)
  }

  onUserCssChange(listener: Listener<string>): Unsubscribe {
    this.cssListeners.add(listener)
    return () => this.cssListeners.delete(listener)
  }

  async updateConfigText(newText: string): Promise<void> {
    const success = await this.bridge.writeConfigText(newText)
    if (success) {
      this.configText = newText
      this.config = this.parseConfig(newText)
      this.notifyConfigTextListeners()
      this.notifyConfigListeners()
    }
    console.log(
      '[Taut] Config update',
      success ? 'succeeded' : 'failed',
      newText
    )
  }

  async updateUserCssText(newCss: string): Promise<void> {
    const success = await this.bridge.writeUserCss(newCss)
    if (success) {
      this.userCssText = newCss
      this.notifyCssListeners()
    }
    console.log(
      '[Taut] User CSS update',
      success ? 'succeeded' : 'failed',
      newCss
    )
  }

  async setPluginEnabled(pluginName: string, enabled: boolean): Promise<void> {
    const edits = this.jsonc.modify(
      this.configText,
      ['plugins', pluginName, 'enabled'],
      enabled,
      { formattingOptions: { tabSize: 2, insertSpaces: true } }
    )
    const newText = this.jsonc.applyEdits(this.configText, edits)
    await this.updateConfigText(newText)
  }

  private notifyConfigListeners() {
    for (const listener of this.configListeners) {
      listener(this.config)
    }
    console.log('[Taut] Notified config listeners', this.config)
  }

  private notifyConfigTextListeners() {
    for (const listener of this.configTextListeners) {
      listener(this.configText)
    }
  }

  private notifyCssListeners() {
    for (const listener of this.cssListeners) {
      listener(this.userCssText)
    }
  }
}
