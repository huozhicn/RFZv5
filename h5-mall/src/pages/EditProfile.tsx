import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '@/stores/auth'

export default function EditProfile() {
  const nav = useNavigate()
  const auth = useCustomerAuth()
  const customer = auth.customer

  const [name, setName] = useState(customer?.name || '')
  const [avatar, setAvatar] = useState(customer?.avatar || '')
  const [address, setAddress] = useState(customer?.address || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!customer) { nav('/orders', { replace: true }); return null }

  async function handleSave() {
    if (!name.trim()) { setError('姓名不能为空'); return }
    setSaving(true); setError('')
    try {
      await auth.updateProfile({ name: name.trim(), avatar: avatar.trim(), address: address.trim() })
      setSuccess(true)
      setTimeout(() => nav('/orders'), 1000)
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Avatar section */}
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        {avatar ? (
          <img src={avatar} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #c41e3a' }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#c41e3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, margin: '0 auto' }}>
            {name?.[0] || customer.name?.[0] || '?'}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 13, color: '#999' }}>输入图片URL作为头像</div>
      </div>

      <div className="form-group">
        <label>头像URL</label>
        <input type="text" placeholder="https://..." value={avatar} onChange={e => setAvatar(e.target.value)} />
      </div>
      <div className="form-group">
        <label>姓名</label>
        <input type="text" placeholder="您的称呼" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>手机号</label>
        <input type="text" value={customer.phone} disabled style={{ background: '#f5f5f5', color: '#999' }} />
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>手机号用于登录，不可修改</div>
      </div>
      <div className="form-group">
        <label>地址（选填）</label>
        <input type="text" placeholder="收货地址" value={address} onChange={e => setAddress(e.target.value)} />
      </div>

      {error && <div style={{ color: '#d93025', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
      {success && <div style={{ color: '#389e0d', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>✅ 保存成功</div>}

      <button className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  )
}
