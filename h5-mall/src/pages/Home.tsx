import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

// 分类 emoji 映射
const CAT_ICONS: Record<string, string> = {
  '经书': '📖', '法器': '🔔', '念珠': '📿', '香品': '🕯️', '佛像': '🧘', '文创': '🎨',
}

interface CarouselItem { id: string; image_url: string; link_url?: string }
interface CategoryItem { id: string; name: string }
interface ProductItem { id: string; name: string; main_image_url: string }
interface ProductWithPrice extends ProductItem {
  price: number
  variantId: string
}
interface StoreInfo { name: string; address: string; phone: string; business_hours: string; description: string; logo_url?: string }
interface AnnounceItem { id: string; title: string; content: string }

export default function Home() {
  const nav = useNavigate()
  const [carousels, setCarousels] = useState<CarouselItem[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [featured, setFeatured] = useState<ProductWithPrice[]>([])
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null)
  const [announcements, setAnnouncements] = useState<AnnounceItem[]>([])
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    try {
      const [carouselRes, catRes, featRes, storeRes, annRes] = await Promise.all([
        sdbQuery<any[]>('SELECT id, image_url, link_url FROM carousel WHERE is_active=true ORDER BY sort_order LIMIT 5'),
        sdbQuery<any[]>('SELECT id, name FROM product_category ORDER BY sort_order'),
        sdbQuery<any[]>('SELECT id, product.name, product.main_image_url, product.id AS productId, variant.id AS variantId, (SELECT price FROM pricing WHERE variant=variant.id AND is_active=true LIMIT 1)[0].price AS price FROM featured_product FETCH product FETCH variant ORDER BY sort_order LIMIT 6'),
        sdbQuery<any[]>('SELECT * FROM store_info LIMIT 1'),
        sdbQuery<any[]>('SELECT id, title, content FROM announcement WHERE is_active=true ORDER BY created_at DESC LIMIT 3'),
      ])
      setCarousels(carouselRes || [])
      setCategories(catRes || [])
      setFeatured((featRes || []).map((f: any) => ({
        id: f.productId || f.id,
        name: f.product?.name || f.name || '',
        main_image_url: f.product?.main_image_url || '',
        price: f.price || 0,
        variantId: f.variantId || f.variant?.id || '',
      })).filter((f: any) => f.name))
      setStoreInfo((storeRes || [])[0] || null)
      setAnnouncements(annRes || [])
    } catch (err) {
      console.error('Home load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // 轮播自动播放
  useEffect(() => {
    if (carousels.length <= 1) return
    const timer = setInterval(() => {
      setCarouselIdx(i => (i + 1) % carousels.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [carousels.length])

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', marginBottom: 20, borderRadius: 12 }} />
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width: 72, height: 72, borderRadius: 12, flexShrink: 0 }} />)}
        </div>
        <div className="product-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 轮播图 */}
      {carousels.length > 0 && (
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

      {/* 推荐商品 */}
      {featured.length > 0 && (
        <>
          <div className="section-header">
            <h2>推荐法宝</h2>
          </div>
          <div className="product-grid">
            {featured.map(p => (
              <div key={p.id} className="product-card" onClick={() => nav(`/product/${p.id}`)}>
                {p.main_image_url ? (
                  <img className="card-img" src={p.main_image_url} alt={p.name} loading="lazy" />
                ) : (
                  <div className="card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
                    📦
                  </div>
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
          {announcements.map(a => (
            <div key={a.id} className="announce-bar">
              <span className="ann-icon">📢</span>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: '#999' }}>{a.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 营业信息 */}
      {storeInfo && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 16, fontSize: 13, color: '#666' }}>
          <div style={{ marginBottom: 4 }}>📍 {storeInfo.address}</div>
          <div style={{ marginBottom: 4 }}>📞 {storeInfo.phone}</div>
          <div>🕐 {storeInfo.business_hours}</div>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
