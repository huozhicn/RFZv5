// 消费者 Auth — phone + password，sessionStorage 持久化
import { sdbQuery, sdbGet } from '@/lib/sdb'

const STORAGE_KEY = 'h5_customer'

export interface CustomerInfo {
  id: string
  name: string
  phone: string
  avatar: string
  address: string
}

let _customer: CustomerInfo | null = null
let _loaded = false

function loadFromStorage(): CustomerInfo | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveToStorage(c: CustomerInfo) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

function clearStorage() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export const customerAuth = {
  get customer(): CustomerInfo | null {
    if (!_loaded) { _customer = loadFromStorage(); _loaded = true }
    return _customer
  },

  get isLoggedIn(): boolean { return !!this.customer },

  async login(phone: string, password: string): Promise<CustomerInfo> {
    const hash = await sha256(password)
    const rows = await sdbQuery<any[]>(
      `SELECT id, name, phone, avatar, address FROM customer WHERE phone='${phone}' AND password_hash='${hash}' LIMIT 1`
    )
    if (!rows?.[0]) throw new Error('手机号或密码错误')
    const c: CustomerInfo = {
      id: rows[0].id, name: rows[0].name, phone: rows[0].phone,
      avatar: rows[0].avatar || '', address: rows[0].address || '',
    }
    _customer = c
    saveToStorage(c)
    return c
  },

  async register(phone: string, password: string, name: string): Promise<CustomerInfo> {
    // Check if phone exists
    const existing = await sdbGet<any>(`SELECT id FROM customer WHERE phone='${phone}' LIMIT 1`)
    if (existing) throw new Error('该手机号已注册，请直接登录')

    const hash = await sha256(password)
    const rows = await sdbQuery<any[]>(
      `CREATE customer CONTENT { name: '${name}', phone: '${phone}', password_hash: '${hash}' }`
    )
    if (!rows?.[0]) throw new Error('注册失败')
    const c: CustomerInfo = {
      id: rows[0].id, name, phone, avatar: '', address: '',
    }
    _customer = c
    saveToStorage(c)
    return c
  },

  async updateProfile(fields: { name?: string; avatar?: string; address?: string }): Promise<CustomerInfo> {
    if (!this.customer) throw new Error('未登录')
    const sets: string[] = []
    if (fields.name !== undefined) sets.push(`name='${fields.name.replace(/'/g, "\\'")}'`)
    if (fields.avatar !== undefined) sets.push(`avatar='${fields.avatar}'`)
    if (fields.address !== undefined) sets.push(`address='${fields.address.replace(/'/g, "\\'")}'`)
    if (sets.length === 0) return this.customer
    await sdbQuery(`UPDATE ${this.customer.id} SET ${sets.join(', ')}`)
    const c = { ...this.customer, ...fields }
    _customer = c
    saveToStorage(c)
    return c
  },

  async changePassword(oldPass: string, newPass: string): Promise<void> {
    if (!this.customer) throw new Error('未登录')
    const oldHash = await sha256(oldPass)
    const check = await sdbGet<any>(
      `SELECT id FROM customer WHERE id=${this.customer.id} AND password_hash='${oldHash}' LIMIT 1`
    )
    if (!check) throw new Error('原密码错误')
    const newHash = await sha256(newPass)
    await sdbQuery(`UPDATE ${this.customer.id} SET password_hash='${newHash}'`)
  },

  logout() {
    _customer = null
    clearStorage()
  },
}

async function sha256(msg: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(msg)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// React hook
import { useState, useEffect } from 'react'

export function useCustomerAuth() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const handler = () => setTick(t => t + 1)
    window.addEventListener('auth-change', handler)
    return () => window.removeEventListener('auth-change', handler)
  }, [])
  return customerAuth
}
