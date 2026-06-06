;(() => {
  const DEV_MODE = true
  const TAUT_URL = DEV_MODE
    ? browser.runtime.getURL('taut.js')
    : 'https://jer.app/taut/taut.js'

  /** @type {browser.webRequest.RequestFilter} */
  const SLACK_FILTER = {
    urls: ['https://app.slack.com/*'],
    types: ['main_frame'],
  }

  // Rewrite the response body: remove CSP meta tag, inject flag + userscript
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      const filter = browser.webRequest.filterResponseData(details.requestId)
      const decoder = new TextDecoder('utf-8')
      const encoder = new TextEncoder()

      let buffer = ''

      filter.ondata = (event) => {
        buffer += decoder.decode(event.data, { stream: true })
      }

      filter.onstop = () => {
        buffer += decoder.decode()

        // Remove CSP meta tag
        buffer = buffer.replace(
          /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*\/?>/gi,
          ''
        )

        // Inject flag + taut as the first scripts in <head>
        const injection =
          '<script>window.__TAUT_NO_REWRITE=true</script>' +
          `<script src="${TAUT_URL}"></script>`
        buffer = buffer.replace(/(<head\b[^>]*>)/i, `$1${injection}`)

        filter.write(encoder.encode(buffer))
        filter.close()
      }
    },
    SLACK_FILTER,
    ['blocking']
  )
})()
