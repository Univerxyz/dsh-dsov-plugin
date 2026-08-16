/**
 * dsh-dsov-plugin — Host half.
 *
 * 会话级用量计量：
 *  - llm/stream waterfall（global: true）——按模型累计请求数、输入（命中/未命中缓存）、
 *    输出 Token，并按 DeepSeek 官方最新峰谷定价自动核算费用；
 *  - agent/status（global: true）——任务活跃计时：仅 Agent 运行中累计运行时长，空闲即暂停；
 *  - webServer 路由 POST /dsov/overview ——向浏览器提供当前会话实时数据（JSON 信封，与
 *    /aionui-panel 同规范，回环地址护栏）。
 *
 * 仅随 web profile 加载（该行只存在于 web profile 的 bundle patch 中）。
 */
export const inject = ['webServer', 'sessions', 'tokenMeter']

/** 官方上下文长度：DeepSeek V4 Flash / Pro 均为 1M tokens。 */
const CONTEXT_CAPACITY = 1_000_000
/** DSH 默认压缩阈值：模型上下文窗口的 80%（dsh-compaction-basic thresholdRatio）。 */
const COMPACTION_THRESHOLD = 0.8

/**
 * 官方最新定价（来源 platform.deepseek.com 官方定价页
 * api-docs.deepseek.com/zh-cn/quick_start/pricing，2026-08-17 生效）。
 * 峰谷定价：北京时间高峰 09:00-12:00 / 14:00-18:00，其余为空闲时段（空闲 = 高峰 × 0.5）。
 * 单位：元 / 每百万 tokens。
 */
const PRICING = {
  flash: {
    inputHit: { peak: 0.1, off: 0.05 },
    inputMiss: { peak: 3.0, off: 1.5 },
    output: { peak: 9.0, off: 4.5 },
  },
  pro: {
    inputHit: { peak: 0.3, off: 0.15 },
    inputMiss: { peak: 9.0, off: 4.5 },
    output: { peak: 27.0, off: 13.5 },
  },
}

const bjHour = (ts) => new Date(ts + 8 * 3600000).getUTCHours()
const isPeak = (ts) => {
  const h = bjHour(ts)
  return (h >= 9 && h < 12) || (h >= 14 && h < 18)
}
const priceOf = (bucket, field, ts) => {
  const p = PRICING[bucket]
  if (!p || !p[field]) return 0
  return p[field][isPeak(ts) ? 'peak' : 'off']
}

const emptyModel = () => ({ requests: 0, inputHit: 0, inputMiss: 0, output: 0, cost: 0 })
const modelBucket = (model) => {
  const m = String(model || '').toLowerCase()
  return m.indexOf('pro') >= 0 ? 'pro' : m.indexOf('flash') >= 0 ? 'flash' : 'other'
}
const ensureSession = (map, id) => {
  let s = map.get(id)
  if (!s) {
    s = { activeMs: 0, models: { flash: emptyModel(), pro: emptyModel(), other: emptyModel() } }
    map.set(id, s)
  }
  return s
}

export function apply(ctx) {
  const sessionStats = new Map()
  // 任务活跃窗口：sessionId -> running 开始时间戳（任务空闲即暂停计时）
  const runningSince = new Map()

  const recordUsage = (sessionId, bucket, u, ts) => {
    const hit = u.cacheRead || 0
    const miss = (u.inputTokens || 0) + (u.cacheWrite || 0)
    const out = u.outputTokens || 0
    const cost =
      (hit * priceOf(bucket, 'inputHit', ts) +
        miss * priceOf(bucket, 'inputMiss', ts) +
        out * priceOf(bucket, 'output', ts)) /
      1_000_000
    if (sessionId !== '') {
      const s = ensureSession(sessionStats, sessionId)
      const m = s.models[bucket] || (s.models[bucket] = emptyModel())
      m.requests += 1
      m.inputHit += hit
      m.inputMiss += miss
      m.output += out
      m.cost += cost
    }
  }

  // ── 任务活跃计时：agent 运行中才累计运行时间，空闲即暂停 ──
  ctx.on(
    'agent/status',
    (payload) => {
      try {
        const agent = payload && payload.agent
        const id = agent && agent.id ? String(agent.id) : ''
        const status = payload && payload.status
        if (id === '') return
        if (status === 'running') {
          if (!runningSince.has(id)) runningSince.set(id, Date.now())
        } else if (status === 'idle') {
          const start = runningSince.get(id)
          if (start !== undefined) {
            runningSince.delete(id)
            ensureSession(sessionStats, id).activeMs += Math.max(0, Date.now() - start)
          }
        }
      } catch (e) {
        /* noop */
      }
    },
    { global: true },
  )

  // ── llm/stream 实时计量（global: true 接收任意会话作用域的模型调用）──
  ctx.on(
    'llm/stream',
    (options, next) => {
      const bucket = modelBucket(options && options.model)
      const sessionId = options && options.sessionId ? String(options.sessionId) : ''
      let source
      try {
        source = next()
      } catch (e) {
        throw e
      }
      let recorded = false
      const wrapped = (async function* () {
        for await (const chunk of source) {
          if (!recorded && chunk && chunk.type === 'usage' && chunk.usage) {
            recorded = true
            const u = chunk.usage
            try {
              recordUsage(
                sessionId,
                bucket,
                {
                  cacheRead: u.cacheReadTokens || 0,
                  cacheWrite: u.cacheWriteTokens || 0,
                  inputTokens: u.inputTokens || 0,
                  outputTokens: u.outputTokens || 0,
                },
                Date.now(),
              )
            } catch (e) {
              console.error('[dsh-dsov] recordUsage failed', e)
            }
          }
          yield chunk
        }
      })()
      return wrapped
    },
    { global: true },
  )

  // ── 概览数据装配（仅当前会话实时数据；设置页不经过此路由）──
  const buildOverview = async (sessionId) => {
    const session = sessionId !== '' ? ctx.sessions.get(sessionId) : undefined
    let used = 0
    if (session) {
      try {
        used = ctx.tokenMeter.measure(session).totalTokens || 0
      } catch (e) {
        used = 0
      }
    }
    const st = sessionId !== '' ? sessionStats.get(sessionId) : undefined
    const flash = st ? { ...st.models.flash } : emptyModel()
    const pro = st ? { ...st.models.pro } : emptyModel()
    const other = st ? st.models.other : emptyModel()
    const sum = (f) => flash[f] + pro[f] + other[f]
    let runtimeMs = st ? st.activeMs : 0
    if (st) {
      const runStart = runningSince.get(sessionId)
      if (runStart !== undefined) runtimeMs += Math.max(0, Date.now() - runStart)
    }
    return {
      context: { capacity: CONTEXT_CAPACITY, used, threshold: COMPACTION_THRESHOLD },
      metrics: {
        inputHit: sum('inputHit'),
        inputMiss: sum('inputMiss'),
        output: sum('output'),
        requests: sum('requests'),
        cost: sum('cost'),
        runtimeMs,
      },
      models: { flash, pro },
    }
  }

  // ── 路由层：POST /dsov/overview，JSON 信封 { ok, value }，回环护栏 ──
  const isLoopback = (req) => {
    const address = req.socket && req.socket.remoteAddress
    if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
    const host = req.headers.host
    if (typeof host !== 'string') return false
    let hostUrl
    try {
      hostUrl = new URL(`http://${host}`)
    } catch (e) {
      return false
    }
    if (
      hostUrl.hostname !== '127.0.0.1' &&
      hostUrl.hostname !== 'localhost' &&
      hostUrl.hostname !== '[::1]'
    ) {
      return false
    }
    return true
  }
  const readJsonBody = async (req) => {
    const chunks = []
    let total = 0
    for await (const chunk of req) {
      chunks.push(chunk)
      total += chunk.length
      if (total > (1 << 20)) return null
    }
    const text = Buffer.concat(chunks).toString('utf8')
    if (text === '') return null
    try {
      return JSON.parse(text)
    } catch (e) {
      return null
    }
  }
  const json = (res, body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  const handler = async (req, res) => {
    if (!isLoopback(req)) {
      json(res, { error: 'forbidden: loopback-only' }, 403)
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }
    const ct = req.headers['content-type'] || ''
    if (!ct.toLowerCase().startsWith('application/json')) {
      json(res, { ok: false, error: { code: 'bad-request', message: 'json required' } }, 415)
      return
    }
    const pathname = new URL(req.url || '/', 'http://x').pathname
    const payload = await readJsonBody(req)
    if (pathname === '/dsov/overview') {
      const sessionId =
        payload && typeof payload === 'object' && typeof payload.sessionId === 'string'
          ? payload.sessionId
          : ''
      const value = await buildOverview(sessionId)
      json(res, { ok: true, value })
      return
    }
    res.writeHead(404)
    res.end()
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: '/dsov', handler }),
    'dsh-dsov-plugin: /dsov routes',
  )

  return () => {
    sessionStats.clear()
    runningSince.clear()
  }
}
