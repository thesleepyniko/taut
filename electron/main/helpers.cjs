// Taut Main Process Helpers
// Shared utilities and path constants for the main process modules

const { promises: fs } = require('fs')
const path = require('path')

/** @type {typeof import('./deps')} */
const deps = require('./deps/deps.bundle.js')
const { initEsbuild } = deps

/**
 * Deep equality for JSON-serializable values
 * @param {unknown} left - first value to compare
 * @param {unknown} right - second value to compare
 * @returns {boolean} true if values are deeply equal
 */
function deepEqual(left, right) {
  if (left === right) return true
  if (Number.isNaN(left) && Number.isNaN(right)) return true
  if (left == null || right == null) return false
  if (typeof left !== typeof right) return false
  if (typeof left !== 'object') return left === right

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false
    for (let i = 0; i < left.length; i++) {
      if (!deepEqual(left[i], right[i])) return false
    }
    return true
  }
  if (Array.isArray(left) !== Array.isArray(right)) return false

  let keyCount = 0
  for (const key in left) {
    if (Object.prototype.hasOwnProperty.call(left, key)) {
      keyCount++
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false
      // @ts-ignore
      if (!deepEqual(left[key], right[key])) return false
    }
  }
  return Object.keys(right).length === keyCount
}

/**
 * Check if a path exists without throwing an exception
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const TAUT_DIR = path.join(__dirname, '..', '..')

const paths = {
  tautDir: TAUT_DIR,
  plugins: path.join(TAUT_DIR, 'plugins'),
  userPlugins: path.join(TAUT_DIR, 'user-plugins'),
  config: path.join(TAUT_DIR, 'config.jsonc'),
  userCss: path.join(TAUT_DIR, 'user.css'),
  esbuildWasm: path.join(TAUT_DIR, 'electron', 'main', 'deps', 'esbuild.wasm'),
  preloadJs: path.join(TAUT_DIR, 'electron', 'preload', 'preload.js'),
  renderJs: path.join(TAUT_DIR, 'app', 'main.ts'),
}

// calculate a display path relative to ~ or %appdata%
const displayPathPrefix =
  process.platform === 'win32'
    ? process.env.APPDATA || null
    : process.env.HOME || null
const displayPathReplacement = process.platform === 'win32' ? '%appdata%' : '~'

/** @param {string} fullPath */
const displayPath = (fullPath) => {
  if (!displayPathPrefix) return fullPath
  return path.join(
    displayPathReplacement,
    path.relative(displayPathPrefix, fullPath)
  )
}

/**
 * Build a paths object with display-friendly paths
 * @param {typeof paths} sourcePaths
 * @returns {typeof paths}
 */
function buildDisplayPaths(sourcePaths) {
  /** @type {Record<string, string>} */
  const result = {}
  for (const key of Object.keys(sourcePaths)) {
    // @ts-ignore - index access is safe for this mapping
    result[key] = displayPath(sourcePaths[key])
  }
  return /** @type {typeof paths} */ (result)
}

const PATHS = {
  ...paths,
  display: buildDisplayPaths(paths),
}

const esbuildInitialized = initEsbuild(PATHS.esbuildWasm)

module.exports = {
  deepEqual,
  fileExists,
  PATHS,
  esbuildInitialized,
}
