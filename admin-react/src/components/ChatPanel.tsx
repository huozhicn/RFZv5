import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'
import { subscribeAgentMessages } from '@/agent/live-query'
import { dispatchActions, type TableController, type DetailController } from '@/agent/dispatcher'
import type { AgentAction, AgentMessage, DataAction, ConfirmAction, Attachment } from '@/agent/types'
import { parseMarkdown } from '@/lib/markdown'

interface ChatMsg {
  id: string
  role: 'user' | 'agent'
  text: string
  attachments?: Attachment[]
  status: 'pending' | 'sent' | 'done' | 'error'
  actions: AgentAction[]
  timestamp: string
}

interface Props {
  tableRefs: React.MutableRefObject<Map<string, TableController>>
  currentTable: string
  detailCtrl: DetailController
}

export default function ChatPanel({ tableRefs, currentTable, detailCtrl }: Props) {
  const auth = useAuth()
  const sessionIdRef = useRef(`sess_${Date.now()}`)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [inputText, setInputText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function scrollBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  // ── file helpers ──

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function addFiles(files: FileList | File[]) {
    const newAttachments: Attachment[] = []
    for (const f of files) {
      if (attachments.length + newAttachments.length >= 10) break // max 10
      const data = await fileToBase64(f)
      newAttachments.push({ name: f.name, type: f.type, data, size: f.size })
    }
    setAttachments(prev => [...prev, ...newAttachments])
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const f = items[i].getAsFile()
        if (f) imageFiles.push(f)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      addFiles(imageFiles)
    }
  }

  // ── send ──

  async function sendMessage() {
    const text = inputText.trim()
    if ((!text && attachments.length === 0) || sending) return
    setSending(true)
    try {
      const result = await sdbQuery(
        `INSERT INTO agent_message { user_input: $input, attachments: $atts, status: 'pending', session_id: $sid, created_by: $uid }`,
        {
          input: text,
          atts: attachments.length > 0 ? attachments : null,
          sid: sessionIdRef.current,
          uid: auth.user?.id ?? '',
        },
        auth.token
      )
      setMessages(prev => [...prev, {
        id: result?.[0]?.id ?? '', role: 'user', text,
        attachments: [...attachments], status: 'sent',
        actions: [], timestamp: new Date().toISOString(),
      }])
      setInputText('')
      setAttachments([])
      setTimeout(scrollBottom, 100)
    } catch (err: any) {
      console.error('[Chat] send failed:', err.message)
    } finally {
      setSending(false)
    }
  }

  function handleKeydown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── clear history ──

  function clearHistory() {
    setMessages([])
    setAttachments([])
    sessionIdRef.current = `sess_${Date.now()}`
  }

  // ── confirm ──

  async function execConfirm(a: ConfirmAction, msgId: string) {
    setConfirming(true)
    try {
      await sdbQuery(a.on_confirm.sql, a.on_confirm.vars, auth.token)
      setMessages(prev => [...prev, {
        id: msgId + '_done', role: 'agent', text: '✅ 已执行',
        status: 'done', actions: [], timestamp: new Date().toISOString(),
      }])
      dispatchActions([{ type: 'refresh' }], {
        router: null as any, tableRefs: tableRefs.current, detailRef: detailCtrl,
      })
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: msgId + '_err', role: 'agent', text: `❌ 执行失败: ${err.message}`,
        status: 'error', actions: [], timestamp: new Date().toISOString(),
      }])
    } finally {
      setConfirming(false)
    }
  }

  // ── agent response ──

  // 用 ref 存 detailCtrl，避免 useCallback 依赖变化导致 useEffect 重订阅
  const detailCtrlRef = useRef(detailCtrl)
  detailCtrlRef.current = detailCtrl

  const handleAgentResponse = useCallback((row: AgentMessage) => {
    setMessages(prev => {
      // 去重：同一 agent 消息不重复添加
      const agentId = row.id + '_agent'
      if (prev.some(m => m.id === agentId)) return prev
      return [...prev, {
        id: agentId, role: 'agent',
        text: row.response ?? '',
        status: (row.status as 'done' | 'error'),
        actions: row.actions || [],
        timestamp: row.created_at || '',
      }]
    })
    dispatchActions(row.actions || [], {
      router: null as any, tableRefs: tableRefs.current, detailRef: detailCtrlRef.current,
    })
    setTimeout(scrollBottom, 100)
  }, [])  // 空依赖 — 不随 props 变化重建

  useEffect(() => {
    if (!auth.token) return
    const unsub = subscribeAgentMessages(sessionIdRef.current, (rows) => {
      for (const row of rows) handleAgentResponse(row)
    }, auth.token)
    return unsub
  }, [auth.token, handleAgentResponse])

  // ── file size helper ──

  function fmtSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // ── render ──

  return (
    <div style={{
      width: 380, minWidth: 380,
      borderLeft: '1px solid #e8e8e8',
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* header */}
      <div style={{
        padding: '12px 16px', fontWeight: 600, fontSize: 14,
        borderBottom: '1px solid #e8e8e8', flexShrink: 0, background: '#fafafa',
      }}>💬 对话</div>

      {/* typing animation styles */}
      <style>{`
        @keyframes ruyi-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes ruyi-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .ruyi-typing { display: inline-flex; align-items: center; gap: 2px; padding: 4px 0; }
        .ruyi-typing span { width: 5px; height: 5px; border-radius: 50%; background: #1677ff; display: inline-block; }
        .ruyi-typing span:nth-child(1) { animation: ruyi-bounce 1.2s infinite 0s; }
        .ruyi-typing span:nth-child(2) { animation: ruyi-bounce 1.2s infinite 0.2s; }
        .ruyi-typing span:nth-child(3) { animation: ruyi-bounce 1.2s infinite 0.4s; }
        .ruyi-thinking { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #888; animation: ruyi-pulse 2s infinite; }
      `}</style>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div>输入指令开始对话</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>试试：「看库存」「新建客户张三」</div>
          </div>
        )}

        {messages.map(msg => {
          const dataActs = msg.actions.filter(a => a.type === 'data') as DataAction[]
          const confirmActs = msg.actions.filter(a => a.type === 'confirm') as ConfirmAction[]

          return (
            <div key={msg.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '90%', padding: '8px 14px', borderRadius: 12,
                  background: msg.role === 'user' ? '#e8f0fe' : '#f1f3f4',
                  fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word', overflow: 'hidden',
                }}>
                  {msg.role === 'agent' && msg.status === 'pending' && (
                    <div className="ruyi-thinking" style={{ marginBottom: 4 }}>
                      <div className="ruyi-typing"><span /><span /><span /></div>
                      如意思考中…
                    </div>
                  )}
                  {msg.status === 'error' && <div style={{ color: '#d93025', fontSize: 11, marginBottom: 4 }}>⚠ 出错</div>}
                  {msg.role === 'user' ? msg.text : parseMarkdown(msg.text)}

                  {/* ── attachments in bubble ── */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {msg.attachments.map((att, i) => (
                        <div key={i} style={{
                          width: 72, borderRadius: 8, overflow: 'hidden',
                          border: '1px solid #e0e0e0', background: '#fff',
                        }}>
                          {att.type.startsWith('image/') ? (
                            <img src={`data:${att.type};base64,${att.data}`}
                              alt={att.name}
                              style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }}
                            />
                          ) : (
                            <div style={{
                              width: 72, height: 72, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: 24, color: '#999',
                            }}>📄</div>
                          )}
                          <div style={{
                            fontSize: 9, color: '#999', padding: '1px 4px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{att.name}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* data actions */}
                  {dataActs.map((a, i) => (
                    <div key={i} style={{ marginTop: 8, overflow: 'auto' }}>
                      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: '#555' }}>{a.title}</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead><tr style={{ background: '#f5f5f5' }}>
                          {a.columns.map(c => <th key={c.key} style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.title}</th>)}
                        </tr></thead>
                        <tbody>{a.rows.map((r, ri) => (
                          <tr key={ri} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            {a.columns.map(c => <td key={c.key} style={{ padding: '3px 6px', whiteSpace: 'nowrap' }}>{String(r[c.key] ?? '-')}</td>)}
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  ))}

                  {/* confirm actions */}
                  {confirmActs.map((a, i) => (
                    <div key={i} style={{ marginTop: 10, padding: '10px 12px', background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>⚠ {a.message}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={confirming} onClick={() => execConfirm(a, msg.id + '_c' + i)} style={{
                          padding: '6px 18px', background: confirming ? '#91caff' : '#1677ff',
                          color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: confirming ? 'not-allowed' : 'pointer',
                        }}>{confirming ? '执行中...' : '确认'}</button>
                        <button style={{
                          padding: '6px 18px', background: '#fff', color: '#666',
                          border: '1px solid #d9d9d9', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                        }}>取消</button>
                      </div>
                    </div>
                  ))}

                  {msg.actions.filter(a => a.type !== 'data' && a.type !== 'confirm').length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {msg.actions.filter(a => a.type !== 'data' && a.type !== 'confirm').map((a, i) => (
                        <span key={i} style={{ padding: '2px 6px', background: '#e6f4ff', borderRadius: 4, fontSize: 11, color: '#1677ff' }}>{a.type}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                {msg.role === 'user' ? '我' : 'Agent'} {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── input area ── */}
      <div style={{
        borderTop: '1px solid #e0e0e0', flexShrink: 0,
        background: '#fff',
      }}>
        {/* attachment previews */}
        {attachments.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 14px 0', flexWrap: 'wrap' }}>
            {attachments.map((att, i) => (
              <div key={i} style={{
                position: 'relative', width: 56, height: 56,
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid #e0e0e0', flexShrink: 0,
              }}>
                {att.type.startsWith('image/') ? (
                  <img src={`data:${att.type};base64,${att.data}`}
                    alt={att.name}
                    style={{ width: 56, height: 56, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 20, background: '#f5f5f5',
                  }}>📄</div>
                )}
                <button onClick={() => removeAttachment(i)} style={{
                  position: 'absolute', top: 1, right: 1,
                  width: 18, height: 18, borderRadius: '50%',
                  border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff',
                  fontSize: 10, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* textarea + toolbar */}
        <div style={{ padding: '10px 14px' }}>
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeydown}
            onPaste={handlePaste}
            placeholder="输入指令... 支持 Ctrl+V 粘贴图片"
            disabled={sending}
            rows={3}
            style={{
              width: '100%', minHeight: 60,
              padding: '10px 12px', border: '1px solid #d9d9d9',
              borderRadius: 12, fontSize: 13, resize: 'none',
              fontFamily: 'inherit', outline: 'none',
              boxSizing: 'border-box',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.max(60, Math.min(el.scrollHeight, 160)) + 'px'
            }}
          />

          {/* bottom bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* clear button */}
              <button
                onClick={clearHistory}
                title="清空对话"
                disabled={messages.length === 0}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid #d9d9d9', background: '#fff',
                  fontSize: 14, cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: messages.length === 0 ? '#ccc' : '#666',
                  opacity: messages.length === 0 ? 0.4 : 1,
                }}
              >🗑️</button>
              {/* attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="添加附件"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1px solid #d9d9d9', background: '#fff',
                  fontSize: 16, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#666',
                }}
              >📎</button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.csv,.xlsx,.docx,.txt"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#bbb' }}>Enter 发送 · Shift+Enter 换行</span>
              <button onClick={sendMessage} disabled={sending || (!inputText.trim() && attachments.length === 0)}
                style={{
                  padding: '7px 20px', background: sending ? '#91caff' : '#1677ff',
                  color: '#fff', border: 'none', borderRadius: 8,
                  fontSize: 13, cursor: sending ? 'not-allowed' : 'pointer',
                  fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >{sending ? '...' : '发送'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
