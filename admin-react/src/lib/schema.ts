// 流通处 Schema — 字段元数据 + 中文映射
import { sdbQuery } from './sdb'

export interface FieldMeta {
  name: string
  kind: string         // string | int | float | bool | datetime | record | array
  assert: string | null
  default: string | null
  isOption: boolean
  isRecord: boolean
  recordTarget: string | null
  comment: string | null
}

export interface TableMeta {
  name: string
  fields: FieldMeta[]
  label: string
  group: string
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

export interface MenuGroup {
  key: string
  label: string
  tables: { key: string; label: string }[]
}

// 从 SDB INFO FOR TABLE 解析字段元数据
export function parseFieldFromInfo(info: any): FieldMeta[] {
  if (!info || !info.fields) return []
  const fields: Record<string, any> = typeof info.fields === 'object' ? info.fields : {}
  return Object.entries(fields).map(([name, def]: [string, any]) => ({
    name,
    kind: def.kind || 'string',
    assert: def.assert || null,
    default: def.default || null,
    isOption: !!(def.assert || def.default),
    isRecord: def.kind?.startsWith('record') || false,
    recordTarget: def.kind?.match(/record<(\w+)>/)?.[1] || null,
    comment: def.comment || null,
  }))
}

// 隐藏字段
const HIDDEN_FIELDS = new Set(['id', 'password_hash', 'sync_source_id', 'synced_at'])

// 排序字段（始终显示在末尾）
const TAIL_FIELDS = new Set(['created_at', 'updated_at', 'created_by'])

export function getVisibleFields(fields: FieldMeta[]): { fields: FieldMeta[]; fetchClause: string } {
  const visible = fields.filter(f =>
    !f.name.startsWith('_') && !HIDDEN_FIELDS.has(f.name)
  )
  const head = visible.filter(f => !TAIL_FIELDS.has(f.name))
  const tail = visible.filter(f => TAIL_FIELDS.has(f.name))
  const sorted = [...head, ...tail]
  return { fields: sorted, fetchClause: getFetchClause(fields) }
}

export function getFetchClause(fields: FieldMeta[]): string {
  const recordFields = fields.filter(f => f.isRecord && f.recordTarget)
  if (recordFields.length === 0) return ''
  return `FETCH ${recordFields.map(f => f.name).join(', ')}`
}

// 菜单配置（从 menu-config.json 加载）
let _menuConfig: MenuGroup[] = []

export function getMenuGroups(): MenuGroup[] {
  return _menuConfig || []
}

export async function loadMenuConfig(): Promise<MenuGroup[]> {
  try {
    const resp = await fetch('/v5/menu-config.json')
    _menuConfig = await resp.json()
    return _menuConfig
  } catch {
    // Fallback: hardcoded menu
    _menuConfig = [
      { key: 'product', label: '商品管理', tables: [
        { key: 'product', label: '产品SPU' },
        { key: 'product_variant', label: '产品SKU' },
        { key: 'product_category', label: '产品类目' },
        { key: 'pricing', label: '定价' },
      ]},
      { key: 'inventory', label: '库存管理', tables: [
        { key: 'store_inventory', label: '库存' },
        { key: 'inventory_count', label: '盘点' },
        { key: 'restock_request', label: '补货' },
      ]},
      { key: 'order', label: '订单管理', tables: [
        { key: 'sales_order', label: '销售订单' },
        { key: 'order_item', label: '订单明细' },
      ]},
      { key: 'crm', label: '客户管理', tables: [
        { key: 'customer', label: '会员' },
      ]},
      { key: 'org', label: '系统管理', tables: [
        { key: 'user', label: '用户' },
      ]},
    ]
    return _menuConfig
  }
}

// 表名 → 中文标签
const TABLE_LABELS: Record<string, { label: string; group: string }> = {}
export function getTableLabel(name: string): string {
  return TABLE_LABELS[name]?.label || name
}

// 字段中文映射
const FIELD_ZH: Record<string, string> = {
  id: 'ID', name: '名称', display_name: '显示名称', title: '标题',
  description: '描述', notes: '备注', reason: '原因',
  status: '状态', role: '角色',
  sku: 'SKU编码', price: '售价', base_price: '基准价',
  quantity: '数量', amount: '金额', total_amount: '总金额', unit_price: '单价',
  category: '类目', spu: '所属SPU', variant: 'SKU',
  customer: '客户', phone: '电话', wechat: '微信', address: '地址',
  order: '订单', order_no: '订单号',
  sync_status: '同步状态', sync_source_id: '来源ID', synced_at: '同步时间',
  is_active: '启用',
  diff: '差异', prev_stock: '盘前库存', actual_stock: '实盘库存',
  counted_by: '盘点人', counted_at: '盘点时间',
  main_image_url: '主图', detail_image_urls: '详情图',
  password_hash: '密码哈希',
  created_by: '操作人', created_at: '创建时间', updated_at: '更新时间',
  user_input: '用户输入', response: '回复', session_id: '会话ID',
  attachments: '附件', actions: '操作', processed_at: '处理时间',
  sort_order: '排序',
}

export function fieldLabel(field: FieldMeta): string {
  return FIELD_ZH[field.name] || field.comment || field.name
}

// 值格式化
const ENUM_LABELS: Record<string, string> = {
  '待付款': '待付款', '已付款': '已付款', '已发货': '已发货',
  '已完成': '已完成', '已取消': '已取消',
  '待处理': '待处理', '已处理': '已处理', '已拒绝': '已拒绝',
  'pending': '待同步', 'synced': '已同步', 'failed': '失败',
  '管理员': '管理员', '店员': '店员',
}

export function extractEnumOptions(assert: string | null): string[] {
  if (!assert) return []
  return (assert.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1))
}

export function formatValue(value: any, field: FieldMeta): string {
  if (value == null) return '-'
  if (field.isRecord && typeof value === 'object' && value) {
    return value.name || value.sku || value.display_name || String(value.id || '-')
  }
  if (field.kind === 'datetime') {
    const s = String(value)
    const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
    return m ? `${m[1]} ${m[2]}` : s
  }
  if (field.assert) {
    const opts = extractEnumOptions(field.assert)
    if (opts.length > 0 && opts.length <= 8) {
      return ENUM_LABELS[value] || String(value)
    }
  }
  if (typeof value === 'boolean') return value ? '是' : '否'
  return String(value)
}

// Schema 快照缓存
let _schemaSnapshot: Record<string, TableMeta> | null = null

export async function loadSchema(token?: string): Promise<Record<string, TableMeta>> {
  // 从 INFO FOR TABLE 逐表加载
  const tables = getMenuGroups().flatMap(g => g.tables.map(t => t.key))
  const result: Record<string, TableMeta> = {}
  
  for (const name of tables) {
    try {
      const info = await sdbQuery(`INFO FOR TABLE ${name}`, undefined, token)
      const raw = Array.isArray(info) ? info[0] : info
      if (raw) {
        const fields = parseFieldFromInfo(raw)
        result[name] = {
          name,
          fields,
          label: getTableLabel(name),
          group: '',
          canCreate: true,
          canUpdate: true,
          canDelete: true,
        }
      }
    } catch {
      // 表可能还没创建
    }
  }
  
  _schemaSnapshot = result
  return result
}

export function getSchemaSnapshot(): Record<string, TableMeta> {
  return _schemaSnapshot || {}
}

export function getTableMeta(name: string): TableMeta | undefined {
  return (_schemaSnapshot || {})[name]
}

// ── v45 兼容层 — 让 SchemaTable/DetailPanel 直接能用 ──

export const extractEnumValues = extractEnumOptions

// de() = 从 TableMeta 提取可见字段 + FETCH 子句
export function de(meta: TableMeta | null): { fields: FieldMeta[]; fetchClause: string } {
  if (!meta) return { fields: [], fetchClause: '' }
  return getVisibleFields(meta.fields)
}

// v45 兼容：visibleFields 接受 TableMeta，返回 {fields, fetchClause}
export function visibleFields(meta: TableMeta): { fields: FieldMeta[]; fetchClause: string } {
  return getVisibleFields(meta.fields)
}

// 从 schema-snapshot 加载（兼容旧接口）
export async function loadTableMetas(token?: string): Promise<Map<string, TableMeta>> {
  const snapshot = await loadSchema(token)
  const map = new Map<string, TableMeta>()
  for (const [k, v] of Object.entries(snapshot)) {
    map.set(k, v)
  }
  return map
}
