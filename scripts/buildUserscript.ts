#!/usr/bin/env bun

// Taut Userscript Build Script
// Bundles all plugins and the userscript entry point into a single .user.js file

import path from 'path'
import fs from 'fs'

if (!('Bun' in globalThis)) {
  console.error('This script must be run with Bun.')
  process.exit(1)
}

const ROOT = path.join(import.meta.dir, '..')
const PLUGINS_DIR = path.join(ROOT, 'plugins')
const OUTPUT_FILE = path.join(ROOT, 'dist', 'taut.user.js')
const DEBUG_OUTPUT_FILE = path.join(ROOT, 'dist', 'taut.debug.user.js')

const globalPluginShim = {
  name: 'global-plugin-shim',
  setup(build: any) {
    build.onLoad({ filter: /core\/Plugin\.ts$/ }, () => {
      return {
        contents: `
          export const TautPlugin = globalThis.TautPlugin
          export default TautPlugin
        `,
        loader: 'js',
      }
    })
  },
}

console.log('[build-userscript] Starting userscript build...')

async function bundlePlugins(debug = false): Promise<Record<string, string>> {
  const plugins: Record<string, string> = {}
  const pluginFiles = fs
    .readdirSync(PLUGINS_DIR)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

  for (const file of pluginFiles) {
    const name = path.basename(file, path.extname(file))
    console.log(`[build-userscript] Bundling plugin: ${name}`)

    const result = await Bun.build({
      entrypoints: [path.join(PLUGINS_DIR, file)],
      target: 'browser',
      format: 'esm',
      minify: debug ? false : true,
      sourcemap: debug ? 'inline' : 'none',
      plugins: [globalPluginShim],
      define: {
        process: 'undefined',
      },
    })

    if (!result.success) {
      console.error(
        `[build-userscript] Failed to bundle plugin ${name}:`,
        result.logs
      )
      continue
    }

    let code = await result.outputs[0].text()

    // Wrap in IIFE and convert export to return
    code = '(() => {\n' + code + '\n})()'
    code = code.replace(
      /export\s*{\s*(\w+)\s+as\s+default\s*};?/g,
      'return $1;'
    )
    code = code.replace(/export\s+default\s+(\w+);?/g, 'return $1;')

    plugins[name] = code
  }

  return plugins
}

async function bundleRenderer(
  plugins: Record<string, string>,
  debug = false
): Promise<string> {
  console.log('[build-userscript] Bundling renderer code...')

  const result = await Bun.build({
    entrypoints: [path.join(ROOT, 'core', 'renderer', 'main.ts')],
    target: 'browser',
    format: 'iife',
    minify: debug ? false : true,
    sourcemap: debug ? 'inline' : 'none',
    define: {
      'process': 'undefined',
      'import.meta.url': 'self.location.href',
    },
    banner: '// Taut injected renderer code',
  })

  if (!result.success) {
    console.error('[build-userscript] Failed to bundle renderer:', result.logs)
    process.exit(1)
  }

  return await result.outputs[0].text()
}

async function buildUserscript(
  rendererCode: string,
  plugins: Record<string, string>,
  header: string,
  debug = false
): Promise<string> {
  console.log('[build-userscript] Bundling userscript entry...')

  const defaultConfig = await Bun.file(
    path.join(ROOT, 'cli', 'default-config.jsonc')
  ).text()
  const defaultUserCss = await Bun.file(
    path.join(ROOT, 'cli', 'default-user.css')
  ).text()

  const result = await Bun.build({
    entrypoints: [path.join(ROOT, 'core', 'userscript', 'main.ts')],
    target: 'browser',
    format: 'iife',
    minify: debug ? false : true,
    sourcemap: debug ? 'inline' : 'none',
    define: {
      '__TAUT_RENDERER_CODE__': JSON.stringify(rendererCode),
      '__TAUT_BUNDLED_PLUGINS__': JSON.stringify(plugins),
      '__TAUT_DEFAULT_CONFIG__': JSON.stringify(defaultConfig),
      '__TAUT_DEFAULT_USER_CSS__': JSON.stringify(defaultUserCss),
      'process': 'undefined',
      'import.meta.url': 'self.location.href',
    },
    banner: header,
  })

  if (!result.success) {
    console.error(
      '[build-userscript] Failed to bundle userscript:',
      result.logs
    )
    process.exit(1)
  }

  return await result.outputs[0].text()
}

async function makeUserscript(debug = false) {
  console.log('[build-userscript] Creating userscript (debug=', debug, ')')

  const plugins = await bundlePlugins(debug)
  console.log(
    `[build-userscript] Bundled ${Object.keys(plugins).length} plugins`
  )

  const rendererCode = await bundleRenderer(plugins, debug)
  console.log(
    `[build-userscript] Renderer size: ${(Buffer.byteLength(rendererCode) / 1024).toFixed(1)} KB`
  )

  const userscriptHeaderTemplate = await Bun.file(
    path.join(ROOT, 'core', 'userscript', 'header.ts')
  ).text()
  const version = (await Bun.file('package.json').json()).version
  const userscriptHeader = userscriptHeaderTemplate
    .replace('$VERSION', version)
    .replace('$DESCRIPTION_SUFFIX', debug ? ' (debug build)' : '')

  const userscriptCode = await buildUserscript(
    rendererCode,
    plugins,
    userscriptHeader,
    debug
  )

  const outputFile = debug ? DEBUG_OUTPUT_FILE : OUTPUT_FILE
  await Bun.write(outputFile, userscriptCode)

  console.log(`[build-userscript] Output written to ${outputFile}`)
  console.log(
    `[build-userscript] Size: ${(Buffer.byteLength(userscriptCode) / 1024).toFixed(1)} KB`
  )
}

makeUserscript(false)
makeUserscript(true)
