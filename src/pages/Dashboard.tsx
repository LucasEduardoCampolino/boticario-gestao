// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NewSale from '../components/NewSale'
import { useToast } from '../hooks/useToast'  // ← Corrigido

function Dashboard() {
  const { showToast } = useToast()
  
  const [userName, setUserName] = useState('')
  const [showNewSale, setShowNewSale] = useState(false)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  const [monthlySales, setMonthlySales] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // Modal de meta
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalError, setGoalError] = useState('')
  const [goalSuccess, setGoalSuccess] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [selectedMonth])

  async function loadDashboard() {
    try {
      setLoading(true)

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

      // Calcular vendas do mês selecionado
      const [year, month] = selectedMonth.split('-')
      const startOfMonth = `${year}-${month}-01`
      const endOfMonth = `${year}-${month}-31`

      // Buscar vendas pagas do mês
      const { data: paidSalesData, error: paidSalesError } = await supabase
        .from('sales')
        .select('total')
        .eq('status', 'paid')
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth)

      if (paidSalesError) throw paidSalesError

      const totalPaidSales = (paidSalesData || []).reduce((sum, sale) => {
        return sum + Number(sale.total)
      }, 0)

      // Buscar vendas pendentes do mês
      const { data: pendingSalesData, error: pendingSalesError } = await supabase
        .from('sales')
        .select('total, payments (amount)')
        .in('status', ['pending', 'partial'])
        .gte('sale_date', startOfMonth)
        .lte('sale_date', endOfMonth)

      if (pendingSalesError) throw pendingSalesError

      // Calcular valor pendente real
      const totalPending = (pendingSalesData || []).reduce((sum, sale) => {
        const saleTotal = Number(sale.total)
        const paidAmount = (sale.payments || []).reduce(
          (paymentSum, payment) => paymentSum + Number(payment.amount),
          0,
        )
        return sum + Math.max(0, saleTotal - paidAmount)
      }, 0)

      setMonthlySales(totalPaidSales)
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
    showToast('Venda registrada com sucesso!', 'success')
  }

  function getMonthName(monthIndex: number) {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril',
      'Maio', 'Junho', 'Julho', 'Agosto',
      'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    return months[monthIndex]
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedDate = e.target.value
    const [year, month] = selectedDate.split('-')
    
    const selectedMonthDate = new Date(Number(year), Number(month) - 1, 1)
    const now = new Date()
    const currentMonthDate = new Date(now.getFullYear(), now.getMonth(), 1)
    
    if (selectedMonthDate > currentMonthDate) {
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    } else {
      setSelectedMonth(selectedDate)
    }
    
    setShowMonthPicker(false)
  }

  function handleOpenGoalModal() {
    setGoalInput(monthlyGoal > 0 ? monthlyGoal.toString() : '')
    setGoalError('')
    setGoalSuccess('')
    setShowGoalModal(true)
  }

  function handleCloseGoalModal() {
    if (savingGoal) return
    setShowGoalModal(false)
    setGoalError('')
    setGoalSuccess('')
  }

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault()
    setGoalError('')
    setGoalSuccess('')

    const goalValue = Number(goalInput.replace(',', '.'))

    if (!Number.isFinite(goalValue) || goalValue < 0) {
      setGoalError('Informe um valor válido para a meta.')
      return
    }

    try {
      setSavingGoal(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuário não autenticado')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ monthly_sales_goal: goalValue })
        .eq('id', user.id)

      if (updateError) throw updateError

      setMonthlyGoal(goalValue)
      setGoalSuccess('Meta atualizada com sucesso!')
      showToast('Meta atualizada com sucesso!', 'success')

      setTimeout(() => {
        setShowGoalModal(false)
        setGoalSuccess('')
      }, 1500)
    } catch (err) {
      console.error('Erro ao salvar meta:', err)
      setGoalError('Não foi possível salvar a meta.')
    } finally {
      setSavingGoal(false)
    }
  }

  const [year, month] = selectedMonth.split('-')
  const monthName = getMonthName(Number(month) - 1)
  const goalPercentage = monthlyGoal > 0
    ? Math.min(100, (monthlySales / monthlyGoal) * 100)
    : 0

  const now = new Date()
  const isCurrentMonth = 
    now.getFullYear() === Number(year) && 
    now.getMonth() + 1 === Number(month)

  const last12Months = () => {
    const months = []
    const currentDate = new Date()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = `${getMonthName(date.getMonth())}/${date.getFullYear()}`
      
      months.push({
        value,
        label,
        isCurrent: i === 0,
      })
    }
    
    return months
  }

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

        {/* Nome clicável que leva para configurações */}
        <Link
          to="/configuracoes"
          className="group mt-1 inline-flex items-center gap-2"
        >
          <h2 className="text-2xl font-bold text-gray-900 transition group-hover:text-pink-600">
            Olá, {userName || 'Revendedora'}! 👋
          </h2>
          <span className="rounded-lg bg-pink-50 p-1.5 text-sm text-pink-400 opacity-0 transition group-hover:opacity-100">
            ⚙️
          </span>
        </Link>

        <p className="mt-1 text-gray-600">
          Veja como está sua revenda hoje.
        </p>
      </section>

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-pink-100 border-t-pink-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando dados...</p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-pink-600 p-5 text-white shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-pink-100">
                  Vendas pagas {isCurrentMonth ? 'do mês' : `em ${monthName}`}
                </p>
                <p className="mt-2 text-3xl font-bold">
                  {monthlySales.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>

              {/* Seletor de mês inline */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-sm font-medium transition hover:bg-white/30"
                >
                  <span className="capitalize">
                    {monthName}/{year}
                  </span>
                  <svg
                    className={`h-4 w-4 transition-transform ${showMonthPicker ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown de seleção */}
                {showMonthPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMonthPicker(false)}
                    />

                    <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl bg-white shadow-xl">
                      <div className="border-b border-gray-100 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Selecionar mês
                        </p>
                      </div>

                      <div className="max-h-64 overflow-y-auto">
                        {last12Months().map((monthOption) => (
                          <button
                            key={monthOption.value}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(monthOption.value)
                              setShowMonthPicker(false)
                            }}
                            className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-gray-50 ${
                              selectedMonth === monthOption.value
                                ? 'bg-pink-50 font-semibold text-pink-700'
                                : 'text-gray-700'
                            }`}
                          >
                            <span className="capitalize">
                              {monthOption.label}
                            </span>

                            {monthOption.isCurrent && (
                              <span className="rounded-full bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700">
                                Atual
                              </span>
                            )}

                            {selectedMonth === monthOption.value && (
                              <svg
                                className="h-5 w-5 text-pink-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>

                      <div className="border-t border-gray-100 p-3">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-gray-500">
                            Outro mês
                          </span>
                          <input
                            type="month"
                            value={selectedMonth}
                            onChange={handleMonthChange}
                            max={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                          />
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-sm">
                <button
                  type="button"
                  onClick={handleOpenGoalModal}
                  className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 transition hover:bg-white/20"
                >
                  <span>
                    Meta: {monthlyGoal > 0 
                      ? monthlyGoal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : 'Definir meta'}
                  </span>
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
                <span>{goalPercentage.toFixed(0)}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
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
              <p className="mt-1 text-xs text-gray-400">
                Em {monthName}
              </p>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">
                {isCurrentMonth ? 'Lucro do mês' : `Lucro em ${monthName}`}
              </p>
              <p className="mt-2 text-xl font-bold text-pink-600">
                {monthlySales.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Vendas pagas
              </p>
            </div>
          </section>

          {isCurrentMonth && (
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
          )}

          <section className="rounded-2xl border border-dashed border-pink-200 bg-white p-8 text-center">
            <div className="text-4xl">📊</div>

            <h3 className="mt-3 font-semibold text-gray-900">
              {monthlySales > 0
                ? `Você vendeu ${monthlySales.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })} em ${monthName}!`
                : `Nenhuma venda paga em ${monthName}`}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {monthlySales > 0
                ? isCurrentMonth
                  ? 'Continue assim! Clique em "Registrar venda" para adicionar mais.'
                  : 'Veja os detalhes no menu Financeiro.'
                : isCurrentMonth
                  ? 'Registre sua primeira venda para começar a acompanhar seus resultados.'
                  : 'Nenhuma venda paga registrada neste mês.'}
            </p>

            {monthlySales > 0 && goalPercentage >= 100 && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-pink-100 px-4 py-2 text-sm font-medium text-pink-700">
                🎉 Meta atingida!
              </div>
            )}

            {monthlySales > 0 && goalPercentage > 0 && goalPercentage < 100 && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
                💪 Faltam {((monthlyGoal - monthlySales) / monthlyGoal * 100).toFixed(0)}% para atingir a meta
              </div>
            )}

            {monthlyGoal === 0 && (
              <button
                type="button"
                onClick={handleOpenGoalModal}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
              >
                🎯 Definir meta mensal
              </button>
            )}
          </section>
        </>
      )}

      {/* Modal de definição de meta */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Definir meta mensal
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Quanto você quer vender por mês?
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseGoalModal}
                disabled={savingGoal}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="goal"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Valor da meta *
                </label>

                <div className="flex items-center rounded-xl border border-gray-300 bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-100">
                  <span className="pl-4 text-lg text-gray-400">R$</span>
                  <input
                    id="goal"
                    type="text"
                    inputMode="decimal"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    placeholder="0,00"
                    required
                    autoFocus
                    className="w-full bg-transparent px-3 py-3 text-right text-xl outline-none"
                  />
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Exemplo: 2000 para R$ 2.000,00
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">
                  Sugestões rápidas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[500, 1000, 2000, 3000, 5000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGoalInput(value.toString())}
                      className="rounded-full bg-pink-50 px-4 py-2 text-sm font-medium text-pink-700 hover:bg-pink-100"
                    >
                      {value.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </button>
                  ))}
                </div>
              </div>

              {goalError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {goalError}
                </div>
              )}

              {goalSuccess && (
                <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
                  {goalSuccess}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseGoalModal}
                  disabled={savingGoal}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingGoal}
                  className="flex-1 rounded-xl bg-pink-600 px-4 py-3 font-semibold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingGoal ? 'Salvando...' : 'Salvar meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard