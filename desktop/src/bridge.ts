// Taut Desktop Bridge
// IPC handlers for config/CSS management and fetch relay

import { promises as fs, watch } from 'fs'
import { ipcMain } from 'electron'
import os from 'os'
import path from 'path'

export interface BridgeConfig {
  configDir: string
}

async function fileExists(p: string) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export function setupBridge(
  config: BridgeConfig,
  opts: {
    getAppUrl: () => string
    setAppUrl: (url: string) => Promise<void>
    openOptionsWindow: () => void
  }
) {
  ipcMain.handle('taut:get-paths', () => {
    const home = os.homedir()
    const dp = (p: string) =>
      p.startsWith(home) ? '~' + p.slice(home.length) : p
    const tautDir = config.configDir
    const configFile = path.join(tautDir, 'config.jsonc')
    const userCssFile = path.join(tautDir, 'user.css')
    return {
      tautDir,
      plugins: path.join(tautDir, 'plugins'),
      userPlugins: path.join(tautDir, 'plugins'),
      config: configFile,
      userCss: userCssFile,
      display: {
        tautDir: dp(tautDir),
        plugins: dp(path.join(tautDir, 'plugins')),
        userPlugins: dp(path.join(tautDir, 'plugins')),
        config: dp(configFile),
        userCss: dp(userCssFile),
      },
    }
  })

  ipcMain.handle('taut:get-app-url', () => opts.getAppUrl())
  ipcMain.handle('taut:set-app-url', async (_, url: string) => {
    await opts.setAppUrl(url)
  })
  ipcMain.handle('taut:warn-outdated', () => opts.openOptionsWindow())

  const configFile = path.join(config.configDir, 'config.jsonc')
  const userCssFile = path.join(config.configDir, 'user.css')

  // Config/CSS watchers (set up once at startup)
  ipcMain.handle('taut:setup-watchers', async (event) => {
    const sender = event.sender
    try {
      await fs.mkdir(config.configDir, { recursive: true })

      // Watch configDir for config.jsonc and user.css changes (inode-based)
      watch(config.configDir, async (_, filename) => {
        if (!filename) return
        if (filename === 'config.jsonc') {
          try {
            const text = await fs.readFile(configFile, 'utf8')
            sender.send('taut:config-text-changed', text)
          } catch {}
        } else if (filename === 'user.css') {
          try {
            const css = await fs.readFile(userCssFile, 'utf8')
            sender.send('taut:user-css-changed', css)
          } catch {}
        }
      })

      // Send initial user.css if the file already exists
      if (await fileExists(userCssFile)) {
        const css = await fs.readFile(userCssFile, 'utf8')
        sender.send('taut:user-css-changed', css)
      }
    } catch (err) {
      console.error('[Taut] Failed to set up watchers:', err)
    }
  })

  // Config
  ipcMain.handle('taut:read-config-text', async () => {
    try {
      if (await fileExists(configFile))
        return await fs.readFile(configFile, 'utf8')
    } catch {}
    return ''
  })

  ipcMain.handle('taut:write-config-text', async (_, text: string) => {
    try {
      await fs.mkdir(config.configDir, { recursive: true })
      await fs.writeFile(configFile, text, 'utf8')
      return true
    } catch {
      return false
    }
  })

  // User CSS
  ipcMain.handle('taut:read-user-css', async () => {
    try {
      if (await fileExists(userCssFile))
        return await fs.readFile(userCssFile, 'utf8')
    } catch {}
    return ''
  })

  ipcMain.handle('taut:write-user-css', async (_, css: string) => {
    try {
      await fs.mkdir(config.configDir, { recursive: true })
      await fs.writeFile(userCssFile, css, 'utf8')
      return true
    } catch {
      return false
    }
  })

  // Fetch relay
  ipcMain.handle('taut:fetch', async (_, url: string, init?: RequestInit) => {
    try {
      const resp = await fetch(url, init)
      const text = await resp.text()
      return { ok: resp.ok, status: resp.status, text }
    } catch (e) {
      return { error: String(e) }
    }
  })
}
