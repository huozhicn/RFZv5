import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

interface ActivityDetail {
  id: string
  name: string
  description: string
  main_image_url: string
  detail_image_urls: string[]
  start_date?: string
  end_date?: string
  cycle_description?: string
  capacity: number
  base_price: number
}
interface SignupVariant {
  id: string
  sku: string
  name: string
  price: number
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [variant, setVariant] = useState<SignupVariant | null>(null)
  const [signups, setSignups] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadActivity(id)
  }, [id])

  async function loadActivity(aid: string) {
    try {
      const rows = await sdbQuery<any[]>(`SELECT * FROM product WHERE id=${aid} LIMIT 1`)
      if (!rows?.[0]) { setLoading(false); return }
      const a = rows[0]
      // Not an activity → redirect to product detail
      if (a.product_type !== '活动') {
        nav(`/product/${aid}`, { replace: true })
        return
      }
      setActivity({
        id: a.id, name: a.name, description: a.description || '',
        main_image_url: a.main_image_url,
        detail_image_urls: a.detail_image_urls || [],
        start_date: a.start_date, end_date: a.end_date,
        cycle_description: a.cycle_description,
        capacity: a.capacity || 0,
        base_price: a.base_price || 0,
      })

      // Get variant for signup
      const varRows = await sdbQuery<any[]>(
        `SELECT id, sku, name, (SELECT price FROM pricing WHERE variant=$parent.id AND is_active=true LIMIT 1)[0].price AS price FROM product_variant WHERE spu=${aid} LIMIT 1`
      )
      if (varRows?.[0]) {
        setVariant({
          id: varRows[0].id, sku: varRows[0].sku, name: varRows[0].name,
          price: varRows[0].price || a.base_price,
        })
      }

      // Count existing signups
      if (varRows?.[0]) {
        const countRows = await sdbQuery<any[]>(
          `SELECT math::sum(order_item.quantity) AS total FROM order_item WHERE variant=${varRows[0].id} AND order.status NOT IN ['已取消'] GROUP ALL`
        )
        setSignups(countRows?.[0]?.total || 0)
      }
    } catch (err) {
      console.error('Activity load error:', err)
    } finally {
      setLoading(false)
    }
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
        <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12, background: '#f0ebe3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, marginBottom: 16 }}>
          🎋
        </div>
      )}

      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{activity.name}</h2>
      {activity.description && <p style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: 1.8 }}>{activity.description}</p>}

      {/* 活动信息 */}
      <div className="activity-meta">
        {isOneTime ? (
          <>
            <div className="meta-row">
              <span className="meta-label">开始时间</span>
              <span className="meta-value">{formatDate(activity.start_date)}</span>
            </div>
            {activity.end_date && (
              <div className="meta-row">
                <span className="meta-label">截止时间</span>
                <span className="meta-value">{formatDate(activity.end_date)}</span>
              </div>
            )}
          </>
        ) : (
          <div className="meta-row">
            <span className="meta-label">活动周期</span>
            <span className="meta-value">{activity.cycle_description || '长期活动'}</span>
          </div>
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
        ) : variant ? (
          <button className="btn-primary" onClick={() => nav(`/product/${activity.id}`)}>
            {activity.base_price > 0 ? `立即报名 ¥${variant.price}` : '免费报名'}
          </button>
        ) : (
          <button className="btn-primary" disabled>暂不可报名</button>
        )}
      </div>

      <div style={{ height: 80 }} />
    </div>
  )
}
