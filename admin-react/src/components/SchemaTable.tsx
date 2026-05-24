import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import type { TableMeta, FieldMeta } from '@/lib/schema'
import { extractEnumOptions, fieldLabel, de } from '@/lib/schema'

interface Props {
  tableName: string
  meta: TableMeta | null
  onRowClick: (recordId: string) => void
  onCreate?: () => void
  defaultFilter?: { field: string; value: string }
}

export interface TableController {
  setFilter: (field: string, value: string) => void
  highlightRows: (rowIds: string[]) => void
  refresh: () => void
}

const LABEL_MAP: Record<string, string> = {
  'active': '激活', 'inactive': '禁用',
  '上架': '上架', '下架': '下架',
  'pending': '待同步', 'synced': '已同步', 'failed': '失败',
  'done': '已完成',
  '已发货': '已发货', '待付款': '待付款', '已完成': '已完成', '已取消': '已取消',
  '待处理': '待处理', '已处理': '已处理', '已拒绝': '已拒绝',
  '管理员': '管理员', '店员': '店员',
  '在线支付': '在线支付', '线下付款': '线下付款',
  '商品': '商品', '活动': '活动',
}

function renderCell(row: any, field: FieldMeta): string {
  const val = row[field.name]
  if (val === null || val === undefined || val === '') return '-'
  if (field.isRecord && typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return val.map((v: any) => recordLabel(v)).join(', ') || '-'
    }
    return recordLabel(val)
  }
  if (field.kind === 'datetime') return fmtDatetime(val)
  if (field.kind.startsWith('array')) {
    if (Array.isArray(val)) return val.length === 0 ? '-' : `${val.length} 项`
    return String(val) || '-'
  }
  if (field.assert) {
    const enums = extractEnumOptions(field.assert)
    if (enums.length > 0 && enums.length <= 8) {
      return LABEL_MAP[val] || String(val)
    }
  }
  if (typeof val === 'boolean') return val ? '是' : '否'
  return String(val)
}

/** 格式化 record 对象 — 优先 SKU，穿透 spu 显示产品名 */
function recordLabel(val: any): string {
  if (!val || typeof val !== 'object') return String(val || '-')
  // 有 SKU 的记录 → 显示 SKU(规格名)，附加产品名
  if (val.sku) {
    const spuName = val.spu?.name || ''
    const suffix = spuName ? ` [${spuName}]` : ''
    return `${val.sku}${suffix}`
  }
  // 有 spu 的（如 inventory variant）→ 显示产品名-规格名
  if (val.spu?.name) {
    return `${val.spu.name} · ${val.name || ''}`
  }
  return val.name || val.display_name || val.title || String(val.id || '-')
}

function fmtDatetime(val: any): string {
  const s = String(val)
  // Truncate ISO 8601 to seconds: "2026-05-23T02:03:20.181667652Z" → "2026-05-23 02:03:20"
  const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
  return m ? `${m[1]} ${m[2]}` : s
}

const SchemaTable = forwardRef<TableController, Props>(({ tableName, meta, onRowClick, onCreate, defaultFilter }, ref) => {
  const { token, tablePerms } = useAuth()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [highlighted, setHighlighted] = useState<string[]>([])
  const PAGE_SIZE = 20

  const fetchData = useCallback(async () => {
    if (!tableName) return
    setLoading(true)
    try {
      const text = searchText.trim()
      const parts: string[] = []
      let vars: Record<string, unknown> = {}
      const { fetchClause } = meta ? de(meta) : { fetchClause: '' }
      const orderField = meta?.fields.some(f => f.name === 'created_at') ? 'created_at' : 'id'
      const orderDir = orderField === 'id' ? 'ASC' : 'DESC'

      if (defaultFilter) {
        parts.push(`${defaultFilter.field} = $filterVal`)
        vars = { ...vars, filterVal: defaultFilter.value }
      }

      let useVector = false
      if (text && tableName === 'product') {
        // 向量搜索: 调 embed proxy → SDB HNSW
        try {
          const resp = await fetch('/api/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          })
          if (resp.ok) {
            const { vector } = await resp.json()
            if (vector && vector.length === 1024) {
              const vecJson = JSON.stringify(vector)
              const where = parts.length > 0
                ? `WHERE ${parts.join(' AND ')} AND content_embedding <|20,20|> ${vecJson}`
                : `WHERE content_embedding <|20,20|> ${vecJson}`

              // 向量搜索用 KNN 排序(距离升序)，跳过传统 ORDER/LIMIT/START
              const dataSql = `SELECT * FROM ${tableName} ${where} LIMIT ${PAGE_SIZE} START ${(page - 1) * PAGE_SIZE} ${fetchClause}`
              const data = await sdbQuery(dataSql, undefined, token) || []
              setRows(data)
              setTotalCount(data.length) // KNN 无 count 查询
              useVector = true
            }
          }
        } catch { /* 回退到 CONTAINS */ }
      }

      if (!useVector) {
        if (text && meta) {
          const stringFields = meta.fields.filter(f => f.kind.includes('string') || f.kind.includes('text'))
          if (stringFields.length > 0) {
            parts.push(`(${stringFields.map(f => `${f.name} CONTAINS $search`).join(' OR ')})`)
            vars = { ...vars, search: text }
          }
        }
        const where = parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : ''
        const whereVars = Object.keys(vars).length > 0 ? vars : undefined

        const countSql = where
          ? `SELECT count() FROM ${tableName} ${where} GROUP ALL`
          : `SELECT count() FROM ${tableName} GROUP ALL`
        const countResult = await sdbQuery(countSql, whereVars, token)
        setTotalCount(countResult?.[0]?.count ?? 0)

        const dataSql = `SELECT * FROM ${tableName} ${where} ORDER BY ${orderField} ${orderDir} LIMIT ${PAGE_SIZE} START ${(page - 1) * PAGE_SIZE} ${fetchClause}`
        const data = await sdbQuery(dataSql, whereVars, token) || []
        setRows(data)
      }
    } catch (err: any) {
      console.error(`[SchemaTable] ${tableName}:`, err.message)
      setRows([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [tableName, searchText, page, token, meta])

  useEffect(() => { fetchData() }, [fetchData])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchData() }, 300)
    return () => clearTimeout(t)
  }, [searchText])

  useImperativeHandle(ref, () => ({
    setFilter(_field: string, value: string) { setSearchText(value) },
    highlightRows(ids: string[]) { setHighlighted(ids) },
    refresh() { fetchData() },
  }), [fetchData])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  if (!meta) return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</div>

  const visibleCols = meta ? de(meta).fields : []
  const colSpan = visibleCols.length || 1

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜索..."
            style={{ width: 240, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 14 }}
          />
          {onCreate && tablePerms[tableName]?.canCreate !== false && (
            <button onClick={onCreate}
              style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >+ 新建</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, color: '#666' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ width: 36, height: 36, border: '1px solid #d9d9d9', background: '#fff', borderRadius: 6, fontSize: 18, cursor: page <= 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >‹</button>
          <span style={{ minWidth: 60, textAlign: 'center' }}>{page} / {totalPages || 1}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            style={{ width: 36, height: 36, border: '1px solid #d9d9d9', background: '#fff', borderRadius: 6, fontSize: 18, cursor: page >= totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >›</button>
          <span style={{ marginLeft: 8 }}>共 {totalCount} 条</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fafafa', borderBottom: '2px solid #e8e8e8' }}>
              {visibleCols.map(f => (
                <th key={f.name} style={{
                  padding: '8px 12px', textAlign: 'left', fontWeight: 600,
                  color: '#555', whiteSpace: 'nowrap',
                }}>
                  {fieldLabel(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} style={{ padding: 40, textAlign: 'center', color: '#999' }}>加载中...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>暂无数据</td></tr>
            ) : rows.map(row => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.id)}
                style={{
                  cursor: 'pointer',
                  background: highlighted.includes(row.id) ? '#fff3cd' : undefined,
                  borderBottom: '1px solid #f0f0f0',
                }}
                onMouseEnter={e => { if (!highlighted.includes(row.id)) (e.currentTarget as HTMLElement).style.background = '#f5f5f5' }}
                onMouseLeave={e => { if (!highlighted.includes(row.id)) (e.currentTarget as HTMLElement).style.background = '' }}
              >
                {visibleCols.map(f => (
                  <td key={f.name} style={{ padding: '6px 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                    {renderCell(row, f)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
})

export default SchemaTable
