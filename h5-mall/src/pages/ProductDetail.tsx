import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'
import { cartStore } from '@/stores/cart'
import { IconBox } from '@/components/icons'

interface ProductDetail {
  id: string
  name: string
  description: string
  main_image_url: string
  detail_image_urls: string[]
  category_name: string
  product_type: string
  base_price: number
  start_date?: string
  end_date?: string
  cycle_description?: string
  capacity?: number
}
interface VariantItem {
  id: string
  sku: string
  name: string
  price: number
  stock: number
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [variants, setVariants] = useState<VariantItem[]>([])
  const [selectedVariant, setSelectedVariant] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) loadProduct(id)
  }, [id])

  async function loadProduct(pid: string) {
    try {
      const rows = await sdbQuery<any[]>(`SELECT *, category.name AS category_name FROM product WHERE id=${pid} LIMIT 1`)
      if (!rows?.[0]) { setLoading(false); return }
      const p = rows[0]
      setProduct({
        id: p.id, name: p.name, description: p.description || '',
        main_image_url: p.main_image_url,
        detail_image_urls: p.detail_image_urls || [],
        category_name: p.category_name || p.category?.name || '',
        product_type: p.product_type || '商品',
        base_price: p.base_price || 0,
        start_date: p.start_date, end_date: p.end_date,
        cycle_description: p.cycle_description,
        capacity: p.capacity,
      })

      // Load variants with pricing and stock
      const varRows = await sdbQuery<any[]>(
        `SELECT id, sku, name, spu.id AS spu, 
          (SELECT price FROM pricing WHERE variant=$parent.id AND is_active=true LIMIT 1)[0].price AS price,
          (SELECT quantity FROM store_inventory WHERE variant=$parent.id LIMIT 1)[0].quantity AS stock
         FROM product_variant WHERE spu=${pid} ORDER BY sku`
      )
      const vars: VariantItem[] = (varRows || []).map((v: any) => ({
        id: v.id, sku: v.sku, name: v.name,
        price: v.price || p.base_price || 0,
        stock: v.stock || 0,
      }))
      setVariants(vars)
      if (vars.length === 1) setSelectedVariant(vars[0].id)
    } catch (err) {
      console.error('ProductDetail error:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleAddToCart() {
    if (!selectedVariant) { showToast('请选择规格'); return }
    const v = variants.find(x => x.id === selectedVariant)
    if (!v) return
    cartStore.addItem({
      variantId: v.id,
      variantSku: v.sku,
      variantName: v.name,
      productId: product!.id,
      productName: product!.name,
      productImage: product!.main_image_url,
      unitPrice: v.price,
      quantity,
      maxStock: v.stock,
    })
    showToast('已加入购物车')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  if (loading) {
    return (
      <div>
        <div className="skeleton" style={{ aspectRatio: '1', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ width: 80, height: 36, borderRadius: 8 }} />)}
        </div>
      </div>
    )
  }

  if (!product) {
    return <div className="empty-state"><div className="empty-icon"><IconBox size={40} /></div><div className="empty-text">商品不存在</div></div>
  }

  // 活动类型 → 跳转活动详情
  if (product.product_type === '活动') {
    nav(`/activity/${product.id}`, { replace: true })
    return null
  }

  const selectedVar = variants.find(v => v.id === selectedVariant)
  const allImages = [product.main_image_url, ...product.detail_image_urls].filter(Boolean)

  return (
    <div>
      {/* 图片画廊 */}
      {allImages.length > 0 ? (
        <div className="detail-gallery">
          <img src={allImages[activeImg]} alt={product.name} />
          {allImages.length > 1 && (
            <div className="detail-thumbs">
              {allImages.map((url, i) => (
                <img key={i} className={`detail-thumb${i === activeImg ? ' active' : ''}`}
                  src={url} alt="" onClick={() => setActiveImg(i)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ aspectRatio: '1', background: '#f5f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconBox size={40} /></div>
      )}

      {/* 商品信息 */}
      <div className="detail-info">
        <div className="detail-name">{product.name}</div>
        {product.description && <div className="detail-desc">{product.description}</div>}
        <div className="detail-price">
          ¥{selectedVar?.price || product.base_price}
          {product.base_price > 0 && selectedVar?.price && selectedVar.price !== product.base_price && (
            <span className="base">¥{product.base_price}</span>
          )}
        </div>

        {/* 变体选择 */}
        {variants.length > 0 && (
          <>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>选择规格</div>
            <div className="variant-list">
              {variants.map(v => (
                <button key={v.id}
                  className={`variant-option${selectedVariant === v.id ? ' selected' : ''}`}
                  disabled={v.stock === 0}
                  onClick={() => { setSelectedVariant(v.id); setQuantity(1) }}>
                  {v.name} — ¥{v.price}
                  {v.stock === 0 ? ' (缺货)' : v.stock <= 5 ? ` (剩${v.stock}件)` : ''}
                </button>
              ))}
            </div>
          </>
        )}

        {/* 库存提示 */}
        {selectedVar && (
          <div style={{ fontSize: 13, color: selectedVar.stock === 0 ? '#d93025' : selectedVar.stock <= 5 ? '#d46b08' : '#999', marginBottom: 16 }}>
            {selectedVar.stock === 0 ? '暂时缺货' : selectedVar.stock <= 5 ? `库存紧张，仅剩 ${selectedVar.stock} 件` : `库存充足 (${selectedVar.stock} 件)`}
          </div>
        )}
      </div>

      {/* 加入购物车栏 */}
      <div className="add-cart-bar">
        <div className="qty-ctrl">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <span style={{ fontSize: 16, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{quantity}</span>
          <button onClick={() => setQuantity(q => Math.min(selectedVar?.stock || 99, q + 1))}>+</button>
        </div>
        <button className="add-btn" disabled={!selectedVariant || (selectedVar?.stock || 0) === 0}
          onClick={handleAddToCart}>
          {selectedVar?.stock === 0 ? '暂时缺货' : `加入购物车 ¥${(selectedVar?.price || 0) * quantity}`}
        </button>
      </div>

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      <div style={{ height: 80 }} />
    </div>
  )
}
