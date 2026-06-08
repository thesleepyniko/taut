// Taut Bridge Interface
// Defines the interface for communication between the app and backends
// Implemented by ElectronBackend (IPC), extensionBridge (WebExtension storage),
// and UserscriptBackend (GM_*)

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
  /** Path to preload.js file (Electron only) */
  preloadJs?: string
  /** Display-friendly versions of paths (with ~ for home dir) */
  display: Record<string, string>
}

/** Cleanup function returned by subscription methods */
export type Unsubscribe = () => void

/**
 * TautBridge interface
 * Abstracts the communication layer between the app and backend.
 * Implemented by each loader: Chrome extension, Firefox extension, Electron preload.
 */
export interface TautBridge {
  /** Which loader is providing this bridge */
  readonly loader:
    | 'chrome-extension'
    | 'firefox-extension'
    | 'electron'
    | 'userscript'
  /** Semver version string of this loader (e.g. '1.0.0'). */
  readonly loaderVersion: string

  /**
   * Monotonic integer version of this loader's bridge API implementation
   */
  readonly bridgeVersion: number

  /**
   * Called by the app when bridgeVersion is below the required minimum.
   * The loader should show UI informing the user to update, then return.
   * After this returns, the app will exit without patching Slack.
   */
  warnOutdated(): void

  /**
   * Initialize the backend
   * Electron: fetches PATHS from main process
   * Extension: seeds config defaults in WebExtension storage
   * Userscript: loads config from GM_getValue
   */
  start(): Promise<void>

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
   * TautPaths object in Electron, or null in extension/userscript mode
   */
  PATHS: TautPaths | null
}

declare global {
  interface Window {
    TautBridge: TautBridge
  }
}
