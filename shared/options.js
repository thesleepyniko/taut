;(() => {
  const OFFICIAL_URL = 'https://jer.app/taut/taut.js'
  const OFFICIAL_DEBUG_URL = 'https://jer.app/taut/taut.debug.js'
  const DEV_URL = 'http://localhost:3000/taut.js'

  /** @type {'chrome' | 'firefox' | 'electron' | 'userscript'} */
  const RUNTIME = __TAUT_RUNTIME__
  const isEmbedded = /** @type {boolean} */ (__TAUT_EMBEDDED__)
  const embeddedVersion = /** @type {string} */ (__TAUT_EMBEDDED_VERSION__)

  async function getStoredUrl() {
    if (RUNTIME === 'electron' || RUNTIME === 'userscript')
      return (
        (await /** @type {NonNullable<Window['tautPrefs']>} */ (
          window.tautPrefs
        ).getUrl()) || OFFICIAL_URL
      )
    if (RUNTIME === 'chrome')
      return /** @type {Promise<string>} */ (
        new Promise((r) =>
          chrome.storage.local.get({ tautUrl: OFFICIAL_URL }, (d) =>
            r(/** @type {string} */ (d.tautUrl))
          )
        )
      )
    return browser.storage.local
      .get({ tautUrl: OFFICIAL_URL })
      .then((d) => d.tautUrl)
  }

  async function storeUrl(/** @type {string} */ url) {
    if (RUNTIME === 'electron' || RUNTIME === 'userscript')
      return /** @type {NonNullable<Window['tautPrefs']>} */ (
        window.tautPrefs
      ).setUrl(url)
    if (RUNTIME === 'chrome')
      return /** @type {Promise<void>} */ (
        new Promise((r) =>
          chrome.storage.local.set({ tautUrl: url }, () => r(undefined))
        )
      )
    return browser.storage.local.set({ tautUrl: url })
  }

  function getEmbeddedUrl() {
    if (RUNTIME === 'userscript') return '<embedded>'
    if (RUNTIME === 'electron') return 'taut://app/taut.js'
    if (RUNTIME === 'chrome') return chrome.runtime.getURL('taut.js')
    if (RUNTIME === 'firefox') return browser.runtime.getURL('taut.js')
    return null
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
    if (btn)
      btn.textContent = embeddedVersion
        ? `Embedded copy (v${embeddedVersion})`
        : 'Embedded copy'
  }

  getStoredUrl().then((url) => {
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
    ?.addEventListener('click', () => setPreset(getEmbeddedUrl() ?? ''))

  saveBtn.addEventListener('click', async () => {
    const url = input.value.trim()
    if (!url) return
    saveBtn.disabled = true
    saveBtn.style.opacity = '0.4'
    await storeUrl(url)
  })
})()
