// src/pages/SaleDetails.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

type SaleItem = {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_cost: number
  unit_price: number
  discount: number
  total: number
}

type Payment = {
  id: string
  amount: number
  method: string
  payment_date: string
  notes: string | null
}

type Sale = {
  id: string
  sale_date: string
  subtotal: number
  discount: number
  total: number
  status: string
  notes: string | null
  customer: {
    id: string
    name: string
  } | null
  sale_items: SaleItem[]
  payments: Payment[]
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'PIX',
  debit_card: 'Débito',
  credit_card: 'Crédito',
  transfer: 'Transferência',
  other: 'Outro',
}

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function SaleDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Modal de pagamento
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [savingPayment, setSavingPayment] = useState(false)

  useEffect(() => {
    loadSale()
  }, [id])

  async function loadSale() {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          sale_date,
          subtotal,
          discount,
          total,
          status,
          notes,
          customers (
            id,
            name
          ),
          sale_items (
            id,
            product_id,
            product_name,
            quantity,
            unit_cost,
            unit_price,
            discount,
            total
          ),
          payments (
            id,
            amount,
            method,
            payment_date,
            notes
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      const customerData = Array.isArray(data.customers)
        ? data.customers[0]
        : data.customers

      setSale({
        id: data.id,
        sale_date: data.sale_date,
        subtotal: Number(data.subtotal),
        discount: Number(data.discount),
        total: Number(data.total),
        status: data.status,
        notes: data.notes,
        customer: customerData,
        sale_items: data.sale_items,
        payments: data.payments,
      })
    } catch (err) {
      console.error('Erro ao carregar venda:', err)
      showToast('Não foi possível carregar os detalhes da venda.', 'error')
      navigate('/financeiro')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelSale() {
    if (!sale) return

    try {
      setCancelling(true)

      const { error } = await supabase.rpc('cancel_sale', {
        p_sale_id: sale.id,
      })

      if (error) throw error

      showToast('Venda cancelada com sucesso!', 'success')
      setShowCancelModal(false)
      await loadSale()
    } catch (err) {
      console.error('Erro ao cancelar venda:', err)
      showToast('Não foi possível cancelar a venda.', 'error')
    } finally {
      setCancelling(false)
    }
  }

  function getPaidAmount() {
    if (!sale) return 0
    return sale.payments.reduce((sum, p) => sum + Number(p.amount), 0)
  }

  function getPendingAmount() {
    if (!sale) return 0
    return Math.max(0, sale.total - getPaidAmount())
  }

  function handleOpenPaymentModal() {
    setPaymentAmount(getPendingAmount().toString())
    setPaymentMethod('pix')
    setShowPaymentModal(true)
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault()

    if (!sale) return

    const amount = Number(paymentAmount.replace(',', '.'))

    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Informe um valor válido.', 'error')
      return
    }

    const remainingAmount = getPendingAmount()

    if (amount > remainingAmount) {
      showToast(`O valor máximo é ${formatCurrency(remainingAmount)}.`, 'error')
      return
    }

    try {
      setSavingPayment(true)

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          sale_id: sale.id,
          amount,
          method: paymentMethod,
          payment_date: new Date().toISOString().split('T')[0],
          notes: 'Pagamento registrado',
        })

      if (paymentError) throw paymentError

      const newPaidAmount = getPaidAmount() + amount
      const isFullyPaid = newPaidAmount >= sale.total

      const { error: updateError } = await supabase
        .from('sales')
        .update({ status: isFullyPaid ? 'paid' : 'partial' })
        .eq('id', sale.id)

      if (updateError) throw updateError

      setShowPaymentModal(false)
      showToast('Pagamento registrado com sucesso!', 'success')
      await loadSale()
    } catch (err) {
      console.error('Erro ao registrar pagamento:', err)
      showToast('Não foi possível registrar o pagamento.', 'error')
    } finally {
      setSavingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-pink-100 border-t-pink-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando venda...</p>
        </div>
      </div>
    )
  }

  if (!sale) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <div className="text-4xl">🔍</div>
        <h3 className="mt-3 font-semibold text-gray-900">Venda não encontrada</h3>
        <p className="mt-1 text-sm text-gray-500">
          A venda que você procura não existe ou foi removida.
        </p>
        <Link
          to="/financeiro"
          className="mt-5 inline-block rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white hover:bg-pink-700"
        >
          Voltar para financeiro
        </Link>
      </div>
    )
  }

  const canCancel = sale.status !== 'cancelled'
  const isPending = sale.status === 'pending' || sale.status === 'partial'

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate('/financeiro')}
            className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            ← Voltar para financeiro
          </button>

          <h2 className="text-2xl font-bold text-gray-900">
            Detalhes da Venda
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            ID: {sale.id.slice(0, 8)}
          </p>
        </div>

        {canCancel && (
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            Cancelar venda
          </button>
        )}
      </section>

      {/* Status */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span
              className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium ${
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
                    : sale.status === 'cancelled'
                      ? 'Cancelada'
                      : sale.status}
            </span>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Data</p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatDate(sale.sale_date)}
            </p>
          </div>
        </div>

        {/* Botão de pagamento */}
        {isPending && (
          <button
            type="button"
            onClick={handleOpenPaymentModal}
            className="mt-4 w-full rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            💰 Registrar pagamento
          </button>
        )}
      </section>

      {/* Cliente */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">Cliente</h3>
        <p className="mt-2 text-gray-600">
          {sale.customer?.name ?? 'Consumidor não cadastrado'}
        </p>
      </section>

      {/* Itens da venda */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">Itens da venda</h3>

        <div className="mt-4 space-y-3">
          {sale.sale_items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {item.product_name}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {item.quantity} x {formatCurrency(Number(item.unit_price))}
                  </p>
                </div>
                <p className="font-bold text-gray-900">
                  {formatCurrency(Number(item.total))}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Totais */}
        <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>

          {sale.discount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Desconto</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          )}

          <div className="flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
        </div>
      </section>

      {/* Pagamentos */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">Pagamentos</h3>

        {sale.payments.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            Nenhum pagamento registrado.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {sale.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between rounded-xl bg-gray-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(Number(payment.amount))}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {paymentMethodLabels[payment.method] || payment.method} •{' '}
                    {formatDateTime(payment.payment_date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resumo de pagamentos */}
        <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total pago</span>
            <span className="font-medium text-green-600">
              {formatCurrency(getPaidAmount())}
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Valor pendente</span>
            <span className="font-medium text-orange-600">
              {formatCurrency(getPendingAmount())}
            </span>
          </div>
        </div>
      </section>

      {/* Observações */}
      {sale.notes && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">Observações</h3>
          <p className="mt-2 text-gray-600">{sale.notes}</p>
        </section>
      )}

      {/* Modal de pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Registrar pagamento</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {sale.customer?.name ?? 'Consumidor não cadastrado'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                disabled={savingPayment}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRegisterPayment} className="mt-6 space-y-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total da venda</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(sale.total)}</span>
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-500">Já pago</span>
                  <span className="font-semibold text-green-600">{formatCurrency(getPaidAmount())}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-sm">
                  <span className="font-medium text-gray-700">Pendente</span>
                  <span className="font-bold text-orange-600">{formatCurrency(getPendingAmount())}</span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Valor do pagamento *</label>
                <div className="flex items-center rounded-xl border border-gray-300 bg-white">
                  <span className="pl-4 text-sm text-gray-400">R$</span>
                  <input
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Forma de pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
                >
                  <option value="pix">PIX</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de crédito</option>
                  <option value="debit_card">Cartão de débito</option>
                  <option value="transfer">Transferência</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={savingPayment}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex-1 rounded-xl bg-pink-600 px-4 py-3 font-semibold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPayment ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
                ⚠️
              </div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                Cancelar venda?
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Esta ação irá:
                <br />• Estornar o estoque dos produtos
                <br />• Remover os pagamentos registrados
                <br />• Marcar a venda como cancelada
                <br />
                <br />
                <strong className="text-gray-700">
                  Esta ação não poderá ser desfeita.
                </strong>
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleCancelSale}
                disabled={cancelling}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SaleDetails