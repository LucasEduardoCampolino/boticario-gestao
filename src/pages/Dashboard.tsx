import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function Dashboard() {
  const [userName, setUserName] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Erro ao carregar perfil:', error)
        return
      }

      setUserName(data?.name || 'Revendedora')
    }

    loadProfile()
  }, [])

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-500">Visão geral</p>

        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          Olá, {userName || 'Revendedora'}! 👋
        </h2>

        <p className="mt-1 text-gray-600">
          Veja como está sua revenda hoje.
        </p>
      </section>

      <section className="rounded-2xl bg-green-600 p-5 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-green-100">
              Vendas do mês
            </p>

            <p className="mt-2 text-3xl font-bold">
              R$ 0,00
            </p>
          </div>

          <span className="rounded-xl bg-white/20 px-3 py-2 text-sm">
            Agosto
          </span>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span>Meta: R$ 2.000,00</span>
            <span>0%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-0 rounded-full bg-white" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            A receber
          </p>

          <p className="mt-2 text-xl font-bold text-gray-900">
            R$ 0,00
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            Lucro estimado
          </p>

          <p className="mt-2 text-xl font-bold text-gray-900">
            R$ 0,00
          </p>
        </div>
      </section>

      <section>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-4 font-semibold text-white shadow-sm transition hover:bg-gray-800"
        >
          <span className="text-xl">+</span>
          Registrar venda
        </button>
      </section>

      <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <div className="text-4xl">📊</div>

        <h3 className="mt-3 font-semibold text-gray-900">
          Ainda não há vendas
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Registre sua primeira venda para começar a acompanhar
          seus resultados.
        </p>
      </section>
    </div>
  )
}

export default Dashboard