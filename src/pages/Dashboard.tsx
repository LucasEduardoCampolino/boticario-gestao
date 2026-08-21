// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import NewSale from '../components/NewSale'

function Dashboard() {
  const [userName, setUserName] = useState('')
  const [showNewSale, setShowNewSale] = useState(false)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  const [monthlySales, setMonthlySales] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Carregar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, monthly_sales_goal')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Erro ao carregar perfil:', profileError)
      } else {
        setUserName(profileData?.name || 'Revendedora')
        setMonthlyGoal(Number(profileData?.monthly_sales_goal || 0))
      }

      // Calcular vendas do mês
      const now = new Date()
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`

      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('total, status')
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth)
        .neq('status', 'cancelled')

      if (salesError) throw salesError

      const totalSales = (salesData || []).reduce((sum, sale) => {
        return sum + Number(sale.total)
      }, 0)

      const pendingSales = (salesData || []).filter(
        (sale) => sale.status === 'pending' || sale.status === 'partial',
      )

      const totalPending = pendingSales.reduce((sum, sale) => {
        return sum + Number(sale.total)
      }, 0)

      setMonthlySales(totalSales)
      setPendingAmount(totalPending)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleSaleSuccess() {
    setShowNewSale(false)
    loadDashboard()
  }

  const goalPercentage = monthlyGoal > 0 
    ? Math.min(100, (monthlySales / monthlyGoal) * 100)
    : 0

  const currentMonth = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
  })

  if (showNewSale) {
    return (
      <NewSale
        onSuccess={handleSaleSuccess}
        onCancel={() => setShowNewSale(false)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-500">Visão geral</p>

        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          Olá, {userName || 'Revendedora'}! 👋
        </h2>

        <p className="mt-1 text-gray-600">
          Veja como está sua revenda hoje.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando...</p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-green-600 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-green-100">Vendas do mês</p>
                <p className="mt-2 text-3xl font-bold">
                  {monthlySales.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>

              <span className="rounded-xl bg-white/20 px-3 py-2 text-sm capitalize">
                {currentMonth}
              </span>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <span>
                  Meta: {monthlyGoal.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </span>
                <span>{goalPercentage.toFixed(0)}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${goalPercentage}%` }}
                />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">A receber</p>
              <p className="mt-2 text-xl font-bold text-orange-600">
                {pendingAmount.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Lucro estimado</p>
              <p className="mt-2 text-xl font-bold text-green-600">
                {monthlySales.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>
          </section>

          <section>
            <button
              type="button"
              onClick={() => setShowNewSale(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-gray-800"
            >
              <span className="text-xl">+</span>
              Registrar venda
            </button>
          </section>
        </>
      )}
    </div>
  )
}

export default Dashboard