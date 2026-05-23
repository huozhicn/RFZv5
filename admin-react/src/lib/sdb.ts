// SDB REST query — sends raw SQL, returns parsed result
const NS = 'huozhi'
const DB = 'rfv5_dist'

function escapeVal(v: unknown): string {
  if (v === null || v === undefined) return 'NONE'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') {
    // Record IDs (e.g. 'user:admin', 'tenant:abc') must NOT be quoted
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

export async function sdbQuery<T = any>(
  sql: string,
  vars?: Record<string, unknown>,
  token?: string | null
): Promise<T> {
  const body = interpolate(sql, vars)
  const url = `${window.location.origin}/sdb/sql`

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain',
    'Accept': 'application/json',
    'Surreal-NS': NS,
    'Surreal-DB': DB,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(url, { method: 'POST', headers, body })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`SDB ${resp.status}: ${text.slice(0, 100)}`)
  }
  const data = await resp.json()
  // SDB REST /sql returns [{result: [...], status: "OK"}]
  return (Array.isArray(data) ? data[0]?.result ?? [] : []) as T
}

export async function sdbSignin(username: string, password: string): Promise<string> {
  const url = `${window.location.origin}/sdb/signin`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Surreal-NS': NS,
      'Surreal-DB': DB,
    },
    body: JSON.stringify({
      ns: NS,
      db: DB,
      ac: 'agent_session',
      user: username,
      pass: password,
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.details || '登录失败')
  }
  const { token } = await resp.json()
  return token
}
