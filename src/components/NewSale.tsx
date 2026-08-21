// src/components/NewSale.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Customer = {
  id: string
  name: string
}

type Product = {
  id: string
  code: string | null
  name: string
  category: string | null
  sale_price: number
  stock_quantity: number
  minimum_stock: number
  active: boolean
}

type SaleItem = {
  product_id: string
  quantity: number
}

type PaymentType = 'now' | 'later'

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

interface NewSaleProps {
  onSuccess?: () => void
  onCancel?: () => void
}

function NewSale({ onSuccess, onCancel }: NewSaleProps) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<SaleItem[]>([])

  const [discount, setDiscount] = useState('')
  const [paymentType, setPaymentType] = useState<PaymentType>('now')
  const [paymentMethod, setPaymentMethod] = useState('pix')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const [customersResult, productsResult] = await Promise.all([
        supabase
          .from('customers')
          .select('id, name')
          .order('name'),

        supabase
          .from('products')
          .select(
            `
              id,
              code,
              name,
              category,
              sale_price,
              stock_quantity,
              minimum_stock,
              active
            `,
          )
          .eq('active', true)
          .order('name'),
      ])

      if (customersResult.error) throw customersResult.error
      if (productsResult.error) throw productsResult.error

      setCustomers(customersResult.data ?? [])
      setProducts(productsResult.data ?? [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function addProduct(productId: string) {
    if (!productId) return

    const existing = items.find(
      (item) => item.product_id === productId,
    )

    if (existing) {
      setItems(
        items.map((item) =>
          item.product_id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      )
      return
    }

    setItems([
      ...items,
      {
        product_id: productId,
        quantity: 1,
      },
    ])
  }

  function updateQuantity(productId: string, quantity: number) {
    const product = products.find((item) => item.id === productId)

    if (!product) return

    const safeQuantity = Math.max(
      1,
      Math.min(quantity, product.stock_quantity),
    )

    setItems(
      items.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: safeQuantity }
          : item,
      ),
    )
  }

  function removeProduct(productId: string) {
    setItems(
      items.filter((item) => item.product_id !== productId),
    )
  }

  const saleDetails = useMemo(() => {
    return items
      .map((item) => {
        const product = products.find(
          (productItem) => productItem.id === item.product_id,
        )

        if (!product) return null

        return {
          ...item,
          product,
          total: Number(product.sale_price) * item.quantity,
        }
      })
      .filter(Boolean) as Array<
      SaleItem & {
        product: Product
        total: number
      }
    >
  }, [items, products])

  const subtotal = useMemo(() => {
    return saleDetails.reduce((sum, item) => sum + item.total, 0)
  }, [saleDetails])

  const discountValue = Math.max(
    0,
    Number(discount.replace(',', '.')) || 0,
  )

  const total = Math.max(0, subtotal - discountValue)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (items.length === 0) {
      setError('Adicione pelo menos um produto à venda.')
      return
    }

    for (const item of saleDetails) {
      if (item.quantity > item.product.stock_quantity) {
        setError(`Estoque insuficiente para ${item.product.name}.`)
        return
      }
    }

    setSaving(true)

    try {
      const effectivePaymentMethod = paymentType === 'now' ? paymentMethod : null

      const { data, error: rpcError } = await supabase.rpc('create_sale', {
        p_customer_id: customerId || null,
        p_discount: discountValue,
        p_payment_method: effectivePaymentMethod,
        p_notes: notes.trim() || null,
        p_items: items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
      })

      if (rpcError) {
        console.error('ERRO CREATE_SALE:', rpcError)
        throw new Error(`${rpcError.message} | Código: ${rpcError.code ?? 'N/A'}`)
      }

      setSuccess(
        paymentType === 'now'
          ? `Venda registrada com sucesso! Nº ${String(data).slice(0, 8)}`
          : `Venda pendente registrada! Nº ${String(data).slice(0, 8)}`,
      )

      // Limpar formulário
      setCustomerId('')
      setItems([])
      setDiscount('')
      setPaymentType('now')
      setPaymentMethod('pix')
      setNotes('')

      // Notificar sucesso
      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Nova Venda
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Registre uma nova venda
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Voltar"
          >
            ←
          </button>
        )}
      </div>

      {/* Mensagens */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cliente */}
        <div>
          <label
            htmlFor="customer"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Cliente
          </label>

          <select
            id="customer"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            <option value="">Consumidor não cadastrado</option>

            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        {/* Adicionar produto */}
        <div>
          <label
            htmlFor="product"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Adicionar produto
          </label>

          <select
            id="product"
            value=""
            onChange={(event) => {
              addProduct(event.target.value)
            }}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          >
            <option value="">Selecione um produto...</option>

            {products
              .filter((product) => product.stock_quantity > 0)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {formatCurrency(Number(product.sale_price))} — estoque: {product.stock_quantity}
                </option>
              ))}
          </select>
        </div>

        {/* Produtos */}
        {saleDetails.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Produtos da venda
            </h3>

            {saleDetails.map((item) => (
              <div
                key={item.product_id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">
                      {item.product.name}
                    </p>

                    {item.product.code && (
                      <p className="mt-1 text-xs text-gray-500">
                        Código: {item.product.code}
                      </p>
                    )}

                    <p className="mt-1 text-sm text-gray-500">
                      {formatCurrency(Number(item.product.sale_price))} cada
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeProduct(item.product_id)}
                    className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center rounded-xl border border-gray-300">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="px-4 py-2 text-lg text-gray-600 disabled:opacity-30"
                    >
                      −
                    </button>

                    <span className="min-w-10 text-center font-semibold">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock_quantity}
                      className="px-4 py-2 text-lg text-gray-600 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>

                  <p className="font-bold text-gray-900">
                    {formatCurrency(item.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Valores */}
        <div className="rounded-xl bg-gray-50 p-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <label htmlFor="discount" className="text-sm text-gray-600">
              Desconto
            </label>

            <div className="flex w-32 items-center rounded-lg border border-gray-300 bg-white">
              <span className="pl-3 text-sm text-gray-400">R$</span>
              <input
                id="discount"
                type="text"
                inputMode="decimal"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder="0,00"
                className="w-full bg-transparent px-2 py-2 text-right text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="font-bold text-gray-900">Total</span>
            <span className="text-xl font-bold text-green-600">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Tipo de pagamento */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Pagamento
          </label>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentType('now')}
              className={`rounded-xl border-2 px-4 py-4 text-center transition ${
                paymentType === 'now'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl">💵</div>
              <div className="mt-1 font-semibold text-gray-900">Pagar agora</div>
              <div className="mt-1 text-xs text-gray-500">Receber no ato</div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentType('later')}
              className={`rounded-xl border-2 px-4 py-4 text-center transition ${
                paymentType === 'later'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl">📅</div>
              <div className="mt-1 font-semibold text-gray-900">Pagar depois</div>
              <div className="mt-1 text-xs text-gray-500">Registrar pendente</div>
            </button>
          </div>
        </div>

        {/* Método de pagamento */}
        {paymentType === 'now' && (
          <div>
            <label
              htmlFor="payment"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Forma de pagamento
            </label>

            <select
              id="payment"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Observação */}
        <div>
          <label
            htmlFor="notes"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Observação
          </label>

          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Observações da venda..."
            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
          />
        </div>

        {/* Confirmar */}
        <button
          type="submit"
          disabled={saving || items.length === 0 || total <= 0}
          className={`w-full rounded-xl px-5 py-4 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-300 ${
            paymentType === 'now'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {saving
            ? 'Registrando venda...'
            : paymentType === 'now'
              ? 'Finalizar venda'
              : 'Registrar venda pendente'}
        </button>
      </form>
    </div>
  )
}

export default NewSale