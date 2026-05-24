import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { customerAuth } from '@/stores/auth'

export default function Login() {
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !/^1\d{10}$/.test(phone.trim())) { setError('请输入正确的手机号'); return }
    if (!password || password.length < 4) { setError('密码至少4位'); return }
    if (mode === 'register' && !name.trim()) { setError('请输入姓名'); return }

    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        await customerAuth.login(phone.trim(), password)
      } else {
        await customerAuth.register(phone.trim(), password, name.trim())
      }
      window.dispatchEvent(new Event('auth-change'))
      nav('/orders', { replace: true })
    } catch (err: any) {
      setError(err.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '0 auto', padding: '32px 0' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🙏</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#c41e3a' }}>
          {mode === 'login' ? '欢迎回来' : '创建账号'}
        </h2>
        <p style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
          {mode === 'login' ? '登录查看订单和活动报名' : '注册后可查看历史订单和报名'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div className="form-group">
            <label>姓名</label>
            <input type="text" placeholder="您的称呼" value={name} onChange={e => setName(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label>手机号</label>
          <input type="tel" placeholder="11位手机号" value={phone} onChange={e => setPhone(e.target.value)} maxLength={11} />
        </div>
        <div className="form-group">
          <label>密码</label>
          <input type="password" placeholder="至少4位" value={password} onChange={e => setPassword(e.target.value)} />
        </div>

        {error && <div style={{ color: '#d93025', fontSize: 14, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
        {mode === 'login' ? (
          <>还没有账号？<span style={{ color: '#c41e3a', cursor: 'pointer' }} onClick={() => { setMode('register'); setError('') }}>立即注册</span></>
        ) : (
          <>已有账号？<span style={{ color: '#c41e3a', cursor: 'pointer' }} onClick={() => { setMode('login'); setError('') }}>去登录</span></>
        )}
      </div>
    </div>
  )
}
