import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useCart } from '@/stores/cart'
import Home from '@/pages/Home'
import ProductList from '@/pages/ProductList'
import ProductDetail from '@/pages/ProductDetail'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import OrderSuccess from '@/pages/OrderSuccess'
import OrderLookup from '@/pages/OrderLookup'
import ActivityDetail from '@/pages/ActivityDetail'

function TabBar() {
  const nav = useNavigate()
  const loc = useLocation()
  const cart = useCart()

  const tabs = [
    { path: '/', icon: '🏠', label: '首页' },
    { path: '/products', icon: '📂', label: '分类' },
    { path: '/cart', icon: '🛒', label: '购物车', badge: cart.count },
    { path: '/orders', icon: '📋', label: '订单' },
  ]

  return (
    <nav className="tab-bar">
      {tabs.map(t => (
        <div key={t.path} className={`tab-item${loc.pathname === t.path ? ' active' : ''}`}
          onClick={() => nav(t.path)}>
          <span className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
          {t.badge ? <span className="badge">{t.badge}</span> : null}
        </div>
      ))}
    </nav>
  )
}

// 需要显示顶部导航栏和底部 TabBar 的页面
const FULL_SHELL = new Set(['/', '/products', '/cart', '/orders'])

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

function AppShell() {
  const loc = useLocation()
  const showShell = FULL_SHELL.has(loc.pathname) || loc.pathname.startsWith('/activity/')

  return (
    <div className="app-shell">
      {showShell && <TopNav />}
      <div className="page-content" style={showShell ? {} : { paddingBottom: 76 }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderSuccess />} />
          <Route path="/orders" element={<OrderLookup />} />
        </Routes>
      </div>
      {showShell && <TabBar />}
    </div>
  )
}

function TopNav() {
  const loc = useLocation()

  const titles: Record<string, string> = {
    '/': '如法流通处',
    '/products': '商品分类',
    '/cart': '购物车',
    '/orders': '我的订单',
  }

  return (
    <div className="top-nav">
      <h1>{titles[loc.pathname] || '如法流通处'}</h1>
      <div style={{ width: 32 }} />
    </div>
  )
}
