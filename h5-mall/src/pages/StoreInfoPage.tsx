import { useState, useEffect } from 'react'
import { sdbQuery } from '@/lib/sdb'

interface StoreData {
  name: string; address: string; phone: string
  business_hours: string; description: string; logo_url?: string
}

export default function StoreInfo() {
  const [store, setStore] = useState<StoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStore() }, [])

  async function loadStore() {
    try {
      const rows = await sdbQuery<any[]>('SELECT * FROM store_info LIMIT 1')
      if (rows?.[0]) setStore(rows[0])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  if (loading) {
    return <div><div className="skeleton" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} /><div className="skeleton" style={{ height: 150, borderRadius: 12 }} /></div>
  }

  if (!store) {
    return <div className="empty-state"><div className="empty-icon">🏛️</div><div className="empty-text">暂无信息</div></div>
  }

  return (
    <div>
      {/* Logo + 名称 */}
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        {store.logo_url ? (
          <img src={store.logo_url} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 12px', border: '3px solid #c41e3a' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#c41e3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, margin: '0 auto 12px' }}>
            卍
          </div>
        )}
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#c41e3a' }}>{store.name}</h2>
        <p style={{ fontSize: 14, color: '#666', marginTop: 8, lineHeight: 1.8 }}>{store.description}</p>
      </div>

      {/* 详情卡片 */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <InfoRow icon="📍" label="地址" value={store.address} />
        <InfoRow icon="📞" label="电话" value={store.phone} />
        <InfoRow icon="🕐" label="营业时间" value={store.business_hours} />
      </div>

      {/* 交通信息 */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>🚇 交通指引</h3>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
          <p>📍 上海市普陀区真如镇兰溪路</p>
          <p>🚇 地铁11号线真如站，步行约10分钟</p>
          <p>🚌 公交63路、105路、838路可到达</p>
        </div>
      </div>

      {/* 注意事项 */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📋 请法宝须知</h3>
        <div style={{ fontSize: 13, color: '#666', lineHeight: 2 }}>
          <p>• 法宝结缘，随喜功德</p>
          <p>• 线上请购支持快递邮寄</p>
          <p>• 到店自提请出示订单号</p>
          <p>• 活动报名以收到确认短信为准</p>
          <p>• 如需开光加持请提前预约</p>
        </div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #f5f5f5', fontSize: 14 }}>
      <span style={{ marginRight: 10 }}>{icon}</span>
      <span style={{ color: '#999', width: 70, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1 }}>{value}</span>
    </div>
  )
}
