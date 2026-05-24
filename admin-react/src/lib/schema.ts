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


// 表名 → 中文标签（静态兜底，运行时从 schema.json 覆盖）
const TABLE_LABELS: Record<string, { label: string; group: string }> = {
  product:             { label: '商品列表',    group: 'product' },
  product_category:    { label: '产品类目',    group: 'product' },
  product_variant:     { label: '产品SKU',     group: '_hidden' },
  pricing:             { label: '定价',        group: 'product' },
  store_inventory:     { label: '库存查看',    group: 'inventory' },
  inventory_count:     { label: '盘点',        group: 'inventory' },
  restock_request:     { label: '补货',        group: 'inventory' },
  sales_order:         { label: '销售订单',    group: 'sales' },
  order_item:          { label: '订单明细',    group: '_hidden' },
  customer:            { label: '会员列表',    group: 'crm' },
  user:                { label: '用户',        group: '_hidden' },
  carousel:            { label: '轮播图',      group: 'store_settings' },
  featured_product:    { label: '推荐商品',    group: 'store_settings' },
  store_info:          { label: '流通处信息',  group: 'store_settings' },
  announcement:        { label: '公告',        group: 'store_settings' },
}

export function getTableLabel(name: string): string {
  // 优先从已加载 schema 取
  if (_schemaSnapshot && _schemaSnapshot[name]?.label) {
    return _schemaSnapshot[name].label
  }
  return TABLE_LABELS[name]?.label || name
}

// 菜单配置（从 schema.json 的 @label/@group 注释生成）
// GROUP_ORDER 定义分组显示顺序和中文名
const GROUP_ORDER: Record<string, string> = {
  sales: '日常销售',
  product: '商品管理',
  activity: '活动运营',
  inventory: '库存管理',
  crm: '会员管理',
  store_settings: '商城设置',
}

// 特殊菜单项：复用已有表但用不同过滤条件
const MENU_OVERRIDES: { key: string; label: string; tables: { key: string; label: string }[] }[] = [
  { key: 'activity', label: '活动运营', tables: [
    { key: 'product:活动', label: '活动列表' },
  ]},
]

let _menuConfig: MenuGroup[] = []
let _menuBuilt = false

function buildMenuFromSchema(schema: Record<string, TableMeta>): MenuGroup[] {
  // 按 group 聚合 tables
  const groups: Record<string, { key: string; label: string }[]> = {}
  for (const [name, meta] of Object.entries(schema)) {
    const g = meta.group || 'default'
    if (g === '_hidden' || g === 'default') continue
    if (!groups[g]) groups[g] = []
    // 跳过已在 overrides 中单独处理的表
    const isOverridden = MENU_OVERRIDES.some(o => o.tables.some(t => t.key.startsWith(name)))
    if (!isOverridden) {
      groups[g].push({ key: name, label: meta.label || name })
    }
  }

  // 按 GROUP_ORDER 排序
  const result: MenuGroup[] = []
  for (const [gkey, glabel] of Object.entries(GROUP_ORDER)) {
    const tables = groups[gkey]
    // 检查是否有 override 替换这个 group
    const override = MENU_OVERRIDES.find(o => o.key === gkey)
    if (override) {
      result.push({ key: gkey, label: glabel, tables: override.tables })
      continue
    }
    if (tables && tables.length > 0) {
      result.push({ key: gkey, label: glabel, tables })
    }
  }

  // 追加未在 GROUP_ORDER 中定义的分组
  for (const [gkey, tables] of Object.entries(groups)) {
    if (!GROUP_ORDER[gkey] && tables.length > 0) {
      result.push({ key: gkey, label: gkey, tables })
    }
  }

  return result
}

export function getMenuGroups(): MenuGroup[] {
  if (_menuBuilt && _menuConfig.length > 0) return _menuConfig
  // 兜底：用已加载的 schema 即时构建
  if (_schemaSnapshot) {
    _menuConfig = buildMenuFromSchema(_schemaSnapshot)
    _menuBuilt = true
  }
  return _menuConfig
}

export async function loadMenuConfig(): Promise<MenuGroup[]> {
  // 从 schema.json 构建菜单（需先加载 schema）
  if (!_schemaSnapshot) {
    try {
      const resp = await fetch('/v5/schema.json')
      if (resp.ok) {
        const raw = await resp.json()
        const temp: Record<string, TableMeta> = {}
        for (const [name, data] of Object.entries(raw)) {
          const d = data as any
          temp[name] = {
            name, fields: [], label: d.label || name, group: d.group || '',
            canCreate: true, canUpdate: true, canDelete: true,
          }
        }
        _menuConfig = buildMenuFromSchema(temp)
        _menuBuilt = true
      }
    } catch {}
  }
  return _menuConfig
}

// 表名 → 中文标签（从 schema.json 构建，TABLE_LABELS 作兜底）
function buildTableLabels(schema: Record<string, TableMeta>): Record<string, { label: string; group: string }> {
  const result: Record<string, { label: string; group: string }> = {}
  for (const [name, meta] of Object.entries(schema)) {
    result[name] = { label: meta.label || name, group: meta.group || '' }
  }
  // 确保 fallback 值存在
  for (const [k, v] of Object.entries(TABLE_LABELS)) {
    if (!result[k]) result[k] = v
  }
  return result
}

let _tableLabels: Record<string, { label: string; group: string }> = TABLE_LABELS

export function getTableLabels() { return _tableLabels }


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
          label: tableData.label || getTableLabel(name),
          group: tableData.group || '',
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
