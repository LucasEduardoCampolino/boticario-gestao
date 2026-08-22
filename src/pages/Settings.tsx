// src/pages/Settings.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

function Settings() {
  const { showToast } = useToast()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [monthlyGoal, setMonthlyGoal] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      setEmail(user.email || '')

      const { data, error } = await supabase
        .from('profiles')
        .select('name, phone, monthly_sales_goal')
        .eq('id', user.id)
        .single()

      if (error) throw error

      setName(data?.name || '')
      setPhone(data?.phone || '')
      setMonthlyGoal(data?.monthly_sales_goal?.toString() || '')
    } catch (err) {
      console.error('Erro ao carregar perfil:', err)
      showToast('Não foi possível carregar o perfil.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      showToast('Informe seu nome.', 'error')
      return
    }

    const goalValue = Number(monthlyGoal.replace(',', '.'))

    if (monthlyGoal && (!Number.isFinite(goalValue) || goalValue < 0)) {
      showToast('Informe uma meta válida.', 'error')
      return
    }

    try {
      setSavingProfile(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Usuário não autenticado')

      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          monthly_sales_goal: goalValue,
        })
        .eq('id', user.id)

      if (error) throw error

      showToast('Perfil atualizado com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
      showToast('Não foi possível salvar o perfil.', 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('Preencha todos os campos de senha.', 'error')
      return
    }

    if (newPassword.length < 6) {
      showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('As senhas não coincidem.', 'error')
      return
    }

    try {
      setSavingPassword(true)

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      showToast('Senha alterada com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao alterar senha:', err)
      showToast('Não foi possível alterar a senha.', 'error')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-pink-100 border-t-pink-600" />
          <p className="mt-3 text-sm text-gray-500">Carregando configurações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-500">Configurações</p>
        <h2 className="mt-1 text-2xl font-bold text-gray-900">
          Meu Perfil
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie suas informações pessoais
        </p>
      </section>

      {/* PERFIL */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">
          Informações pessoais
        </h3>

        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Nome *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
              placeholder="Seu nome"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              O e-mail não pode ser alterado.
            </p>
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
              Telefone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label htmlFor="goal" className="mb-1 block text-sm font-medium text-gray-700">
              Meta mensal de vendas
            </label>
            <div className="flex items-center rounded-xl border border-gray-300 bg-white focus-within:border-pink-600 focus-within:ring-2 focus-within:ring-pink-100">
              <span className="pl-4 text-sm text-gray-400">R$</span>
              <input
                id="goal"
                type="text"
                inputMode="decimal"
                value={monthlyGoal}
                onChange={(e) => setMonthlyGoal(e.target.value)}
                className="w-full bg-transparent px-3 py-3 text-right outline-none"
                placeholder="0,00"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full rounded-xl bg-pink-600 px-4 py-3 font-semibold text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingProfile ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </section>

      {/* SENHA */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900">
          Alterar senha
        </h3>

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-gray-700">
              Senha atual *
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">
              Nova senha *
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">
              Confirmar nova senha *
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={savingPassword}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingPassword ? 'Alterando...' : 'Alterar senha'}
          </button>
        </form>
      </section>

      {/* BACKUP */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-2xl">
            💾
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">
              Backup e Restauração
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Exporte ou importe seus dados para proteger suas informações.
            </p>
            <Link
              to="/backup"
              className="mt-4 inline-block rounded-xl bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-700 hover:bg-pink-100"
            >
              Acessar backup
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Settings