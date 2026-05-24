import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

interface ActivityData {
  id: string; name: string; description: string
  main_image_url: string; detail_image_urls: string[]
  start_date?: string; end_date?: string
  cycle_description?: string
  capacity: number; base_price: number
}
interface SignupVariant { id: string; sku: string; name: string; price: number }

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [activity, setActivity] = useState<ActivityData | null>(null)
  const [variant, setVariant] = useState<SignupVariant | null>(null)
  const [signups, setSignups] = useState(0)
  const [loading, setLoading] = useState(true)

  // Signup form
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) loadActivity(id)
  }, [id])

  async function loadActivity(aid: string) {
    try {
      const rows = await sdbQuery<any[]>(`SELECT * FROM product WHERE id=${aid} LIMIT 1`)
      if (!rows?.[0]) { setLoading(false); return }
      const a = rows[0]
      if (a.product_type !== '活动') { nav(`/product/${aid}`, { replace: true }); return }
      setActivity({
        id: a.id, name: a.name, description: a.description || '',
        main_image_url: a.main_image_url, detail_image_urls: a.detail_image_urls || [],
        start_date: a.start_date, end_date: a.end_date,
        cycle_description: a.cycle_description, capacity: a.capacity || 0,
        base_price: a.base_price || 0,
      })

      const varRows = await sdbQuery<any[]>(
        `SELECT id, sku, name, (SELECT price FROM pricing WHERE variant=$parent.id AND is_active=true LIMIT 1)[0].price AS price FROM product_variant WHERE spu=${aid} LIMIT 1`
      )
      if (varRows?.[0]) {
        setVariant({ id: varRows[0].id, sku: varRows[0].sku, name: varRows[0].name, price: varRows[0].price || a.base_price })
        const countRows = await sdbQuery<any[]>(
          `SELECT math::sum(order_item.quantity) AS total FROM order_item WHERE variant=${varRows[0].id} AND order.status NOT IN ['已取消'] GROUP ALL`
        )
        setSignups(countRows?.[0]?.total || 0)
      }
    } catch (err) { console.error('Activity load error:', err) }
    finally { setLoading(false) }
  }

  async function handleSignup() {
    if (!name.trim()) { setError('请输入姓名'); return }
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) { setError('请输入正确的手机号'); return }
    if (!variant) { setError('活动信息异常，请刷新重试'); return }

    setSubmitting(true)
    setError('')
    try {
      // 1. Upsert customer
      const custRows = await sdbQuery<any[]>(`SELECT id FROM customer WHERE phone='${phone.trim()}' LIMIT 1`)
      let custId: string
      if (custRows?.[0]) {
        custId = custRows[0].id
        await sdbQuery(`UPDATE ${custId} SET name='${name.trim().replace(/'/g, "\\'")}'`)
      } else {
        const cr = await sdbQuery<any[]>(`CREATE customer CONTENT { name: '${name.trim().replace(/'/g, "\\'")}', phone: '${phone.trim()}' }`)
        custId = cr?.[0]?.id
      }

      // 2. Generate order number
      const today = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const countRes = await sdbQuery<any[]>(`SELECT count() FROM sales_order WHERE created_at >= d'${new Date().toISOString().slice(0, 10)}' GROUP ALL`)
      const seq = String((countRes?.[0]?.count || 0) + 1).padStart(3, '0')
      const orderNo = `SO${today}${seq}`

      // 3. Create order — free activities get '已完成' status immediately
      const totalAmount = variant.price
      const orderStatus = totalAmount === 0 ? '已完成' : '待付款'
      const orderRes = await sdbQuery<any[]>(
        `CREATE sales_order CONTENT {
          order_no: '${orderNo}', customer: ${custId},
          total_amount: ${totalAmount}, status: '${orderStatus}',
          payment_method: '线下付款',
          notes: '${notes.trim().replace(/'/g, "\\'")} (活动报名: ${activity!.name.replace(/'/g, "\\'")})',
          sync_status: 'pending', created_by: user:h5_visitor
        }`
      )
      const orderId = orderRes?.[0]?.id

      // 4. Create order item + deduct inventory
      await sdbQuery(
        `CREATE order_item CONTENT { order: ${orderId}, variant: ${variant.id}, quantity: 1, unit_price: ${variant.price}, amount: ${variant.price} }`
      )
      await sdbQuery(`UPDATE store_inventory SET quantity = quantity - 1 WHERE variant=${variant.id}`)

      sessionStorage.setItem('just_placed_order', orderId)
      nav(`/order/${orderId}`, { replace: true })
    } catch (err: any) {
      setError(err.message || '报名失败，请重试')
    } finally { setSubmitting(false) }
  }

  function formatDate(d?: string): string {
    if (!d) return ''
    return d.slice(0, 16).replace('T', ' ')
  }

  if (loading) {
    return <div><div className="skeleton" style={{ aspectRatio: '16/9', marginBottom: 16, borderRadius: 12 }} /><div className="skeleton" style={{ height: 200, borderRadius: 12 }} /></div>
  }
  if (!activity) {
    return <div className="empty-state"><div className="empty-icon">😕</div><div className="empty-text">活动不存在</div></div>
  }

  const isOneTime = !!activity.start_date
  const remaining = activity.capacity > 0 ? activity.capacity - signups : 999
  const isFull = activity.capacity > 0 && remaining <= 0

  return (
    <div>
      {/* 封面图 */}
      {activity.main_image_url ? (
        <img src={activity.main_image_url} alt={activity.name} style={{ width: '100%', borderRadius: 12, marginBottom: 16 }} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, background: '#f0ebe3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, marginBottom: 16 }}>🎋</div>
      )}

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{activity.name}</h2>
      {activity.description && <p style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 1.8 }}>{activity.description}</p>}

      {/* 活动信息 */}
      <div className="activity-meta">
        {isOneTime ? (
          <>
            <div className="meta-row"><span className="meta-label">开始时间</span><span className="meta-value">{formatDate(activity.start_date)}</span></div>
            {activity.end_date && <div className="meta-row"><span className="meta-label">截止时间</span><span className="meta-value">{formatDate(activity.end_date)}</span></div>}
          </>
        ) : (
          <div className="meta-row"><span className="meta-label">活动周期</span><span className="meta-value">{activity.cycle_description || '长期活动'}</span></div>
        )}
        {activity.capacity > 0 && (
          <div className="meta-row">
            <span className="meta-label">报名情况</span>
            <span className="meta-value" style={{ color: isFull ? '#d93025' : remaining <= 5 ? '#d46b08' : '#333' }}>
              {signups}/{activity.capacity} {isFull ? '(已满)' : remaining <= 5 ? `(仅剩${remaining}位)` : ''}
            </span>
          </div>
        )}
        <div className="meta-row">
          <span className="meta-label">费用</span>
          <span className="meta-value" style={{ color: '#c41e3a', fontWeight: 700 }}>
            {activity.base_price > 0 ? `¥${activity.base_price}` : '免费'}
          </span>
        </div>
      </div>

      {/* 详情图 */}
      {activity.detail_image_urls.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-header"><h2>活动详情</h2></div>
          {activity.detail_image_urls.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
          ))}
        </div>
      )}

      {/* 报名按钮 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', padding: '12px 16px', borderTop: '1px solid #e8e8e8', zIndex: 50 }}>
        {isFull ? (
          <button className="btn-primary" disabled style={{ background: '#999' }}>报名已满</button>
        ) : (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            {activity.base_price > 0 ? `立即报名 ¥${variant?.price || activity.base_price}` : '免费报名'}
          </button>
        )}
      </div>

      {/* 报名表单弹窗 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>活动报名</h3>
              <button onClick={() => { setShowForm(false); setError('') }}
                style={{ background: 'none', fontSize: 24, color: '#999', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ background: '#f5f0eb', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{activity.name}</div>
              <div style={{ color: '#999' }}>
                {isOneTime ? formatDate(activity.start_date) : activity.cycle_description}
                {activity.base_price > 0 ? ` · ¥${activity.base_price}` : ' · 免费'}
              </div>
            </div>

            <div className="form-group">
              <label>姓名 *</label>
              <input type="text" placeholder="您的称呼" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>手机号 *</label>
              <input type="tel" placeholder="用于接收活动通知" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
            </div>
            <div className="form-group">
              <label>备注（选填）</label>
              <textarea placeholder="如有特殊需求请注明" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>

            {error && <div style={{ color: '#d93025', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

            <button className="btn-primary" disabled={submitting} onClick={handleSignup}>
              {submitting ? '提交中...' : '确认报名'}
            </button>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  )
}
