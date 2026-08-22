// src/pages/CustomerDetails.tsx
import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
}

type PurchaseItem = {
  sale_id: string
  sale_date: string
  sale_total: number
  sale_status: string
  product_name: string
  quantity: number
  unit_price: number
  item_total: number
}

type ProductSummary = {
  product_name: string
  total_quantity: number
  total_spent: number
  purchase_count: number
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

function CustomerDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [purchases, setPurchases] = useState<PurchaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'history' | 'products'>('history')

  useEffect(() => {
    loadCustomerData()
  }, [id])

  async function loadCustomerData() {
    try {
      setLoading(true)

      // Carregar dados do cliente
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()

      if (customerError) throw customerError

      setCustomer(customerData as Customer)

      // Carregar histórico de compras usando a função RPC
      const { data: purchasesData, error: purchasesError } = await supabase
        .rpc('get_customer_purchase_history', {
          p_customer_id: id,
        })

      if (purchasesError) throw purchasesError

      setPurchases((purchasesData || []) as PurchaseItem[])
    } catch (err) {
      console.error('Erro ao carregar dados do cliente:', err)
      showToast('Não foi possível carregar os dados do cliente.', 'error')
      navigate('/clientes')
    } finally {
      setLoading(false)
    }
  }

  // Agrupar compras por venda
  const salesGrouped = useMemo(() => {
    const salesMap = new Map<string, {
      sale_id: string
      sale_date: string
      sale_total: number
      sale_status: string
      items: PurchaseItem[]
    }>()

    purchases.forEach((item) => {
      if (!salesMap.has(item.sale_id)) {
        salesMap.set(item.sale_id, {
          sale_id: item.sale_id,
          sale_date: item.sale_date,
          sale_total: Number(item.sale_total),
          sale_status: item.sale_status,
          items: [],
        })
      }

      salesMap.get(item.sale_id)!.items.push(item)
    })

    return Array.from(salesMap.values())
  }, [purchases])

  // Resumo de produtos mais comprados
  const productSummary = useMemo(() => {
    const productMap = new Map<string, ProductSummary>()

    purchases.forEach((item) => {
      if (!productMap.has(item.product_name)) {
        productMap.set(item.product_name, {
          product_name: item.product_name,
          total_quantity: 0,
          total_spent: 0,
          purchase_count: 0,
        })
      }

      const summary = productMap.get(item.product_name)!
      summary.total_quantity += item.quantity
      summary.total_spent += Number(item.item_total)
      summary.purchase_count += 1
    })

    return Array.from(productMap.values())
      .sort((a, b) => b.total_quantity - a.total_quantity)
  }, [purchases])

  // Totais
  const totals = useMemo(() => {
    const totalSpent = purchases.reduce((sum, item) => sum + Number(item.item_total), 0)
    const totalItems = purchases.reduce((sum, item) => sum + item.quantity, 0)
    const totalSales = salesGrouped.length

    return {
      totalSpent,
      totalItems,
      totalSales,
    }
  }, [purchases, salesGrouped])

  const maxProductQuantity = useMemo(() => {
    return Math.max(...productSummary.map(p => p.total_quantity), 1)
  }, [productSummary])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-pink-100 border-t-pink-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando dados do cliente...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <div className="text-4xl">🔍</div>
        <h3 className="mt-3 font-semibold text-gray-900">Cliente não encontrado</h3>
        <p className="mt-1 text-sm text-gray-500">
          O cliente que você procura não existe ou foi removido.
        </p>
        <Link
          to="/clientes"
          className="mt-5 inline-block rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white hover:bg-pink-700"
        >
          Voltar para clientes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <button
          type="button"
          onClick={() => navigate('/clientes')}
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar para clientes
        </button>

        <h2 className="text-2xl font-bold text-gray-900">
          {customer.name}
        </h2>

        <div className="mt-2 space-y-1 text-sm text-gray-500">
          {customer.phone && <p>📱 {customer.phone}</p>}
          {customer.email && <p>✉️ {customer.email}</p>}
          {customer.address && <p>📍 {customer.address}</p>}
        </div>

        {customer.notes && (
          <div className="mt-3 rounded-xl bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              <strong>Observações:</strong> {customer.notes}
            </p>
          </div>
        )}
      </section>

      {/* Cards de resumo */}
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Compras
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totals.totalSales}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Itens
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totals.totalItems}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Total gasto
          </p>
          <p className="mt-1 text-2xl font-bold text-pink-600">
            {formatCurrency(totals.totalSpent)}
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            activeTab === 'history'
              ? 'bg-pink-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Histórico de Compras
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('products')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            activeTab === 'products'
              ? 'bg-pink-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Itens Mais Comprados
        </button>
      </section>

      {/* Conteúdo da tab */}
      {activeTab === 'history' ? (
        <section className="space-y-3">
          {salesGrouped.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <div className="text-4xl">🛍️</div>
              <h3 className="mt-3 font-semibold text-gray-900">
                Nenhuma compra registrada
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Este cliente ainda não realizou compras.
              </p>
            </div>
          ) : (
            salesGrouped.map((sale) => (
              <div key={sale.sale_id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-500">
                      {formatDate(sale.sale_date)}
                    </p>
                    <p className="text-xs text-gray-400">
                      ID: {sale.sale_id.slice(0, 8)}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    sale.sale_status === 'paid'
                      ? 'bg-green-50 text-green-700'
                      : sale.sale_status === 'pending'
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-blue-50 text-blue-700'
                  }`}>
                    {sale.sale_status === 'paid' ? 'Paga' : sale.sale_status === 'pending' ? 'Pendente' : 'Parcial'}
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {sale.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.quantity}x {item.product_name}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(Number(item.item_total))}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between border-t border-gray-100 pt-3">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-pink-600">
                    {formatCurrency(sale.sale_total)}
                  </span>
                </div>

                <Link
                  to={`/vendas/${sale.sale_id}`}
                  className="mt-3 block w-full rounded-xl bg-gray-50 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Ver detalhes da venda
                </Link>
              </div>
            ))
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {productSummary.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <div className="text-4xl">📦</div>
              <h3 className="mt-3 font-semibold text-gray-900">
                Nenhum produto comprado
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Este cliente ainda não comprou produtos.
              </p>
            </div>
          ) : (
            productSummary.map((product, index) => {
              const percentage = (product.total_quantity / maxProductQuantity) * 100

              return (
                <div key={product.product_name} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-50 text-sm font-bold text-pink-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900">
                        {product.product_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {product.total_quantity} {product.total_quantity === 1 ? 'unidade' : 'unidades'} • {product.purchase_count} {product.purchase_count === 1 ? 'compra' : 'compras'}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(product.total_spent)}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-pink-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </section>
      )}
    </div>
  )
}

export default CustomerDetails