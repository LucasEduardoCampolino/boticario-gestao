import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  createProduct,
  getProducts,
  updateProduct,
  updateProductStatus,
  type Product,
} from '../services/products'

import {
  getStockMovements,
  registerStockMovement,
  type StockMovement,
  type StockMovementType,
} from '../services/stock'

interface ProductForm {
  code: string
  name: string
  category: string
  cost_price: string
  sale_price: string
  stock_quantity: string
  minimum_stock: string
}

const initialForm: ProductForm = {
  code: '',
  name: '',
  category: '',
  cost_price: '',
  sale_price: '',
  stock_quantity: '0',
  minimum_stock: '0',
}

function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null)

  const [productToChangeStatus, setProductToChangeStatus] =
    useState<Product | null>(null)

  const [stockProduct, setStockProduct] =
    useState<Product | null>(null)

  const [stockType, setStockType] =
    useState<StockMovementType>('entrada')

  const [stockQuantity, setStockQuantity] =
    useState('')

  const [stockReason, setStockReason] =
    useState('')

  const [historyProduct, setHistoryProduct] =
    useState<Product | null>(null)

  const [stockMovements, setStockMovements] =
    useState<StockMovement[]>([])

  const [loadingHistory, setLoadingHistory] =
    useState(false)

  const [form, setForm] =
    useState<ProductForm>(initialForm)

  const [saving, setSaving] = useState(false)
  const [savingStock, setSavingStock] = useState(false)

  const [error, setError] = useState('')

  async function loadProducts() {
    try {
      setLoading(true)
      setError('')

      const data = await getProducts()

      setProducts(data)
    } catch (err) {
      console.error(err)

      setError(
        'Não foi possível carregar os produtos.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return products.filter((product) => {
      if (!showInactive && !product.active) {
        return false
      }

      if (!searchTerm) {
        return true
      }

      return (
        product.name
          .toLowerCase()
          .includes(searchTerm) ||
        product.code
          ?.toLowerCase()
          .includes(searchTerm) ||
        product.category
          ?.toLowerCase()
          .includes(searchTerm)
      )
    })
  }, [products, search, showInactive])

  const activeProducts = products.filter(
    (product) => product.active,
  )

  const lowStockProducts = activeProducts.filter(
    (product) =>
      product.stock_quantity <= product.minimum_stock,
  )

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function calculateProfit(product: Product) {
    return product.sale_price - product.cost_price
  }

  function calculateMargin(product: Product) {
    if (product.sale_price <= 0) {
      return 0
    }

    return (
      ((product.sale_price - product.cost_price) /
        product.sale_price) *
      100
    )
  }

  function handleChange(
    field: keyof ProductForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleOpenForm(product?: Product) {
    setError('')

    if (product) {
      setEditingProduct(product)

      setForm({
        code: product.code ?? '',
        name: product.name,
        category: product.category ?? '',
        cost_price: product.cost_price.toString(),
        sale_price: product.sale_price.toString(),
        stock_quantity:
          product.stock_quantity.toString(),
        minimum_stock:
          product.minimum_stock.toString(),
      })
    } else {
      setEditingProduct(null)
      setForm(initialForm)
    }

    setShowForm(true)
  }

  function handleCloseForm() {
    if (saving) return

    setShowForm(false)
    setEditingProduct(null)
    setForm(initialForm)
    setError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Informe o nome do produto.')
      return
    }

    const costPrice = Number(
      form.cost_price.replace(',', '.'),
    )

    const salePrice = Number(
      form.sale_price.replace(',', '.'),
    )

    const stockQuantity = Number(
      form.stock_quantity,
    )

    const minimumStock = Number(
      form.minimum_stock,
    )

    if (
      !Number.isFinite(costPrice) ||
      costPrice < 0
    ) {
      setError('Informe um preço de custo válido.')
      return
    }

    if (
      !Number.isFinite(salePrice) ||
      salePrice < 0
    ) {
      setError('Informe um preço de venda válido.')
      return
    }

    if (
      !Number.isInteger(stockQuantity) ||
      stockQuantity < 0
    ) {
      setError(
        'O estoque deve ser um número inteiro maior ou igual a zero.',
      )
      return
    }

    if (
      !Number.isInteger(minimumStock) ||
      minimumStock < 0
    ) {
      setError(
        'O estoque mínimo deve ser um número inteiro maior ou igual a zero.',
      )
      return
    }

    try {
      setSaving(true)
      setError('')

      const productData = {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        cost_price: costPrice,
        sale_price: salePrice,
        stock_quantity: stockQuantity,
        minimum_stock: minimumStock,
      }

      if (editingProduct) {
        const product = await updateProduct(
          editingProduct.id,
          productData,
        )

        setProducts((current) =>
          current
            .map((item) =>
              item.id === product.id
                ? product
                : item,
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
        )
      } else {
        const product =
          await createProduct(productData)

        setProducts((current) =>
          [...current, product].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        )
      }

      setShowForm(false)
      setEditingProduct(null)
      setForm(initialForm)
    } catch (err) {
      console.error(err)

      setError(
        editingProduct
          ? 'Não foi possível atualizar o produto.'
          : 'Não foi possível cadastrar o produto.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleChangeStatus() {
    if (!productToChangeStatus) return

    try {
      const newStatus =
        !productToChangeStatus.active

      const product =
        await updateProductStatus(
          productToChangeStatus.id,
          newStatus,
        )

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? product
            : item,
        ),
      )

      setProductToChangeStatus(null)
      setError('')
    } catch (err) {
      console.error(err)

      setError(
        'Não foi possível alterar o status do produto.',
      )

      setProductToChangeStatus(null)
    }
  }

  async function handleStockMovement(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!stockProduct) {
      return
    }

    const quantity = Number(stockQuantity)

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setError(
        'Informe uma quantidade inteira maior que zero.',
      )
      return
    }

    if (
      stockType === 'saida' &&
      quantity > stockProduct.stock_quantity
    ) {
      setError(
        `Estoque insuficiente. Disponível: ${stockProduct.stock_quantity} unidade(s).`,
      )
      return
    }

    try {
      setSavingStock(true)
      setError('')

      await registerStockMovement({
        productId: stockProduct.id,
        type: stockType,
        quantity,
        reason: stockReason,
      })

      await loadProducts()

      setStockProduct(null)
      setStockType('entrada')
      setStockQuantity('')
      setStockReason('')
    } catch (err) {
      console.error(err)

      const message =
        err instanceof Error
          ? err.message
          : ''

      if (
        message
          .toLowerCase()
          .includes('estoque insuficiente')
      ) {
        setError(
          'Estoque insuficiente para realizar essa saída.',
        )
      } else {
        setError(
          'Não foi possível registrar a movimentação.',
        )
      }
    } finally {
      setSavingStock(false)
    }
  }

  function handleOpenStock(product: Product) {
    setStockProduct(product)
    setStockType('entrada')
    setStockQuantity('')
    setStockReason('')
    setError('')
  }

  function handleCloseStock() {
    if (savingStock) return

    setStockProduct(null)
    setStockType('entrada')
    setStockQuantity('')
    setStockReason('')
    setError('')
  }

  async function handleOpenHistory(
    product: Product,
  ) {
    try {
      setHistoryProduct(product)
      setStockMovements([])
      setLoadingHistory(true)
      setError('')

      const movements =
        await getStockMovements(product.id)

      setStockMovements(movements)
    } catch (err) {
      console.error(err)

      setError(
        'Não foi possível carregar o histórico.',
      )
    } finally {
      setLoadingHistory(false)
    }
  }

  function handleCloseHistory() {
    if (loadingHistory) return

    setHistoryProduct(null)
    setStockMovements([])
    setError('')
  }

  function formatMovementDate(
    dateString: string,
  ) {
    const date = new Date(dateString)

    const datePart =
      date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })

    const timePart =
      date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })

    return `${datePart} às ${timePart}`
  }

  return (
    <div className="space-y-6">
      {/* =====================================================
          CABEÇALHO
          ===================================================== */}

      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Catálogo
          </p>

          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            Produtos
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {activeProducts.length}{' '}
            {activeProducts.length === 1
              ? 'produto ativo'
              : 'produtos ativos'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenForm()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-600 text-2xl text-white shadow-sm transition hover:bg-green-700"
          aria-label="Novo produto"
        >
          +
        </button>
      </section>

      {/* =====================================================
          RESUMO
          ===================================================== */}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Produtos
          </p>

          <p className="mt-1 text-2xl font-bold text-gray-900">
            {activeProducts.length}
          </p>
        </div>

        <div
          className={`rounded-2xl p-4 shadow-sm ${
            lowStockProducts.length > 0
              ? 'bg-orange-50'
              : 'bg-white'
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Estoque baixo
          </p>

          <p
            className={`mt-1 text-2xl font-bold ${
              lowStockProducts.length > 0
                ? 'text-orange-600'
                : 'text-gray-900'
            }`}
          >
            {lowStockProducts.length}
          </p>
        </div>
      </section>

      {/* =====================================================
          BUSCA
          ===================================================== */}

      <section>
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="🔎  Buscar produto..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
        />
      </section>

      {/* =====================================================
          FILTRO
          ===================================================== */}

      <label className="flex cursor-pointer items-center gap-3 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) =>
            setShowInactive(
              event.target.checked,
            )
          }
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />

        Mostrar produtos inativos
      </label>

      {/* =====================================================
          ERRO
          ===================================================== */}

      {error &&
        !showForm &&
        !stockProduct &&
        !historyProduct && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

      {/* =====================================================
          LISTA DE PRODUTOS
          ===================================================== */}

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

            <p className="mt-3 text-sm text-gray-500">
              Carregando produtos...
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <div className="text-4xl">
              📦
            </div>

            <h3 className="mt-3 font-semibold text-gray-900">
              {search
                ? 'Nenhum produto encontrado'
                : showInactive
                  ? 'Nenhum produto cadastrado'
                  : 'Nenhum produto ativo'}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {search
                ? 'Tente buscar por outro nome, código ou categoria.'
                : 'Cadastre seu primeiro produto para começar.'}
            </p>

            {!search && !showInactive && (
              <button
                type="button"
                onClick={() => handleOpenForm()}
                className="mt-5 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
              >
                Cadastrar produto
              </button>
            )}
          </div>
        ) : (
          filteredProducts.map((product) => {
            const profit =
              calculateProfit(product)

            const margin =
              calculateMargin(product)

            const lowStock =
              product.active &&
              product.stock_quantity <=
                product.minimum_stock

            return (
              <div
                key={product.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ${
                  !product.active
                    ? 'opacity-60'
                    : ''
                }`}
              >
                {/* PRODUTO */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {product.name}
                      </h3>

                      {!product.active && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
                          Inativo
                        </span>
                      )}
                    </div>

                    <div className="mt-1 space-y-1 text-sm text-gray-500">
                      {product.code && (
                        <p>
                          Código: {product.code}
                        </p>
                      )}

                      {product.category && (
                        <p>
                          Categoria:{' '}
                          {product.category}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* PREÇOS */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      Custo
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {formatCurrency(
                        product.cost_price,
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">
                      Venda
                    </p>

                    <p className="mt-1 font-semibold text-gray-900">
                      {formatCurrency(
                        product.sale_price,
                      )}
                    </p>
                  </div>
                </div>

                {/* LUCRO */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-green-50 px-3 py-2">
                  <div>
                    <p className="text-xs text-gray-500">
                      Lucro unitário
                    </p>

                    <p className="font-semibold text-green-700">
                      {formatCurrency(profit)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-gray-500">
                      Margem
                    </p>

                    <p className="font-semibold text-green-700">
                      {margin.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* ESTOQUE */}
                <div
                  className={`mt-3 flex items-center justify-between rounded-xl px-3 py-3 ${
                    lowStock
                      ? 'bg-orange-50'
                      : 'bg-gray-50'
                  }`}
                >
                  <div>
                    <p className="text-xs text-gray-500">
                      Estoque
                    </p>

                    <p
                      className={`font-semibold ${
                        lowStock
                          ? 'text-orange-700'
                          : 'text-gray-900'
                      }`}
                    >
                      {product.stock_quantity}{' '}
                      {product.stock_quantity === 1
                        ? 'unidade'
                        : 'unidades'}
                    </p>
                  </div>

                  {lowStock && (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                      ⚠️ Estoque baixo
                    </span>
                  )}
                </div>

                {/* AÇÕES */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenForm(product)
                    }
                    className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenStock(product)
                    }
                    disabled={!product.active}
                    className="rounded-xl bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Estoque
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenHistory(product)
                    }
                    className="rounded-xl bg-gray-100 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Histórico
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setProductToChangeStatus(
                        product,
                      )
                    }
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      product.active
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {product.active
                      ? 'Inativar'
                      : 'Ativar'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </section>

      {/* =====================================================
          MODAL CADASTRO / EDIÇÃO
          ===================================================== */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingProduct
                    ? 'Editar produto'
                    : 'Novo produto'}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {editingProduct
                    ? 'Atualize os dados do produto.'
                    : 'Cadastre um novo produto.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseForm}
                disabled={saving}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="product-code"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Código
                </label>

                <input
                  id="product-code"
                  type="text"
                  value={form.code}
                  onChange={(event) =>
                    handleChange(
                      'code',
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Ex.: 12345"
                />
              </div>

              <div>
                <label
                  htmlFor="product-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Nome *
                </label>

                <input
                  id="product-name"
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    handleChange(
                      'name',
                      event.target.value,
                    )
                  }
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Nome do produto"
                />
              </div>

              <div>
                <label
                  htmlFor="product-category"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Categoria
                </label>

                <input
                  id="product-category"
                  type="text"
                  value={form.category}
                  onChange={(event) =>
                    handleChange(
                      'category',
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Ex.: Perfumaria"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="product-cost"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Preço de custo *
                  </label>

                  <input
                    id="product-cost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      handleChange(
                        'cost_price',
                        event.target.value,
                      )
                    }
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-sale"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Preço de venda *
                  </label>

                  <input
                    id="product-sale"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.sale_price}
                    onChange={(event) =>
                      handleChange(
                        'sale_price',
                        event.target.value,
                      )
                    }
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="product-stock"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Estoque atual *
                  </label>

                  <input
                    id="product-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_quantity}
                    onChange={(event) =>
                      handleChange(
                        'stock_quantity',
                        event.target.value,
                      )
                    }
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-minimum-stock"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Estoque mínimo *
                  </label>

                  <input
                    id="product-minimum-stock"
                    type="number"
                    min="0"
                    step="1"
                    value={form.minimum_stock}
                    onChange={(event) =>
                      handleChange(
                        'minimum_stock',
                        event.target.value,
                      )
                    }
                    required
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    placeholder="0"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? 'Salvando...'
                    : editingProduct
                      ? 'Atualizar'
                      : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL ALTERAR STATUS
          ===================================================== */}

      {productToChangeStatus && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                  productToChangeStatus.active
                    ? 'bg-red-50'
                    : 'bg-green-50'
                }`}
              >
                {productToChangeStatus.active
                  ? '⚠️'
                  : '✅'}
              </div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                {productToChangeStatus.active
                  ? 'Inativar produto?'
                  : 'Ativar produto?'}
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                {productToChangeStatus.active
                  ? 'O produto deixará de aparecer na lista principal, mas seus dados serão preservados.'
                  : 'O produto voltará a aparecer na lista principal.'}
              </p>

              <p className="mt-2 font-semibold text-gray-800">
                {productToChangeStatus.name}
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setProductToChangeStatus(null)
                }
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleChangeStatus}
                className={`flex-1 rounded-xl px-4 py-3 font-semibold text-white ${
                  productToChangeStatus.active
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {productToChangeStatus.active
                  ? 'Inativar'
                  : 'Ativar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL MOVIMENTAÇÃO DE ESTOQUE
          ===================================================== */}

      {stockProduct && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">
                  Movimentação de estoque
                </p>

                <h3 className="mt-1 text-xl font-bold text-gray-900">
                  {stockProduct.name}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Estoque atual:{' '}
                  <span className="font-semibold text-gray-900">
                    {stockProduct.stock_quantity}{' '}
                    {stockProduct.stock_quantity ===
                    1
                      ? 'unidade'
                      : 'unidades'}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseStock}
                disabled={savingStock}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleStockMovement}
              className="mt-6 space-y-5"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Tipo de movimentação
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setStockType('entrada')
                    }
                    className={`rounded-xl border px-4 py-4 text-left transition ${
                      stockType === 'entrada'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xl">
                      ➕
                    </div>

                    <div className="mt-1 font-semibold">
                      Entrada
                    </div>

                    <div className="mt-1 text-xs opacity-75">
                      Adicionar ao estoque
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setStockType('saida')
                    }
                    className={`rounded-xl border px-4 py-4 text-left transition ${
                      stockType === 'saida'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-xl">
                      ➖
                    </div>

                    <div className="mt-1 font-semibold">
                      Saída
                    </div>

                    <div className="mt-1 text-xs opacity-75">
                      Retirar do estoque
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="stock-quantity"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Quantidade *
                </label>

                <input
                  id="stock-quantity"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={stockQuantity}
                  onChange={(event) =>
                    setStockQuantity(
                      event.target.value,
                    )
                  }
                  required
                  autoFocus
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Ex.: 5"
                />

                {stockType === 'saida' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Disponível para saída:{' '}
                    {stockProduct.stock_quantity}{' '}
                    unidades
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="stock-reason"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Motivo
                </label>

                <input
                  id="stock-reason"
                  type="text"
                  value={stockReason}
                  onChange={(event) =>
                    setStockReason(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder={
                    stockType === 'entrada'
                      ? 'Ex.: Compra de reposição'
                      : 'Ex.: Venda'
                  }
                />
              </div>

              {stockQuantity &&
                Number(stockQuantity) > 0 && (
                  <div
                    className={`rounded-xl p-4 ${
                      stockType === 'entrada'
                        ? 'bg-green-50'
                        : 'bg-orange-50'
                    }`}
                  >
                    <p className="text-sm text-gray-600">
                      Novo estoque
                    </p>

                    <p
                      className={`mt-1 text-2xl font-bold ${
                        stockType === 'entrada'
                          ? 'text-green-700'
                          : 'text-orange-700'
                      }`}
                    >
                      {stockType === 'entrada'
                        ? stockProduct.stock_quantity +
                          Number(stockQuantity)
                        : stockProduct.stock_quantity -
                          Number(stockQuantity)}{' '}
                      unidades
                    </p>
                  </div>
                )}

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseStock}
                  disabled={savingStock}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={savingStock}
                  className={`flex-1 rounded-xl px-4 py-3 font-semibold text-white ${
                    stockType === 'entrada'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {savingStock
                    ? 'Salvando...'
                    : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL HISTÓRICO DE ESTOQUE
          ===================================================== */}

      {historyProduct && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-w-lg sm:rounded-3xl">
            {/* CABEÇALHO */}
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 p-6">
              <div>
                <p className="text-sm text-gray-500">
                  Histórico de estoque
                </p>

                <h3 className="mt-1 text-xl font-bold text-gray-900">
                  {historyProduct.name}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Estoque atual:{' '}
                  <span className="font-semibold text-gray-900">
                    {historyProduct.stock_quantity}{' '}
                    {historyProduct.stock_quantity ===
                    1
                      ? 'unidade'
                      : 'unidades'}
                  </span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseHistory}
                className="rounded-xl p-2 text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            {/* CONTEÚDO */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="py-10 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

                  <p className="mt-3 text-sm text-gray-500">
                    Carregando histórico...
                  </p>
                </div>
              ) : stockMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
                  <div className="text-4xl">
                    📋
                  </div>

                  <h4 className="mt-3 font-semibold text-gray-900">
                    Nenhuma movimentação
                  </h4>

                  <p className="mt-1 text-sm text-gray-500">
                    Este produto ainda não possui movimentações registradas.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-4 left-5 top-4 w-px bg-gray-200" />

                  <div className="space-y-5">
                    {stockMovements.map(
                      (movement) => {
                        const isEntry =
                          movement.type ===
                          'entrada'

                        return (
                          <div
                            key={movement.id}
                            className="relative flex gap-4"
                          >
                            {/* ÍCONE */}
                            <div
                              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
                                isEntry
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {isEntry
                                ? '↑'
                                : '↓'}
                            </div>

                            {/* MOVIMENTAÇÃO */}
                            <div className="min-w-0 flex-1 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p
                                    className={`font-semibold ${
                                      isEntry
                                        ? 'text-green-700'
                                        : 'text-red-700'
                                    }`}
                                  >
                                    {isEntry
                                      ? 'Entrada'
                                      : 'Saída'}
                                  </p>

                                  <p className="mt-1 text-sm text-gray-500">
                                    {formatMovementDate(
                                      movement.created_at,
                                    )}
                                  </p>
                                </div>

                                <span
                                  className={`shrink-0 text-lg font-bold ${
                                    isEntry
                                      ? 'text-green-700'
                                      : 'text-red-700'
                                  }`}
                                >
                                  {isEntry
                                    ? '+'
                                    : '-'}
                                  {movement.quantity}
                                </span>
                              </div>

                              {movement.reason && (
                                <div className="mt-3 border-t border-gray-200 pt-3">
                                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                    Motivo
                                  </p>

                                  <p className="mt-1 text-sm text-gray-700">
                                    {movement.reason}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      },
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {/* RODAPÉ */}
            <div className="shrink-0 border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={handleCloseHistory}
                className="w-full rounded-xl bg-gray-100 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products