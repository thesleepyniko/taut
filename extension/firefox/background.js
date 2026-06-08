// Taut Firefox background script

;(() => {
  const DEFAULT_URL = __TAUT_EMBEDDED__
    ? browser.runtime.getURL('taut.js')
    : 'https://jer.app/taut/taut.js'

  /** @type {browser.webRequest.RequestFilter} */
  const SLACK_FILTER = {
    urls: ['https://app.slack.com/*'],
    types: ['main_frame'],
  }

  // Rewrite the response body: remove CSP meta tag, inject bridge-setup + taut.js
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      const filter = browser.webRequest.filterResponseData(details.requestId)
      const decoder = new TextDecoder('utf-8')
      const encoder = new TextEncoder()

      let buffer = ''

      filter.ondata = (event) => {
        buffer += decoder.decode(event.data, { stream: true })
      }

      filter.onstop = async () => {
        buffer += decoder.decode()

        buffer = buffer.replace(
          /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*\/?>/gi,
          ''
        )

        const { tautUrl } = await browser.storage.local.get({
          tautUrl: DEFAULT_URL,
        })

        const bridgeUrl = browser.runtime.getURL('bridge-setup.js')
        const injection =
          `<script src="${bridgeUrl}"></script>` +
          `<script src="${tautUrl}"></script>`
        buffer = buffer.replace(/(<head\b[^>]*>)/i, `$1${injection}`)

        filter.write(encoder.encode(buffer))
        filter.close()
      }
    },
    SLACK_FILTER,
    ['blocking']
  )

  browser.runtime.onMessage.addListener((message) => {
    if (message.type !== 'fetch:request') return
    return fetch(message.url, message.init)
      .then(async (response) => {
        /** @type {Record<string, string>} */
        const headers = {}
        response.headers.forEach((value, key) => {
          headers[key] = value
        })
        const body = await response.text()
        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
        }
      })
      .catch((e) => ({ error: String(e) }))
  })
})()
