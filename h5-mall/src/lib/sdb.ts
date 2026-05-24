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
