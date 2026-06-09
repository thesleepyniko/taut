#!/usr/bin/env bun
// Builds the Taut userscript from userscript/main.ts → dist/taut.user.js

import path from 'path'
import { readFile, mkdir } from 'fs/promises'

if (!('Bun' in globalThis)) {
  console.error('This script must be run with Bun.')
  process.exit(1)
}

const ROOT = path.join(import.meta.dir, '..')
const USERSCRIPT_SRC = path.join(ROOT, 'userscript')
const DIST = path.join(ROOT, 'dist')

const TAUT_VERSION: string = (
  await Bun.file(path.join(ROOT, 'package.json')).json()
).version
const LOADER_VERSION: string = (
  await Bun.file(path.join(USERSCRIPT_SRC, 'version.json')).json()
).version

await mkdir(DIST, { recursive: true })

const headerRaw = await readFile(path.join(USERSCRIPT_SRC, 'header.ts'), 'utf8')
const header = headerRaw
  .replace(/\$VERSION/g, LOADER_VERSION)
  .replace(/\$DESCRIPTION_SUFFIX/g, '')

const optionsHtml = (
  await readFile(path.join(ROOT, 'shared', 'options.html'), 'utf8')
)
  .replace(/__TAUT_EMBEDDED__/g, 'false')
  .replace(/__TAUT_RUNTIME__/g, "'userscript'")
  .replace(/__TAUT_EMBEDDED_VERSION__/g, "''")

const result = await Bun.build({
  entrypoints: [path.join(USERSCRIPT_SRC, 'main.ts')],
  target: 'browser',
  format: 'iife',
  define: {
    __TAUT_VERSION__: JSON.stringify(TAUT_VERSION),
    __TAUT_LOADER_VERSION__: JSON.stringify(LOADER_VERSION),
    __TAUT_BUNDLED_PLUGINS__: JSON.stringify({}),
    __TAUT_OPTIONS_HTML__: JSON.stringify(optionsHtml),
  },
})

if (!result.success) {
  console.error('[build-userscript] Build failed:')
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

const code = await result.outputs[0].text()
const userscript = header + '\n' + code

const outPath = path.join(DIST, 'taut.user.js')
await Bun.write(outPath, userscript)
console.log(
  `[build-userscript] dist/taut.user.js: ${(Buffer.byteLength(userscript) / 1024).toFixed(1)} KB`
)
console.log('[build-userscript] Done!')
