import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'

interface OrderSummary {
  id: string; order_no: string; total_amount: number
  status: string; payment_method: string
  created_at: string; items_preview: string
}
interface ActivitySignup {
  order_id: string; order_no: string
  activity_name: string; status: string
  created_at: string
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  '待付款': { label: '待付款', cls: 'pending' },
  '已付款': { label: '已付款', cls: 'paid' },
  '已发货': { label: '已发货', cls: 'shipped' },
  '已完成': { label: '已完成', cls: 'done' },
  '已取消': { label: '已取消', cls: 'cancelled' },
}

export default function Profile() {
  const nav = useNavigate()
  const auth = useCustomerAuth()
  const customer = auth.customer
  const [tab, setTab] = useState<'orders' | 'activities'>('orders')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [activities, setActivities] = useState<ActivitySignup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (customer) loadData(customer.id)
  }, [customer])

  async function loadData(cid: string) {
    setLoading(true)
    try {
      // Orders
      const orderRows = await sdbQuery<any[]>(
        `SELECT id, order_no, total_amount, status, payment_method, created_at FROM sales_order WHERE customer=${cid} ORDER BY created_at DESC LIMIT 30`
      )
      const summaries: OrderSummary[] = []
      for (const r of (orderRows || [])) {
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

      // Activity signups — orders that contain activity variants
      const actRows = await sdbQuery<any[]>(
        `SELECT id, order_no, status, created_at,
          (SELECT variant.spu.name AS activity_name FROM order_item WHERE order=$parent.id AND variant.spu.product_type='活动' LIMIT 1)[0].activity_name AS activity_name
         FROM sales_order WHERE customer=${cid} AND status NOT IN ['已取消']
         ORDER BY created_at DESC LIMIT 20`
      )
      setActivities((actRows || []).filter((a: any) => a.activity_name).map((a: any) => ({
        order_id: a.id, order_no: a.order_no,
        activity_name: a.activity_name, status: a.status,
        created_at: a.created_at,
      })))
    } catch (err) {
      console.error('Profile load error:', err)
    } finally { setLoading(false) }
  }

  // Not logged in
  if (!customer) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>👤</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>登录后查看更多</div>
        <div style={{ fontSize: 13, color: '#999', marginBottom: 24 }}>查看订单、活动报名、管理个人信息</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn-primary" style={{ width: 140 }} onClick={() => nav('/login')}>登录</button>
          <button className="btn-outline" style={{ width: 140 }} onClick={() => nav('/login?register=1')}>注册</button>
        </div>

        {/* Quick order lookup for non-logged-in */}
        <div style={{ marginTop: 40, borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
          <div style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>或者直接输入手机号查订单</div>
          <PhoneLookup />
        </div>
      </div>
    )
  }

  // Logged in
  return (
    <div>
      {/* Profile Header */}
      <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
        <div onClick={() => nav('/profile/edit')} style={{ cursor: 'pointer' }}>
          {customer.avatar ? (
            <img src={customer.avatar} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px', border: '3px solid #c41e3a' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#c41e3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, margin: '0 auto 8px' }}>
              {customer.name?.[0] || '?'}
            </div>
          )}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{customer.name}</div>
        <div style={{ fontSize: 13, color: '#999' }}>{customer.phone}</div>
      </div>

      {/* Menu — 不含订单和活动（已在 Tab 中） */}
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <MenuItem icon="✏️" label="编辑资料" onClick={() => nav('/profile/edit')} />
        <MenuItem icon="🔒" label="修改密码" onClick={() => nav('/profile/password')} />
      </div>

      {/* Tab content */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: 12 }}>
          <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')}>我的订单</TabBtn>
          <TabBtn active={tab === 'activities'} onClick={() => setTab('activities')}>我的活动</TabBtn>
        </div>

        {loading && (
          <div>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 8 }} />)}
          </div>
        )}

        {!loading && tab === 'orders' && orders.length === 0 && (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon">📦</div>
            <div className="empty-text">暂无订单</div>
          </div>
        )}
        {!loading && tab === 'activities' && activities.length === 0 && (
          <div className="empty-state" style={{ padding: 24 }}>
            <div className="empty-icon">🎋</div>
            <div className="empty-text">暂无活动报名</div>
          </div>
        )}

        {tab === 'orders' && orders.map(order => {
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
              {order.items_preview && <div className="oc-items">{order.items_preview}</div>}
              <div className="oc-footer">
                <span style={{ fontSize: 13, color: '#999' }}>{order.payment_method}</span>
                <span className="oc-total">¥{order.total_amount}</span>
              </div>
            </div>
          )
        })}

        {tab === 'activities' && activities.map(a => {
          const s = STATUS_LABELS[a.status] || { label: a.status, cls: '' }
          return (
            <div key={a.order_id} className="order-card" onClick={() => nav(`/order/${a.order_id}`)}>
              <div className="oc-header">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{a.activity_name}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                    {a.created_at?.toString().slice(0, 19).replace('T', ' ')}
                  </div>
                </div>
                <span className={`status-badge ${s.cls}`}>{s.label}</span>
              </div>
              <div className="oc-footer">
                <span className="oc-no">{a.order_no}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Logout */}
      <button className="btn-outline" onClick={() => { auth.logout(); window.dispatchEvent(new Event('auth-change')); }}
        style={{ color: '#999', borderColor: '#d9d9d9' }}>
        退出登录
      </button>

      <div style={{ height: 80 }} />
    </div>
  )
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', fontSize: 15 }}>
      <span>{icon} {label}</span>
      <span style={{ color: '#ccc' }}>›</span>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{
      flex: 1, textAlign: 'center', padding: '10px 0', fontSize: 14, fontWeight: active ? 600 : 400,
      color: active ? '#c41e3a' : '#666', borderBottom: active ? '2px solid #c41e3a' : '2px solid transparent',
      cursor: 'pointer',
    }}>{children}</div>
  )
}

// Quick phone lookup (for non-logged-in users)
function PhoneLookup() {
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) return
    setLoading(true); setSearched(true)
    try {
      const custRows = await sdbQuery<any[]>(`SELECT id FROM customer WHERE phone='${phone.trim()}' LIMIT 1`)
      if (!custRows?.[0]) { setOrders([]); return }
      const rows = await sdbQuery<any[]>(
        `SELECT id, order_no, total_amount, status, payment_method, created_at FROM sales_order WHERE customer=${custRows[0].id} ORDER BY created_at DESC LIMIT 20`
      )
      const summaries: OrderSummary[] = []
      for (const r of (rows || [])) {
        const items = await sdbQuery<any[]>(`SELECT variant.sku, variant.spu.name AS product_name FROM order_item WHERE order=${r.id} LIMIT 3`)
        const preview = (items || []).map((i: any) => i.product_name || '').filter(Boolean).join('、')
        summaries.push({ id: r.id, order_no: r.order_no, total_amount: r.total_amount, status: r.status, payment_method: r.payment_method, created_at: r.created_at, items_preview: preview || '' })
      }
      setOrders(summaries)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="tel" placeholder="输入手机号" value={phone} onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()} maxLength={11}
          style={{ flex: 1, padding: '8px 12px', border: '1px solid #d9d9d9', borderRadius: 8, fontSize: 14, background: '#fff' }} />
        <button onClick={handleSearch}
          style={{ padding: '8px 16px', background: '#c41e3a', color: '#fff', borderRadius: 8, fontSize: 13 }}>查询</button>
      </div>
      {loading && <div style={{ marginTop: 12 }}>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8, marginBottom: 8 }} />)}</div>}
      {!loading && searched && orders.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#999', fontSize: 14 }}>未找到订单</div>}
      {orders.map(order => {
        const s = STATUS_LABELS[order.status] || { label: order.status, cls: '' }
        return (
          <div key={order.id} className="order-card" onClick={() => nav(`/order/${order.id}`)} style={{ marginTop: 8 }}>
            <div className="oc-header">
              <div><div className="oc-no">{order.order_no}</div></div>
              <span className={`status-badge ${s.cls}`}>{s.label}</span>
            </div>
            <div className="oc-footer">
              <span style={{ fontSize: 13, color: '#999' }}>{order.payment_method}</span>
              <span className="oc-total">¥{order.total_amount}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
