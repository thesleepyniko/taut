// Taut main entrypoint

import { UserscriptBackend } from './userscriptBridge'
import { extensionBridge } from './extensionBridge'

declare const __TAUT_APP_CODE__: string
const tautAppCode = __TAUT_APP_CODE__

const g = globalThis as any

function appScript(doc: Document): HTMLScriptElement {
  const script = doc.createElement('script')
  script.classList.add('taut-script')
  script.type = 'text/javascript'
  script.textContent = tautAppCode
  return script
}

function rewriteWithApp() {
  window.stop()
  return (async () => {
    const html = await fetch(location.href).then((r) => r.text())
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.remove()

    // Collect scripts before removing them
    const scripts = Array.from(doc.querySelectorAll('script')).map((s) => ({
      src: s.src,
      textContent: s.textContent,
      type: s.getAttribute('type'),
    }))
    doc.querySelectorAll('script').forEach((s) => s.remove())

    // Put the cleaned HTML into the current document
    document.documentElement.replaceWith(doc.documentElement)

    // Run the app first
    document.head.appendChild(appScript(document))

    // Re-add Slack's scripts in order
    for (const { src, textContent, type } of scripts) {
      const s = document.createElement('script')
      if (type) s.type = type
      if (src) s.src = src
      else if (textContent) s.textContent = textContent
      document.head.appendChild(s)
    }
  })()
}

if (typeof g.GM_getValue !== 'undefined') {
  // Tampermonkey (or other userscript manager)
  const targetWindow = 'unsafeWindow' in g ? g.unsafeWindow : window
  targetWindow.TautBridge = UserscriptBackend
  rewriteWithApp()
} else if (g.__TAUT_NO_REWRITE) {
  // Firefox extension
  window.TautBridge = extensionBridge
  document.head.insertBefore(appScript(document), document.head.firstChild)
} else if (window.TautBridge) {
  // Electron
  document.head.insertBefore(appScript(document), document.head.firstChild)
} else {
  // Chrome extension
  window.TautBridge = extensionBridge
  rewriteWithApp()
}
