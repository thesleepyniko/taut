// Taut Bridge Interface
// Defines the interface for communication between renderer and backends
// Implemented by ElectronBackend (IPC) and UserscriptBackend (GM_*)

/**
 * Plugin configuration object stored in config.jsonc
 * Each plugin has an `enabled` flag and can have additional custom properties
 */
export interface TautPluginConfig {
  enabled: boolean
  [key: string]: unknown
}

/**
 * Paths to Taut directories and files
 * Used by Electron backend for filesystem operations
 */
export interface TautPaths {
  /** Root Taut configuration directory */
  tautDir: string
  /** Directory containing core plugins */
  plugins: string
  /** Directory containing user plugins */
  userPlugins: string
  /** Path to config.jsonc file */
  config: string
  /** Path to user.css file */
  userCss: string
  /** Path to esbuild.wasm file (Electron only) */
  esbuildWasm?: string
  /** Path to preload.js file (Electron only) */
  preloadJs?: string
  /** Path to bundled renderer code (Electron only) */
  renderJs?: string
  /** Display-friendly versions of paths (with ~ for home dir) */
  display: Record<string, string>
}

/** Cleanup function returned by subscription methods */
export type Unsubscribe = () => void

/**
 * TautBridge interface
 * Abstracts the communication layer between renderer and backend
 * Electron uses IPC, Userscript uses GM_* storage APIs
 */
export interface TautBridge {
  /** Backend environment type */
  readonly env: 'electron' | 'extension' | 'userscript'

  /**
   * Initialize the backend
   * Electron: fetches PATHS from main process
   * Userscript: loads config from GM_getValue
   */
  start(): Promise<void>

  /**
   * Trigger plugin loading
   * Electron: tells main process to bundle and send plugins via IPC to onPluginCode
   * Userscript: triggers all bundled plugins to be sent to onPluginCode
   */
  startPlugins(): Promise<void>

  /**
   * Subscribe to plugin code delivery
   * Called when a plugin is bundled and ready to be loaded
   * @param cb - Callback receiving plugin name, code string, and config
   * @returns Unsubscribe function
   */
  onPluginCode(cb: (name: string, code: string) => void): Unsubscribe

  /**
   * Read the raw config.jsonc text
   * @returns Promise resolving to config file contents
   */
  readConfigText(): Promise<string>

  /**
   * Write raw text to config.jsonc
   * @param text - New config file contents
   * @returns Promise resolving to true on success
   */
  writeConfigText(text: string): Promise<boolean>

  /**
   * Subscribe to config text changes (for editor sync)
   * @param cb - Callback receiving new config text
   * @returns Unsubscribe function
   */
  onConfigTextChange(cb: (text: string) => void): Unsubscribe

  /**
   * Read the raw user.css text
   * @returns Promise resolving to user.css contents
   */
  readUserCss(): Promise<string>

  /**
   * Write raw text to user.css
   * @param text - New CSS contents
   * @returns Promise resolving to true on success
   */
  writeUserCss(text: string): Promise<boolean>

  /**
   * Subscribe to user.css changes
   * @param cb - Callback receiving new CSS text
   * @returns Unsubscribe function
   */
  onUserCssChange(cb: (css: string) => void): Unsubscribe

  /**
   * CORS-bypassing fetch.
   */
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>

  /**
   * Paths to Taut directories and files
   * TautPaths object, or null in userscript mode
   */
  PATHS: TautPaths | null
}

declare global {
  interface Window {
    TautBridge: TautBridge
  }
}
