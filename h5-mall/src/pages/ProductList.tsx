import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sdbQuery, embed } from '@/lib/sdb'
import { CatIcon, IconHome, IconLeaf, IconSearch, IconBox } from '@/components/icons'

interface Product {
  id: string
  name: string
  main_image_url: string
  product_type: string
  category_name: string
  min_price: number
}

// Special category value for activity filter
const ACTIVITY_CAT = '_activity_'

export default function ProductList() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const catFilter = params.get('cat') || ''
  const isActivity = params.get('activity') === '1'
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState(isActivity ? ACTIVITY_CAT : catFilter)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [activeCat])

  async function loadData() {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        loadProducts(activeCat, search),
        sdbQuery<{ id: string; name: string }[]>('SELECT id, name, sort_order FROM product_category ORDER BY sort_order'),
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
    const baseFields = 'id, name, main_image_url, product_type, category.name AS category_name, created_at'
    if (q) {
      const vector = await embed(q)
      const vectorStr = '[' + vector.join(',') + ']'
      sql = `SELECT ${baseFields}, vector::similarity::cosine(content_embedding, ${vectorStr}) AS _score FROM product WHERE is_listed=true AND content_embedding IS NOT NONE ORDER BY _score DESC LIMIT 30`
    } else if (catId === ACTIVITY_CAT) {
      sql = `SELECT ${baseFields} FROM product WHERE is_listed=true AND product_type='活动' ORDER BY created_at DESC LIMIT 30`
    } else if (catId) {
      sql = `SELECT ${baseFields} FROM product WHERE is_listed=true AND category=${catId} ORDER BY created_at DESC LIMIT 30`
    } else {
      sql = `SELECT ${baseFields} FROM product WHERE is_listed=true ORDER BY created_at DESC LIMIT 30`
    }
    
    const rows = await sdbQuery<any[]>(sql)
    if (!rows || rows.length === 0) return []

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

  function handleSearch() { loadData() }

  function selectCat(cat: string) {
    setActiveCat(activeCat === cat ? '' : cat)
    setSearch('')
  }

  const chipBase = { border: '1px solid #e8e2d8', background: '#fff' }
  const chipActive = { border: '1px solid #333', background: '#fafaf6' }

  return (
    <div>
      {/* 搜索栏 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input type="text" placeholder="搜索法宝或活动..." value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, padding: '10px 0', border: 'none', borderBottom: '1px solid #e8e2d8', fontSize: 14, background: 'transparent', color: '#333' }} />
        <button onClick={handleSearch}
          style={{ padding: '10px 16px', color: '#333', fontSize: 14 }}><IconSearch size={18} /></button>
      </div>

      {/* 分类筛选 */}
      <div className="category-row" style={{ marginBottom: 4 }}>
        <div className="category-chip"
          onClick={() => { setActiveCat(''); setSearch('') }}
          style={!activeCat ? chipActive : chipBase}>
          <IconHome size={20} />
          <span className="chip-label">全部</span>
        </div>
        <div className="category-chip"
          onClick={() => selectCat(ACTIVITY_CAT)}
          style={activeCat === ACTIVITY_CAT ? chipActive : chipBase}>
          <IconLeaf size={20} />
          <span className="chip-label">活动</span>
        </div>
        {categories.map(cat => (
          <div key={cat.id} className="category-chip"
            onClick={() => selectCat(cat.id)}
            style={activeCat === cat.id ? chipActive : chipBase}>
            <CatIcon name={cat.name} size={20} />
            <span className="chip-label">{cat.name}</span>
          </div>
        ))}
      </div>

      {/* 商品/活动列表 */}
      {loading ? (
        <div className="product-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ aspectRatio: '3/4' }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><IconSearch size={40} /></div>
          <div className="empty-text">{activeCat === ACTIVITY_CAT ? '暂无活动' : '没有找到相关法宝'}</div>
        </div>
      ) : (
        <div className="product-grid">
          {products.map(p => (
            <div key={p.id} className="product-card"
              onClick={() => nav(p.product_type === '活动' ? `/activity/${p.id}` : `/product/${p.id}`)}>
              {p.main_image_url ? (
                <img className="card-img" src={p.main_image_url} alt={p.name} loading="lazy" />
              ) : (
                <div className="card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f0eb' }}>
                  {p.product_type === '活动' ? <IconLeaf size={32} /> : <CatIcon name={p.category_name} size={32} />}
                </div>
              )}
              <div className="card-body">
                <div className="card-name">{p.name}</div>
                {p.product_type === '活动' ? (
                  <div className="card-price" style={{ color: '#999', fontSize: 12 }}>查看活动</div>
                ) : p.min_price > 0 ? (
                  <div className="card-price">¥{p.min_price}</div>
                ) : (
                  <div className="card-price" style={{ color: '#999' }}>免费</div>
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
