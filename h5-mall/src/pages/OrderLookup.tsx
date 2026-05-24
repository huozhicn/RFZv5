import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

interface OrderSummary {
  id: string; order_no: string; total_amount: number
  status: string; payment_method: string
  created_at: string; items_preview: string
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  '待付款': { label: '待付款', cls: 'pending' },
  '已付款': { label: '已付款', cls: 'paid' },
  '已发货': { label: '已发货', cls: 'shipped' },
  '已完成': { label: '已完成', cls: 'done' },
  '已取消': { label: '已取消', cls: 'cancelled' },
}

export default function OrderLookup() {
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!phone.trim()) return
    if (!/^1\d{10}$/.test(phone.trim())) return

    setLoading(true)
    setSearched(true)
    try {
      const custRows = await sdbQuery<any[]>(
        `SELECT id, name FROM customer WHERE phone='${phone.trim()}' LIMIT 1`
      )
      if (!custRows?.[0]) { setOrders([]); return }
      const custId = custRows[0].id

      const rows = await sdbQuery<any[]>(
        `SELECT id, order_no, total_amount, status, payment_method, created_at FROM sales_order WHERE customer=${custId} ORDER BY created_at DESC LIMIT 20`
      )

      const summaries: OrderSummary[] = []
      for (const r of (rows || [])) {
        const items = await sdbQuery<any[]>(
          `SELECT variant.sku, variant.spu.name AS product_name FROM order_item WHERE order=${r.id} LIMIT 3`
        )
        const preview = (items || []).map((i: any) => i.product_name || '').filter(Boolean).join('、')
        summaries.push({
          id: r.id, order_no: r.order_no, total_amount: r.total_amount,
          status: r.status, payment_method: r.payment_method,
          created_at: r.created_at, items_preview: preview || '',
        })
      }
      setOrders(summaries)
    } catch (err) {
      console.error('Order lookup error:', err)
    } finally { setLoading(false) }
  }

  return (
    <div>
      {/* 我的 — 头部 */}
      <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#f5f0eb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 8px',
        }}>👤</div>
        <div style={{ fontSize: 14, color: '#999' }}>查看您的订单和活动报名</div>
      </div>

      {/* 手机号搜索 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input type="tel" placeholder="输入手机号查询"
          value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          maxLength={11}
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #d9d9d9', borderRadius: 8, fontSize: 15, background: '#fff' }} />
        <button onClick={handleSearch}
          style={{ padding: '10px 20px', background: '#c41e3a', color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 500 }}>
          查询
        </button>
      </div>

      {loading && (
        <div>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 12, marginBottom: 12 }} />)}
        </div>
      )}

      {!loading && searched && orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">未找到订单</div>
          <div style={{ fontSize: 13, color: '#bbb', marginTop: 4 }}>试试其他手机号？</div>
        </div>
      )}

      {!loading && !searched && (
        <div className="empty-state" style={{ padding: '8px 20px' }}>
          <div style={{ fontSize: 13, color: '#ccc' }}>↑ 输入手机号查看历史记录</div>
        </div>
      )}

      {orders.map(order => {
        const s = STATUS_LABELS[order.status] || { label: order.status, cls: '' }
        return (
          <div key={order.id} className="order-card" onClick={() => nav(`/order/${order.id}`)}>
            <div className="oc-header">
              <div>
                <div className="oc-no">{order.order_no}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                  {order.created_at?.toString().slice(0, 19).replace('T', ' ')}
                </div>
              </div>
              <span className={`status-badge ${s.cls}`}>{s.label}</span>
            </div>
            {order.items_preview && (
              <div className="oc-items">{order.items_preview}</div>
            )}
            <div className="oc-footer">
              <span style={{ fontSize: 13, color: '#999' }}>{order.payment_method}</span>
              <span className="oc-total">¥{order.total_amount}</span>
            </div>
          </div>
        )
      })}

      <div style={{ height: 16 }} />
    </div>
  )
}
