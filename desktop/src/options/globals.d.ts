interface Window {
  tautPrefs?: {
    getUrl(): Promise<string>
    setUrl(url: string): Promise<void>
    hasEmbedded: boolean
  }
}
