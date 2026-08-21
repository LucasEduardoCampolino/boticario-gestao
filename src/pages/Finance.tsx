// src/pages/Finance.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastContainer'

type Sale = {
  id: string
  sale_date: string
  subtotal: number
  discount: number
  total: number
  status: string
  customer: {
    name: string
  } | null
  payments: {
    id: string
    amount: number
    method: string
    payment_date: string
  }[]
}

type Expense = {
  id: string
  expense_date: string
  description: string
  category: string | null
  amount: number
  notes: string | null
  created_at: string
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
  transfer: 'Transferência',
  other: 'Outro',
}

const expenseCategories = [
  'Compras',
  'Frete',
  'Embalagens',
  'Marketing',
  'Taxas',
  'Outros',
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

function getMonthName(monthIndex: number) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return months[monthIndex]
}

function Finance() {
  const { showToast } = useToast()

  // Estado principal
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedTab, setSelectedTab] = useState<'summary' | 'sales' | 'expenses'>('summary')

  // Modal de despesa
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    category: 'Compras',
    amount: '',
    notes: '',
  })
  const [savingExpense, setSavingExpense] = useState(false)

  // Modal de exclusão de despesa
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null)

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [year, month] = selectedMonth.split('-')
      const startDate = `${year}-${month}-01`
      const endDate = `${year}-${month}-31`

      // Buscar vendas com pagamentos
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          subtotal,
          discount,
          total,
          status,
          customers (
            name
          ),
          payments (
            id,
            amount,
            method,
            payment_date
          )
        `)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .neq('status', 'cancelled')
        .order('sale_date', { ascending: false })

      if (salesError) throw salesError

      // Buscar despesas
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false })

      if (expensesError) throw expensesError

      // Formatar vendas
      const formattedSales: Sale[] = (salesData || []).map(sale => {
        const customerData = Array.isArray(sale.customers)
          ? sale.customers[0]
          : sale.customers

        return {
          id: sale.id,
          sale_date: sale.sale_date,
          subtotal: Number(sale.subtotal),
          discount: Number(sale.discount),
          total: Number(sale.total),
          status: sale.status,
          customer: customerData ? { name: customerData.name } : null,
          payments: (sale.payments || []).map(p => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            payment_date: p.payment_date,
          })),
        }
      })

      setSales(formattedSales)
      setExpenses((expensesData || []) as Expense[])
    } catch (err) {
      console.error('Erro ao carregar financeiro:', err)
      setError('Não foi possível carregar os dados financeiros.')
    } finally {
      setLoading(false)
    }
  }

  // Cálculos do resumo
  const summary = useMemo(() => {
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
    const totalReceived = sales.reduce((sum, sale) => {
      const salePayments = sale.payments.reduce((pSum, p) => pSum + p.amount, 0)
      return sum + salePayments
    }, 0)
    const totalPending = sales
      .filter(sale => sale.status === 'pending' || sale.status === 'partial')
      .reduce((sum, sale) => {
        const paid = sale.payments.reduce((pSum, p) => pSum + p.amount, 0)
        return sum + (sale.total - paid)
      }, 0)
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
    const balance = totalReceived - totalExpenses

    // Vendas por método de pagamento
    const salesByMethod: Record<string, number> = {}
    sales.forEach(sale => {
      sale.payments.forEach(payment => {
        if (!salesByMethod[payment.method]) {
          salesByMethod[payment.method] = 0
        }
        salesByMethod[payment.method] += payment.amount
      })
    })

    // Despesas por categoria
    const expensesByCategory: Record<string, number> = {}
    expenses.forEach(expense => {
      const category = expense.category || 'Outros'
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = 0
      }
      expensesByCategory[category] += Number(expense.amount)
    })

    return {
      totalSales,
      totalReceived,
      totalPending,
      totalExpenses,
      balance,
      salesByMethod,
      expensesByCategory,
      salesCount: sales.length,
      expensesCount: expenses.length,
    }
  }, [sales, expenses])

  // Funções de despesa
  function handleOpenExpenseModal(expense?: Expense) {
    setError('')

    if (expense) {
      setEditingExpense(expense)
      setExpenseForm({
        expense_date: expense.expense_date,
        description: expense.description,
        category: expense.category || 'Compras',
        amount: expense.amount.toString(),
        notes: expense.notes || '',
      })
    } else {
      setEditingExpense(null)
      setExpenseForm({
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
        category: 'Compras',
        amount: '',
        notes: '',
      })
    }

    setShowExpenseModal(true)
  }

  function handleCloseExpenseModal() {
    if (savingExpense) return
    setShowExpenseModal(false)
    setEditingExpense(null)
    setError('')
  }

  async function handleSaveExpense(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const amount = Number(expenseForm.amount.replace(',', '.'))

    if (!expenseForm.description.trim()) {
      setError('Informe a descrição da despesa.')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor válido para a despesa.')
      return
    }

    try {
      setSavingExpense(true)

      const expenseData = {
        expense_date: expenseForm.expense_date,
        description: expenseForm.description.trim(),
        category: expenseForm.category,
        amount,
        notes: expenseForm.notes.trim() || null,
      }

      if (editingExpense) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)

        if (updateError) throw updateError
        showToast('Despesa atualizada com sucesso!', 'success')
      } else {
        const { error: insertError } = await supabase
          .from('expenses')
          .insert(expenseData)

        if (insertError) throw insertError
        showToast('Despesa adicionada com sucesso!', 'success')
      }

      setShowExpenseModal(false)
      setEditingExpense(null)
      await loadData()
    } catch (err) {
      console.error('Erro ao salvar despesa:', err)
      setError('Não foi possível salvar a despesa.')
      showToast('Não foi possível salvar a despesa.', 'error')
    } finally {
      setSavingExpense(false)
    }
  }

  async function handleDeleteExpense() {
    if (!deletingExpense) return

    try {
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deletingExpense.id)

      if (deleteError) throw deleteError

      setDeletingExpense(null)
      showToast('Despesa excluída com sucesso!', 'success')
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir despesa:', err)
      setError('Não foi possível excluir a despesa.')
      showToast('Não foi possível excluir a despesa.', 'error')
      setDeletingExpense(null)
    }
  }

  const [year, month] = selectedMonth.split('-')
  const monthName = getMonthName(Number(month) - 1)

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section>
        <p className="text-sm text-gray-500">Financeiro</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          {monthName} de {year}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Acompanhe suas finanças
        </p>
      </section>

      {/* FILTRO DE MÊS */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <label htmlFor="month" className="mb-1 block text-sm font-medium text-gray-700">
          Selecionar mês
        </label>
        <input
          id="month"
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-2.5 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100 sm:w-64"
        />
      </section>

      {/* TABS */}
      <section className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelectedTab('summary')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            selectedTab === 'summary'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Resumo
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab('sales')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            selectedTab === 'sales'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Vendas
        </button>
        <button
          type="button"
          onClick={() => setSelectedTab('expenses')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            selectedTab === 'expenses'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Despesas
        </button>
      </section>

      {/* ERRO */}
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="mt-3 text-sm text-gray-500">
            Carregando dados financeiros...
          </p>
        </div>
      ) : (
        <>
          {/* TAB: RESUMO */}
          {selectedTab === 'summary' && (
            <div className="space-y-6">
              {/* CARDS PRINCIPAIS */}
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Faturamento
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">
                    {formatCurrency(summary.totalSales)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {summary.salesCount} {summary.salesCount === 1 ? 'venda' : 'vendas'}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Recebido
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-600">
                    {formatCurrency(summary.totalReceived)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    A receber
                  </p>
                  <p className="mt-2 text-2xl font-bold text-orange-600">
                    {formatCurrency(summary.totalPending)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Despesas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-red-600">
                    {formatCurrency(summary.totalExpenses)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {summary.expensesCount} {summary.expensesCount === 1 ? 'despesa' : 'despesas'}
                  </p>
                </div>

                <div className="rounded-2xl bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Saldo
                  </p>
                  <p className={`mt-2 text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary.balance)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Recebido - Despesas
                  </p>
                </div>
              </section>

              {/* VENDAS POR FORMA DE PAGAMENTO */}
              <section className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">
                  Vendas por forma de pagamento
                </h3>

                <div className="mt-4 space-y-3">
                  {Object.entries(paymentMethodLabels).map(([value, label]) => {
                    const total = summary.salesByMethod[value] || 0
                    if (total === 0) return null

                    const percentage = summary.totalReceived > 0
                      ? (total / summary.totalReceived) * 100
                      : 0

                    return (
                      <div key={value}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-medium text-gray-900">
                            {formatCurrency(total)}
                            <span className="ml-2 text-xs text-gray-500">
                              ({percentage.toFixed(1)}%)
                            </span>
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-green-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}

                  {Object.keys(summary.salesByMethod).length === 0 && (
                    <p className="text-sm text-gray-500">
                      Nenhum pagamento registrado neste período.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB: VENDAS */}
          {selectedTab === 'sales' && (
            <div className="space-y-3">
              {sales.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <div className="text-4xl">💰</div>
                  <h3 className="mt-3 font-semibold text-gray-900">
                    Nenhuma venda neste mês
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    As vendas registradas em {monthName} aparecerão aqui.
                  </p>
                </div>
              ) : (
                sales.map((sale) => (
                  <div key={sale.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {sale.customer?.name ?? 'Consumidor não cadastrado'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(sale.sale_date)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        sale.status === 'paid'
                          ? 'bg-green-50 text-green-700'
                          : sale.status === 'pending'
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-blue-50 text-blue-700'
                      }`}>
                        {sale.status === 'paid' ? 'Paga' : sale.status === 'pending' ? 'Pendente' : 'Parcial'}
                      </span>
                    </div>
                    <div className="mt-3 flex justify-between">
                      <span className="text-sm text-gray-500">Total</span>
                      <span className="font-bold text-gray-900">
                        {formatCurrency(sale.total)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: DESPESAS */}
          {selectedTab === 'expenses' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleOpenExpenseModal()}
                className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
              >
                + Nova despesa
              </button>

              {expenses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                  <div className="text-4xl">📝</div>
                  <h3 className="mt-3 font-semibold text-gray-900">
                    Nenhuma despesa registrada
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Adicione suas despesas para acompanhar melhor seu lucro.
                  </p>
                </div>
              ) : (
                expenses.map((expense) => (
                  <div key={expense.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {expense.description}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDate(expense.expense_date)} • {expense.category || 'Outros'}
                        </p>
                      </div>
                      <span className="font-bold text-red-600">
                        -{formatCurrency(Number(expense.amount))}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenExpenseModal(expense)}
                        className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingExpense(expense)}
                        className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL DE DESPESA */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingExpense ? 'Editar despesa' : 'Nova despesa'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {editingExpense ? 'Atualize os dados da despesa.' : 'Registre uma nova despesa.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseExpenseModal}
                disabled={savingExpense}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="mt-6 space-y-4">
              <div>
                <label htmlFor="expense-date" className="mb-1 block text-sm font-medium text-gray-700">
                  Data *
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                  required
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div>
                <label htmlFor="expense-description" className="mb-1 block text-sm font-medium text-gray-700">
                  Descrição *
                </label>
                <input
                  id="expense-description"
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Ex.: Compra de produtos"
                />
              </div>

              <div>
                <label htmlFor="expense-category" className="mb-1 block text-sm font-medium text-gray-700">
                  Categoria
                </label>
                <select
                  id="expense-category"
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="expense-amount" className="mb-1 block text-sm font-medium text-gray-700">
                  Valor *
                </label>
                <div className="flex items-center rounded-xl border border-gray-300 bg-white">
                  <span className="pl-4 text-sm text-gray-400">R$</span>
                  <input
                    id="expense-amount"
                    type="text"
                    inputMode="decimal"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                    className="w-full bg-transparent px-3 py-3 text-right text-lg outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="expense-notes" className="mb-1 block text-sm font-medium text-gray-700">
                  Observações
                </label>
                <textarea
                  id="expense-notes"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Observações adicionais..."
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseExpenseModal}
                  disabled={savingExpense}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingExpense}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingExpense ? 'Salvando...' : editingExpense ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
                ⚠️
              </div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                Excluir despesa?
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Você está prestes a excluir{' '}
                <strong className="text-gray-700">
                  {deletingExpense.description}
                </strong>
                .
                <br />
                Essa ação não poderá ser desfeita.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingExpense(null)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteExpense}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Finance