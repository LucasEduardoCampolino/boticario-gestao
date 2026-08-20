import { useEffect, useMemo, useState } from 'react'

import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
  type Customer,
} from '../services/customers'

interface CustomerForm {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

const initialForm: CustomerForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null)

  const [deletingCustomer, setDeletingCustomer] =
    useState<Customer | null>(null)

  const [form, setForm] = useState<CustomerForm>(initialForm)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  async function loadCustomers() {
    try {
      setLoading(true)
      setError('')

      const data = await getCustomers()

      setCustomers(data)
    } catch (err) {
      console.error(err)

      setError('Não foi possível carregar os clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    if (!searchTerm) {
      return customers
    }

    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.phone
          ?.toLowerCase()
          .includes(searchTerm) ||
        customer.email
          ?.toLowerCase()
          .includes(searchTerm)
      )
    })
  }, [customers, search])

  function handleChange(
    field: keyof CustomerForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleOpenForm(customer?: Customer) {
    setError('')

    if (customer) {
      setEditingCustomer(customer)

      setForm({
        name: customer.name,
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        notes: customer.notes ?? '',
      })
    } else {
      setEditingCustomer(null)
      setForm(initialForm)
    }

    setShowForm(true)
  }

  function handleCloseForm() {
    if (saving) return

    setShowForm(false)
    setEditingCustomer(null)
    setForm(initialForm)
    setError('')
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Informe o nome do cliente.')
      return
    }

    try {
      setSaving(true)
      setError('')

      if (editingCustomer) {
        const customer = await updateCustomer(
          editingCustomer.id,
          {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
            notes: form.notes.trim(),
          },
        )

        setCustomers((current) =>
          current
            .map((item) =>
              item.id === customer.id
                ? customer
                : item,
            )
            .sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
        )
      } else {
        const customer = await createCustomer({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          notes: form.notes.trim(),
        })

        setCustomers((current) =>
          [...current, customer].sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        )
      }

      setShowForm(false)
      setEditingCustomer(null)
      setForm(initialForm)
    } catch (err) {
      console.error(err)

      setError(
        editingCustomer
          ? 'Não foi possível atualizar o cliente.'
          : 'Não foi possível salvar o cliente.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingCustomer) return

    try {
      await deleteCustomer(deletingCustomer.id)

      setCustomers((current) =>
        current.filter(
          (customer) =>
            customer.id !== deletingCustomer.id,
        ),
      )

      setDeletingCustomer(null)
      setError('')
    } catch (err) {
      console.error(err)

      setError(
        'Não foi possível excluir o cliente.',
      )

      setDeletingCustomer(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            Cadastro
          </p>

          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            Clientes
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {customers.length}{' '}
            {customers.length === 1
              ? 'cliente cadastrado'
              : 'clientes cadastrados'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenForm()}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-600 text-2xl text-white shadow-sm transition hover:bg-green-700"
          aria-label="Novo cliente"
        >
          +
        </button>
      </section>

      {/* BUSCA */}
      <section>
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="🔎  Buscar cliente..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
        />
      </section>

      {/* ERRO */}
      {error && !showForm && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* LISTA DE CLIENTES */}
      <section className="space-y-3">
        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

            <p className="mt-3 text-sm text-gray-500">
              Carregando clientes...
            </p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <div className="text-4xl">👥</div>

            <h3 className="mt-3 font-semibold text-gray-900">
              {search
                ? 'Nenhum cliente encontrado'
                : 'Nenhum cliente cadastrado'}
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {search
                ? 'Tente buscar por outro nome, telefone ou e-mail.'
                : 'Cadastre seu primeiro cliente para começar.'}
            </p>

            {!search && (
              <button
                type="button"
                onClick={() => handleOpenForm()}
                className="mt-5 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white hover:bg-green-700"
              >
                Cadastrar cliente
              </button>
            )}
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900">
                    {customer.name}
                  </h3>

                  {customer.phone && (
                    <p className="mt-1 text-sm text-gray-500">
                      📱 {customer.phone}
                    </p>
                  )}

                  {customer.email && (
                    <p className="mt-1 truncate text-sm text-gray-500">
                      ✉️ {customer.email}
                    </p>
                  )}

                  {customer.address && (
                    <p className="mt-1 text-sm text-gray-500">
                      📍 {customer.address}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenForm(customer)
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDeletingCustomer(customer)
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-700"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      {/* MODAL DE CADASTRO / EDIÇÃO */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[95vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editingCustomer
                    ? 'Editar cliente'
                    : 'Novo cliente'}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {editingCustomer
                    ? 'Atualize os dados do cliente.'
                    : 'Cadastre os dados do cliente.'}
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
              {/* NOME */}
              <div>
                <label
                  htmlFor="customer-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Nome *
                </label>

                <input
                  id="customer-name"
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
                  placeholder="Nome completo"
                />
              </div>

              {/* TELEFONE */}
              <div>
                <label
                  htmlFor="customer-phone"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Telefone
                </label>

                <input
                  id="customer-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    handleChange(
                      'phone',
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="(00) 00000-0000"
                />
              </div>

              {/* EMAIL */}
              <div>
                <label
                  htmlFor="customer-email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  E-mail
                </label>

                <input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    handleChange(
                      'email',
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="cliente@email.com"
                />
              </div>

              {/* ENDEREÇO */}
              <div>
                <label
                  htmlFor="customer-address"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Endereço
                </label>

                <textarea
                  id="customer-address"
                  value={form.address}
                  onChange={(event) =>
                    handleChange(
                      'address',
                      event.target.value,
                    )
                  }
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Endereço do cliente"
                />
              </div>

              {/* OBSERVAÇÕES */}
              <div>
                <label
                  htmlFor="customer-notes"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Observações
                </label>

                <textarea
                  id="customer-notes"
                  value={form.notes}
                  onChange={(event) =>
                    handleChange(
                      'notes',
                      event.target.value,
                    )
                  }
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  placeholder="Preferências, informações importantes..."
                />
              </div>

              {/* ERRO DO FORMULÁRIO */}
              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* BOTÕES */}
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
                    : editingCustomer
                      ? 'Atualizar'
                      : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deletingCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
                ⚠️
              </div>

              <h3 className="mt-4 text-xl font-bold text-gray-900">
                Excluir cliente?
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Você está prestes a excluir{' '}
                <strong className="text-gray-700">
                  {deletingCustomer.name}
                </strong>
                .
                <br />
                Essa ação não poderá ser desfeita.
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setDeletingCustomer(null)
                }
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Customers