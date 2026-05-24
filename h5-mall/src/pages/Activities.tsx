import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

interface ActivityItem {
  id: string; name: string; description: string
  main_image_url: string; base_price: number
  start_date?: string; end_date?: string
  cycle_description?: string
  capacity: number; signup_count: number
}

export default function Activities() {
  const nav = useNavigate()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadActivities() }, [])

  async function loadActivities() {
    try {
      const rows = await sdbQuery<any[]>(
        `SELECT id, name, description, main_image_url, base_price, start_date, end_date, cycle_description, capacity FROM product WHERE product_type='活动' AND is_listed=true ORDER BY created_at DESC`
      )
      if (!rows) { setLoading(false); return }

      const list: ActivityItem[] = []
      for (const a of rows) {
        let signupCount = 0
        try {
          const vr = await sdbQuery<any[]>(`SELECT id FROM product_variant WHERE spu=${a.id} LIMIT 1`)
          if (vr?.[0]) {
            const cr = await sdbQuery<any[]>(
              `SELECT math::sum(order_item.quantity) AS total FROM order_item WHERE variant=${vr[0].id} AND order.status NOT IN ['已取消'] GROUP ALL`
            )
            signupCount = cr?.[0]?.total || 0
          }
        } catch {}
        list.push({ ...a, signup_count: signupCount })
      }
      setActivities(list)
    } catch (err) { console.error('Activities load error:', err) }
    finally { setLoading(false) }
  }

  function formatDate(d?: string): string {
    if (!d) return ''
    const s = d.slice(0, 16).replace('T', ' ')
    // 友好显示：如果是单日活动，只显示日期+时间
    const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/)
    if (m) return `${m[1]} ${m[2]}`
    return s
  }

  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12, marginBottom: 16 }} />
        ))}
      </div>
    )
  }

  // Split into upcoming and past
  const now = new Date()
  const upcoming = activities.filter(a => {
    if (!a.end_date) return true // ongoing activities always upcoming
    return new Date(a.end_date) >= now
  })
  const past = activities.filter(a => {
    if (!a.end_date) return false
    return new Date(a.end_date) < now
  })

  return (
    <div>
      {activities.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🎋</div>
          <div className="empty-text">暂无活动，敬请期待</div>
        </div>
      )}

      {/* 进行中的活动 */}
      {upcoming.map(a => {
        const isOneTime = !!a.start_date
        const remaining = a.capacity > 0 ? a.capacity - a.signup_count : 999
        const isFull = a.capacity > 0 && remaining <= 0
        const dateLabel = isOneTime
          ? `${formatDate(a.start_date)}${a.end_date ? ' ~ ' + formatDate(a.end_date).split(' ')[0] : ''}`
          : a.cycle_description || '长期活动'

        return (
          <div key={a.id} onClick={() => nav(`/activity/${a.id}`)}
            style={{
              background: '#fff', borderRadius: 12, overflow: 'hidden',
              marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
            {a.main_image_url ? (
              <img src={a.main_image_url} alt={a.name}
                style={{ width: '100%', height: 160, objectFit: 'cover' }} loading="lazy" />
            ) : (
              <div style={{ width: '100%', height: 160, background: 'linear-gradient(135deg, #c41e3a22, #c41e3a08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56 }}>🎋</div>
            )}
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, flex: 1, marginRight: 12 }}>{a.name}</h3>
                <span style={{
                  flexShrink: 0, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: isFull ? '#fff1f0' : a.base_price > 0 ? '#fff7e6' : '#f6ffed',
                  color: isFull ? '#d93025' : a.base_price > 0 ? '#d46b08' : '#389e0d',
                }}>
                  {isFull ? '已满' : a.base_price > 0 ? `¥${a.base_price}` : '免费'}
                </span>
              </div>
              {a.description && (
                <p style={{ fontSize: 13, color: '#666', marginBottom: 10, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {a.description}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#999' }}>
                <span>📅 {dateLabel}</span>
                {a.capacity > 0 && (
                  <span style={{ color: isFull ? '#d93025' : remaining <= 5 ? '#d46b08' : '#999' }}>
                    {a.signup_count}/{a.capacity}人
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* 往期活动 */}
      {past.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="section-header"><h2 style={{ color: '#999' }}>往期活动</h2></div>
          {past.map(a => (
            <div key={a.id} onClick={() => nav(`/activity/${a.id}`)}
              style={{
                background: '#fafafa', borderRadius: 10, padding: 14, marginBottom: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                border: '1px solid #f0f0f0',
              }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#999' }}>{a.name}</div>
                <div style={{ fontSize: 12, color: '#bbb', marginTop: 2 }}>{formatDate(a.end_date)} 截止</div>
              </div>
              <span style={{ fontSize: 12, color: '#bbb' }}>{a.signup_count}人参加</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
