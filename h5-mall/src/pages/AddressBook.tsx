import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '@/stores/auth'
import { sdbQuery } from '@/lib/sdb'

interface Address {
  id: string; contact_name: string; contact_phone: string
  full_address: string; is_default: boolean
}

export default function AddressBook() {
  const nav = useNavigate()
  const auth = useCustomerAuth()
  const customer = auth.customer
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Address | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddr, setFormAddr] = useState('')
  const [formDefault, setFormDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!customer) { nav('/orders'); return }
    loadAddresses()
  }, [customer])

  async function loadAddresses() {
    setLoading(true)
    try {
      const rows = await sdbQuery<any[]>(
        `SELECT id, contact_name, contact_phone, full_address, is_default FROM customer_address WHERE customer=${customer!.id} ORDER BY is_default DESC, created_at DESC`
      )
      setAddresses(rows || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function openEdit(addr?: Address) {
    if (addr) {
      setEditing(addr)
      setFormName(addr.contact_name)
      setFormPhone(addr.contact_phone)
      setFormAddr(addr.full_address)
      setFormDefault(addr.is_default)
    } else {
      setEditing(null)
      setFormName(customer?.name || '')
      setFormPhone(customer?.phone || '')
      setFormAddr('')
      setFormDefault(addresses.length === 0)
    }
    setShowForm(true)
    setError('')
  }

  async function handleSave() {
    if (!formName.trim()) { setError('请输入收货人'); return }
    if (!formPhone.trim() || !/^1\d{10}$/.test(formPhone.trim())) { setError('请输入正确的手机号'); return }
    if (!formAddr.trim()) { setError('请输入地址'); return }

    setSaving(true); setError('')
    try {
      if (editing) {
        // Update
        await sdbQuery(`UPDATE ${editing.id} SET contact_name='${formName.trim()}', contact_phone='${formPhone.trim()}', full_address='${formAddr.trim()}', is_default=${formDefault}`)
        // If set as default, unset others
        if (formDefault) {
          await sdbQuery(`UPDATE customer_address SET is_default=false WHERE customer=${customer!.id} AND id!=${editing.id}`)
        }
      } else {
        // Create
        if (formDefault) {
          await sdbQuery(`UPDATE customer_address SET is_default=false WHERE customer=${customer!.id}`)
        }
        await sdbQuery(`CREATE customer_address CONTENT { customer: ${customer!.id}, contact_name: '${formName.trim()}', contact_phone: '${formPhone.trim()}', full_address: '${formAddr.trim()}', is_default: ${formDefault} }`)
      }
      setShowForm(false)
      loadAddresses()
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除这个地址？')) return
    await sdbQuery(`DELETE ${id}`)
    loadAddresses()
  }

  async function handleSetDefault(id: string) {
    await sdbQuery(`UPDATE customer_address SET is_default=false WHERE customer=${customer!.id}`)
    await sdbQuery(`UPDATE ${id} SET is_default=true`)
    loadAddresses()
  }

  if (!customer) return null

  return (
    <div>
      {loading ? (
        <div>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />)}</div>
      ) : addresses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📍</div>
          <div className="empty-text">暂无收货地址</div>
          <div style={{ fontSize: 13, color: '#bbb', marginBottom: 20 }}>添加地址后下单更方便</div>
        </div>
      ) : (
        addresses.map(addr => (
          <div key={addr.id} style={{
            background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
            border: addr.is_default ? '2px solid #c41e3a' : '1px solid transparent',
            position: 'relative',
          }}>
            {addr.is_default && (
              <span style={{ position: 'absolute', top: -8, left: 16, background: '#c41e3a', color: '#fff', fontSize: 11, padding: '2px 10px', borderRadius: 10 }}>默认</span>
            )}
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
              {addr.contact_name} <span style={{ fontWeight: 400, fontSize: 13, color: '#999' }}>{addr.contact_phone}</span>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>{addr.full_address}</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <span style={{ color: '#c41e3a', cursor: 'pointer' }} onClick={() => openEdit(addr)}>编辑</span>
              {!addr.is_default && <span style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => handleSetDefault(addr.id)}>设为默认</span>}
              <span style={{ color: '#999', cursor: 'pointer' }} onClick={() => handleDelete(addr.id)}>删除</span>
            </div>
          </div>
        ))
      )}

      <button className="btn-primary" onClick={() => openEdit()} style={{ marginTop: 8 }}>
        + 新增地址
      </button>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: '16px 16px 0 0', padding: '24px 20px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600 }}>{editing ? '编辑地址' : '新增地址'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', fontSize: 24, color: '#999' }}>✕</button>
            </div>
            <div className="form-group">
              <label>收货人 *</label>
              <input type="text" placeholder="姓名" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>联系电话 *</label>
              <input type="tel" placeholder="11位手机号" value={formPhone} onChange={e => setFormPhone(e.target.value)} maxLength={11} />
            </div>
            <div className="form-group">
              <label>详细地址 *</label>
              <textarea placeholder="省/市/区/街道/门牌号" value={formAddr} onChange={e => setFormAddr(e.target.value)} rows={3} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 14 }}>
              <input type="checkbox" id="setDefault" checked={formDefault} onChange={e => setFormDefault(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#c41e3a' }} />
              <label htmlFor="setDefault">设为默认地址</label>
            </div>

            {error && <div style={{ color: '#d93025', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
            <button className="btn-primary" disabled={saving} onClick={handleSave}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
