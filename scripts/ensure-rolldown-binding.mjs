/**
 * Work around npm optional-dependency bugs (https://github.com/npm/cli/issues/4828).
 * Vite 8 bundles Rolldown, which needs a platform-specific @rolldown/binding-* package.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))

const MIN_NODE = [20, 19, 0]

const BINDING_BY_PLATFORM = {
  'android-arm': '@rolldown/binding-android-arm-eabi',
  'android-arm64': '@rolldown/binding-android-arm64',
  'darwin-arm64': '@rolldown/binding-darwin-arm64',
  'darwin-x64': '@rolldown/binding-darwin-x64',
  'freebsd-x64': '@rolldown/binding-freebsd-x64',
  'linux-arm': '@rolldown/binding-linux-arm-gnueabihf',
  'linux-arm64': '@rolldown/binding-linux-arm64-gnu',
  'linux-ppc64': '@rolldown/binding-linux-ppc64-gnu',
  'linux-s390x': '@rolldown/binding-linux-s390x-gnu',
  'linux-x64': '@rolldown/binding-linux-x64-gnu',
  'openharmony-arm64': '@rolldown/binding-openharmony-arm64',
  'win32-arm64': '@rolldown/binding-win32-arm64-msvc',
  'win32-x64': '@rolldown/binding-win32-x64-msvc',
}

function parseNodeVersion(versionString) {
  const [major, minor, patch] = versionString.replace(/^v/, '').split('.').map(Number)
  return [major, minor, patch ?? 0]
}

function isNodeVersionAtLeast(current, minimum) {
  for (let i = 0; i < 3; i += 1) {
    if (current[i] > minimum[i]) return true
    if (current[i] < minimum[i]) return false
  }
  return true
}

const nodeVersion = parseNodeVersion(process.version)
if (!isNodeVersionAtLeast(nodeVersion, MIN_NODE)) {
  console.error(
    `\nThis project requires Node.js ${MIN_NODE.join('.')} or newer (Vite 8 / Rolldown).\n` +
      `You are on ${process.version}.\n\n` +
      'Upgrade Node, then reinstall:\n' +
      '  nvm install   # uses .nvmrc (20.19)\n' +
      '  nvm use\n' +
      '  rm -rf node_modules package-lock.json   # or Remove-Item on Windows\n' +
      '  npm install\n',
  )
  process.exit(1)
}

const bindingPackage =
  BINDING_BY_PLATFORM[`${process.platform}-${process.arch}`]
if (!bindingPackage) {
  process.exit(0)
}

function bindingInstalled() {
  try {
    require.resolve(bindingPackage)
    return true
  } catch {
    return false
  }
}

if (bindingInstalled()) {
  process.exit(0)
}

const rolldownPkgPath = join(root, 'node_modules', 'rolldown', 'package.json')
if (!existsSync(rolldownPkgPath)) {
  process.exit(0)
}

const rolldownVersion = JSON.parse(readFileSync(rolldownPkgPath, 'utf8')).version
const spec = `${bindingPackage}@${rolldownVersion}`

console.warn(`[postinstall] Installing missing Rolldown native binding: ${spec}`)
execSync(`npm install --no-save --include=optional ${spec}`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, npm_config_include: 'optional' },
})

if (!bindingInstalled()) {
  console.error(
    `[postinstall] Failed to install ${bindingPackage}.\n` +
      'Remove node_modules and package-lock.json, then run npm install again.\n' +
      'Do not use npm install --omit=optional.',
  )
  process.exit(1)
}
