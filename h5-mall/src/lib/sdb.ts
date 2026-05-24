// H5 商城 SDB 连接层 — 自动以 visitor 身份登录，直连 SDB
const NS = 'huozhi'
const DB = 'rfv5_dist'
const H5_USER = 'h5_visitor'
const H5_PASS = 'h5_visitor_pass'

let _token: string | null = null
let _tokenPromise: Promise<string> | null = null

function escapeVal(v: unknown): string {
  if (v === null || v === undefined) return 'NONE'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') {
    if (/^\w+:\w+/.test(v)) return v
    return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  }
  return String(v)
}

export function interpolate(sql: string, vars?: Record<string, unknown>): string {
  if (!vars) return sql
  return sql.replace(/\$(\w+)/g, (_, name) => {
    if (name in vars) return escapeVal(vars[name])
    return `$${name}`
  })
}

async function getToken(): Promise<string> {
  if (_token) return _token
  if (_tokenPromise) return _tokenPromise

  _tokenPromise = (async () => {
    const url = `${window.location.origin}/sdb/signin`
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Surreal-NS': NS,
        'Surreal-DB': DB,
      },
      body: JSON.stringify({ ns: NS, db: DB, ac: 'agent_session', user: H5_USER, pass: H5_PASS }),
    })
    if (!resp.ok) {
      _tokenPromise = null
      throw new Error('H5 visitor 登录失败')
    }
    const data = await resp.json()
    _token = data.token
    return _token!
  })()
  return _tokenPromise
}

export async function sdbQuery<T = any>(sql: string, vars?: Record<string, unknown>): Promise<T> {
  const token = await getToken()
  const body = interpolate(sql, vars)
  const url = `${window.location.origin}/sdb/sql`

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Accept': 'application/json',
      'Surreal-NS': NS,
      'Surreal-DB': DB,
      'Authorization': `Bearer ${token}`,
    },
    body,
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`SDB ${resp.status}: ${text.slice(0, 100)}`)
  }
  const data = await resp.json()
  return (Array.isArray(data) ? data[0]?.result ?? [] : []) as T
}

// 便捷方法：获取单条记录
export async function sdbGet<T = any>(sql: string, vars?: Record<string, unknown>): Promise<T | null> {
  const rows = await sdbQuery<T[]>(sql, vars)
  return rows?.[0] ?? null
}

// 语义搜索：调用 /api/embed 获取 1024 维 bge-m3 向量
let _embedCache = new Map<string, number[]>()
export async function embed(text: string): Promise<number[]> {
  const key = text.trim()
  if (_embedCache.has(key)) return _embedCache.get(key)!

  const resp = await fetch(`${window.location.origin}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: key }),
  })
  if (!resp.ok) throw new Error(`Embed API ${resp.status}`)
  const data = await resp.json()
  const vec: number[] = data.vector
  _embedCache.set(key, vec)
  // Limit cache size
  if (_embedCache.size > 100) {
    const first = _embedCache.keys().next().value
    if (first) _embedCache.delete(first)
  }
  return vec
}
