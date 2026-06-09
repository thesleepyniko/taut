// Taut Bridge Setup Template
// Sets up window.TautBridge in main world using postMessage relay to content script

;(() => {
  const CONFIG_KEY = 'taut-config'
  const CSS_KEY = 'taut-user-css'

  let msgId = 0

  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {Promise<T>}
   */
  function storageGet(key, fallback) {
    return new Promise((resolve) => {
      const id = ++msgId
      const handler = /** @type {(e: MessageEvent) => void} */ (
        (e) => {
          if (
            !e.data?.__taut ||
            e.data.type !== 'storage:response' ||
            e.data.id !== id
          )
            return
          window.removeEventListener('message', handler)
          resolve(e.data.value ?? fallback)
        }
      )
      window.addEventListener('message', handler)
      window.postMessage({ __taut: true, type: 'storage:get', id, key })
    })
  }

  /**
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  function storageSet(key, value) {
    return /** @type {Promise<void>} */ (
      new Promise((resolve) => {
        const id = ++msgId
        const handler = /** @type {(e: MessageEvent) => void} */ (
          (e) => {
            if (
              !e.data?.__taut ||
              e.data.type !== 'storage:response' ||
              e.data.id !== id
            )
              return
            window.removeEventListener('message', handler)
            resolve()
          }
        )
        window.addEventListener('message', handler)
        window.postMessage({
          __taut: true,
          type: 'storage:set',
          id,
          key,
          value,
        })
      })
    )
  }

  const lastWritten = new Map()
  const configTextCallbacks = new Set()
  const userCssCallbacks = new Set()

  window.addEventListener('message', (e) => {
    if (!e.data?.__taut || e.data.type !== 'storage:changed') return
    const { key, newValue } = e.data
    if (lastWritten.get(key) === newValue) {
      lastWritten.delete(key)
      return
    }
    if (key === CONFIG_KEY) for (const cb of configTextCallbacks) cb(newValue)
    if (key === CSS_KEY) for (const cb of userCssCallbacks) cb(newValue)
  })

  /** @satisfies {import('../../shared/TautBridge').TautBridge} */
  window.TautBridge = {
    loader:
      /** @type {import('../../shared/TautBridge').TautBridge['loader']} */ (
        '__TAUT_LOADER__'
      ),
    loaderVersion: '__TAUT_LOADER_VERSION__',
    bridgeVersion: 1,
    PATHS: null,

    async start() {},

    async readConfigText() {
      return storageGet(CONFIG_KEY, '')
    },

    async writeConfigText(text) {
      try {
        lastWritten.set(CONFIG_KEY, text)
        await storageSet(CONFIG_KEY, text)
        return true
      } catch {
        return false
      }
    },

    onConfigTextChange(cb) {
      configTextCallbacks.add(cb)
      return () => configTextCallbacks.delete(cb)
    },

    async readUserCss() {
      return storageGet(CSS_KEY, '')
    },

    async writeUserCss(text) {
      try {
        lastWritten.set(CSS_KEY, text)
        await storageSet(CSS_KEY, text)
        return true
      } catch {
        return false
      }
    },

    onUserCssChange(cb) {
      userCssCallbacks.add(cb)
      return () => userCssCallbacks.delete(cb)
    },

    fetch(input, init) {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const serialInit =
        /** @type {{ method?: string, body?: string, headers?: Record<string, string> }} */ ({})
      if (init?.method) serialInit.method = init.method
      if (init?.body && typeof init.body === 'string')
        serialInit.body = init.body
      if (init?.headers) {
        const headers = /** @type {Record<string, string>} */ ({})
        if (init.headers instanceof Headers) {
          init.headers.forEach((v, k) => {
            headers[k] = v
          })
        } else if (Array.isArray(init.headers)) {
          for (const [k, v] of init.headers) headers[k] = v
        } else {
          Object.assign(headers, init.headers)
        }
        serialInit.headers = headers
      }
      return new Promise((resolve, reject) => {
        const id = ++msgId
        const handler = /** @type {(e: MessageEvent) => void} */ (
          (e) => {
            if (
              !e.data?.__taut ||
              e.data.type !== 'fetch:response' ||
              e.data.id !== id
            )
              return
            window.removeEventListener('message', handler)
            const { status, statusText, headers, body, error } = e.data
            if (error) {
              reject(new TypeError(error))
              return
            }
            resolve(new Response(body, { status, statusText, headers }))
          }
        )
        window.addEventListener('message', handler)
        window.postMessage({
          __taut: true,
          type: 'fetch:request',
          id,
          url,
          init: serialInit,
        })
      })
    },

    warnOutdated() {
      // TODO: improve this
      alert(
        '[Taut] Your Taut extension is outdated and may not work correctly.\n\nPlease update the Taut extension to continue using it.'
      )
    },
  }
})()
