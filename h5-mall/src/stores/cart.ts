// 购物车状态管理 — localStorage 持久化

export interface CartItem {
  variantId: string       // record ID, e.g. "product_variant:v_jgj"
  variantSku: string      // SKU code, e.g. "JGJ-STD"
  variantName: string     // variant display name
  productId: string       // parent product record ID
  productName: string     // product display name
  productImage: string    // main image URL
  unitPrice: number       // selling price
  quantity: number
  maxStock: number        // max available stock
}

const STORAGE_KEY = 'h5_cart'

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

let _items = loadCart()
let _listeners: Array<() => void> = []

function notify() {
  saveCart(_items)
  _listeners.forEach(fn => fn())
}

export const cartStore = {
  get items(): CartItem[] { return _items },

  get count(): number {
    return _items.reduce((sum, item) => sum + item.quantity, 0)
  },

  get totalAmount(): number {
    return _items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  },

  subscribe(fn: () => void) {
    _listeners.push(fn)
    return () => { _listeners = _listeners.filter(f => f !== fn) }
  },

  addItem(item: CartItem) {
    const existing = _items.find(i => i.variantId === item.variantId)
    if (existing) {
      existing.quantity = Math.min(existing.quantity + item.quantity, existing.maxStock)
    } else {
      _items.push(item)
    }
    notify()
  },

  updateQuantity(variantId: string, quantity: number) {
    const item = _items.find(i => i.variantId === variantId)
    if (item) {
      item.quantity = Math.max(1, Math.min(quantity, item.maxStock))
      notify()
    }
  },

  removeItem(variantId: string) {
    _items = _items.filter(i => i.variantId !== variantId)
    notify()
  },

  clear() {
    _items = []
    notify()
  },
}

// React hook
import { useState, useEffect } from 'react'

export function useCart() {
  const [, setTick] = useState(0)
  useEffect(() => cartStore.subscribe(() => setTick(t => t + 1)), [])
  return cartStore
}
