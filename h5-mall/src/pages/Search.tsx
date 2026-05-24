import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'

interface ProductResult {
  id: string; name: string; main_image_url: string
  product_type: string; min_price: number
}

const STORAGE_KEY = 'h5_search_history'
const MAX_HISTORY = 10

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveHistory(terms: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(terms.slice(0, MAX_HISTORY)))
}

export default function Search() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const initialQ = params.get('q') || ''
  const [query, setQuery] = useState(initialQ)
  const [results, setResults] = useState<ProductResult[]>([])
  const [history, setHistory] = useState<string[]>(loadHistory())
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (initialQ) doSearch(initialQ)
  }, [])

  async function doSearch(q: string) {
    const term = q.trim()
    if (!term) return
    setQuery(term)
    setLoading(true); setSearched(true)

    // Add to history
    const updated = [term, ...history.filter(h => h !== term)]
    setHistory(updated)
    saveHistory(updated)

    try {
      const rows = await sdbQuery<any[]>(
        `SELECT id, name, main_image_url, product_type, created_at FROM product WHERE is_listed=true AND name CONTAINS '${term.replace(/'/g, "\\'")}' ORDER BY created_at DESC LIMIT 20`
      )
      if (!rows) { setResults([]); return }
      const list: ProductResult[] = []
      for (const r of rows) {
        let minPrice = 0
        try {
          const pr = await sdbQuery<any[]>(`SELECT price FROM pricing WHERE variant.spu=${r.id} AND is_active=true ORDER BY price ASC LIMIT 1`)
          if (pr?.[0]) minPrice = pr[0].price
        } catch {}
        list.push({ id: r.id, name: r.name, main_image_url: r.main_image_url, product_type: r.product_type, min_price: minPrice })
      }
      setResults(list)
    } catch (err) { console.error('Search error:', err) }
    finally { setLoading(false) }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    doSearch(query)
  }

  function clearHistory() {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  function handleResultClick(p: ProductResult) {
    if (p.product_type === '活动') {
      nav(`/activity/${p.id}`)
    } else {
      nav(`/product/${p.id}`)
    }
  }

  return (
    <div>
      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="text" placeholder="搜索法宝或活动..." value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
          style={{ flex: 1, padding: '10px 14px', border: '1px solid #d9d9d9', borderRadius: 8, fontSize: 15, background: '#fff' }} />
        <button type="submit"
          style={{ padding: '10px 20px', background: '#c41e3a', color: '#fff', borderRadius: 8, fontSize: 15, fontWeight: 500 }}>
          搜索
        </button>
      </form>

      {loading && (
        <div className="product-grid">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 12 }} />)}
        </div>
      )}

      {/* Results */}
      {!loading && searched && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">未找到「{query}」相关结果</div>
        </div>
      )}

      {!loading && searched && results.length > 0 && (
        <div className="product-grid">
          {results.map(p => (
            <div key={p.id} className="product-card" onClick={() => handleResultClick(p)}>
              {p.main_image_url ? (
                <img className="card-img" src={p.main_image_url} alt={p.name} loading="lazy" />
              ) : (
                <div className="card-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, background: '#f0ebe3' }}>
                  {p.product_type === '活动' ? '🎋' : '📦'}
                </div>
              )}
              <div className="card-body">
                <div className="card-name">{p.name}</div>
                {p.product_type === '活动' ? (
                  <div className="card-price" style={{ color: '#389e0d', fontSize: 13 }}>查看活动 ›</div>
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

      {/* No search yet — show history */}
      {!searched && (
        <div>
          {history.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600 }}>搜索历史</h3>
                <span style={{ fontSize: 13, color: '#999', cursor: 'pointer' }} onClick={clearHistory}>清空</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {history.map((term, i) => (
                  <span key={i} onClick={() => doSearch(term)}
                    style={{ padding: '6px 14px', background: '#fff', borderRadius: 16, fontSize: 13, color: '#666', cursor: 'pointer', border: '1px solid #f0f0f0' }}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>热门搜索</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['金刚经', '念珠', '线香', '心经', '禅修', '铜灯'].map(term => (
                <span key={term} onClick={() => doSearch(term)}
                  style={{ padding: '6px 14px', background: '#fff', borderRadius: 16, fontSize: 13, color: '#c41e3a', cursor: 'pointer', border: '1px solid #c41e3a22' }}>
                  {term}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}
