// Taut Userscript Entry Point
// Reconstructs the document with CSP removed, injects renderer code
// Mirrors what preload.js does for Electron

import { UserscriptBackend } from './backend'

declare const __TAUT_RENDERER_CODE__: string
const rendererCode = __TAUT_RENDERER_CODE__

const targetWindow =
  'unsafeWindow' in globalThis
    ? (globalThis as any).unsafeWindow
    : (window as any)

console.log('[Taut] Userscript starting...')

targetWindow.TautBridge = UserscriptBackend
;(window as any).TautBridge = UserscriptBackend

function injectScript(doc: Document) {
  const blobUrl = URL.createObjectURL(
    new Blob([rendererCode], { type: 'application/javascript' })
  )
  const scriptEl = doc.createElement('script')
  scriptEl.src = blobUrl
  doc.head.insertBefore(scriptEl, doc.head.firstChild)
}

// Start work on fetching and modifying the original HTML
async function getModifiedHtml() {
  const originalHtmlResponse = await fetch(location.href)
  const originalHtml = await originalHtmlResponse.text()
  const parsedDocument = new DOMParser().parseFromString(
    originalHtml,
    'text/html'
  )

  const metaCsp = parsedDocument.querySelector(
    'meta[http-equiv="Content-Security-Policy"]'
  )
  if (metaCsp) {
    console.log('[Taut] Found and removing CSP meta tag:', metaCsp)
    metaCsp.replaceWith(
      parsedDocument.createComment(
        ` CSP Meta Tag removed by Taut: ${metaCsp.outerHTML} `
      )
    )
  }

  injectScript(parsedDocument)

  const html = `<!DOCTYPE html>\n${parsedDocument.documentElement.outerHTML}`

  return html
}

// Detect current page state and decide how to inject
const hasMetaCsp =
  document.querySelector('meta[http-equiv="Content-Security-Policy"]') !== null
const hasWebpackGlobal = 'webpackChunkwebapp' in targetWindow
console.log(
  '[Taut] Current stuff:',
  hasMetaCsp,
  hasWebpackGlobal,
  document.readyState
)
console.log('[Taut] HTML at injection:', document.documentElement.outerHTML)

if (!hasMetaCsp && !hasWebpackGlobal) {
  // Ideal case, no CSP or anything to deal with
  // Stop the current document loading, rewrite it without CSP and with our script, load that
  console.log('[Taut] No CSP detected, reconstructing document...')

  document.open()
  document.write('')
  document.close()

  // Wait for our modified HTML and write it
  ;(async () => {
    const modifiedHtml = await getModifiedHtml()
    document.open()
    document.write(modifiedHtml)
    document.close()
    console.log('[Taut] Document reconstructed and renderer injected.')
  })()
  // } else if (!hasWebpackGlobal) {
  //   // We missed the CSP, but we can still patch the webpack global

  //   console.log('[Taut] Missed CSP, patching webpack global...')
  //   injectScript(document)
} else {
  console.error(
    '[Taut] Detected that the page has already begun loading, Taut cannot load.'
  )
}
