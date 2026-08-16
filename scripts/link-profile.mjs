#!/usr/bin/env node
/**
 * dsh-dsov-plugin — 构建并链接到指定 DSH profile（默认 web）。
 *
 * 等价于 dsh-web-ui 的本地 link 部署流程：
 *   1) 先执行构建（scripts/build.mjs），确保 lib/ 存在；
 *   2) 调用 `dsh plugin --profile <profile> add link:<本仓库绝对路径>`
 *      （底层转发给 pnpm，把本包以 link: 依赖装入 profile 的 node_modules，
 *       bundle patch（cordis.patch.yml）随包自动生效）；
 *   3) 提示重启 dsh 使配置生效。
 *
 * 回退：当 profile 的 pnpm 供应链策略（minimumReleaseAge）冻结 lockfile、导致
 * `dsh plugin add` 失败时，自动降级为等价的手工 link（无需 pnpm）：
 *   - 在 profile package.json 的 dependencies 写入 `"<name>": "link:<repo>"`；
 *   - 在 dsh.profile.bundles 末尾追加 `<name>`（bundle patch 随 boot 生效）；
 *   - 为 node_modules/<name> 创建指向仓库的 junction（Windows）/ 符号链接（POSIX）。
 *   （profile 默认 nodeLinker: hoisted，junction 可被 require.resolve 正常解析。）
 *
 * 用法：
 *   node scripts/link-profile.mjs                    # 构建 + 链接到 profile "web"
 *   node scripts/link-profile.mjs --profile tui      # 链接到其它 profile
 *   node scripts/link-profile.mjs --skip-build       # 跳过构建（lib/ 已存在）
 *   node scripts/link-profile.mjs --unlink           # 从 profile 卸载本插件
 *
 * 兼容 Windows：路径统一转为正斜杠传给 pnpm link: 协议；dsh 命令经 shell 调用。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)

const argValue = (name, fallback) => {
  const i = argv.indexOf(name)
  return i !== -1 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}
const profile = argValue('--profile', 'web')
const skipBuild = argv.includes('--skip-build')
const unlink = argv.includes('--unlink')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const pkgName = pkg.name
const repoPath = root.replaceAll('\\', '/')
const repoPathNative = root

const profileDir = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', profile)
const profilePkgPath = join(profileDir, 'package.json')
const linkPath = join(profileDir, 'node_modules', ...pkgName.split('/'))

/** 手工 link 安装（pnpm 策略冻结时的等价回退）。 */
function manualLink() {
  console.log(`[link-profile] fallback: manual link into ${profileDir}`)
  const pkgJson = JSON.parse(readFileSync(profilePkgPath, 'utf8'))
  pkgJson.dependencies = pkgJson.dependencies || {}
  pkgJson.dependencies[pkgName] = `link:${repoPath}`
  const bundles = (pkgJson.dsh && pkgJson.dsh.profile && pkgJson.dsh.profile.bundles) || []
  if (!bundles.includes(pkgName)) bundles.push(pkgName)
  pkgJson.dsh = pkgJson.dsh || {}
  pkgJson.dsh.profile = pkgJson.dsh.profile || {}
  pkgJson.dsh.profile.bundles = bundles
  writeFileSync(profilePkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`)
  if (!existsSync(linkPath)) {
    mkdirSync(dirname(linkPath), { recursive: true })
    symlinkSync(repoPathNative, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
  }
  const ok = existsSync(join(linkPath, 'package.json')) && existsSync(join(linkPath, 'lib', 'client.js'))
  if (!ok) {
    console.error('[link-profile] manual link incomplete: package.json or lib/client.js not resolvable')
    process.exit(1)
  }
  console.log(`[link-profile] manual link done: ${linkPath}`)
  console.log(`[link-profile]   bundles: ${pkgJson.dsh.profile.bundles.join(', ')}`)
}

/** 手工卸载（与 manualLink 对应）。 */
function manualUnlink() {
  if (!existsSync(profilePkgPath)) return false
  const pkgJson = JSON.parse(readFileSync(profilePkgPath, 'utf8'))
  let changed = false
  if (pkgJson.dependencies && pkgJson.dependencies[pkgName]) {
    delete pkgJson.dependencies[pkgName]
    changed = true
  }
  const bundles = pkgJson.dsh && pkgJson.dsh.profile && pkgJson.dsh.profile.bundles
  if (bundles && bundles.includes(pkgName)) {
    pkgJson.dsh.profile.bundles = bundles.filter((b) => b !== pkgName)
    changed = true
  }
  if (changed) writeFileSync(profilePkgPath, `${JSON.stringify(pkgJson, null, 2)}\n`)
  if (existsSync(linkPath)) {
    // junction 用 rmdir 删除（不是文件删除）；POSIX 符号链接用 unlink
    execFileSync('rmdir', [linkPath], { shell: process.platform === 'win32' })
    changed = true
  }
  return changed
}

const runDsh = (args) =>
  execFileSync('dsh', args, { stdio: 'inherit', shell: process.platform === 'win32' })

/** 捕获输出的 dsh 调用：返回 { ok, text }（text 含 stdout+stderr+message，用于策略检测）。 */
const runDshCapture = (args) => {
  try {
    const out = execFileSync('dsh', args, { encoding: 'utf8', shell: process.platform === 'win32' })
    process.stdout.write(String(out))
    return { ok: true, text: String(out) }
  } catch (e) {
    const text = [
      e && e.stdout ? String(e.stdout) : '',
      e && e.stderr ? String(e.stderr) : '',
      e && e.message ? String(e.message) : '',
    ].join('\n')
    process.stdout.write(text)
    return { ok: false, text }
  }
}

if (unlink) {
  const cmd = `dsh plugin --profile ${profile} remove ${pkgName}`
  console.log(`[link-profile] ${cmd}`)
  let removed = false
  try {
    runDsh(['plugin', '--profile', profile, 'remove', pkgName])
    removed = true
  } catch (e) {
    removed = manualUnlink()
  }
  if (removed) {
    console.log(`[link-profile] done. Restart dsh web:  dsh --profile ${profile}`)
  } else {
    console.error('[link-profile] remove failed (dsh 与 manual 均未成功)')
    process.exit(1)
  }
  process.exit(0)
}

if (!skipBuild) {
  console.log('[link-profile] building first…')
  execFileSync(process.execPath, [resolve(root, 'scripts/build.mjs')], { stdio: 'inherit' })
}

const spec = `link:${repoPath}`
const cmd = `dsh plugin --profile ${profile} add ${spec}`
console.log(`[link-profile] ${cmd}`)
const addRes = runDshCapture(['plugin', '--profile', profile, 'add', spec])
if (addRes.ok) {
  console.log('[link-profile] done. Restart dsh web so the bundle patch takes effect:')
  console.log(`[link-profile]   dsh --profile ${profile}`)
} else {
  const policyBlocked = /pnpm failed|MINIMUM_RELEASE_AGE|Lockfile failed|supply-chain/i.test(addRes.text)
  if (policyBlocked && existsSync(profilePkgPath)) {
    console.warn('[link-profile] pnpm 供应链策略拦截（profile 的 lockfile 被冻结，与插件无关），降级为手工 link：')
    manualLink()
    console.log('[link-profile] done (fallback). Restart dsh web so the bundle patch takes effect:')
    console.log(`[link-profile]   dsh --profile ${profile}`)
  } else {
    console.error('[link-profile] `dsh plugin add` failed（非策略原因）')
    console.error('[link-profile] 请确认 dsh 已全局安装（npm i -g @deepseek-ai/dsh），或手动执行上面的命令。')
    process.exit(1)
  }
}
