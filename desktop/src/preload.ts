// Taut Desktop Preload

import type { TautBridge } from '../../shared/TautBridge'

declare const __TAUT_LOADER_VERSION__: string

const { contextBridge, ipcRenderer } = require('electron')

document.open()
document.write('<!DOCTYPE html>')
document.close()

// Kick off all async fetches in parallel to minimize latency
const origPreloadPromise = ipcRenderer.invoke(
  'taut:get-original-preload'
) as Promise<string | null>
const origHtmlPromise = fetch(location.href).then((r) => r.text())
const tautUrlPromise = ipcRenderer.invoke('taut:get-app-url') as Promise<string>
const pathsPromise = ipcRenderer.invoke('taut:get-paths')

;(async () => {
  try {
    // Eval Slack's original preload first so its contextBridge.exposeInMainWorld
    // calls run before any Slack scripts execute
    const origPreload = await origPreloadPromise
    if (origPreload) {
      console.log('[Taut] Evaluating Slack original preload')
      eval(origPreload) // eslint-disable-line no-eval
    }
  } catch (e) {
    console.error('[Taut] Failed to eval Slack preload:', e)
  }

  let html: string
  try {
    html = await origHtmlPromise
  } catch (e) {
    console.error('[Taut] Failed to fetch page HTML:', e)
    return
  }

  let tautUrl: string
  try {
    tautUrl = await tautUrlPromise
  } catch {
    tautUrl = 'https://taut.jer.app/taut.js'
  }

  const paths = await pathsPromise

  contextBridge.exposeInMainWorld('TautBridge', {
    loader: 'electron' as const,
    loaderVersion: __TAUT_LOADER_VERSION__,
    bridgeVersion: 1,
    PATHS: paths,

    start: () => ipcRenderer.invoke('taut:setup-watchers'),

    readConfigText: () => ipcRenderer.invoke('taut:read-config-text'),
    writeConfigText: (text: string) =>
      ipcRenderer.invoke('taut:write-config-text', text),

    onConfigTextChange(cb: (text: string) => void) {
      const handler = (_: unknown, text: string) => cb(text)
      ipcRenderer.on('taut:config-text-changed', handler)
      return () =>
        ipcRenderer.removeListener('taut:config-text-changed', handler)
    },

    readUserCss: () => ipcRenderer.invoke('taut:read-user-css'),
    writeUserCss: (css: string) =>
      ipcRenderer.invoke('taut:write-user-css', css),

    onUserCssChange(cb: (css: string) => void) {
      const handler = (_: unknown, css: string) => cb(css)
      ipcRenderer.on('taut:user-css-changed', handler)
      return () => ipcRenderer.removeListener('taut:user-css-changed', handler)
    },

    // CORS bypassed via webRequest in main process
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),

    warnOutdated: () => ipcRenderer.invoke('taut:warn-outdated'),
  } satisfies TautBridge)

  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.remove()

  // Collect and remove all script elements
  const scripts = Array.from(doc.querySelectorAll('script')).map((s) => ({
    src: (s as HTMLScriptElement).src,
    textContent: s.textContent,
    type: s.getAttribute('type'),
  }))
  doc.querySelectorAll('script').forEach((s) => s.remove())

  // Inject taut.js, then Slack's scripts
  const scriptError = (url: string) =>
    `alert('[Taut] Failed to load a script.\\n\\nURL: ' + ${JSON.stringify(url)} + '\\n\\n${url.includes('://localhost') ? 'Make sure your server is running.' : 'Ask in #taut for help.'}')`

  const tautScript = doc.createElement('script')
  tautScript.id = 'taut-app'
  tautScript.src = tautUrl
  tautScript.setAttribute('onerror', scriptError(tautScript.src))
  doc.head.appendChild(tautScript)

  for (const { src, textContent, type } of scripts) {
    const s = doc.createElement('script')
    if (type) s.type = type
    if (src) s.src = src
    else if (textContent) s.textContent = textContent
    doc.head.appendChild(s)
  }

  // Reconstruct the document
  document.open()
  document.write('<!DOCTYPE html>' + doc.documentElement.outerHTML)
  document.close()

  console.log(
    '[Taut] Document reconstructed with CSP removed and taut.js injected'
  )
})()
