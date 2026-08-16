/**
 * dsh-dsov-plugin — Client half body.
 *
 * 本文件被 scripts/build.mjs 包装为 web 端 module-loader 包
 * （window.__ModuleLoader__.load），运行环境为 DSH Web GUI（浏览器）。
 * 注意：此文件是纯函数体代码 —— 不使用 import/export，`React` 由构建包装层
 * 以 require('react') 注入，`ctx` 来自插件 apply(ctx)。
 *
 * 功能：
 *  1) 右侧侧边栏首位【概览】标签（注入 aionui-panel 原生 tab 栏）：
 *     上下文窗口 / 会话指标（1 秒刷新、任务活跃计时）/ 用量分析（智能单/双模型渲染），
 *     全界面跟随 DSH 主题自动适配浅色/深色；
 *  2) 设置页【DeepSeek 开放平台】：点击唤起系统默认浏览器打开 platform.deepseek.com。
 */

const DSOV_CSS = [
  '.dsov-tab-btn{height:28px;padding:0 8px;border:none;border-radius:2px;background:transparent;color:var(--aion-text-secondary);font-size:13px;font-family:var(--aion-font-sans);cursor:pointer;white-space:nowrap;transition:background-color .15s cubic-bezier(.4,0,.2,1)}',
  '.dsov-tab-btn:hover{background:var(--aion-fill-2)}',
  '.dsov-tab-btn:active{background:var(--aion-bg-active)}',
  '.dsov-tab-btn:focus-visible{outline:2px solid var(--aion-primary);outline-offset:2px}',
  '.dsov-tab-btn.dsov-tab-active{background:var(--aion-bg-2);color:var(--aion-text-primary);font-weight:500}',
  '.dsov-overview-pane{display:none;flex:1;min-height:0;overflow-y:auto;padding:8px 8px 16px 10px}',
  '.aionui-root.dsov-overview-active>.dsov-overview-pane{display:flex;flex-direction:column;gap:8px}',
  '.aionui-root.dsov-overview-active>div:nth-child(n+3){display:none !important}',
  '.dsov-card{background:var(--aion-bg-2);border:1px solid var(--aion-bg-3);border-radius:8px;padding:10px 12px}',
  '.dsov-card-title{font-size:12px;font-weight:600;color:var(--aion-text-primary);margin-bottom:8px}',
  '.dsov-card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
  '.dsov-card-head .dsov-card-title{margin-bottom:0}',
  '.dsov-ctx-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
  '.dsov-pill{display:inline-flex;align-items:center;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;line-height:1.5}',
  '.dsov-pill-ok{background:color-mix(in srgb, var(--aion-success) 16%, transparent);color:var(--aion-success)}',
  '.dsov-pill-tight{background:color-mix(in srgb, var(--aion-warning) 16%, transparent);color:var(--aion-warning)}',
  '.dsov-pill-overload{background:color-mix(in srgb, var(--aion-danger) 16%, transparent);color:var(--aion-danger)}',
  '.dsov-ctx-ratio{font-size:12px;font-weight:600;color:var(--aion-text-primary);font-family:var(--aion-font-mono)}',
  '.dsov-bar{display:flex;height:8px;border-radius:4px;background:var(--aion-bg-3);overflow:hidden;margin:6px 0;position:relative}',
  '.dsov-bar-fill{height:100%;border-radius:4px;transition:width .3s}',
  '.dsov-ctx-marker{position:absolute;top:-3px;bottom:-3px;left:80%;width:2px;background:var(--aion-warning);border-radius:1px;z-index:2;opacity:.9}',
  '.dsov-ctx-foot{display:flex;justify-content:space-between;font-size:11px;color:var(--aion-text-secondary)}',
  '.dsov-ctx-foot b{color:var(--aion-text-primary);font-weight:600;font-family:var(--aion-font-mono)}',
  '.dsov-fill-ok{background:var(--aion-success)}',
  '.dsov-fill-tight{background:var(--aion-warning)}',
  '.dsov-fill-overload{background:var(--aion-danger)}',
  '.dsov-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px}',
  '.dsov-metric{display:flex;flex-direction:column;gap:3px;padding:6px 0;border-bottom:1px dashed var(--aion-bg-3)}',
  '.dsov-metric-name{font-size:11px;color:var(--aion-text-secondary)}',
  '.dsov-metric-val{font-size:16px;font-weight:700;color:var(--aion-text-primary);font-family:var(--aion-font-mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dsov-source-title{font-size:11px;color:var(--aion-text-secondary);margin-bottom:2px}',
  '.dsov-source-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--aion-text-secondary)}',
  '.dsov-source-legend b{color:var(--aion-text-primary);font-weight:600;font-family:var(--aion-font-mono)}',
  '.dsov-legend-item::before{content:" ";display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
  '.dsov-legend-flash::before{background:var(--aion-primary)}',
  '.dsov-legend-pro::before{background:#8b5cf6}',
  '.dsov-model{margin-top:8px;border-top:1px dashed var(--aion-bg-3);padding-top:8px}',
  '.dsov-model-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
  '.dsov-model-name{font-size:12px;font-weight:600;color:var(--aion-text-primary)}',
  '.dsov-model-req{font-size:11px;color:var(--aion-text-secondary)}',
  '.dsov-model-summary{display:flex;gap:8px;font-size:11px;color:var(--aion-text-secondary);margin-bottom:6px;flex-wrap:wrap}',
  '.dsov-model-summary b,.dsov-model-req b,.dsov-io-label b,.dsov-hit-label b{color:var(--aion-text-primary);font-weight:600;font-family:var(--aion-font-mono)}',
  '.dsov-detail-toggle{background:transparent;border:none;color:var(--aion-text-tertiary);font-size:11px;cursor:pointer;padding:2px 0;margin:2px 0}',
  '.dsov-detail-toggle:hover{color:var(--aion-text-primary)}',
  '.dsov-model-detail{display:none}',
  '.dsov-model.dsov-open .dsov-model-detail{display:block}',
  '.dsov-io-label,.dsov-hit-label{display:flex;justify-content:space-between;font-size:11px;color:var(--aion-text-secondary);margin-bottom:6px}',
  '.dsov-model-text{margin-top:6px;display:flex;flex-direction:column;gap:3px}',
  '.dsov-txt-row{font-size:11px;color:var(--aion-text-secondary)}',
  '.dsov-txt-row b{color:var(--aion-text-primary);font-weight:600;font-family:var(--aion-font-mono)}',
  '.dsov-model-hint{font-size:11px;color:var(--aion-text-tertiary);padding:6px 0}',
  '.dsov-bar-fill[data-c=io-in]{background:var(--aion-primary)}',
  '.dsov-bar-fill[data-c=io-out]{background:var(--aion-aou-5)}',
  '.dsov-bar-fill[data-c=hit]{background:var(--aion-success)}',
  '.dsov-bar-fill[data-c=miss]{background:var(--aion-warning)}',
  '.dsov-bar-fill[data-c=flash]{background:var(--aion-primary)}',
  '.dsov-bar-fill[data-c=pro]{background:#8b5cf6}',
  '.dsov-overview-pane::-webkit-scrollbar{width:8px}',
  '.dsov-overview-pane::-webkit-scrollbar-thumb{background:var(--aion-bg-3);border-radius:4px}',
  '.dsov-overview-pane::-webkit-scrollbar-track{background:transparent}',
].join('')

// ── 格式化工具 ──
const fmtInt = (n) => (Number(n) || 0).toLocaleString('en-US')
const fmtMoney = (n) => {
  const v = Number(n) || 0
  return '¥' + (v >= 1 ? v.toFixed(2) : v.toFixed(4))
}
const fmtPct = (x) => ((Number(x) || 0) * 100).toFixed(1) + '%'
const fmtDur = (ms) => {
  const s = Math.floor((Number(ms) || 0) / 1000)
  const p = (x) => String(x).padStart(2, '0')
  return p(Math.floor(s / 3600)) + ':' + p(Math.floor((s % 3600) / 60)) + ':' + p(s % 60)
}
const fmtK = (n) => {
  const v = Number(n) || 0
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(v))
}

// ── 最小外部 store（React useSyncExternalStore 兼容）──
function createStore(initial) {
  let state = initial
  const listeners = new Set()
  return {
    get: () => state,
    set(fn) {
      const next = typeof fn === 'function' ? fn(state) : fn
      if (next === state) return
      state = next
      for (const l of listeners) l()
    },
    subscribe(l) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
  }
}

// ── 概览数据：POST /dsov/overview（host webServer 路由，JSON 信封）──
async function fetchOverview(sessionId) {
  try {
    const res = await fetch('/dsov/overview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    const envelope = await res.json()
    return envelope && envelope.ok === true ? envelope.value : null
  } catch (e) {
    return null
  }
}

// ── 设置页：【DeepSeek 开放平台】 —— 点击左侧导航项直接唤起系统默认浏览器 ──
// 主交互：apply() 内 attachNavInterceptors() 在导航项元素上挂捕获阶段点击拦截，
// 直接 window.open 并阻止 shell 打开该 section（不渲染主体过渡页）。
// 兜底：若主体区域仍被渲染（例如拦截未生效），挂载即唤起浏览器并调用 props.close()
// 关闭设置面板，页面依然不会停留在过渡页上。
function SettingsPage(props) {
  React.useEffect(() => {
    try {
      window.open('https://platform.deepseek.com', '_blank', 'noopener')
    } catch (e) {
      /* noop */
    }
    try {
      if (props && typeof props.close === 'function') props.close()
    } catch (e) {
      /* noop */
    }
  }, [])
  return null
}

const inject = ['sessions']

function apply(ctx) {
  // 全部 UI 装配放在单个 effect 内（StrictMode 安全：清理与装配一一对应）
  ctx.effect(
    () => {
      const ROOT_SELECTOR = '[data-aionui-explorer-col] .aionui-root'
      let rootEl = null
      let tabBarEl = null
      let tabBtnEl = null
      let paneEl = null
      let injected = false
      let foldFlash = true
      let foldPro = true
      let styleTag = null

      const overviewStore = createStore({ active: false, sessionId: '', data: null, error: null })

      const mk = (tag, cls, text) => {
        const el = document.createElement(tag)
        if (cls) el.className = cls
        if (text !== undefined && text !== null) el.textContent = text
        return el
      }
      const num = (key) => {
        const b = mk('b')
        b.setAttribute('data-k', key)
        b.textContent = '0'
        return b
      }

      // —— 用量分析：单个模型区块（样式与折叠功能固定）——
      const buildModelBlock = (title, key, foldRef) => {
        const block = mk('div', 'dsov-model' + (foldRef ? ' dsov-open' : ''))
        const head = mk('div', 'dsov-model-head')
        head.appendChild(mk('span', 'dsov-model-name', title))
        const req = mk('span', 'dsov-model-req')
        req.appendChild(document.createTextNode('请求 '))
        req.appendChild(num(key + '.req'))
        req.appendChild(document.createTextNode(' 次'))
        head.appendChild(req)
        block.appendChild(head)
        const summary = mk('div', 'dsov-model-summary')
        const kv = (label, k2) => {
          const sp = mk('span')
          sp.appendChild(document.createTextNode(label))
          sp.appendChild(num(k2))
          return sp
        }
        summary.appendChild(kv('总计 Token ', key + '.tokens'))
        summary.appendChild(kv('缓存命中率 ', key + '.hitRate'))
        summary.appendChild(kv('累计费用 ', key + '.cost'))
        block.appendChild(summary)
        const dt = mk('button', 'dsov-detail-toggle')
        dt.type = 'button'
        dt.setAttribute('data-fold', key)
        dt.appendChild(document.createTextNode('▾ 明细'))
        block.appendChild(dt)
        const detail = mk('div', 'dsov-model-detail')
        // 输入/输出占比进度条
        const ioBar = mk('div', 'dsov-bar')
        const ioIn = mk('div', 'dsov-bar-fill')
        ioIn.setAttribute('data-k', key + '.ioIn')
        ioIn.setAttribute('data-c', 'io-in')
        const ioOut = mk('div', 'dsov-bar-fill')
        ioOut.setAttribute('data-k', key + '.ioOut')
        ioOut.setAttribute('data-c', 'io-out')
        ioBar.appendChild(ioIn)
        ioBar.appendChild(ioOut)
        detail.appendChild(ioBar)
        const ioLabel = mk('div', 'dsov-io-label')
        const ioL = mk('span')
        ioL.appendChild(document.createTextNode('输入 '))
        ioL.appendChild(num(key + '.ioPct'))
        const outL = mk('span')
        outL.appendChild(document.createTextNode('输出 '))
        outL.appendChild(num(key + '.outPct'))
        ioLabel.appendChild(ioL)
        ioLabel.appendChild(outL)
        detail.appendChild(ioLabel)
        // 缓存命中/未命中占比进度条
        const hitBar = mk('div', 'dsov-bar')
        const hitF = mk('div', 'dsov-bar-fill')
        hitF.setAttribute('data-k', key + '.hitFill')
        hitF.setAttribute('data-c', 'hit')
        const missF = mk('div', 'dsov-bar-fill')
        missF.setAttribute('data-k', key + '.missFill')
        missF.setAttribute('data-c', 'miss')
        hitBar.appendChild(hitF)
        hitBar.appendChild(missF)
        detail.appendChild(hitBar)
        const hitLabel = mk('div', 'dsov-hit-label')
        const hitL = mk('span')
        hitL.appendChild(document.createTextNode('命中 '))
        hitL.appendChild(num(key + '.hitPct'))
        const missL = mk('span')
        missL.appendChild(document.createTextNode('未命中 '))
        missL.appendChild(num(key + '.missPct'))
        hitLabel.appendChild(hitL)
        hitLabel.appendChild(missL)
        detail.appendChild(hitLabel)
        // 文本明细（分区展示）
        const txt = mk('div', 'dsov-model-text')
        txt.appendChild(mk('div', 'dsov-txt-row', '输入总量：'))
        txt.lastChild.appendChild(num(key + '.inputTotal'))
        txt.appendChild(mk('div', 'dsov-txt-row', '输出总量：'))
        txt.lastChild.appendChild(num(key + '.output'))
        txt.appendChild(mk('div', 'dsov-txt-row', '输入命中缓存 Token：'))
        txt.lastChild.appendChild(num(key + '.inputHit'))
        txt.appendChild(mk('div', 'dsov-txt-row', '输入未命中缓存 Token：'))
        txt.lastChild.appendChild(num(key + '.inputMiss'))
        detail.appendChild(txt)
        block.appendChild(detail)
        return block
      }

      // —— 概览页三卡片 ——
      const buildPane = () => {
        const pane = mk('div', 'dsov-overview-pane')
        pane.setAttribute('data-dsov-pane', '1')
        // 卡片 1：上下文窗口
        const c1 = mk('div', 'dsov-card')
        c1.appendChild(mk('div', 'dsov-card-title', '上下文窗口'))
        const ctxHead = mk('div', 'dsov-ctx-head')
        const pill = mk('span', 'dsov-pill dsov-pill-ok')
        const pillText = mk('span')
        pillText.setAttribute('data-k', 'status')
        pillText.textContent = '—'
        pill.appendChild(pillText)
        ctxHead.appendChild(pill)
        const ratio = mk('span', 'dsov-ctx-ratio')
        ratio.setAttribute('data-k', 'ctxRatio')
        ratio.textContent = '—'
        ctxHead.appendChild(ratio)
        c1.appendChild(ctxHead)
        const ctxBar = mk('div', 'dsov-bar dsov-ctx-bar')
        const ctxFill = mk('div', 'dsov-bar-fill dsov-fill-ok')
        ctxFill.setAttribute('data-k', 'ctxFill')
        const marker = mk('div', 'dsov-ctx-marker')
        marker.setAttribute('title', '上下文压缩阈值 80%')
        ctxBar.appendChild(ctxFill)
        ctxBar.appendChild(marker)
        c1.appendChild(ctxBar)
        const ctxFoot = mk('div', 'dsov-ctx-foot')
        const usedL = mk('span')
        usedL.appendChild(document.createTextNode('已用 '))
        usedL.appendChild(num('ctxPct'))
        const remainL = mk('span')
        remainL.appendChild(document.createTextNode('距压缩 '))
        remainL.appendChild(num('ctxRemain'))
        ctxFoot.appendChild(usedL)
        ctxFoot.appendChild(remainL)
        c1.appendChild(ctxFoot)
        // 卡片 2：会话指标（双栏网格）
        const c2 = mk('div', 'dsov-card')
        c2.appendChild(mk('div', 'dsov-card-title', '会话指标'))
        const grid = mk('div', 'dsov-metrics-grid')
        const metric = (name, key) => {
          const m = mk('div', 'dsov-metric')
          m.appendChild(mk('span', 'dsov-metric-name', name))
          const v = mk('b', 'dsov-metric-val')
          v.setAttribute('data-k', key)
          v.textContent = '—'
          m.appendChild(v)
          return m
        }
        grid.appendChild(metric('平均命中', 'cacheHitRate'))
        grid.appendChild(metric('会话费用', 'cost'))
        grid.appendChild(metric('运行时间', 'runtime'))
        grid.appendChild(metric('请求数', 'requests'))
        grid.appendChild(metric('累计tokens', 'totalTokens'))
        c2.appendChild(grid)
        // 卡片 3：用量分析（智能动态渲染：单模型隐藏来源占比与多余区块）
        const c3 = mk('div', 'dsov-card')
        c3.setAttribute('data-dsov-card', 'usage')
        c3.appendChild(mk('span', 'dsov-card-title', '用量分析'))
        const srcArea = mk('div', 'dsov-source-area')
        srcArea.appendChild(mk('div', 'dsov-source-title', '来源占比'))
        const srcBar = mk('div', 'dsov-bar')
        const srcF = mk('div', 'dsov-bar-fill')
        srcF.setAttribute('data-k', 'src.flashFill')
        srcF.setAttribute('data-c', 'flash')
        const srcP = mk('div', 'dsov-bar-fill')
        srcP.setAttribute('data-k', 'src.proFill')
        srcP.setAttribute('data-c', 'pro')
        srcBar.appendChild(srcF)
        srcBar.appendChild(srcP)
        srcArea.appendChild(srcBar)
        const srcLeg = mk('div', 'dsov-source-legend')
        const fl = mk('span', 'dsov-legend-item dsov-legend-flash', 'DeepSeek V4 Flash ')
        fl.appendChild(num('src.flashPct'))
        const pl = mk('span', 'dsov-legend-item dsov-legend-pro', 'DeepSeek V4 Pro ')
        pl.appendChild(num('src.proPct'))
        srcLeg.appendChild(fl)
        srcLeg.appendChild(pl)
        srcArea.appendChild(srcLeg)
        c3.appendChild(srcArea)
        const models = mk('div', 'dsov-models')
        models.appendChild(buildModelBlock('DeepSeek V4 Flash', 'flash', foldFlash))
        models.appendChild(buildModelBlock('DeepSeek V4 Pro', 'pro', foldPro))
        c3.appendChild(models)
        const hint = mk('div', 'dsov-model-hint')
        hint.setAttribute('data-k', 'usageHint')
        hint.textContent = '暂无模型调用数据'
        hint.style.display = 'none'
        c3.appendChild(hint)
        pane.appendChild(c1)
        pane.appendChild(c2)
        pane.appendChild(c3)
        return pane
      }

      const setT = (key, text) => {
        const el = paneEl && paneEl.querySelector('[data-k="' + key + '"]')
        if (el) el.textContent = text
      }
      const setW = (key, pct) => {
        const el = paneEl && paneEl.querySelector('[data-k="' + key + '"]')
        if (el) el.style.width = pct + '%'
      }

      const renderModel = (key, mm) => {
        const inT = (Number(mm.inputHit) || 0) + (Number(mm.inputMiss) || 0)
        const out = Number(mm.output) || 0
        const ioTotal = inT + out
        const hr = inT > 0 ? (Number(mm.inputHit) || 0) / inT : 0
        setT(key + '.req', fmtInt(mm.requests))
        setT(key + '.tokens', fmtInt(inT + out))
        setT(key + '.hitRate', fmtPct(hr))
        setT(key + '.cost', fmtMoney(mm.cost))
        setW(key + '.ioIn', ioTotal > 0 ? (inT / ioTotal) * 100 : 0)
        setW(key + '.ioOut', ioTotal > 0 ? (out / ioTotal) * 100 : 0)
        setT(key + '.ioPct', fmtPct(ioTotal > 0 ? inT / ioTotal : 0))
        setT(key + '.outPct', fmtPct(ioTotal > 0 ? out / ioTotal : 0))
        setW(key + '.hitFill', inT > 0 ? ((Number(mm.inputHit) || 0) / inT) * 100 : 0)
        setW(key + '.missFill', inT > 0 ? ((Number(mm.inputMiss) || 0) / inT) * 100 : 0)
        setT(key + '.hitPct', fmtPct(hr))
        setT(key + '.missPct', fmtPct(1 - hr))
        setT(key + '.inputTotal', fmtInt(inT))
        setT(key + '.output', fmtInt(out))
        setT(key + '.inputHit', fmtInt(mm.inputHit))
        setT(key + '.inputMiss', fmtInt(mm.inputMiss))
      }

      const renderOverview = () => {
        if (!paneEl) return
        const s = overviewStore.get()
        const d = s.data
        if (!d) {
          setT('status', s.error === 'no-session' ? '无会话' : s.error ? '获取失败' : '加载中…')
          setT('ctxRatio', '—')
          setW('ctxFill', 0)
          setT('ctxPct', '—')
          setT('ctxRemain', '—')
          for (const k of ['cacheHitRate', 'cost', 'runtime', 'requests', 'totalTokens']) setT(k, '—')
          for (const key of ['flash', 'pro']) {
            for (const k of ['req', 'tokens', 'hitRate', 'cost', 'ioPct', 'outPct', 'hitPct', 'missPct', 'inputTotal', 'output', 'inputHit', 'inputMiss']) {
              setT(key + '.' + k, '—')
            }
          }
          setT('src.flashPct', '—')
          setT('src.proPct', '—')
          setW('src.flashFill', 0)
          setW('src.proFill', 0)
          return
        }
        // 卡片 1：上下文窗口
        const cap = Number(d.context.capacity) || 0
        const used = Number(d.context.used) || 0
        const pct = cap > 0 ? used / cap : 0
        const threshold = Number(d.context.threshold) || 0.8
        const status = pct >= 0.9 ? 'overload' : pct >= 0.7 ? 'tight' : 'ok'
        const statusText = { ok: '上下文充足', tight: '上下文紧张', overload: '上下文过载' }[status]
        setT('status', statusText)
        const pill = paneEl.querySelector('.dsov-pill')
        if (pill) pill.className = 'dsov-pill dsov-pill-' + status
        setT('ctxRatio', fmtK(used) + '/' + fmtK(cap))
        const ctxFill = paneEl.querySelector('[data-k="ctxFill"]')
        if (ctxFill) {
          ctxFill.style.width = (pct * 100).toFixed(2) + '%'
          ctxFill.className = 'dsov-bar-fill dsov-fill-' + status
        }
        setT('ctxPct', fmtPct(pct))
        setT('ctxRemain', fmtK(Math.max(0, cap * threshold - used)))
        // 卡片 2：会话指标（运行时间 = 任务活跃时长，任务空闲即暂停）
        const m = d.metrics || {}
        const hitTotal = Number(m.inputHit) || 0
        const missTotal = Number(m.inputMiss) || 0
        const outTotal = Number(m.output) || 0
        const hitRate = hitTotal + missTotal > 0 ? hitTotal / (hitTotal + missTotal) : 0
        setT('cacheHitRate', fmtPct(hitRate))
        setT('cost', fmtMoney(m.cost))
        setT('runtime', fmtDur(m.runtimeMs))
        setT('requests', fmtInt(m.requests))
        setT('totalTokens', fmtInt(hitTotal + missTotal + outTotal))
        // 卡片 3：用量分析（智能动态渲染）
        const flash = d.models && d.models.flash
        const pro = d.models && d.models.pro
        const flashUsed = flash && (Number(flash.requests) > 0 || Number(flash.inputHit) + Number(flash.inputMiss) + Number(flash.output) > 0)
        const proUsed = pro && (Number(pro.requests) > 0 || Number(pro.inputHit) + Number(pro.inputMiss) + Number(pro.output) > 0)
        const srcArea = paneEl.querySelector('.dsov-source-area')
        const flashBlock = paneEl.querySelector('.dsov-model[data-fold-block="flash"]')
        const proBlock = paneEl.querySelector('.dsov-model[data-fold-block="pro"]')
        const hint = paneEl.querySelector('[data-k="usageHint"]')
        const dual = flashUsed && proUsed
        if (srcArea) srcArea.style.display = dual ? '' : 'none'
        if (flashBlock) flashBlock.style.display = flashUsed ? '' : 'none'
        if (proBlock) proBlock.style.display = proUsed ? '' : 'none'
        if (hint) hint.style.display = flashUsed || proUsed ? 'none' : ''
        if (flashUsed && flash) renderModel('flash', flash)
        if (proUsed && pro) renderModel('pro', pro)
        if (dual) {
          const fTok = (Number(flash.inputHit) || 0) + (Number(flash.inputMiss) || 0) + (Number(flash.output) || 0)
          const pTok = (Number(pro.inputHit) || 0) + (Number(pro.inputMiss) || 0) + (Number(pro.output) || 0)
          const sTot = fTok + pTok
          setW('src.flashFill', sTot > 0 ? (fTok / sTot) * 100 : 0)
          setW('src.proFill', sTot > 0 ? (pTok / sTot) * 100 : 0)
          setT('src.flashPct', fmtPct(sTot > 0 ? fTok / sTot : 0))
          setT('src.proPct', fmtPct(sTot > 0 ? pTok / sTot : 0))
        }
      }

      const setFold = (key, open) => {
        if (key === 'flash') foldFlash = open
        else foldPro = open
        const block = paneEl && paneEl.querySelector('.dsov-model[data-fold-block="' + key + '"]')
        if (!block) return
        block.classList.toggle('dsov-open', open)
        const dt = block.querySelector('.dsov-detail-toggle')
        if (dt) dt.textContent = (open ? '▾' : '▸') + ' 明细'
      }

      const setOverviewActive = (active) => {
        overviewStore.set((s) => ({ ...s, active }))
        if (rootEl) rootEl.classList.toggle('dsov-overview-active', active)
        if (tabBtnEl) tabBtnEl.classList.toggle('dsov-tab-active', active)
        if (paneEl) paneEl.style.display = active ? '' : 'none'
        if (active) refreshOverview()
      }

      const onPaneClick = (e) => {
        if (!paneEl) return
        const t = e.target
        const foldBtn = t.closest && t.closest('.dsov-detail-toggle')
        if (foldBtn) {
          const k = foldBtn.getAttribute('data-fold')
          const open = k === 'flash' ? foldFlash : foldPro
          setFold(k, !open)
        }
      }

      const onTabBarClick = (e) => {
        if (!rootEl || !tabBtnEl || !tabBarEl) return
        const t = e.target
        if (t === tabBtnEl || tabBtnEl.contains(t)) {
          setOverviewActive(true)
          return
        }
        if (tabBarEl.contains(t)) setOverviewActive(false)
      }

      const injectUI = (root) => {
        if (injected) return
        if (document.querySelector('[data-dsov-tab="overview"]')) {
          injected = true
          return
        }
        const bar = root.firstElementChild
        if (!bar || !bar.querySelector('button')) return
        rootEl = root
        tabBarEl = bar
        const btn = mk('button', 'dsov-tab-btn', '概览')
        btn.type = 'button'
        btn.setAttribute('data-dsov-tab', 'overview')
        btn.setAttribute('title', '概览')
        bar.insertBefore(btn, bar.firstChild)
        tabBtnEl = btn
        const pane = buildPane()
        bar.insertAdjacentElement('afterend', pane)
        paneEl = pane
        bar.addEventListener('click', onTabBarClick, true)
        pane.addEventListener('click', onPaneClick)
        const blocks = pane.querySelectorAll('.dsov-model')
        if (blocks[0]) blocks[0].setAttribute('data-fold-block', 'flash')
        if (blocks[1]) blocks[1].setAttribute('data-fold-block', 'pro')
        injected = true
        overviewStore.subscribe(renderOverview)
        renderOverview()
      }

      const waitForElement = (selector, onFound) => {
        let disposed = false
        let obs = null
        const tryFind = () => {
          if (disposed) return
          const el = document.querySelector(selector)
          if (el) {
            if (obs) obs.disconnect()
            onFound(el)
          }
        }
        obs = new MutationObserver(tryFind)
        obs.observe(document.body, { childList: true, subtree: true })
        tryFind()
        return () => {
          disposed = true
          if (obs) obs.disconnect()
        }
      }

      const currentSessionId = () => {
        try {
          const snap = ctx.sessions.list.getSnapshot()
          return snap && snap.current ? String(snap.current) : ''
        } catch (e) {
          return ''
        }
      }

      let overviewBusy = false
      const refreshOverview = async () => {
        if (overviewBusy) return
        if (!overviewStore.get().active) return
        const sid = currentSessionId()
        if (!sid) {
          overviewStore.set((s) => ({ ...s, sessionId: '', data: null, error: 'no-session' }))
          return
        }
        overviewBusy = true
        try {
          const value = await fetchOverview(sid)
          overviewStore.set((s) =>
            value
              ? { ...s, sessionId: sid, data: value, error: null }
              : { ...s, sessionId: sid, data: null, error: 'route-unavailable' },
          )
        } catch (e) {
          overviewStore.set((s) => ({ ...s, sessionId: sid, data: null, error: String((e && e.message) || e) }))
        } finally {
          overviewBusy = false
        }
      }

      // 注入样式（跟随 DSH 主题变量自动切换浅色/深色）
      styleTag = document.createElement('style')
      styleTag.setAttribute('data-dsov', 'styles')
      styleTag.textContent = DSOV_CSS
      document.head.appendChild(styleTag)

      // 概览标签注入
      const disposeWait = waitForElement(ROOT_SELECTOR, injectUI)

      // 会话切换时刷新
      let unsubSessions = null
      try {
        unsubSessions = ctx.sessions.list.subscribe(() => {
          if (overviewStore.get().active) refreshOverview()
        })
      } catch (e) {
        unsubSessions = null
      }

      // —— 设置导航【DeepSeek 开放平台】：点击导航项直接唤起系统默认浏览器，不再渲染主体过渡页 ——
      // 在文本匹配该标签的可点击元素上挂捕获阶段点击拦截：直接 window.open，
      // 并 stopPropagation/preventDefault 阻止 shell 打开该 section（不出现过渡页）。
      const NAV_KEY = 'DeepSeek开放平台'.replace(/\s+/g, '')
      const navAttached = new Set()
      const onNavClick = (e) => {
        e.stopPropagation()
        e.preventDefault()
        try {
          window.open('https://platform.deepseek.com', '_blank', 'noopener')
        } catch (err) {
          /* noop */
        }
      }
      const attachNavInterceptors = () => {
        const all = document.querySelectorAll('button, [role="button"], a')
        for (const el of all) {
          if (navAttached.has(el)) continue
          if ((el.textContent || '').replace(/\s+/g, '') !== NAV_KEY) continue
          el.addEventListener('click', onNavClick, true)
          navAttached.add(el)
        }
      }
      attachNavInterceptors()

      // 概览 1 秒实时刷新（运行时间每秒平滑递增；任务空闲暂停计时）；
      // 顺带每秒探测设置导航项（设置面板随时可能被打开），确保拦截器及时挂上。
      const pollTimer = window.setInterval(() => {
        attachNavInterceptors()
        refreshOverview()
      }, 1000)

      return () => {
        disposeWait()
        if (pollTimer !== null) window.clearInterval(pollTimer)
        if (unsubSessions) unsubSessions()
        for (const el of navAttached) el.removeEventListener('click', onNavClick, true)
        navAttached.clear()
        if (tabBarEl && tabBtnEl) tabBarEl.removeEventListener('click', onTabBarClick, true)
        if (paneEl) paneEl.removeEventListener('click', onPaneClick)
        if (tabBtnEl) tabBtnEl.remove()
        if (paneEl) paneEl.remove()
        if (styleTag) {
          styleTag.remove()
          styleTag = null
        }
        rootEl = null
        tabBarEl = null
        tabBtnEl = null
        paneEl = null
        injected = false
      }
    },
    'dsh-dsov-plugin: overview wiring',
  )

  // 设置页：settings.section（slots 由 ui-slots 提供，动态等待）。
  // 导航项点击由上方拦截器处理（直接唤起浏览器、不渲染主体页）；此处注册仅为
  // 提供导航项本体 + 兜底组件（万一拦截未生效，组件挂载即唤起并关闭设置面板）。
  ctx.inject(['slots'], (scope) => {
    scope.slots.inject('settings.section', () =>
      scope.slots.register(
        { name: 'settings.section', id: 'deepseek-open-platform', order: 50, label: 'DeepSeek 开放平台' },
        (props) => React.createElement(SettingsPage, props),
      ),
    )
  })
}
