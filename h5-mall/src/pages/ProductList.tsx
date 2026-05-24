import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

interface Product {
  id: string
  name: string
  main_image_url: string
  product_type: string
  category_name: string
  min_price: number
}

const CAT_LABELS: Record<string, string> = {
  '经书': '📖', '法器': '🔔', '念珠': '📿', '香品': '🕯️', '佛像': '🧘', '文创': '🎨',
}

export default function ProductList() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const catFilter = params.get('cat') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(catFilter)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [activeCat])

  async function loadData() {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        loadProducts(activeCat, search),
        sdbQuery<{ id: string; name: string }[]>('SELECT id, name FROM product_category ORDER BY sort_order'),
      ])
      setProducts(prodRes)
      setCategories(catRes || [])
    } catch (err) {
      console.error('ProductList error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadProducts(catId: string, q: string): Promise<Product[]> {
    let sql: string
    if (q) {
      sql = `SELECT id, name, main_image_url, product_type, category.name AS category_name FROM product WHERE is_listed=true AND name CONTAINS '${q.replace(/'/g, "\\'")}' ORDER BY created_at DESC LIMIT 30`
    } else if (catId) {
      sql = `SELECT id, name, main_image_url, product_type, category.name AS category_name FROM product WHERE is_listed=true AND category=${catId} ORDER BY created_at DESC LIMIT 30`
    } else {
      sql = `SELECT id, name, main_image_url, product_type, category.name AS category_name FROM product WHERE is_listed=true ORDER BY created_at DESC LIMIT 30`
    }
    
    // Get products + their min pricing
    const rows = await sdbQuery<any[]>(sql)
    if (!rows || rows.length === 0) return []

    // For each product, get the minimum active pricing
    const result: Product[] = []
    for (const r of rows) {
      let minPrice = 0
      try {
        const priceRows = await sdbQuery<any[]>(
          `SELECT price FROM pricing WHERE variant.spu=${r.id} AND is_active=true ORDER BY price ASC LIMIT 1`
        )
        if (priceRows?.[0]) minPrice = priceRows[0].price
      } catch {}
      result.push({
        id: r.id,
        name: r.name,
        main_image_url: r.main_image_url,
        product_type: r.product_type,
        category_name: r.category_name || r.category?.name || '',
        min_price: minPrice,
      })
    }
    return result
  }

  function handleSearch() {
    loadData()
  }

  return (
    <div>
      {/* 搜索栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text" placeholder="搜索法宝..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{
            flex: 1, padding: '8px 14px', border: '1px solid #e8e8e8',
            borderRadius: 20, fontSize: 14, background: '#fff',
          }}
        />
        <button onClick={handleSearch}
          style={{ padding: '8px 16px', background: '#c41e3a', color: '#fff', borderRadius: 20, fontSize: 13 }}>
          搜索
        </button>
      </div>

      {/* 分类筛选 */}
      <div className="category-row" style={{ marginBottom: 4 }}>
        <div className={`category-chip${!activeCat ? ' selected' : ''}`}
          onClick={() => { setActiveCat(''); setSearch('') }}
          style={!activeCat ? { border: '2px solid #c41e3a', background: '#fff5f5' } : {}}>
          <span className="chip-icon">🏠</span>
          <span className="chip-label">全部</span>
        </div>
        {categories.map(cat => (
          <div key={cat.id} className={`category-chip${activeCat === cat.id ? ' selected' : ''}`}
            onClick={() => { setActiveCat(activeCat === cat.id ? '' : cat.id); setSearch('') }}
            style={activeCat === cat.id ? { border: '2px solid #c41e3a', background: '#fff5f5' } : {}}>
            <span className="chip-icon">{CAT_LABELS[cat.name] || '📦'}</span>
            <span className="chip-label">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* 商品列表 */}
      {loading ? (
        <div className="product-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">没有找到相关法宝</div>
        </div>
      ) : (
        <div className="product-grid">
          {products.map(p => (
            <div key={p.id} className="product-card" onClick={() => nav(`/product/${p.id}`)}>
              {p.main_image_url ? (
                <img className="card-img" src={p.main_image_url} alt={p.name} loading="lazy" />
              ) : (
                <div className="card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, background: '#f0ebe3' }}>
                  {CAT_LABELS[p.category_name] || '📦'}
                </div>
              )}
              <div className="card-body">
                <div className="card-name">{p.name}</div>
                {p.product_type === '活动' ? (
                  <div className="card-price" style={{ color: '#389e0d', fontSize: 13 }}>查看活动</div>
                ) : p.min_price > 0 ? (
                  <div className="card-price">¥{p.min_price}</div>
                ) : (
                  <div className="card-price" style={{ color: '#389e0d' }}>免费</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
