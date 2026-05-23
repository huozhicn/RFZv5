/**
 * Agent 通信协议 — 前端与 Hermes Agent 之间的消息格式
 *
 * 数据流：用户输入 → agent_message 表 → SDB EVENT → Hermes Webhook
 *        → Agent 处理 → UPDATE agent_message → LIVE QUERY → 前端渲染
 */

// ── Agent 返回的操作指令 ──

export type AgentAction =
  | NavigateAction
  | FilterAction
  | HighlightAction
  | OpenDetailAction
  | OpenCreateAction
  | DataAction
  | ConfirmAction
  | DownloadAction
  | RefreshAction
  | ReplyAction

export interface NavigateAction {
  type: 'navigate'
  route: string                          // e.g. '/tables/store_inventory'
  params?: Record<string, string>        // query params
}

export interface FilterAction {
  type: 'filter'
  field: string                          // 列 key
  value: string                          // 筛选值
}

export interface HighlightAction {
  type: 'highlight'
  row_ids: string[]                      // 要高亮的行 ID 列表
}

export interface OpenDetailAction {
  type: 'open_detail'
  record_id: string                      // record ID e.g. 'store:abc123'
}

export interface OpenCreateAction {
  type: 'open_create'
  table: string                          // table name
  prefill?: Record<string, unknown>      // 预填字段
}

export interface DataAction {
  type: 'data'
  title: string
  columns: ColumnDef[]
  rows: Record<string, unknown>[]
}

export interface ColumnDef {
  key: string
  title: string
  width?: number
  sortable?: boolean
}

export interface ConfirmAction {
  type: 'confirm'
  message: string
  on_confirm: { sql: string; vars?: Record<string, unknown> }
}

export interface DownloadAction {
  type: 'download'
  format: 'csv' | 'pdf'
  sql: string
  filename?: string
}

export interface RefreshAction {
  type: 'refresh'
}

export interface ReplyAction {
  type: 'reply'
  text: string
}

// ── Agent 完整响应 ──

export interface AgentResponse {
  message_id: string
  status: 'done' | 'error'
  reply: string                        // 始终有文字回复
  actions: AgentAction[]               // 前端逐一执行
  error?: string                       // status=error 时的错误信息
}

// ── 新消息（前端 → SDB） ──

export interface Attachment {
  name: string
  type: string       // MIME type
  data: string       // base64
  size: number       // bytes
}

export interface AgentMessage {
  id: string
  user_input: string
  attachments: Attachment[] | null
  response: string | null
  actions: AgentAction[] | null
  status: 'pending' | 'processing' | 'done' | 'error'
  session_id: string
  created_by: string
  created_at: string
  processed_at: string | null
}
