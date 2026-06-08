// Taut Chrome content script

;(() => {
  const DEFAULT_URL = __TAUT_EMBEDDED__
    ? chrome.runtime.getURL('taut.js')
    : 'https://jer.app/taut/taut.js'

  window.stop()

  Promise.all([
    chrome.storage.local.get({ tautUrl: DEFAULT_URL }),
    fetch(location.href).then((r) => r.text()),
  ]).then(([{ tautUrl }, html]) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.remove()

    // Collect and remove all script elements
    const scripts = Array.from(doc.querySelectorAll('script')).map((s) => ({
      src: s.src,
      textContent: s.textContent,
      type: s.getAttribute('type'),
    }))
    doc.querySelectorAll('script').forEach((s) => s.remove())

    // Inject: bridge-setup (sets window.TautBridge), then taut.js, then Slack's scripts
    const bridgeScript = doc.createElement('script')
    bridgeScript.src = chrome.runtime.getURL('bridge-setup.js')
    doc.head.appendChild(bridgeScript)

    const tautScript = doc.createElement('script')
    tautScript.src = /** @type {string} */ (tautUrl)
    doc.head.appendChild(tautScript)

    for (const { src, textContent, type } of scripts) {
      const s = doc.createElement('script')
      if (type) s.type = type
      if (src) s.src = src
      else if (textContent) s.textContent = textContent
      doc.head.appendChild(s)
    }

    document.open()
    document.write('<!DOCTYPE html>' + doc.documentElement.outerHTML)
    document.close()
  })

  // Relay postMessages from main world to chrome storage / background
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data?.__taut) return
    const { type, id, key, value, url, init } = event.data

    if (type === 'storage:get') {
      const result = await chrome.storage.local.get(key)
      window.postMessage({
        __taut: true,
        type: 'storage:response',
        id,
        value: result[key] ?? null,
      })
    } else if (type === 'storage:set') {
      await chrome.storage.local.set({ [key]: value })
      window.postMessage({ __taut: true, type: 'storage:response', id })
    } else if (type === 'fetch:request') {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'fetch:request',
          url,
          init,
        })
        window.postMessage({
          __taut: true,
          type: 'fetch:response',
          id,
          ...response,
        })
      } catch (e) {
        window.postMessage({
          __taut: true,
          type: 'fetch:response',
          id,
          error: String(e),
        })
      }
    }
  })

  // Forward storage changes from other tabs to main world
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    for (const [key, { newValue }] of Object.entries(changes)) {
      window.postMessage({
        __taut: true,
        type: 'storage:changed',
        key,
        newValue,
      })
    }
  })
})()
