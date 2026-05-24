import { useState, useRef, useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useAuth } from '@/stores/auth'
import { loadMenuConfig, getMenuGroups, loadSchema, getTableMeta } from '@/lib/schema'
import SchemaTable from '@/components/SchemaTable'
import DetailPanel from '@/components/DetailPanel'
import ChatPanel from '@/components/ChatPanel'
import type { DetailController, TableController } from '@/agent/dispatcher'

// ── 首页 ──
function HomePage() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: '#999' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: '#333', marginBottom: 8 }}>流通处管理后台</div>
      <div style={{ fontSize: 14 }}>选择左侧菜单开始操作，或在右侧对话中输入指令</div>
      <div style={{ fontSize: 12, marginTop: 8, color: '#bbb' }}>试试：「看库存」「新建订单」</div>
    </div>
  )
}

// ── 表页面 ──
function TablePage({ tableName, tableRefs, detailCtrl, defaultFilter }: {
  tableName: string
  tableRefs: React.MutableRefObject<Map<string, TableController>>
  detailCtrl: DetailController
  defaultFilter?: string
}) {
  const meta = getTableMeta(tableName)
  const [detailMode, setDetailMode] = useState<'view' | 'create' | null>(null)
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)
  const [detailPrefill, setDetailPrefill] = useState<Record<string, any>>({})

  const filterProp = defaultFilter ? { field: 'product_type', value: defaultFilter } : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e8e8', background: '#fafafa', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{meta?.label || tableName}</h2>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        <SchemaTable
          ref={(el) => { if (el) tableRefs.current.set(tableName, el as TableController) }}
          tableName={tableName}
          meta={meta || null}
          onRowClick={(id) => { setDetailMode('view'); setDetailRecordId(id) }}
          onCreate={() => { setDetailMode('create'); setDetailRecordId(null); setDetailPrefill({}) }}
          defaultFilter={filterProp}
        />
      </div>
      <DetailPanel
        visible={detailMode !== null}
        tableName={tableName}
        meta={meta || null}
        recordId={detailRecordId}
        mode={detailMode || 'view'}
        prefill={detailPrefill}
        onClose={() => { setDetailMode(null); setDetailRecordId(null); tableRefs.current.get(tableName)?.refresh() }}
      />
    </div>
  )
}

// ── 侧栏 ──
function Sidebar({ currentTable, onSelectTable, onLogout }: {
  currentTable: string
  onSelectTable: (key: string) => void
  onLogout: () => void
}) {
  const auth = useAuth()
  // 直接从模块变量读取（loadMenuConfig 完成后会被填充）
  const menuGroups = getMenuGroups()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    for (const g of menuGroups) {
      if (g.tables.some((t: any) => t.key.split(':')[0] === currentTable)) {
        setExpandedGroups(prev => new Set([...prev, g.key]))
        break
      }
    }
  }, [currentTable, menuGroups])

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div style={{ width: 220, minWidth: 220, background: '#001529', color: '#fff', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '16px 20px', fontSize: 18, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        流通处 <span style={{ fontSize: 12, fontWeight: 400, color: '#ffffff88' }}>管理后台</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {menuGroups.map((group: any) => (
          <div key={group.key}>
            <div onClick={() => toggleGroup(group.key)}
              style={{ padding: '10px 20px', cursor: 'pointer', fontSize: 13, color: '#ffffff99', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
              {group.label}
              <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expandedGroups.has(group.key) ? 'rotate(90deg)' : '' }}>▶</span>
            </div>
            {expandedGroups.has(group.key) && group.tables.map((table: any) => (
              <div key={table.key} onClick={() => onSelectTable(table.key)}
                style={{ padding: '8px 20px 8px 36px', cursor: 'pointer', fontSize: 13, color: currentTable === table.key.split(':')[0] ? '#fff' : '#ffffff88', background: currentTable === table.key.split(':')[0] ? '#1677ff' : '' }}>
                {table.label}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div onClick={() => setUserMenuOpen(!userMenuOpen)} style={{ padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 14 }}>
            {auth.user?.display_name?.[0] || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <div>{auth.user?.display_name || '用户'}</div>
            <div style={{ fontSize: 10, color: '#ffffff66' }}>{auth.user?.role}</div>
          </div>
        </div>
        {userMenuOpen && (
          <div style={{ position: 'absolute', bottom: '100%', left: 12, right: 12, background: '#fff', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: 4, zIndex: 100 }}>
            <div onClick={() => { onLogout(); setUserMenuOpen(false) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#333', borderRadius: 6 }}>
              退出登录
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '8px 20px', fontSize: 10, color: '#ffffff33' }}>
        v.{__COMMIT_HASH__}
      </div>
    </div>
  )
}

// ── AppInner ──
function AppInner() {
  const auth = useAuth()
  const nav = useNavigate()
  const [currentTable, setCurrentTable] = useState('')
  const tableRefs = useRef<Map<string, TableController>>(new Map())
  const [detailMode, setDetailMode] = useState<'view' | 'create' | null>(null)
  const [detailRecordId, setDetailRecordId] = useState<string | null>(null)
  const [detailPrefill, setDetailPrefill] = useState<Record<string, any>>({})
  const [detailTable, setDetailTable] = useState('')

  const detailCtrl: DetailController = {
    openDetail: (id: string) => { setDetailRecordId(id); setDetailMode('view') },
    openCreate: (table: string, prefill?: Record<string, unknown>) => {
      setDetailTable(table)
      setDetailPrefill(prefill || {})
      setDetailMode('create')
    },
  }

  function handleSelectTable(rawKey: string) {
    const [key, filter] = rawKey.split(':')
    setCurrentTable(key)
    setTableFilter(filter || '')
    nav('/tables/' + key)
  }

  function handleLogout() {
    auth.logout()
    nav('/login')
  }
  const [schemaReady, setSchemaReady] = useState(false)
  const [tableFilter, setTableFilter] = useState('')
  const [menuReady, setMenuReady] = useState(false)

  // Load data on mount
  useEffect(() => {
    if (auth.token) {
      loadMenuConfig().then(() => setMenuReady(true))
      loadSchema(auth.token).then(() => setSchemaReady(true))
    }
  }, [auth.token])
  // Parse route on mount and on hash change
  useEffect(() => {
    function parseHash() {
      const hash = window.location.hash
      const match = hash.match(/#\/tables\/(\w+)/)
      if (match) setCurrentTable(match[1])
    }
    parseHash()
    window.addEventListener('hashchange', parseHash)
    return () => window.removeEventListener('hashchange', parseHash)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentTable={currentTable} onSelectTable={handleSelectTable} onLogout={handleLogout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tables/:tableName" element={<TablePage key={`${currentTable}-${schemaReady}`} tableName={currentTable} tableRefs={tableRefs} detailCtrl={detailCtrl} defaultFilter={tableFilter} />} />
        </Routes>
      </div>
      <ChatPanel tableRefs={tableRefs} currentTable={currentTable} detailCtrl={detailCtrl} />
    </div>
  )
}

// ── 登录页 ──
function LoginPage() {
  const { login, token } = useAuth()
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) nav('/', { replace: true })
  }, [token, nav])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      await login(username, password)
      nav('/')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f2f5' }}>
      <div style={{ width: 380, padding: 32, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 24px', fontWeight: 600 }}>
          流通处管理 <span style={{ color: '#999', fontSize: 14, fontWeight: 400 }}>后台</span>
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#666' }}>用户名</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="输入用户名"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#666' }}>密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入密码"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ color: '#d93025', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading || !username || !password}
            style={{ width: '100%', padding: '10px 0', background: loading ? '#91caff' : '#1677ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Root ──
export default function App() {
  const auth = useAuth()
  return (
    <HashRouter>
      {auth.token ? <AppInner /> : <LoginPage />}
    </HashRouter>
  )
}
