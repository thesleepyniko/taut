// Taut Options Page
// Works in Chrome extension, Firefox extension, and Electron desktop

;(() => {
  const OFFICIAL_URL = 'https://jer.app/taut/taut.js'
  const OFFICIAL_DEBUG_URL = 'https://jer.app/taut/taut.debug.js'
  const DEV_URL = 'http://localhost:3000/taut.js'

  const RUNTIME = /** @type {'chrome' | 'firefox' | 'electron'} */ (
    __TAUT_RUNTIME__
  )
  const isEmbedded = __TAUT_EMBEDDED__

  function getEmbeddedUrl() {
    if (RUNTIME === 'electron') return 'taut://app/taut.js'
    if (RUNTIME === 'chrome') return chrome.runtime.getURL('taut.js')
    return browser.runtime.getURL('taut.js')
  }

  /** @returns {Promise<string>} */
  async function getStoredUrl() {
    const defaultUrl = isEmbedded ? getEmbeddedUrl() : OFFICIAL_URL
    if (RUNTIME === 'electron') {
      const prefs = /** @type {NonNullable<typeof window.tautPrefs>} */ (
        window.tautPrefs
      )
      const url = await prefs.getUrl()
      return url || defaultUrl
    }
    if (RUNTIME === 'chrome') {
      return new Promise((r) =>
        chrome.storage.local.get({ tautUrl: defaultUrl }, (d) =>
          r(/** @type {string} */ (d.tautUrl))
        )
      )
    }
    return browser.storage.local
      .get({ tautUrl: defaultUrl })
      .then((d) => d.tautUrl)
  }

  async function storeUrl(/** @type {string} */ url) {
    if (RUNTIME === 'electron') {
      const prefs = /** @type {NonNullable<typeof window.tautPrefs>} */ (
        window.tautPrefs
      )
      return prefs.setUrl(url)
    }
    if (RUNTIME === 'chrome')
      return /** @type {Promise<void>} */ (
        new Promise((r) =>
          chrome.storage.local.set({ tautUrl: url }, () => r())
        )
      )
    return browser.storage.local.set({ tautUrl: url })
  }

  const input = /** @type {HTMLInputElement} */ (document.getElementById('url'))
  const saveBtn = /** @type {HTMLButtonElement} */ (
    document.getElementById('save')
  )

  saveBtn.disabled = true
  saveBtn.style.opacity = '0.4'

  function markChanged() {
    saveBtn.disabled = false
    saveBtn.style.opacity = ''
  }

  function setPreset(/** @type {string} */ url) {
    input.value = url
    markChanged()
  }

  input.addEventListener('input', markChanged)

  if (isEmbedded) {
    const wrap = document.getElementById('btn-embedded-wrap')
    if (wrap) wrap.style.display = ''
    const btn = document.getElementById('btn-embedded')
    if (btn) btn.textContent = `Embedded copy (v${__TAUT_APP_VERSION__})`
  }

  const storedUrl = /** @type {Promise<string>} */ (getStoredUrl())
  storedUrl.then((url) => {
    input.value = url
  })

  document
    .getElementById('btn-official')
    ?.addEventListener('click', () => setPreset(OFFICIAL_URL))
  document
    .getElementById('btn-official-debug')
    ?.addEventListener('click', () => setPreset(OFFICIAL_DEBUG_URL))
  document
    .getElementById('btn-dev')
    ?.addEventListener('click', () => setPreset(DEV_URL))
  document
    .getElementById('btn-embedded')
    ?.addEventListener('click', () => setPreset(getEmbeddedUrl()))

  saveBtn.addEventListener('click', async () => {
    const url = input.value.trim()
    if (!url) return
    saveBtn.disabled = true
    saveBtn.style.opacity = '0.4'
    await storeUrl(url)
  })
})()
