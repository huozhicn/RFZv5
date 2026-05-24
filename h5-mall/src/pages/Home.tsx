import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

const CAT_ICONS: Record<string, string> = {
  '经书': '📖', '法器': '🔔', '念珠': '📿', '香品': '🕯️', '佛像': '🧘', '文创': '🎨',
}

interface CarouselItem { id: string; image_url: string; link_url?: string }
interface CategoryItem { id: string; name: string }
interface ProductItem { id: string; name: string; main_image_url: string }
interface ProductWithPrice extends ProductItem { price: number; variantId: string }
interface StoreInfo { name: string; address: string; phone: string; business_hours: string; description: string; logo_url?: string }
interface AnnounceItem { id: string; title: string; content: string; link_type?: string; link_target?: string }
interface ActivityItem {
  id: string; name: string; main_image_url: string; base_price: number
  start_date?: string; end_date?: string; cycle_description?: string
  capacity: number; signup_count: number
}

export default function Home() {
  const nav = useNavigate()
  const [carousels, setCarousels] = useState<CarouselItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [featured, setFeatured] = useState<ProductWithPrice[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [announcements, setAnnouncements] = useState<AnnounceItem[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    try {
      const [carouselRes, catRes, featRes, storeRes, annRes, actRes] = await Promise.all([
        sdbQuery<any[]>('SELECT id, image_url, link_url, sort_order FROM carousel WHERE is_active=true ORDER BY sort_order LIMIT 5'),
        sdbQuery<any[]>('SELECT id, name, sort_order FROM product_category ORDER BY sort_order'),
        sdbQuery<any[]>('SELECT id, product.name AS product_name, product.main_image_url, product.id AS productId, sort_order FROM featured_product ORDER BY sort_order LIMIT 6 FETCH product'),
        sdbQuery<any[]>('SELECT * FROM store_info LIMIT 1'),
        sdbQuery<any[]>('SELECT id, title, content, link_type, link_target, created_at FROM announcement WHERE is_active=true ORDER BY created_at DESC LIMIT 3'),
        sdbQuery<any[]>(`SELECT id, name, main_image_url, base_price, start_date, end_date, cycle_description, capacity, created_at FROM product WHERE product_type='活动' AND is_listed=true ORDER BY created_at DESC LIMIT 10`),
      ])
      setCarousels(carouselRes || [])
      setCategories(catRes || [])
      setFeatured([]) // will populate below
      setStoreInfo((storeRes || [])[0] || null)
      setAnnouncements(annRes || [])

      // Process featured: get pricing + variant for each
      if (featRes && featRes.length > 0) {
        const featuredItems: ProductWithPrice[] = []
        for (const f of featRes) {
          const pid = f.productId
          try {
            const varRows = await sdbQuery<any[]>(
              `SELECT id FROM product_variant WHERE spu=${pid} LIMIT 1`
            )
            const vid = varRows?.[0]?.id || ''
            let price = 0
            if (vid) {
              const priceRows = await sdbQuery<any[]>(
                `SELECT price FROM pricing WHERE variant=${vid} AND is_active=true LIMIT 1`
              )
              price = priceRows?.[0]?.price || 0
            }
            featuredItems.push({
              id: pid,
              name: f.product_name || '',
              main_image_url: f.main_image_url || '',
              price,
              variantId: vid,
            })
          } catch {}
        }
        setFeatured(featuredItems.filter(x => x.name))
      }

      // Load signup counts for each activity
      const actList: ActivityItem[] = []
      for (const a of (actRes || [])) {
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
        actList.push({ ...a, signup_count: signupCount })
      }
      setActivities(actList)
    } catch (err) { console.error('Home load error:', err) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (carousels.length <= 1) return
    const timer = setInterval(() => setCarouselIdx(i => (i + 1) % carousels.length), 3000)
    return () => clearInterval(timer)
  }, [carousels.length])

  return (
    <div>
      {/* 轮播图 */}
      {carousels.filter(c => c.image_url).length > 0 && (
        <div className="carousel">
          <img src={carousels[carouselIdx].image_url} alt="" />
          {carousels.length > 1 && (
            <div className="carousel-dots">
              {carousels.map((_, i) => (
                <div key={i} className={`carousel-dot${i === carouselIdx ? ' active' : ''}`} onClick={() => setCarouselIdx(i)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 流通处信息 */}
      {storeInfo && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#c41e3a', marginBottom: 4 }}>{storeInfo.name}</h2>
          <p style={{ fontSize: 13, color: '#999' }}>{storeInfo.description}</p>
        </div>
      )}

      {/* 分类入口 */}
      {categories.length > 0 && (
        <>
          <div className="section-header">
            <h2>法宝分类</h2>
            <span className="more" onClick={() => nav('/products')}>全部 ›</span>
          </div>
          <div className="category-row">
            {categories.map(cat => (
              <div key={cat.id} className="category-chip" onClick={() => nav(`/products?cat=${cat.id}`)}>
                <span className="chip-icon">{CAT_ICONS[cat.name] || '📦'}</span>
                <span className="chip-label">{cat.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 近期活动 — 横滑卡片 */}
      {activities.length > 0 && (
        <div style={{ marginTop: 4, marginBottom: 20 }}>
          <div className="section-header">
            <h2>近期活动</h2>
            <span className="more" onClick={() => nav('/products?activity=1')}>全部 ›</span>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
            {activities.map(a => {
              const isFull = a.capacity > 0 && a.signup_count >= a.capacity
              const dateStr = a.start_date
                ? a.start_date.slice(0, 16).replace('T', ' ')
                : a.cycle_description || '长期活动'
              return (
                <div key={a.id} onClick={() => nav(`/activity/${a.id}`)}
                  style={{
                    flexShrink: 0, width: 220, background: '#fff', borderRadius: 12,
                    overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                  {a.main_image_url ? (
                    <img src={a.main_image_url} alt={a.name} style={{ width: '100%', height: 110, objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: 110, background: '#f0ebe3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🎋</div>
                  )}
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>📅 {dateStr}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: a.base_price > 0 ? '#c41e3a' : '#389e0d' }}>
                        {a.base_price > 0 ? `¥${a.base_price}` : '免费'}
                      </span>
                      {a.capacity > 0 && (
                        <span style={{ fontSize: 11, color: isFull ? '#d93025' : '#999' }}>
                          {isFull ? '已满' : `${a.signup_count}/${a.capacity}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 推荐商品 */}
      {featured.length > 0 && (
        <>
          <div className="section-header"><h2>推荐法宝</h2></div>
          <div className="product-grid">
            {featured.map(p => (
              <div key={p.id} className="product-card" onClick={() => nav(`/product/${p.id}`)}>
                {p.main_image_url ? (
                  <img className="card-img" src={p.main_image_url} alt={p.name} loading="lazy" />
                ) : (
                  <div className="card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📦</div>
                )}
                <div className="card-body">
                  <div className="card-name">{p.name}</div>
                  {p.price > 0 && <div className="card-price">¥{p.price}</div>}
                  {p.price === 0 && <div className="card-price" style={{ color: '#389e0d' }}>免费</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 公告 */}
      {announcements.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="section-header"><h2>公告</h2></div>
          {announcements.map(a => {
            function handleClick() {
              if (a.link_type === 'activity' && a.link_target) {
                nav(`/activity/${a.link_target}`)
              } else if (a.link_type === 'product' && a.link_target) {
                nav(`/product/${a.link_target}`)
              }
            }
            return (
              <div key={a.id} className="announce-bar"
                onClick={handleClick}
                style={{ cursor: (a.link_type && a.link_target) ? 'pointer' : 'default' }}>
                <span className="ann-icon">📢</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{a.content}</div>
                </div>
                {(a.link_type && a.link_target) && <span style={{ color: '#c41e3a', fontSize: 13 }}>›</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* 营业信息 */}
      {storeInfo && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 16, fontSize: 13, color: '#666' }}>
          <div style={{ marginBottom: 4 }}>📍 {storeInfo.address}</div>
          <div style={{ marginBottom: 4 }}>📞 {storeInfo.phone}</div>
          <div style={{ marginBottom: 8 }}>🕐 {storeInfo.business_hours}</div>
          <div onClick={() => nav('/store')} style={{ textAlign: 'center', color: '#c41e3a', cursor: 'pointer', paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
            查看流通处介绍 ›
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
