// Taut Firefox storage relay

window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data?.__taut) return
  const { type, id, key, value } = event.data

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
  }
})

// Forward storage changes from other tabs to main world
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  for (const [key, { newValue }] of Object.entries(changes)) {
    window.postMessage({ __taut: true, type: 'storage:changed', key, newValue })
  }
})
