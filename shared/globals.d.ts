interface Window {
  tautPrefs?: {
    getUrl(): Promise<string>
    setUrl(url: string): Promise<void>
  }
}

declare const __TAUT_RUNTIME__: 'chrome' | 'firefox' | 'electron' | 'userscript'
declare const __TAUT_EMBEDDED__: boolean
declare const __TAUT_EMBEDDED_VERSION__: string
