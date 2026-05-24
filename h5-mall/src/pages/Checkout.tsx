import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart, cartStore } from '@/stores/cart'
import { sdbQuery } from '@/lib/sdb'

export default function Checkout() {
  const nav = useNavigate()
  const cart = useCart()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('线下付款')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (cart.items.length === 0) {
    nav('/cart', { replace: true })
    return null
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('请输入姓名'); return }
    if (!phone.trim()) { setError('请输入手机号'); return }
    if (!/^1\d{10}$/.test(phone.trim())) { setError('请输入正确的手机号'); return }

    setSubmitting(true)
    setError('')

    try {
      // 1. Upsert customer
      const custRows = await sdbQuery<any[]>(
        `SELECT id FROM customer WHERE phone='${phone.trim()}' LIMIT 1`
      )
      let custId: string
      if (custRows?.[0]) {
        custId = custRows[0].id
        // Update name if changed
        await sdbQuery(`UPDATE ${custId} SET name='${name.trim().replace(/'/g, "\\'")}'`)
      } else {
        const createRes = await sdbQuery<any[]>(
          `CREATE customer CONTENT { name: '${name.trim().replace(/'/g, "\\'")}', phone: '${phone.trim()}' }`
        )
        custId = createRes?.[0]?.id
      }

      // 2. Generate order number
      const today = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const countRes = await sdbQuery<any[]>(
        `SELECT count() FROM sales_order WHERE created_at >= d'${new Date().toISOString().slice(0, 10)}' GROUP ALL`
      )
      const seq = String((countRes?.[0]?.count || 0) + 1).padStart(3, '0')
      const orderNo = `SO${today}${seq}`

      // 3. Create order
      const totalAmount = cart.totalAmount
      const orderRes = await sdbQuery<any[]>(
        `CREATE sales_order CONTENT {
          order_no: '${orderNo}',
          customer: ${custId},
          total_amount: ${totalAmount},
          status: '待付款',
          payment_method: '${paymentMethod}',
          notes: '${notes.trim().replace(/'/g, "\\'")}',
          sync_status: 'pending',
          created_by: user:h5_visitor
        }`
      )
      const orderId = orderRes?.[0]?.id

      // 4. Create order items + update inventory
      for (const item of cart.items) {
        await sdbQuery(
          `CREATE order_item CONTENT {
            order: ${orderId},
            variant: ${item.variantId},
            quantity: ${item.quantity},
            unit_price: ${item.unitPrice},
            amount: ${item.unitPrice * item.quantity}
          }`
        )
        // Deduct inventory
        await sdbQuery(
          `UPDATE store_inventory SET quantity = quantity - ${item.quantity} WHERE variant=${item.variantId}`
        )
      }

      // 5. Clear cart & navigate
      cartStore.clear()
      nav(`/order/${orderId}`, { replace: true })
    } catch (err: any) {
      setError(err.message || '下单失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div style={{ padding: '0 0 16px', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <div className="section-header"><h2>订单商品</h2></div>
        {cart.items.map(item => (
          <div key={item.variantId} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
            <span style={{ flex: 1 }}>{item.productName} · {item.variantSku}</span>
            <span style={{ color: '#999', margin: '0 8px' }}>×{item.quantity}</span>
            <span style={{ fontWeight: 600 }}>¥{item.unitPrice * item.quantity}</span>
          </div>
        ))}
        <div style={{ textAlign: 'right', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0', fontSize: 18, fontWeight: 700, color: '#c41e3a' }}>
          合计 ¥{cart.totalAmount}
        </div>
      </div>

      <div className="section-header"><h2>联系信息</h2></div>
      <div className="form-group">
        <label>姓名 *</label>
        <input type="text" placeholder="您的称呼" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>手机号 *</label>
        <input type="tel" placeholder="用于查询订单" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
      </div>

      <div className="section-header" style={{ marginTop: 20 }}><h2>支付方式</h2></div>
      <div className="payment-methods">
        <div className={`payment-option${paymentMethod === '线下付款' ? ' selected' : ''}`}
          onClick={() => setPaymentMethod('线下付款')}>
          💵 线下付款
        </div>
        <div className={`payment-option${paymentMethod === '在线支付' ? ' selected' : ''}`}
          onClick={() => setPaymentMethod('在线支付')}>
          📱 在线支付
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 16 }}>
        <label>备注（选填）</label>
        <textarea placeholder="如有特殊需求请注明" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {error && <div style={{ color: '#d93025', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

      <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
        {submitting ? '提交中...' : `确认下单 ¥${cart.totalAmount}`}
      </button>

      <div style={{ height: 24 }} />
    </div>
  )
}
