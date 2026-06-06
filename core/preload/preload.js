// Taut Preload Script (The Bridge)
// Injected into the renderer process as a custom preload script by main.cjs
// Implements TautBridge interface and loads the original Slack preload

const { contextBridge, ipcRenderer } = require('electron')
/** @typedef { import('../main/helpers.cjs')['PATHS'] } PATHS */

console.log('[Taut] Preload loaded')

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
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ensureUserCssStyle(), {
      once: true,
    })
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

/**
 * Electron backend implementation of TautBridge
 * Exposes IPC-based methods to the renderer world
 * @type {import('../shared/TautBridge').TautBridge}
 */
const ElectronBackend = {
  env: 'electron',

  async start() {
    PATHS = await ipcRenderer.invoke('taut:get-paths')
  },

  startPlugins: () => ipcRenderer.invoke('taut:start-plugins'),

  /**
   * Subscribe to plugin code delivery from main process
   * @param {(name: string, code: string) => void} cb
   * @returns {() => void}
   */
  onPluginCode(cb) {
    /**
     * @param {Electron.IpcRendererEvent} _
     * @param {string} name
     * @param {string} code
     */
    const handler = (_, name, code) => cb(name, code)
    ipcRenderer.on('taut:plugin-code', handler)
    return () => ipcRenderer.removeListener('taut:plugin-code', handler)
  },

  readConfigText: () => ipcRenderer.invoke('taut:read-config-text'),
  writeConfigText: (text) => ipcRenderer.invoke('taut:write-config-text', text),

  /**
   * Subscribe to config text changes
   * @param {(text: string) => void} cb
   * @returns {() => void}
   */
  onConfigTextChange(cb) {
    /**
     * @param {Electron.IpcRendererEvent} _
     * @param {string} text
     */
    const handler = (_, text) => cb(text)
    ipcRenderer.on('taut:config-text-changed', handler)
    return () => ipcRenderer.removeListener('taut:config-text-changed', handler)
  },

  readUserCss: () => ipcRenderer.invoke('taut:read-user-css'),
  writeUserCss: (text) => ipcRenderer.invoke('taut:write-user-css', text),

  /**
   * Subscribe to user.css changes
   * @param {(css: string) => void} cb
   * @returns {() => void}
   */
  onUserCssChange(cb) {
    /**
     * @param {Electron.IpcRendererEvent} _
     * @param {string} css
     */
    const handler = (_, css) => cb(css)
    ipcRenderer.on('taut:user-css-changed', handler)
    return () => ipcRenderer.removeListener('taut:user-css-changed', handler)
  },

  // CORS bypassed via webRequest in patch.cjs
  fetch: (input, init) => fetch(input, init),

  get PATHS() {
    return PATHS
  },
}

contextBridge.exposeInMainWorld('TautBridge', ElectronBackend)

// Clear document and prepare for reconstruction
document.open()
document.write('<!DOCTYPE html>')
document.write('')
document.close()

/** @type {Promise<string | null>} */
const originalPreloadPromise = ipcRenderer.invoke('taut:get-original-preload')
const originalHtmlPromise = fetch(location.href).then((res) => res.text())
/** @type {Promise<string>} */
const rendererCodePromise = ipcRenderer.invoke('taut:get-renderer-code')

// Load original preload, reconstruct document with CSP removed, inject renderer
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

  // Inject renderer code at the start of <head>
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
