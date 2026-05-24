import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerAuth } from '@/stores/auth'

export default function ChangePassword() {
  const nav = useNavigate()
  const auth = useCustomerAuth()

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!auth.customer) { nav('/orders', { replace: true }); return null }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!oldPass) { setError('请输入原密码'); return }
    if (!newPass || newPass.length < 4) { setError('新密码至少4位'); return }
    if (newPass !== confirmPass) { setError('两次密码不一致'); return }

    setLoading(true); setError('')
    try {
      await auth.changePassword(oldPass, newPass)
      setSuccess(true)
      setTimeout(() => nav('/orders'), 1500)
    } catch (err: any) {
      setError(err.message || '修改失败')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', padding: '24px 0' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, textAlign: 'center' }}>修改密码</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>原密码</label>
          <input type="password" placeholder="输入原密码" value={oldPass} onChange={e => setOldPass(e.target.value)} />
        </div>
        <div className="form-group">
          <label>新密码</label>
          <input type="password" placeholder="至少4位" value={newPass} onChange={e => setNewPass(e.target.value)} />
        </div>
        <div className="form-group">
          <label>确认新密码</label>
          <input type="password" placeholder="再次输入新密码" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
        </div>

        {error && <div style={{ color: '#d93025', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
        {success && <div style={{ color: '#389e0d', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>✅ 密码修改成功</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? '修改中...' : '确认修改'}
        </button>
      </form>
    </div>
  )
}
