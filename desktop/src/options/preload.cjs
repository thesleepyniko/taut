// Preload for the Taut options window
// Exposes tautPrefs API to the options page via contextBridge
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tautPrefs', {
  getUrl: () => ipcRenderer.invoke('taut:get-app-url'),
  setUrl: (/** @type {string} */ url) =>
    ipcRenderer.invoke('taut:set-app-url', url),
  hasEmbedded:
    typeof __TAUT_EMBEDDED__ !== 'undefined' ? __TAUT_EMBEDDED__ : false,
})
