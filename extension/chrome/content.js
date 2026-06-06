// Taut Chrome content script

;(() => {
  const DEV_MODE = true
  const TAUT_URL = DEV_MODE
    ? chrome.runtime.getURL('taut.js')
    : 'https://jer.app/taut/taut.js'

  // Inject taut.js (which will handle CSP bypass and stop/rewrite logic)
  document.write(`<script src="${TAUT_URL}"></script>`)

  // Storage relay
  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data?.__taut) return
    const { type, id, key, value } = event.data

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
    }
  })

  // Forward storage changes from other tabs to main world.
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
