// Taut Preload Script (The Bridge)
// Injected into the renderer process as a custom preload script by main.cjs
// Exposes TautBridge to the renderer and loads the original Slack preload

const { contextBridge, ipcRenderer } = require('electron')
/** @import { TautPluginConfig } from '../Plugin' */
/** @typedef { import('../main/helpers.cjs')['PATHS'] } PATHS */

console.log('[Taut] Preload loaded')

/** @typedef {typeof TautBridge} TautBridge */

// user.css style element management
const TAUT_USER_CSS_ID = 'taut-user-css-style'

/** @type {string} */
let currentUserCss = ''

/**
 * Get or create the user.css style element
 * @returns {HTMLStyleElement}
 */
function getOrCreateUserCssStyle() {
  let style = document.getElementById(TAUT_USER_CSS_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = TAUT_USER_CSS_ID
    style.textContent = currentUserCss
    document.head.appendChild(style)
    console.log('[Taut] Created user.css style element')
  }
  return /** @type {HTMLStyleElement} */ (style)
}

/**
 * Ensure the user.css style element exists and has correct content
 */
function ensureUserCssStyle() {
  const style = getOrCreateUserCssStyle()
  if (style.textContent !== currentUserCss) {
    style.textContent = currentUserCss
  }
}

/**
 * Update the user.css content
 * @param {string} css - The new CSS content
 */
function updateUserCss(css) {
  currentUserCss = css

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        ensureUserCssStyle()
      },
      { once: true }
    )
  } else {
    ensureUserCssStyle()
  }
}

// Listen for user.css changes from main process
ipcRenderer.on('taut:user-css-changed', (event, css) => {
  console.log('[Taut] Received user.css update')
  updateUserCss(css)
})

/** @type {PATHS | null} */
let PATHS = null

// Expose TautBridge to the renderer world
const TautBridge = {
  /**
   * Ask the main process to start sending plugins and configs
   * @returns {Promise<void>}
   */
  startPlugins: () => ipcRenderer.invoke('taut:start-plugins'),

  /**
   * Subscribe to config changes with a callback
   * @param {(name: string, newConfig: TautPluginConfig) => void} callback - Callback to invoke on config changes
   */
  onConfigChange: (callback) => {
    ipcRenderer.on(
      'taut:config-changed',
      /**
       * @param {Electron.IpcRendererEvent} event
       * @param {string} name - Plugin name
       * @param {TautPluginConfig} newConfig - New plugin configuration
       */
      (event, name, newConfig) => {
        callback(name, newConfig)
      }
    )
  },

  /**
   * Subscribe to config text changes
   * @param {(text: string) => void} callback
   * @returns {() => void} Cleanup function
   */
  onConfigTextChange: (callback) => {
    /** @type {(event: Electron.IpcRendererEvent, text: string) => void} */
    const handler = (event, text) => callback(text)
    ipcRenderer.on('taut:config-text-changed', handler)
    return () => ipcRenderer.removeListener('taut:config-text-changed', handler)
  },

  /**
   * Subscribe to user.css changes
   * @param {(css: string) => void} callback
   * @returns {() => void} Cleanup function
   */
  onUserCssChange: (callback) => {
    /** @type {(event: Electron.IpcRendererEvent, css: string) => void} */
    const handler = (event, css) => callback(css)
    ipcRenderer.on('taut:user-css-changed', handler)
    return () => ipcRenderer.removeListener('taut:user-css-changed', handler)
  },

  /**
   * Get paths to the config directory and files within it
   * @type {() => (PATHS | null)} - The paths object
   */
  PATHS: () => PATHS,

  /**
   * Set whether a plugin is enabled (persists to config file)
   * @param {string} pluginName - The name of the plugin
   * @param {boolean} enabled - Whether the plugin should be enabled
   * @returns {Promise<boolean>} - True if successful
   */
  setPluginEnabled: (pluginName, enabled) =>
    ipcRenderer.invoke('taut:set-plugin-enabled', pluginName, enabled),

  /**
   * Read config.jsonc as raw text
   * @returns {Promise<string>} - The config file contents
   */
  readConfigText: () => ipcRenderer.invoke('taut:read-config-text'),

  /**
   * Write config.jsonc (raw text)
   * @param {string} text - The new config contents
   * @returns {Promise<boolean>} - True if successful
   */
  writeConfigText: (text) => ipcRenderer.invoke('taut:write-config-text', text),

  /**
   * Read user.css as raw text
   * @returns {Promise<string>} - The user.css contents
   */
  readUserCss: () => ipcRenderer.invoke('taut:read-user-css'),

  /**
   * Write user.css (raw text)
   * @param {string} text - The new CSS contents
   * @returns {Promise<boolean>} - True if successful
   */
  writeUserCss: (text) => ipcRenderer.invoke('taut:write-user-css', text),
}
contextBridge.exposeInMainWorld('TautBridge', TautBridge)

document.open()
document.write('')
document.close()

/** @type {Promise<string | null>} */
const originalPreloadPromise = ipcRenderer.invoke('taut:get-original-preload')
const originalHtmlPromise = fetch(location.href).then((res) => res.text())
/** @type {Promise<string>} */
const rendererCodePromise = ipcRenderer.invoke('taut:get-renderer-code')

;(async () => {
  try {
    const originalPreload = await originalPreloadPromise
    if (originalPreload) {
      console.log('[Taut] Evaluating original Slack preload script')
      eval(originalPreload)
    }
  } catch (err) {
    throw new Error(
      `[Taut] Failed to load original Slack preload script: ${err}`,
      { cause: err }
    )
  }

  const originalHtml = await originalHtmlPromise
  const parsedDocument = new DOMParser().parseFromString(
    originalHtml,
    'text/html'
  )

  // Remove CSP meta tag and reconstruct document
  const metaCsp = parsedDocument.querySelector(
    'meta[http-equiv="Content-Security-Policy"]'
  )
  if (metaCsp) {
    console.log('[Taut] Found and removing CSP meta tag:', metaCsp)
    metaCsp.replaceWith(
      document.createComment(
        ` CSP Meta Tag removed by Taut: ${metaCsp.outerHTML} `
      )
    )
  }
  // inject renderer code at the start of <head>
  const head = parsedDocument.head
  const rendererCode = await rendererCodePromise
  const scriptEl = parsedDocument.createElement('script')
  scriptEl.textContent = `// Taut injected renderer code\n// Built from core/renderer/main.ts\n${rendererCode}`
  head.insertBefore(scriptEl, head.firstChild)

  const html = parsedDocument.documentElement.outerHTML

  document.open()
  document.write(html)
  document.close()

  console.log('[Taut] CSP Meta Tag removed and document reconstructed.')
})()

// Fetch the PATHS from main process
;(async () => {
  try {
    const paths = await ipcRenderer.invoke('taut:get-paths')
    PATHS = paths
  } catch (err) {
    console.error('[Taut] Failed to get PATHS from main process:', err)
  }
})()
