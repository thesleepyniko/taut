#!/usr/bin/env bun

// Taut Build Script
// Builds main process dependencies (esbuild-wasm) for Electron
// Monaco and jsonc-parser are loaded from CDN at runtime

import path from 'path'

if (!('Bun' in globalThis)) {
  console.error('This script must be run with Bun.')
  process.exit(1)
}

// Build main process dependencies (esbuild-wasm, resolve, electron-devtools-installer)
console.log('[build-main] Bundling main dependencies...')
const mainResult = await Bun.build({
  entrypoints: [
    path.join(import.meta.dir, '..', 'electron', 'main', 'deps.ts'),
  ],
  outdir: path.join(import.meta.dir, '..', 'electron', 'main', 'deps'),
  naming: 'deps.bundle.js',
  target: 'node',
  format: 'cjs',
  external: ['electron'],
  banner: '// @ts-nocheck',
})

if (!mainResult.success) {
  console.error('[build-main] Build failed:', mainResult.logs)
  process.exit(1)
}

console.log('[build-main] Copying esbuild.wasm...')
try {
  const wasmSrc = path.join(
    import.meta.dir,
    '..',
    'node_modules',
    'esbuild-wasm',
    'esbuild.wasm'
  )
  const wasmDest = path.join(
    import.meta.dir,
    '..',
    'electron',
    'main',
    'deps',
    'esbuild.wasm'
  )
  await Bun.write(wasmDest, Bun.file(wasmSrc))
} catch (e) {
  console.error('[build-main] Failed to copy esbuild.wasm:', e)
  process.exit(1)
}

console.log('[build-main] Done!')
