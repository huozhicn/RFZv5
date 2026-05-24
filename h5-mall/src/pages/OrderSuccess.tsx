import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sdbQuery } from '@/lib/sdb'
import { useCustomerAuth } from '@/stores/auth'
import { IconCheck, IconBox } from '@/components/icons'

interface OrderInfo {
  id: string
  order_no: string
  total_amount: number
  status: string
  payment_method: string
  notes: string
  created_at: string
  items: OrderItemInfo[]
}
interface OrderItemInfo {
  quantity: number
  unit_price: number
  amount: number
  variant_sku: string
  variant_name: string
  product_name: string
  product_image: string
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  '待付款': { label: '待付款', cls: 'pending' },
  '已付款': { label: '已付款', cls: 'paid' },
  '已发货': { label: '已发货', cls: 'shipped' },
  '已完成': { label: '已完成', cls: 'done' },
  '已取消': { label: '已取消', cls: 'cancelled' },
}

export default function OrderSuccess() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const auth = useCustomerAuth()
  const customer = auth.customer
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Authenticated users can see their own orders
    if (customer) { if (id) loadOrder(id, customer.id); return }
    // Non-logged-in users can only see the order they just placed (sessionStorage token)
    const justPlaced = sessionStorage.getItem('just_placed_order')
    if (justPlaced === id) { if (id) loadOrder(id); return }
    nav('/login')
  }, [id, customer])

  async function loadOrder(oid: string, cid?: string) {
    try {
      const cidFilter = cid ? ` AND customer=${cid}` : ''
      const rows = await sdbQuery<any[]>(
        `SELECT *, 
          (SELECT quantity, unit_price, amount, variant.sku AS variant_sku, variant.name AS variant_name, variant.spu.name AS product_name, variant.spu.main_image_url AS product_image FROM order_item WHERE order=$parent.id) AS items
         FROM sales_order WHERE id=${oid}${cidFilter} LIMIT 1`
      )
      if (rows?.[0]) {
        const o = rows[0]
        setOrder({
          id: o.id,
          order_no: o.order_no,
          total_amount: o.total_amount,
          status: o.status,
          payment_method: o.payment_method,
          notes: o.notes || '',
          created_at: o.created_at,
          items: (o.items || []).map((i: any) => ({
            quantity: i.quantity, unit_price: i.unit_price, amount: i.amount,
            variant_sku: i.variant_sku, variant_name: i.variant_name,
            product_name: i.product_name, product_image: i.product_image,
          })),
        })
      }
    } catch (err) {
      console.error('Order load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center mt-16"><div className="skeleton" style={{ height: 200, borderRadius: 12 }} /></div>
  }

  if (!order) {
    return <div className="empty-state"><div className="empty-icon"><IconBox size={40} /></div><div className="empty-text">订单不存在</div></div>
  }

  const statusInfo = STATUS_LABELS[order.status] || { label: order.status, cls: '' }

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '32px 0 20px' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}><IconCheck size={40} /></div>
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          {order.payment_method === '线下付款' ? '下单成功，请到店付款' : '下单成功'}
        </div>
        <div style={{ fontSize: 14, color: '#999' }}>订单号：{order.order_no}</div>
      </div>

      <div className="order-card">
        <div className="oc-header">
          <div>
            <div className="oc-no">订单号 {order.order_no}</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
              {order.created_at?.toString().slice(0, 19).replace('T', ' ')}
            </div>
          </div>
          <span className={`status-badge ${statusInfo.cls}`}>{statusInfo.label}</span>
        </div>

        {order.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < order.items.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
            {item.product_image ? (
              <img src={item.product_image} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', background: '#f0ebe3' }} />
            ) : (
              <div style={{ width: 48, height: 48, background: '#f5f0eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconBox size={20} /></div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{item.product_name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{item.variant_sku}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>¥{item.amount}</div>
              <div style={{ fontSize: 12, color: '#999' }}>×{item.quantity}</div>
            </div>
          </div>
        ))}

        <div className="oc-footer" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <span>支付方式：{order.payment_method}</span>
          <span className="oc-total">合计 ¥{order.total_amount}</span>
        </div>

        {order.notes && (
          <div style={{ marginTop: 8, fontSize: 13, color: '#999' }}>备注：{order.notes}</div>
        )}
      </div>

      {order.payment_method === '线下付款' && (
        <div style={{ background: '#fff7e6', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13, color: '#d46b08' }}>
          请到店出示订单号 <strong>{order.order_no}</strong> 完成付款。店员确认收款后，订单状态会更新。
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button className="btn-outline" onClick={() => nav('/')}>继续逛逛</button>
        <button className="btn-primary" onClick={() => nav('/orders')}>查看订单</button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
