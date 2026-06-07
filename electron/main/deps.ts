// Taut Main Process Dependencies
// NPM dependencies bundled into deps/ by Bun for use in the main process
// Provides esbuild (WASM) and React DevTools installer

import * as esbuild from 'esbuild-wasm/lib/browser.js'
import resolve from 'resolve'
import path from 'node:path'
import fs from 'node:fs'
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer'

const defaultLoader: Record<string, esbuild.Loader | undefined> = {
  '.ts': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.tsx': 'tsx',
  '.jsx': 'jsx',
  '.json': 'json',
  '.txt': 'text',
  '.css': 'text',
}

/**
 * Initialize esbuild-wasm with the given wasm file path
 * @param wasmPath - path to the esbuild.wasm file
 */
export async function initEsbuild(wasmPath: string) {
  const wasmFile = await fs.promises.readFile(wasmPath)
  await esbuild.initialize({
    wasmModule: new WebAssembly.Module(new Uint8Array(wasmFile)),
    worker: false,
  })
}

/**
 * Bundle an entry file and return an IIFE expression
 * Uses esbuild-wasm
 *
 * @param entryPath - path to the entry file (ts or js)
 * @param useGlobalTautPlugin - if true, resolves `$taut` imports to globalThis.TautPlugin
 * @returns the generated IIFE expression
 */
export async function bundle(
  entryPath: string,
  useGlobalTautPlugin = false
): Promise<string> {
  const absEntry = path.resolve(entryPath)

  const result = await esbuild.build({
    entryPoints: [absEntry],
    bundle: true,
    format: 'iife',
    globalName: 'output',
    write: false,
    sourcemap: false,
    treeShaking: true,
    legalComments: 'none',
    platform: 'browser',
    plugins: [
      {
        name: 'load-plugin',
        setup(build) {
          if (useGlobalTautPlugin) {
            build.onResolve({ filter: /^\$taut$/ }, () => ({
              path: '$taut',
              namespace: 'taut-global',
            }))
            build.onLoad({ filter: /.*/, namespace: 'taut-global' }, () => ({
              contents: `
                  export const TautPlugin = globalThis.TautPlugin
                  export default TautPlugin
                `,
              loader: 'js' as const,
            }))
          }

          build.onResolve({ filter: /.*/ }, async (args) => {
            try {
              const resolvedPath = await new Promise<string>((r, reject) => {
                resolve(
                  args.path,
                  {
                    basedir:
                      args.resolveDir ||
                      (args.importer ? path.dirname(args.importer) : undefined),
                    extensions: Object.keys(defaultLoader),
                    includeCoreModules: false,
                    preserveSymlinks: false,
                  },
                  (err, res) => {
                    if (err) return reject(err)
                    if (!res)
                      return reject(
                        new Error(`Could not resolve module: ${args.path}`)
                      )
                    r(res)
                  }
                )
              })

              return { path: resolvedPath, namespace: 'local-fs' }
            } catch (err) {
              console.error(
                `[Taut] Failed to resolve module "${args.path}" in esbuild onResolve hook:`,
                err
              )
              return null // Log failure and let esbuild handle resolution (or report its own error)
            }
          })

          build.onLoad(
            { filter: /.*/, namespace: 'local-fs' },
            async (args) => {
              const contents = await fs.promises.readFile(args.path, 'utf-8')
              return {
                contents,
                loader: defaultLoader[path.extname(args.path)] || 'text',
              }
            }
          )
        },
      },
    ],
  })

  if (!result.outputFiles || result.outputFiles.length === 0) {
    throw new Error('no output produced')
  }

  const code = result.outputFiles[0].text
    .replace(/^(["']use strict["'];?\n?)?var output = /, '')
    .replace(/;?\s*$/, '')
    .trim()

  return code
}

export async function stopEsbuild() {
  await esbuild.stop()
}

export async function installReactDevtools() {
  await installExtension(REACT_DEVELOPER_TOOLS)
}
