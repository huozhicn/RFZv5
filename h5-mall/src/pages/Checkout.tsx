import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCart, cartStore } from '@/stores/cart'
import { useCustomerAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'

interface AddressInfo {
  id: string; contact_name: string; contact_phone: string
  full_address: string; is_default: boolean
}

export default function Checkout() {
  const nav = useNavigate()
  const cart = useCart()
  const auth = useCustomerAuth()
  const customer = auth.customer
  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [addresses, setAddresses] = useState<AddressInfo[]>([])
  const [selectedAddr, setSelectedAddr] = useState<string>('')  // address id, or '' for manual input
  const [manualAddr, setManualAddr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('线下付款')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (customer) loadAddresses()
  }, [customer])

  async function loadAddresses() {
    try {
      const rows = await sdbQuery<any[]>(
        `SELECT id, contact_name, contact_phone, full_address, is_default FROM customer_address WHERE customer=${customer!.id} ORDER BY is_default DESC`
      )
      setAddresses(rows || [])
      const defaultAddr = (rows || []).find((a: AddressInfo) => a.is_default)
      if (defaultAddr) {
        setSelectedAddr(defaultAddr.id)
        setName(defaultAddr.contact_name)
        setPhone(defaultAddr.contact_phone)
      }
    } catch {}
  }

  if (cart.items.length === 0) {
    nav('/cart', { replace: true })
    return null
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('请输入姓名'); return }
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) { setError('请输入正确的手机号'); return }

    // Get address string
    let addressStr = ''
    if (selectedAddr) {
      const addr = addresses.find(a => a.id === selectedAddr)
      if (addr) addressStr = addr.full_address
    } else if (manualAddr.trim()) {
      addressStr = manualAddr.trim()
    }

    setSubmitting(true); setError('')
    try {
      // 1. Upsert customer
      const custRows = await sdbQuery<any[]>(`SELECT id FROM customer WHERE phone='${phone.trim()}' LIMIT 1`)
      let custId: string
      if (custRows?.[0]) {
        custId = custRows[0].id
        await sdbQuery(`UPDATE ${custId} SET name='${name.trim().replace(/'/g, "\\'")}', address='${addressStr.replace(/'/g, "\\'")}'`)
      } else {
        const cr = await sdbQuery<any[]>(
          `CREATE customer CONTENT { name: '${name.trim().replace(/'/g, "\\'")}', phone: '${phone.trim()}', address: '${addressStr.replace(/'/g, "\\'")}' }`
        )
        custId = cr?.[0]?.id
      }

      // 2. Generate order number
      const today = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const countRes = await sdbQuery<any[]>(`SELECT count() FROM sales_order WHERE created_at >= d'${new Date().toISOString().slice(0, 10)}' GROUP ALL`)
      const seq = String((countRes?.[0]?.count || 0) + 1).padStart(3, '0')
      const orderNo = `SO${today}${seq}`

      const totalAmount = cart.totalAmount
      const addrNote = addressStr ? `地址: ${addressStr}` : ''
      const fullNotes = [notes.trim(), addrNote].filter(Boolean).join(' | ')

      const orderRes = await sdbQuery<any[]>(
        `CREATE sales_order CONTENT {
          order_no: '${orderNo}', customer: ${custId},
          total_amount: ${totalAmount}, status: '待付款',
          payment_method: '${paymentMethod}',
          notes: '${fullNotes.replace(/'/g, "\\'")}',
          sync_status: 'pending', created_by: user:h5_visitor
        }`
      )
      const orderId = orderRes?.[0]?.id

      for (const item of cart.items) {
        await sdbQuery(
          `CREATE order_item CONTENT { order: ${orderId}, variant: ${item.variantId}, quantity: ${item.quantity}, unit_price: ${item.unitPrice}, amount: ${item.unitPrice * item.quantity} }`
        )
        await sdbQuery(`UPDATE store_inventory SET quantity = quantity - ${item.quantity} WHERE variant=${item.variantId}`)
      }

      cartStore.clear()
      sessionStorage.setItem('just_placed_order', orderId)
      nav(`/order/${orderId}`, { replace: true })
    } catch (err: any) {
      setError(err.message || '下单失败，请重试')
    } finally { setSubmitting(false) }
  }

  return (
    <div>
      {/* Order summary */}
      <div style={{ padding: '0 0 12px', borderBottom: '1px solid #f0f0f0', marginBottom: 16 }}>
        <div className="section-header"><h2>订单商品</h2></div>
        {cart.items.map(item => (
          <div key={item.variantId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14 }}>
            <span style={{ flex: 1 }}>{item.productName} · {item.variantSku}</span>
            <span style={{ color: '#999', margin: '0 6px' }}>×{item.quantity}</span>
            <span style={{ fontWeight: 600 }}>¥{item.unitPrice * item.quantity}</span>
          </div>
        ))}
        <div style={{ textAlign: 'right', marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0', fontSize: 18, fontWeight: 700, color: '#c41e3a' }}>
          合计 ¥{cart.totalAmount}
        </div>
      </div>

      {/* Contact info */}
      <div className="section-header"><h2>联系信息</h2></div>
      <div className="form-group">
        <label>姓名 *</label>
        <input type="text" placeholder="您的称呼" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>手机号 *</label>
        <input type="tel" placeholder="用于查询订单" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
      </div>

      {/* Address */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>收货地址</h2>
          {customer && <span style={{ fontSize: 13, color: '#c41e3a', cursor: 'pointer' }} onClick={() => nav('/address')}>管理地址 ›</span>}
        </div>

        {addresses.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {addresses.map(addr => (
              <div key={addr.id} onClick={() => { setSelectedAddr(addr.id); setName(addr.contact_name); setPhone(addr.contact_phone); }}
                style={{
                  padding: 12, marginBottom: 8, borderRadius: 8, cursor: 'pointer',
                  border: selectedAddr === addr.id ? '2px solid #c41e3a' : '1px solid #e8e8e8',
                  background: selectedAddr === addr.id ? '#fff5f5' : '#fff',
                }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                  {addr.contact_name} <span style={{ fontWeight: 400, fontSize: 12, color: '#999' }}>{addr.contact_phone}</span>
                  {addr.is_default && <span style={{ marginLeft: 6, fontSize: 10, color: '#c41e3a' }}>[默认]</span>}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>{addr.full_address}</div>
              </div>
            ))}
            <div onClick={() => setSelectedAddr('')}
              style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#999',
                border: selectedAddr === '' ? '2px solid #c41e3a' : '1px solid #e8e8e8',
                background: selectedAddr === '' ? '#fff5f5' : '#fff', textAlign: 'center' }}>
              不使用已有地址，手动输入
            </div>
          </div>
        )}

        {selectedAddr === '' && (
          <div className="form-group">
            <textarea placeholder="省/市/区/街道/门牌号（快递邮寄填写）" value={manualAddr}
              onChange={e => setManualAddr(e.target.value)} rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d9d9d9', borderRadius: 8, fontSize: 14 }} />
          </div>
        )}
      </div>

      {/* Payment */}
      <div style={{ marginTop: 20 }}>
        <div className="section-header"><h2>支付方式</h2></div>
        <div className="payment-methods">
          <div className={`payment-option${paymentMethod === '线下付款' ? ' selected' : ''}`} onClick={() => setPaymentMethod('线下付款')}>💵 线下付款</div>
          <div className={`payment-option${paymentMethod === '在线支付' ? ' selected' : ''}`} onClick={() => setPaymentMethod('在线支付')}>📱 在线支付</div>
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
