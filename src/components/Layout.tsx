import type { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 font-bold text-white">
              B
            </div>

            <div>
              <h1 className="font-bold text-gray-900">
                Boticário Gestão
              </h1>
              <p className="text-xs text-gray-500">
                Gestão da sua revenda
              </p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-xl p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Notificações"
          >
            🔔
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
          <button className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-green-600">
            <span>🏠</span>
            <span className="text-xs font-medium">Início</span>
          </button>

          <button className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-gray-500">
            <span>🛍️</span>
            <span className="text-xs font-medium">Vendas</span>
          </button>

          <button className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-gray-500">
            <span>👥</span>
            <span className="text-xs font-medium">Clientes</span>
          </button>

          <button className="flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-gray-500">
            <span>📦</span>
            <span className="text-xs font-medium">Estoque</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default Layout