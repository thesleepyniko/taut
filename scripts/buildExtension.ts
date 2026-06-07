#!/usr/bin/env bun
// Builds distributable extension packages from the templates in extension/.
//
// For each browser (chrome, firefox) we produce two modes:
//   offline - taut.js is bundled inside the extension
//   online - taut.js is loaded from the server at runtime
//
// Output: dist/extension/<browser>-<mode>/ and dist/taut-<browser>-<mode>.zip
//
// Run build:taut first (the build:extension script does this).

import path from 'path'
import { rm, mkdir, readdir } from 'fs/promises'
import prettier from 'prettier'
import { zipSync } from 'fflate'

if (!('Bun' in globalThis)) {
  console.error('This script must be run with Bun.')
  process.exit(1)
}

const ROOT = path.join(import.meta.dir, '..')
const EXT_SRC = path.join(ROOT, 'extension')
const DIST = path.join(ROOT, 'dist')
const OUT_ROOT = path.join(DIST, 'extension')
const TAUT_JS = path.join(DIST, 'taut.js')

const BROWSERS = ['chrome', 'firefox'] as const
const MODES = ['offline', 'online', 'dev'] as const

await rm(OUT_ROOT, { recursive: true, force: true })

for (const browser of BROWSERS) {
  const srcDir = path.join(EXT_SRC, browser)
  const files = (await readdir(srcDir)).filter((f) => f !== 'taut.js')

  for (const mode of MODES) {
    const outDir = path.join(OUT_ROOT, `${browser}-${mode}`)
    await mkdir(outDir, { recursive: true })

    // Collect each package file as bytes so we can write the unpacked folder
    // (for Chrome "Load unpacked") and build the zip from the same content.
    const entries: Record<string, Uint8Array> = {}

    for (const file of files) {
      const srcPath = path.join(srcDir, file)

      if (file === 'manifest.json') {
        const manifest = await Bun.file(srcPath).json()
        if (mode !== 'offline') delete manifest.web_accessible_resources
        const formatted = await prettier.format(JSON.stringify(manifest), {
          ...(await prettier.resolveConfig(srcPath)),
          filepath: srcPath,
        })
        entries[file] = new TextEncoder().encode(formatted)
        continue
      }

      const result = await Bun.build({
        entrypoints: [srcPath],
        target: 'browser',
        format: 'iife',
        define: { __TAUT_MODE__: JSON.stringify(mode) },
      })
      if (!result.success) {
        console.error(
          `[build-extension] Failed to build ${browser}/${file}:`,
          result.logs
        )
        process.exit(1)
      }
      entries[file] = new Uint8Array(await result.outputs[0].arrayBuffer())
    }

    if (mode === 'offline') {
      entries['taut.js'] = new Uint8Array(await Bun.file(TAUT_JS).arrayBuffer())
    }

    // Write the unpacked folder and a cross-platform zip from the same bytes.
    for (const [name, bytes] of Object.entries(entries)) {
      await Bun.write(path.join(outDir, name), bytes)
    }
    const zip = zipSync(entries)
    await Bun.write(path.join(DIST, `taut-${browser}-${mode}.zip`), zip)

    console.log(`[build-extension] Built ${browser}-${mode}`)
  }
}

console.log('[build-extension] Done!')
