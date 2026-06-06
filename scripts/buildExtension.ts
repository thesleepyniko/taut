#!/usr/bin/env bun
// Copies the prebuilt taut.js into both extension packages and syncs the
// manifest version. Run build:taut first (the build:extension script does this).

import path from 'path'
import prettier from 'prettier'

if (!('Bun' in globalThis)) {
  console.error('This script must be run with Bun.')
  process.exit(1)
}

const ROOT = path.join(import.meta.dir, '..')

// Copy to both extension packages
const src = path.join(ROOT, 'dist', 'taut.js')
const chromeOut = path.join(ROOT, 'extension', 'chrome', 'taut.js')
const firefoxOut = path.join(ROOT, 'extension', 'firefox', 'taut.js')

await Promise.all([
  Bun.write(chromeOut, Bun.file(src)),
  Bun.write(firefoxOut, Bun.file(src)),
])

console.log('[build-extension] Copied taut.js to extension packages')

// Sync version from package.json into both manifests
const { version } = await Bun.file(path.join(ROOT, 'package.json')).json()

for (const browser of ['chrome', 'firefox']) {
  const manifestPath = path.join(ROOT, 'extension', browser, 'manifest.json')
  const manifest = await Bun.file(manifestPath).json()
  manifest.version = version
  const formatted = await prettier.format(JSON.stringify(manifest), {
    ...(await prettier.resolveConfig(manifestPath)),
    filepath: manifestPath,
  })
  await Bun.write(manifestPath, formatted)
}

console.log(`[build-extension] Set manifest version to ${version}`)
