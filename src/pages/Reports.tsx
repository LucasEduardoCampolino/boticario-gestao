// src/pages/Reports.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast' 

type ProductSales = {
  product_name: string
  total_quantity: number
  total_revenue: number
}

type CustomerSales = {
  customer_name: string
  total_sales: number
  total_spent: number
}

type MonthlySales = {
  month: string
  total: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function getMonthName(monthIndex: number) {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril',
    'Maio', 'Junho', 'Julho', 'Agosto',
    'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  return months[monthIndex]
}

function Reports() {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [topProducts, setTopProducts] = useState<ProductSales[]>([])
  const [topCustomers, setTopCustomers] = useState<CustomerSales[]>([])
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<'6months' | '12months'>('6months')

  useEffect(() => {
    loadReports()
  }, [selectedPeriod])

  async function loadReports() {
    try {
      setLoading(true)

      const monthsAgo = selectedPeriod === '6months' ? 6 : 12
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - monthsAgo)
      const startDateStr = startDate.toISOString().split('T')[0]

      // Produtos mais vendidos
      const { data: productsData, error: productsError } = await supabase
        .from('sale_items')
        .select(`
          product_name,
          quantity,
          total
        `)
        .gte('created_at', startDateStr)

      if (productsError) throw productsError

      // Agrupar por produto
      const productMap = new Map<string, ProductSales>()
      ;(productsData || []).forEach(item => {
        const existing = productMap.get(item.product_name)
        if (existing) {
          existing.total_quantity += item.quantity
          existing.total_revenue += Number(item.total)
        } else {
          productMap.set(item.product_name, {
            product_name: item.product_name,
            total_quantity: item.quantity,
            total_revenue: Number(item.total),
          })
        }
      })

      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10)

      setTopProducts(sortedProducts)

      // Clientes que mais compram
      const { data: customersData, error: customersError } = await supabase
        .from('sales')
        .select(`
          total,
          customers (
            name
          )
        `)
        .gte('sale_date', startDateStr)
        .neq('status', 'cancelled')

      if (customersError) throw customersError

      const customerMap = new Map<string, CustomerSales>()
      ;(customersData || []).forEach(sale => {
        const customerData = Array.isArray(sale.customers)
          ? sale.customers[0]
          : sale.customers
        const customerName = customerData?.name || 'Consumidor não cadastrado'

        const existing = customerMap.get(customerName)
        if (existing) {
          existing.total_sales += 1
          existing.total_spent += Number(sale.total)
        } else {
          customerMap.set(customerName, {
            customer_name: customerName,
            total_sales: 1,
            total_spent: Number(sale.total),
          })
        }
      })

      const sortedCustomers = Array.from(customerMap.values())
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10)

      setTopCustomers(sortedCustomers)

      // Vendas por mês
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('sales')
        .select('sale_date, total')
        .gte('sale_date', startDateStr)
        .neq('status', 'cancelled')

      if (monthlyError) throw monthlyError

      const monthMap = new Map<string, number>()
      ;(monthlyData || []).forEach(sale => {
        const [year, month] = sale.sale_date.split('-')
        const key = `${year}-${month}`
        monthMap.set(key, (monthMap.get(key) || 0) + Number(sale.total))
      })

      const sortedMonths = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, total]) => ({
          month,
          total,
        }))

      setMonthlySales(sortedMonths)
    } catch (err) {
      console.error('Erro ao carregar relatórios:', err)
      showToast('Não foi possível carregar os relatórios.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const maxMonthlySales = useMemo(() => {
    return Math.max(...monthlySales.map(m => m.total), 1)
  }, [monthlySales])

  const totalRevenue = useMemo(() => {
    return monthlySales.reduce((sum, m) => sum + m.total, 0)
  }, [monthlySales])

  function handleExportCSV() {
    if (topProducts.length === 0 && topCustomers.length === 0) {
      showToast('Não há dados para exportar.', 'error')
      return
    }

    let csv = ''

    // Exportar produtos
    if (topProducts.length > 0) {
      csv += 'PRODUTOS MAIS VENDIDOS\n'
      csv += 'Produto;Quantidade;Receita\n'
      topProducts.forEach(p => {
        csv += `"${p.product_name}";${p.total_quantity};${p.total_revenue.toFixed(2)}\n`
      })
      csv += '\n'
    }

    // Exportar clientes
    if (topCustomers.length > 0) {
      csv += 'CLIENTES QUE MAIS COMPRAM\n'
      csv += 'Cliente;Vendas;Total Gasto\n'
      topCustomers.forEach(c => {
        csv += `"${c.customer_name}";${c.total_sales};${c.total_spent.toFixed(2)}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `relatorio_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast('Relatório exportado com sucesso!', 'success')
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando relatórios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Relatórios</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            Análise de Vendas
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Acompanhe o desempenho da sua revenda
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          📥 Exportar CSV
        </button>
      </section>

      {/* FILTRO DE PERÍODO */}
      <section className="flex gap-2">
        <button
          type="button"
          onClick={() => setSelectedPeriod('6months')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            selectedPeriod === '6months'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Últimos 6 meses
        </button>
        <button
          type="button"
          onClick={() => setSelectedPeriod('12months')}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
            selectedPeriod === '12months'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Últimos 12 meses
        </button>
      </section>

      {/* TOTAL DO PERÍODO */}
      <section className="rounded-2xl bg-green-600 p-5 text-white shadow-sm">
        <p className="text-sm text-green-100">Receita total do período</p>
        <p className="mt-2 text-3xl font-bold">
          {formatCurrency(totalRevenue)}
        </p>
      </section>

      {/* GRÁFICO DE VENDAS POR MÊS */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">
          Vendas por mês
        </h3>

        {monthlySales.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Nenhuma venda registrada neste período.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {monthlySales.map((month) => {
              const [year, monthNum] = month.month.split('-')
              const percentage = (month.total / maxMonthlySales) * 100

              return (
                <div key={month.month}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-600">
                      {getMonthName(Number(monthNum) - 1)}/{year}
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(month.total)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* PRODUTOS MAIS VENDIDOS */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">
          Produtos mais vendidos
        </h3>

        {topProducts.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Nenhum produto vendido neste período.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {topProducts.map((product, index) => (
              <div
                key={product.product_name}
                className="flex items-center gap-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-sm font-bold text-green-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">
                    {product.product_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {product.total_quantity} unidades
                  </p>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(product.total_revenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CLIENTES QUE MAIS COMPRAM */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">
          Clientes que mais compram
        </h3>

        {topCustomers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Nenhum cliente registrado neste período.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {topCustomers.map((customer, index) => (
              <div
                key={customer.customer_name}
                className="flex items-center gap-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">
                    {customer.customer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {customer.total_sales} compras
                  </p>
                </div>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(customer.total_spent)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default Reports