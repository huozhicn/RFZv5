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

export function getVisibleFields(fields: FieldMeta[], tableName?: string): { fields: FieldMeta[]; fetchClause: string } {
  const visible = fields.filter(f =>
    !f.name.startsWith('_') && !HIDDEN_FIELDS.has(f.name)
  )
  const head = visible.filter(f => !TAIL_FIELDS.has(f.name))
  const tail = visible.filter(f => TAIL_FIELDS.has(f.name))
  const sorted = [...head, ...tail]
  return { fields: sorted, fetchClause: getFetchClause(fields, tableName) }
}

export function getFetchClause(fields: FieldMeta[], tableName?: string): string {
  const recordFields = fields.filter(f => f.isRecord && f.recordTarget)
  if (recordFields.length === 0) return ''
  
  // 深层 FETCH 映射 — 某些表需要穿透到孙子节点
  const deepFetch: Record<string, string[]> = {
    store_inventory: ['variant.spu'],
    inventory_count: ['variant.spu'],
    restock_request: ['variant.spu'],
    pricing: ['variant.spu'],
    order_item: ['variant.spu', 'order.customer'],
    featured_product: ['product.category'],
  }
  
  const parts = recordFields.map(f => f.name)
  if (tableName && deepFetch[tableName]) {
    parts.push(...deepFetch[tableName])
  }
  
  return `FETCH ${parts.join(', ')}`
}

// 菜单配置（从 menu-config.json 加载，有硬编码兜底）
const DEFAULT_MENU: MenuGroup[] = [
  { key: 'sales', label: '日常销售', tables: [
    { key: 'sales_order', label: '销售订单' },
  ]},
  { key: 'product', label: '商品管理', tables: [
    { key: 'product', label: '商品列表' },
    { key: 'product_category', label: '产品类目' },
    { key: 'pricing', label: '定价' },
  ]},
  { key: 'activity', label: '活动运营', tables: [
    { key: 'product:活动', label: '活动列表' },
  ]},
  { key: 'inventory', label: '库存管理', tables: [
    { key: 'store_inventory', label: '库存查看' },
    { key: 'inventory_count', label: '盘点' },
    { key: 'restock_request', label: '补货' },
  ]},
  { key: 'crm', label: '会员管理', tables: [
    { key: 'customer', label: '会员列表' },
  ]},
  { key: 'store_settings', label: '商城设置', tables: [
    { key: 'carousel', label: '轮播图' },
    { key: 'featured_product', label: '推荐商品' },
    { key: 'store_info', label: '流通处信息' },
    { key: 'announcement', label: '公告' },
  ]},
]

let _menuConfig: MenuGroup[] = DEFAULT_MENU

export function getMenuGroups(): MenuGroup[] {
  return _menuConfig
}

export async function loadMenuConfig(): Promise<MenuGroup[]> {
  try {
    const resp = await fetch('/v5/menu-config.json')
    if (resp.ok) {
      _menuConfig = await resp.json()
    }
  } catch {}
  return _menuConfig
}
// 表名 → 中文标签
const TABLE_LABELS: Record<string, { label: string; group: string }> = {
  product:             { label: '商品列表',    group: '商品管理' },
  product_category:    { label: '产品类目',    group: '商品管理' },
  product_variant:     { label: '产品SKU',     group: '_hidden' },
  pricing:             { label: '定价',        group: '商品管理' },
  store_inventory:     { label: '库存查看',    group: '库存管理' },
  inventory_count:     { label: '盘点',        group: '库存管理' },
  restock_request:     { label: '补货',        group: '库存管理' },
  sales_order:         { label: '销售订单',    group: '日常销售' },
  order_item:          { label: '订单明细',    group: '_hidden' },
  customer:            { label: '会员列表',    group: '会员管理' },
  user:                { label: '用户',        group: '_hidden' },
  carousel:            { label: '轮播图',      group: '商城设置' },
  featured_product:    { label: '推荐商品',    group: '商城设置' },
  store_info:          { label: '流通处信息',  group: '商城设置' },
  announcement:        { label: '公告',        group: '商城设置' },
}
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
  is_active: '启用', is_listed: '上架',
  diff: '差异', prev_stock: '盘前库存', actual_stock: '实盘库存',
  counted_by: '盘点人', counted_at: '盘点时间',
  main_image_url: '主图', detail_image_urls: '详情图',
  password_hash: '密码哈希',
  created_by: '操作人', created_at: '创建时间', updated_at: '更新时间',
  user_input: '用户输入', response: '回复', session_id: '会话ID',
  attachments: '附件', actions: '操作', processed_at: '处理时间',
  sort_order: '排序',
  product_type: '类型', start_date: '开始日期', end_date: '截止日期',
  cycle_description: '周期说明', capacity: '报名上限',
  payment_method: '支付方式',
  image_url: '图片地址', link_url: '跳转链接',
  product: '商品', content: '内容',
  business_hours: '营业时间', logo_url: 'Logo',
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
  '在线支付': '在线支付', '线下付款': '线下付款',
  '商品': '商品', '活动': '活动',
}

export function extractEnumOptions(assert: string | null): string[] {
  if (!assert) return []
  return (assert.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1))
}

/** 格式化 record 对象 — 优先 SKU，穿透 spu 显示产品名 */
function recordLabel(val: any): string {
  if (!val || typeof val !== 'object') return String(val || '-')
  if (val.sku) {
    const spuName = val.spu?.name || ''
    return spuName ? `${val.sku} [${spuName}]` : val.sku
  }
  if (val.spu?.name) return `${val.spu.name} · ${val.name || ''}`
  return val.name || val.display_name || val.title || String(val.id || '-')
}

export function formatValue(value: any, field: FieldMeta): string {
  if (value == null || value === '') return '-'
  if (field.isRecord && typeof value === 'object' && value) {
    return recordLabel(value)
  }
  if (field.kind === 'datetime') {
    const s = String(value)
    const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/)
    return m ? `${m[1]} ${m[2]}` : s
  }
  if (field.kind.startsWith('array')) {
    if (Array.isArray(value)) return value.length === 0 ? '-' : `${value.length} 项`
    return String(value) || '-'
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
  try {
    const resp = await fetch('/v5/schema.json')
    if (resp.ok) {
      const raw = await resp.json()
      const result: Record<string, TableMeta> = {}
      for (const [name, data] of Object.entries(raw)) {
        const tableData = data as any
        const fields: FieldMeta[] = (tableData.fields || []).map((f: any) => {
          const kind = f.kind || 'string'
          const isRecord = kind.startsWith('record<')
          return {
            name: f.name,
            kind,
            isRecord,
            recordTarget: isRecord ? kind.match(/record<(\w+)>/)![1] : '',
            isOption: !!(f.assert || f.default),
            comment: f.comment || null,
            assert: f.assert || null,
            default: f.default || null,
          }
        })
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
      _schemaSnapshot = result
      return result
    }
  } catch {}
  _schemaSnapshot = {}
  return {}
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
  return getVisibleFields(meta.fields, meta.name)
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
