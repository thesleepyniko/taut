// Taut Chrome background service worker

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'fetch:request') return false

  const { url, init } = message
  fetch(url, init)
    .then(async (response) => {
      /** @type {Record<string, string>} */
      const headers = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      const body = await response.text()
      sendResponse({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
      })
    })
    .catch((e) => sendResponse({ error: String(e) }))

  return true // keep channel open for async response
})
