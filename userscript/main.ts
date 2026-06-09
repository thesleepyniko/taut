// Taut Userscript main

import type { TautBridge } from '../shared/TautBridge'
import { userscriptBridge } from './bridge'

declare const unsafeWindow: Window &
  typeof globalThis & { TautBridge: TautBridge }
declare function GM_getValue<T>(key: string, defaultValue: T): T

const DEFAULT_URL = 'https://jer.app/taut/taut.js'

unsafeWindow.TautBridge = userscriptBridge

document.open()
document.write('<!DOCTYPE html>')
document.close()
;(async () => {
  const tautUrl = GM_getValue('tautUrl', DEFAULT_URL)

  let html: string
  try {
    html = await fetch(location.href).then((r) => r.text())
  } catch (e) {
    console.error('[Taut] Failed to fetch page HTML:', e)
    return
  }

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
