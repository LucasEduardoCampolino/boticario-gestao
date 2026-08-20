import { Link, NavLink, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Layout() {
  const navigation = [
    {
      path: '/',
      label: 'Início',
      icon: '🏠',
      end: true,
    },
    {
      path: '/vendas',
      label: 'Vendas',
      icon: '🛍️',
    },
    {
      path: '/clientes',
      label: 'Clientes',
      icon: '👥',
    },
    {
      path: '/produtos',
      label: 'Estoque',
      icon: '📦',
    },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-gray-200 bg-white lg:block">
        <div className="flex h-full flex-col">
          <Link
            to="/"
            className="flex h-20 items-center gap-3 border-b border-gray-100 px-6"
          >
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
          </Link>

          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}

            <NavLink
              to="/financeiro"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <span className="text-lg">💰</span>
              Financeiro
            </NavLink>
          </nav>

          <div className="border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-red-600"
            >
              Sair da conta
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile / tablet header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
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
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Sair"
          >
            ↪
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-1 py-2">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex min-w-16 flex-col items-center gap-1 rounded-xl px-2 py-2 ${
                  isActive
                    ? 'text-green-600'
                    : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>

              <span className="text-[11px] font-medium">
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default Layout