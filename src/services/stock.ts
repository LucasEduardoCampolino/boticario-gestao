// src/services/stock.ts
import { supabase } from '../lib/supabase'

export type StockMovementType = 'entrada' | 'saida'

export interface RegisterStockMovementInput {
  productId: string
  type: StockMovementType
  quantity: number
  reason?: string
}

export interface StockMovement {
  id: string
  user_id: string
  product_id: string
  type: StockMovementType
  quantity: number
  reason: string | null
  created_at: string
}

export async function registerStockMovement(
  input: RegisterStockMovementInput,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  if (
    !Number.isInteger(input.quantity) ||
    input.quantity <= 0
  ) {
    throw new Error(
      'A quantidade deve ser um número inteiro maior que zero.',
    )
  }

  const { data, error } = await supabase.rpc(
    'register_stock_movement',
    {
      p_product_id: input.productId,
      p_type: input.type,
      p_quantity: input.quantity,
      p_reason: input.reason?.trim() || null,
    },
  )

  if (error) {
    throw error
  }

  return data
}

export async function getStockMovements(
  productId: string,
): Promise<StockMovement[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .eq('product_id', productId)
    .eq('user_id', user.id)
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    throw error
  }

  return (data ?? []) as StockMovement[]
}