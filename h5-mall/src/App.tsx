import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useCart } from '@/stores/cart'
import { useCustomerAuth } from '@/stores/auth'
import { IconHome, IconGrid, IconLeaf, IconCart, IconUser, IconSearch } from '@/components/icons'
import Home from '@/pages/Home'
import ProductList from '@/pages/ProductList'
import ProductDetail from '@/pages/ProductDetail'
import Activities from '@/pages/Activities'
import ActivityDetail from '@/pages/ActivityDetail'
import Cart from '@/pages/Cart'
import Checkout from '@/pages/Checkout'
import OrderSuccess from '@/pages/OrderSuccess'
import Profile from '@/pages/Profile'
import Login from '@/pages/Login'
import EditProfile from '@/pages/EditProfile'
import ChangePassword from '@/pages/ChangePassword'
import Search from '@/pages/Search'
import StoreInfoPage from '@/pages/StoreInfoPage'
import AddressBook from '@/pages/AddressBook'

function TabBar() {
  const nav = useNavigate()
  const loc = useLocation()
  const cart = useCart()

  const tabs = [
    { path: '/', Icon: IconHome, label: '首页' },
    { path: '/products', Icon: IconGrid, label: '分类' },
    { path: '/activities', Icon: IconLeaf, label: '活动' },
    { path: '/cart', Icon: IconCart, label: '购物车', badge: cart.count },
    { path: '/orders', Icon: IconUser, label: '我的' },
  ]

  return (
    <nav className="tab-bar">
      {tabs.map(t => (
        <div key={t.path} className={`tab-item${loc.pathname === t.path ? ' active' : ''}`}
          onClick={() => nav(t.path)}>
          <t.Icon size={20} />
          <span>{t.label}</span>
          {t.badge ? <span className="badge">{t.badge}</span> : null}
        </div>
      ))}
    </nav>
  )
}

const FULL_SHELL = new Set(['/', '/products', '/activities', '/cart', '/orders'])

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

function AppShell() {
  const loc = useLocation()
  const showTabs = FULL_SHELL.has(loc.pathname) || loc.pathname.startsWith('/activity/')

  return (
    <div className="app-shell">
      <TopNav />
      <div className="page-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/activity/:id" element={<ActivityDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderSuccess />} />
          <Route path="/orders" element={<Profile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/profile/password" element={<ChangePassword />} />
          <Route path="/search" element={<Search />} />
          <Route path="/store" element={<StoreInfoPage />} />
          <Route path="/address" element={<AddressBook />} />
        </Routes>
      </div>
      {showTabs && <TabBar />}
    </div>
  )
}

function TopNav() {
  const loc = useLocation()
  const nav = useNavigate()
  const isHome = loc.pathname === '/'

  function getTitle(): string {
    const staticTitles: Record<string, string> = {
      '/': '如法流通处',
      '/products': '法宝分类',
      '/activities': '近期活动',
      '/cart': '购物车',
      '/orders': '我的',
      '/login': '登录',
      '/profile/edit': '编辑资料',
      '/profile/password': '修改密码',
      '/search': '搜索',
      '/store': '流通处介绍',
      '/address': '收货地址',
      '/checkout': '确认下单',
    }
    if (staticTitles[loc.pathname]) return staticTitles[loc.pathname]
    if (loc.pathname.startsWith('/product/')) return '商品详情'
    if (loc.pathname.startsWith('/activity/')) return '活动详情'
    if (loc.pathname.startsWith('/order/')) return '订单详情'
    return ''
  }

  const title = getTitle()

  return (
    <div className="top-nav">
      {isHome ? (
        <div style={{ width: 28 }} />
      ) : (
        <button onClick={() => nav('/')} aria-label="回到首页"><IconHome size={20} /></button>
      )}
      <h1 style={{ flex: 1, textAlign: 'center' }}>{title}</h1>
      {loc.pathname === '/search' ? (
        <div style={{ width: 28 }} />
      ) : (
        <button onClick={() => nav('/search')} aria-label="搜索"><IconSearch size={20} /></button>
      )}
    </div>
  )
}
