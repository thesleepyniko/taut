// Taut Firefox content script

window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data?.__taut) return
  const { type, id, key, value, url, init } = event.data

  if (type === 'storage:get') {
    const result = await browser.storage.local.get(key)
    window.postMessage({
      __taut: true,
      type: 'storage:response',
      id,
      value: result[key] ?? null,
    })
  } else if (type === 'storage:set') {
    await browser.storage.local.set({ [key]: value })
    window.postMessage({ __taut: true, type: 'storage:response', id })
  } else if (type === 'fetch:request') {
    try {
      const response = await browser.runtime.sendMessage({
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
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  for (const [key, { newValue }] of Object.entries(changes)) {
    window.postMessage({ __taut: true, type: 'storage:changed', key, newValue })
  }
})
