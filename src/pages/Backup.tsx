// src/pages/Backup.tsx (versão melhorada)
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

function Backup() {
  const { showToast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  async function handleExportData() {
    try {
      setExporting(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuário não autenticado')

      // Buscar todos os dados
      const [customers, products, sales, saleItems, payments, expenses] = await Promise.all([
        supabase.from('customers').select('*').eq('user_id', user.id),
        supabase.from('products').select('*').eq('user_id', user.id),
        supabase.from('sales').select('*').eq('user_id', user.id),
        supabase.from('sale_items').select('*'),
        supabase.from('payments').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
      ])

      const backupData = {
        version: '1.0',
        app: 'SiEncante',
        exported_at: new Date().toISOString(),
        data: {
          customers: customers.data || [],
          products: products.data || [],
          sales: sales.data || [],
          sale_items: saleItems.data || [],
          payments: payments.data || [],
          expenses: expenses.data || [],
        },
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `backup_siencante_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast('Backup exportado com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao exportar:', err)
      showToast('Não foi possível exportar os dados.', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleImportData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)

      const text = await file.text()
      const backupData = JSON.parse(text)

      if (!backupData.data) {
        throw new Error('Arquivo de backup inválido')
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuário não autenticado')

      // Confirmar importação
      if (!confirm('Esta ação irá ADICIONAR os dados do backup aos dados existentes. Deseja continuar?')) {
        event.target.value = ''
        return
      }

      // Importar clientes
      if (backupData.data.customers?.length > 0) {
        const customers = backupData.data.customers.map((c: any) => ({
          name: c.name,
          phone: c.phone || null,
          email: c.email || null,
          address: c.address || null,
          notes: c.notes || null,
        }))
        
        const { error } = await supabase.from('customers').insert(customers)
        if (error) {
          console.error('Erro ao importar clientes:', error)
          throw error
        }
        showToast(`${customers.length} clientes importados!`, 'success')
      }

      // Importar produtos
      if (backupData.data.products?.length > 0) {
        const products = backupData.data.products.map((p: any) => ({
          code: p.code || null,
          name: p.name,
          category: p.category || null,
          cost_price: p.cost_price || 0,
          sale_price: p.sale_price || 0,
          stock_quantity: p.stock_quantity || 0,
          minimum_stock: p.minimum_stock || 0,
          active: p.active ?? true,
        }))
        
        const { error } = await supabase.from('products').insert(products)
        if (error) {
          console.error('Erro ao importar produtos:', error)
          throw error
        }
        showToast(`${products.length} produtos importados!`, 'success')
      }

      // Importar despesas
      if (backupData.data.expenses?.length > 0) {
        const expenses = backupData.data.expenses.map((e: any) => ({
          expense_date: e.expense_date,
          description: e.description,
          category: e.category || null,
          amount: e.amount,
          notes: e.notes || null,
        }))
        
        const { error } = await supabase.from('expenses').insert(expenses)
        if (error) {
          console.error('Erro ao importar despesas:', error)
          throw error
        }
        showToast(`${expenses.length} despesas importadas!`, 'success')
      }

      // Importar vendas (mais complexo por causa dos relacionamentos)
      if (backupData.data.sales?.length > 0) {
        for (const sale of backupData.data.sales) {
          // Criar a venda
          const { data: newSale, error: saleError } = await supabase
            .from('sales')
            .insert({
              sale_date: sale.sale_date,
              subtotal: sale.subtotal,
              discount: sale.discount,
              total: sale.total,
              status: sale.status,
              notes: sale.notes,
            })
            .select()
            .single()

          if (saleError) {
            console.error('Erro ao importar venda:', saleError)
            continue
          }

          // Importar itens da venda
          const saleItems = backupData.data.sale_items?.filter(
            (item: any) => item.sale_id === sale.id
          )

          if (saleItems?.length > 0) {
            const items = saleItems.map((item: any) => ({
              sale_id: newSale.id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              unit_price: item.unit_price,
              discount: item.discount,
              total: item.total,
            }))

            await supabase.from('sale_items').insert(items)
          }

          // Importar pagamentos
          const payments = backupData.data.payments?.filter(
            (p: any) => p.sale_id === sale.id
          )

          if (payments?.length > 0) {
            const paymentData = payments.map((p: any) => ({
              sale_id: newSale.id,
              payment_date: p.payment_date,
              amount: p.amount,
              method: p.method,
              notes: p.notes,
            }))

            await supabase.from('payments').insert(paymentData)
          }
        }
        
        showToast(`${backupData.data.sales.length} vendas importadas!`, 'success')
      }

      showToast('Backup importado com sucesso!', 'success')
      event.target.value = ''
    } catch (err) {
      console.error('Erro ao importar:', err)
      showToast('Não foi possível importar os dados.', 'error')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-500">Backup</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          Backup e Restauração
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Proteja seus dados exportando um backup
        </p>
      </section>

      {/* Exportar */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-2xl">
            📥
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              Exportar dados
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Baixe um arquivo JSON com todos os seus dados (clientes, produtos, vendas, pagamentos e despesas).
            </p>
            <button
              type="button"
              onClick={handleExportData}
              disabled={exporting}
              className="mt-4 rounded-xl bg-pink-600 px-4 py-3 text-sm font-semibold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? 'Exportando...' : 'Exportar backup'}
            </button>
          </div>
        </div>
      </section>

      {/* Importar */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-2xl">
            📤
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              Importar dados
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Restaure seus dados a partir de um arquivo de backup.
              Os dados serão adicionados aos existentes.
            </p>
            <label className="mt-4 inline-block cursor-pointer">
              <span className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                {importing ? 'Importando...' : 'Selecionar arquivo'}
              </span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Instruções */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">
          Como funciona?
        </h3>
        <div className="mt-4 space-y-4">
          <div className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">1</span>
            <div>
              <p className="font-medium text-gray-900">Exportar</p>
              <p className="text-sm text-gray-500">
                Clique em "Exportar backup" para baixar um arquivo com todos os seus dados.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">2</span>
            <div>
              <p className="font-medium text-gray-900">Guardar</p>
              <p className="text-sm text-gray-500">
                Salve o arquivo em um local seguro (Google Drive, Dropbox, e-mail, etc.).
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">3</span>
            <div>
              <p className="font-medium text-gray-900">Importar</p>
              <p className="text-sm text-gray-500">
                Quando precisar, clique em "Selecionar arquivo" e escolha o backup para restaurar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Aviso */}
      <section className="rounded-2xl bg-yellow-50 p-5">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="font-semibold text-yellow-800">
              Aviso importante
            </h3>
            <p className="mt-1 text-sm text-yellow-700">
              A importação irá adicionar os dados do backup aos dados existentes.
              Recomendamos fazer backup regularmente para não perder informações importantes.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Backup