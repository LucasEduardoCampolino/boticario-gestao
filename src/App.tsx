import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Login from './pages/Login'
import { supabase } from './lib/supabase'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setLoading(false)
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

          <p className="mt-4 text-sm text-gray-500">
            Carregando...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={<Dashboard />}
        />

        <Route
          path="/clientes"
          element={<Customers />}
        />

        <Route
          path="/produtos"
          element={<Products />}
        />

        <Route
          path="/vendas"
          element={
            <div className="rounded-2xl bg-white p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900">
                Vendas
              </h2>

              <p className="mt-2 text-gray-500">
                Módulo em construção.
              </p>
            </div>
          }
        />

        <Route
          path="/financeiro"
          element={
            <div className="rounded-2xl bg-white p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900">
                Financeiro
              </h2>

              <p className="mt-2 text-gray-500">
                Módulo em construção.
              </p>
            </div>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Route>
    </Routes>
  )
}

export default App