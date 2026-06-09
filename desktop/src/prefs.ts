// Taut Desktop Preferences
// Reads/writes taut-prefs.json in the Taut config directory.
// Uses app.getPath('appData') which is NOT affected by the userData redirect in patch.ts.

import { promises as fs } from 'fs'
import path from 'path'
import { app } from 'electron'

declare const __TAUT_EMBEDDED__: boolean

// Embedded builds default to the bundled copy (served via taut://); standard
// builds default to jer.app.
const DEFAULT_APP_URL = __TAUT_EMBEDDED__
  ? 'taut://app/taut.js'
  : 'https://taut.jer.app/taut.js'

function getPrefsPath(): string {
  return path.join(app.getPath('appData'), 'Taut', 'prefs.json')
}

interface TautPrefs {
  appUrl?: string
}

let cached: TautPrefs | null = null

export async function loadPrefs(): Promise<TautPrefs> {
  try {
    const text = await fs.readFile(getPrefsPath(), 'utf8')
    cached = JSON.parse(text)
  } catch {
    cached = {}
  }
  return cached!
}

export async function savePrefs(prefs: Partial<TautPrefs>): Promise<void> {
  cached = { ...cached, ...prefs }
  const dir = path.dirname(getPrefsPath())
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(getPrefsPath(), JSON.stringify(cached, null, 2), 'utf8')
}

export function getAppUrl(): string {
  return cached?.appUrl ?? DEFAULT_APP_URL
}
