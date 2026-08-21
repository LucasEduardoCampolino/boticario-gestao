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
  return new Intl.DateTimeFormat('pt-BR').format(
    new Date(`${value}T00:00:00`),
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Ocorreu um erro inesperado.'
}

function Sales() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [customerId, setCustomerId] = useState('')
  const [items, setItems] = useState<SaleItem[]>([])

  const [discount, setDiscount] = useState('')
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
      const [
        customersResult,
        productsResult,
        salesResult,
      ] = await Promise.all([
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

        supabase
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
              )
            `,
          )
          .order('sale_date', { ascending: false })
          .limit(20),
      ])

      if (customersResult.error) {
        throw customersResult.error
      }

      if (productsResult.error) {
        throw productsResult.error
      }

      if (salesResult.error) {
        throw salesResult.error
      }

      setCustomers(customersResult.data ?? [])
      setProducts(productsResult.data ?? [])

      const formattedSales: Sale[] = (
        salesResult.data ?? []
      ).map((sale) => {
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
          customer: customerData
            ? {
                name: customerData.name,
              }
            : null,
        }
      })

      setSales(formattedSales)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function addProduct(productId: string) {
    if (!productId) {
      return
    }

    const existing = items.find(
      (item) => item.product_id === productId,
    )

    if (existing) {
      setItems(
        items.map((item) =>
          item.product_id === productId
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
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

  function updateQuantity(
    productId: string,
    quantity: number,
  ) {
    const product = products.find(
      (item) => item.id === productId,
    )

    if (!product) {
      return
    }

    const safeQuantity = Math.max(
      1,
      Math.min(quantity, product.stock_quantity),
    )

    setItems(
      items.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity: safeQuantity,
            }
          : item,
      ),
    )
  }

  function removeProduct(productId: string) {
    setItems(
      items.filter(
        (item) => item.product_id !== productId,
      ),
    )
  }

  const saleDetails = useMemo(() => {
    return items
      .map((item) => {
        const product = products.find(
          (productItem) =>
            productItem.id === item.product_id,
        )

        if (!product) {
          return null
        }

        return {
          ...item,
          product,
          total:
            Number(product.sale_price) *
            item.quantity,
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
    return saleDetails.reduce(
      (sum, item) => sum + item.total,
      0,
    )
  }, [saleDetails])

  const discountValue = Math.max(
    0,
    Number(discount.replace(',', '.')) || 0,
  )

  const total = Math.max(
    0,
    subtotal - discountValue,
  )

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')
    setSuccess('')

    if (items.length === 0) {
      setError(
        'Adicione pelo menos um produto à venda.',
      )
      return
    }

    for (const item of saleDetails) {
      if (
        item.quantity > item.product.stock_quantity
      ) {
        setError(
          `Estoque insuficiente para ${item.product.name}.`,
        )
        return
      }
    }

    setSaving(true)

    try {
      const { data, error: rpcError } =
        await supabase.rpc('create_sale', {
          p_customer_id: customerId || null,
          p_discount: discountValue,
          p_payment_method: paymentMethod,
          p_notes: notes.trim() || null,
          p_items: items,
        })

      if (rpcError) {
        console.error('ERRO CREATE_SALE:', rpcError)

        throw new Error(
            `${rpcError.message} | Código: ${rpcError.code ?? 'N/A'}`
        )
      }   

      setSuccess(
        `Venda registrada com sucesso! Nº ${String(data).slice(0, 8)}`,
      )

      setCustomerId('')
      setItems([])
      setDiscount('')
      setPaymentMethod('pix')
      setNotes('')

      await loadData()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

          <p className="mt-4 text-sm text-gray-500">
            Carregando vendas...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Vendas
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Registre suas vendas e acompanhe o histórico.
        </p>
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

      {/* Nova venda */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            Nova venda
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Selecione os produtos e confirme a venda.
          </p>
        </div>

        <div className="space-y-5">
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
              onChange={(event) =>
                setCustomerId(event.target.value)
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              <option value="">
                Consumidor não cadastrado
              </option>

              {customers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
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
              <option value="">
                Selecione um produto...
              </option>

              {products
                .filter(
                  (product) =>
                    product.stock_quantity > 0,
                )
                .map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name} —{' '}
                    {formatCurrency(
                      Number(product.sale_price),
                    )}{' '}
                    — estoque:{' '}
                    {product.stock_quantity}
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
                        {formatCurrency(
                          Number(item.product.sale_price),
                        )}{' '}
                        cada
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeProduct(item.product_id)
                      }
                      className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="flex items-center rounded-xl border border-gray-300">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity - 1,
                          )
                        }
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
                        onClick={() =>
                          updateQuantity(
                            item.product_id,
                            item.quantity + 1,
                          )
                        }
                        disabled={
                          item.quantity >=
                          item.product.stock_quantity
                        }
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

              <span>
                {formatCurrency(subtotal)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <label
                htmlFor="discount"
                className="text-sm text-gray-600"
              >
                Desconto
              </label>

              <div className="flex w-32 items-center rounded-lg border border-gray-300 bg-white">
                <span className="pl-3 text-sm text-gray-400">
                  R$
                </span>

                <input
                  id="discount"
                  type="text"
                  inputMode="decimal"
                  value={discount}
                  onChange={(event) =>
                    setDiscount(event.target.value)
                  }
                  placeholder="0,00"
                  className="w-full bg-transparent px-2 py-2 text-right text-sm outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
              <span className="font-bold text-gray-900">
                Total
              </span>

              <span className="text-xl font-bold text-green-600">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Pagamento */}
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
              onChange={(event) =>
                setPaymentMethod(event.target.value)
              }
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              {paymentMethods.map((method) => (
                <option
                  key={method.value}
                  value={method.value}
                >
                  {method.label}
                </option>
              ))}
            </select>
          </div>

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
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={3}
              placeholder="Observações da venda..."
              className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Confirmar */}
          <button
            type="submit"
            disabled={
              saving ||
              items.length === 0 ||
              total <= 0
            }
            className="w-full rounded-xl bg-green-600 px-5 py-4 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving
              ? 'Registrando venda...'
              : 'Finalizar venda'}
          </button>
        </div>
      </form>

      {/* Histórico */}
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            Últimas vendas
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            As 20 vendas mais recentes.
          </p>
        </div>

        {sales.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">
              Nenhuma venda registrada ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => (
              <div
                key={sale.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {sale.customer?.name ??
                        'Consumidor não cadastrado'}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(sale.sale_date)}
                    </p>
                  </div>

                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                    {sale.status === 'completed'
                      ? 'Concluída'
                      : sale.status}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div className="text-sm text-gray-500">
                    <p>
                      Subtotal:{' '}
                      {formatCurrency(
                        sale.subtotal,
                      )}
                    </p>

                    {sale.discount > 0 && (
                      <p>
                        Desconto:{' '}
                        {formatCurrency(
                          sale.discount,
                        )}
                      </p>
                    )}
                  </div>

                  <p className="text-lg font-bold text-gray-900">
                    {formatCurrency(sale.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Sales