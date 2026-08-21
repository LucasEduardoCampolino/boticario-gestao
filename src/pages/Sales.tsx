// src/pages/Sales.tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastContainer'

type Sale = {
  id: string
  sale_date: string
  subtotal: number
  discount: number
  total: number
  status: string
  notes: string | null
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

const paymentMethods = [
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit_card', label: 'Cartão de débito' },
  { value: 'transfer', label: 'Transferência' },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

function Sales() {
  const { showToast } = useToast()
  
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethodModal, setPaymentMethodModal] = useState('pix')
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    loadSales()
  }, [])

  async function loadSales() {
    setLoading(true)
    setError('')

    try {
      const { data, error: salesError } = await supabase
        .from('sales')
        .select(
          `
            id,
            sale_date,
            subtotal,
            discount,
            total,
            status,
            notes,
            customers (
              name
            ),
            payments (
              id,
              amount,
              method,
              payment_date
            )
          `,
        )
        .neq('status', 'cancelled')
        .order('sale_date', { ascending: false })
        .limit(100)

      if (salesError) throw salesError

      const formattedSales: Sale[] = (data ?? []).map((sale) => {
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
          notes: sale.notes,
          customer: customerData ? { name: customerData.name } : null,
          payments: (sale.payments || []).map((p) => ({
            id: p.id,
            amount: Number(p.amount),
            method: p.method,
            payment_date: p.payment_date,
          })),
        }
      })

      setSales(formattedSales)
    } catch (err) {
      setError(getErrorMessage(err))
      showToast('Não foi possível carregar as vendas.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Filtrar por status
      if (filter === 'pending') {
        if (sale.status !== 'pending' && sale.status !== 'partial') {
          return false
        }
      } else if (filter === 'paid') {
        if (sale.status !== 'paid') {
          return false
        }
      }

      // Filtrar por busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (
          sale.customer?.name.toLowerCase().includes(term) ||
          sale.id.toLowerCase().includes(term) ||
          sale.notes?.toLowerCase().includes(term)
        )
      }

      return true
    })
  }, [sales, filter, searchTerm])

  function getPendingAmount(sale: Sale) {
    const paidAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0)
    return Math.max(0, sale.total - paidAmount)
  }

  function handleOpenPaymentModal(sale: Sale) {
    const remainingAmount = getPendingAmount(sale)

    setSelectedSale(sale)
    setPaymentAmount(remainingAmount.toString())
    setPaymentMethodModal('pix')
    setShowPaymentModal(true)
    setError('')
  }

  function handleClosePaymentModal() {
    if (savingPayment) return
    setShowPaymentModal(false)
    setSelectedSale(null)
    setPaymentAmount('')
    setPaymentMethodModal('pix')
    setError('')
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!selectedSale) return

    const amount = Number(paymentAmount.replace(',', '.'))

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Informe um valor válido para o pagamento.')
      return
    }

    const paidAmount = selectedSale.payments.reduce((sum, p) => sum + p.amount, 0)
    const remainingAmount = selectedSale.total - paidAmount

    if (amount > remainingAmount) {
      setError(`O valor máximo é ${formatCurrency(remainingAmount)}.`)
      return
    }

    try {
      setSavingPayment(true)

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          sale_id: selectedSale.id,
          amount,
          method: paymentMethodModal,
          payment_date: new Date().toISOString().split('T')[0],
          notes: 'Pagamento registrado',
        })

      if (paymentError) throw paymentError

      // Verificar se o pagamento total foi atingido
      const newPaidAmount = paidAmount + amount
      const isFullyPaid = newPaidAmount >= selectedSale.total

      const { error: updateError } = await supabase
        .from('sales')
        .update({ status: isFullyPaid ? 'paid' : 'partial' })
        .eq('id', selectedSale.id)

      if (updateError) throw updateError

      setShowPaymentModal(false)
      setSelectedSale(null)
      showToast('Pagamento registrado com sucesso!', 'success')
      await loadSales()
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err)
      setError(getErrorMessage(err))
      showToast('Não foi possível registrar o pagamento.', 'error')
    } finally {
      setSavingPayment(false)
    }
  }

  const pendingCount = sales.filter(
    (sale) => sale.status === 'pending' || sale.status === 'partial',
  ).length

  const paidCount = sales.filter((sale) => sale.status === 'paid').length

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <p className="text-sm text-gray-500">Vendas</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          Histórico de Vendas
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Acompanhe e gerencie suas vendas
        </p>
      </div>

      {/* Mensagens de erro */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filtros */}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todas ({sales.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              filter === 'pending'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            Pendentes ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              filter === 'paid'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            Pagas ({paidCount})
          </button>
        </div>

        <div className="mt-3">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔎 Buscar por cliente, ID ou observação..."
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
          />
        </div>
      </section>

      {/* Lista de vendas */}
      {loading ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando vendas...</p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="text-4xl">💰</div>
          <h3 className="mt-3 font-semibold text-gray-900">
            {filter === 'pending'
              ? 'Nenhuma venda pendente'
              : filter === 'paid'
                ? 'Nenhuma venda paga'
                : 'Nenhuma venda registrada'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {filter === 'pending'
              ? 'Não há vendas aguardando pagamento.'
              : filter === 'paid'
                ? 'Não há vendas pagas registradas.'
                : 'Registre sua primeira venda para começar.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale) => {
            const pendingAmount = getPendingAmount(sale)
            const isPending = sale.status === 'pending' || sale.status === 'partial'

            return (
              <div
                key={sale.id}
                className="rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {sale.customer?.name ?? 'Consumidor não cadastrado'}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(sale.sale_date)} • ID: {sale.id.slice(0, 8)}
                    </p>

                    {sale.notes && (
                      <p className="mt-1 text-xs text-gray-400">
                        Obs: {sale.notes}
                      </p>
                    )}
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      sale.status === 'paid'
                        ? 'bg-green-50 text-green-700'
                        : sale.status === 'pending'
                          ? 'bg-orange-50 text-orange-700'
                          : sale.status === 'partial'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {sale.status === 'paid'
                      ? 'Paga'
                      : sale.status === 'pending'
                        ? 'Pendente'
                        : sale.status === 'partial'
                          ? 'Parcial'
                          : sale.status}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div className="text-sm text-gray-500">
                    <p>Subtotal: {formatCurrency(sale.subtotal)}</p>

                    {sale.discount > 0 && (
                      <p>Desconto: {formatCurrency(sale.discount)}</p>
                    )}

                    {isPending && (
                      <p className="mt-1 font-medium text-orange-600">
                        Pendente: {formatCurrency(pendingAmount)}
                      </p>
                    )}
                  </div>

                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(sale.total)}
                  </p>
                </div>

                {/* Pagamentos realizados */}
                {sale.payments.length > 0 && (
                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-xs font-medium text-gray-500">
                      Pagamentos ({sale.payments.length})
                    </p>
                    <div className="mt-2 space-y-1">
                      {sale.payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex justify-between text-xs text-gray-600"
                        >
                          <span>
                            {formatDate(payment.payment_date)} •{' '}
                            {paymentMethods.find(m => m.value === payment.method)?.label || payment.method}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="mt-4 space-y-2">
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => handleOpenPaymentModal(sale)}
                      className="w-full rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      💰 Registrar pagamento
                    </button>
                  )}

                  <Link
                    to={`/vendas/${sale.id}`}
                    className="block w-full rounded-xl bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Ver detalhes
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de pagamento */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Registrar pagamento
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedSale.customer?.name ?? 'Consumidor não cadastrado'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClosePaymentModal}
                disabled={savingPayment}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="mt-6 space-y-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total da venda</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(selectedSale.total)}
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">Já pago</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(
                      selectedSale.payments.reduce((sum, p) => sum + p.amount, 0)
                    )}
                  </span>
                </div>

                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm">
                  <span className="font-medium text-gray-700">Pendente</span>
                  <span className="font-bold text-orange-600">
                    {formatCurrency(getPendingAmount(selectedSale))}
                  </span>
                </div>
              </div>

              <div>
                <label
                  htmlFor="payment-amount"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Valor do pagamento *
                </label>

                <div className="flex items-center rounded-xl border border-gray-300 bg-white">
                  <span className="pl-4 text-sm text-gray-400">R$</span>
                  <input
                    id="payment-amount"
                    type="text"
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="w-full bg-transparent px-3 py-3 text-right text-lg outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="payment-method-modal"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Forma de pagamento
                </label>

                <select
                  id="payment-method-modal"
                  value={paymentMethodModal}
                  onChange={(e) => setPaymentMethodModal(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClosePaymentModal}
                  disabled={savingPayment}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPayment ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sales