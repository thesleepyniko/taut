// Taut Firefox background script

;(() => {
  const DEFAULT_URL = __TAUT_EMBEDDED__
    ? browser.runtime.getURL('taut.js')
    : 'https://taut.jer.app/taut.js'

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

        const { tautUrl } = await browser.storage.local.get({
          tautUrl: DEFAULT_URL,
        })

        const doc = new DOMParser().parseFromString(buffer, 'text/html')
        doc
          .querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.remove()

        // Collect and remove all script elements
        const scripts = Array.from(doc.querySelectorAll('script')).map((s) => ({
          src: s.src,
          textContent: s.textContent,
          type: s.getAttribute('type'),
        }))
        doc.querySelectorAll('script').forEach((s) => s.remove())

        // Inject: bridge-setup (sets window.TautBridge), then taut.js, then Slack's scripts
        const scriptError = (/** @type {string} */ url) =>
          `alert('[Taut] Failed to load a script.\\n\\nURL: ' + ${JSON.stringify(url)} + '\\n\\n${url.includes('://localhost') ? 'Make sure your server is running.' : 'Ask in #taut for help.'}')`

        const bridgeScript = doc.createElement('script')
        bridgeScript.id = 'taut-bridge'
        bridgeScript.src = browser.runtime.getURL('bridge-setup.js')
        bridgeScript.setAttribute('onerror', scriptError(bridgeScript.src))
        doc.head.appendChild(bridgeScript)

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

        filter.write(
          encoder.encode('<!DOCTYPE html>' + doc.documentElement.outerHTML)
        )
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
