import React, { createContext, useContext, useState, useCallback } from 'react'
import { sdbSignin, sdbQuery } from '@/lib/sdb'

export interface UserInfo {
  id: string
  name: string
  display_name: string
  role: string
}

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  tablePerms: Record<string, { canCreate: boolean; canUpdate: boolean; canDelete: boolean }>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, tablePerms: {},
  login: async () => {}, logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    const t = await sdbSignin(username, password)
    setToken(t)

    // Query user info
    try {
      const rows = await sdbQuery(`SELECT id, name, display_name, role FROM user WHERE name = '${username}'`, undefined, t)
      if (rows && rows[0]) {
        setUser(rows[0] as UserInfo)
      } else {
        setUser({ id: '', name: username, display_name: username, role: '店员' })
      }
    } catch {
      setUser({ id: '', name: username, display_name: username, role: '店员' })
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, tablePerms: {}, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
