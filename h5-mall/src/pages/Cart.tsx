import { useNavigate } from 'react-router-dom'
import { useCart, cartStore } from '@/stores/cart'

export default function Cart() {
  const nav = useNavigate()
  const cart = useCart()

  if (cart.items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🛒</div>
        <div className="empty-text">购物车是空的</div>
        <button className="btn-primary" onClick={() => nav('/products')} style={{ width: 200, margin: '0 auto' }}>
          去逛逛
        </button>
      </div>
    )
  }

  return (
    <div>
      {cart.items.map(item => (
        <div key={item.variantId} className="cart-item">
          {item.productImage ? (
            <img className="ci-img" src={item.productImage} alt={item.productName} />
          ) : (
            <div className="ci-img" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, background: '#f0ebe3' }}>
              📦
            </div>
          )}
          <div className="ci-info">
            <div className="ci-name">{item.productName}</div>
            <div className="ci-variant">{item.variantSku} · {item.variantName}</div>
            <div className="ci-bottom">
              <span className="ci-price">¥{item.unitPrice}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="qty-ctrl">
                  <button onClick={() => cartStore.updateQuantity(item.variantId, item.quantity - 1)}
                    style={{ width: 28, height: 28, fontSize: 16, borderRadius: '50%', border: '1px solid #d9d9d9', background: '#fff' }}>−</button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14 }}>{item.quantity}</span>
                  <button onClick={() => cartStore.updateQuantity(item.variantId, item.quantity + 1)}
                    style={{ width: 28, height: 28, fontSize: 16, borderRadius: '50%', border: '1px solid #d9d9d9', background: '#fff' }}>+</button>
                </div>
                <button onClick={() => cartStore.removeItem(item.variantId)}
                  style={{ color: '#999', background: 'none', fontSize: 18, padding: 4 }}>🗑️</button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 合计 + 结算 */}
      <div style={{ position: 'fixed', bottom: 60, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', padding: '12px 16px', borderTop: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
        <div>
          <div style={{ fontSize: 12, color: '#999' }}>共 {cart.count} 件</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#c41e3a' }}>¥{cart.totalAmount}</div>
        </div>
        <button className="btn-primary" style={{ width: 160, padding: 12 }} onClick={() => nav('/checkout')}>
          去结算
        </button>
      </div>

      <div style={{ height: 80 }} />
    </div>
  )
}
