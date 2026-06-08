// Build-time constants injected via buildExtension.ts / buildDesktop.ts
declare const __TAUT_EMBEDDED__: boolean
declare const __TAUT_LOADER__: string
declare const __TAUT_LOADER_VERSION__: string
declare const __TAUT_RUNTIME__: 'chrome' | 'firefox' | 'electron'
/** Version of the embedded taut.js bundle (from package.json). Empty string in standard builds. */
declare const __TAUT_APP_VERSION__: string
