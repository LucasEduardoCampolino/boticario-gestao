import { supabase } from '../lib/supabase'

export interface Product {
  id: string
  user_id: string
  code: string | null
  name: string
  category: string | null
  cost_price: number
  sale_price: number
  stock_quantity: number
  minimum_stock: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface CreateProductInput {
  code?: string
  name: string
  category?: string
  cost_price: number
  sale_price: number
  stock_quantity: number
  minimum_stock: number
}

export async function getProducts() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return data as Product[]
}

export async function createProduct(
  product: CreateProductInput,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      code: product.code || null,
      name: product.name,
      category: product.category || null,
      cost_price: product.cost_price,
      sale_price: product.sale_price,
      stock_quantity: product.stock_quantity,
      minimum_stock: product.minimum_stock,
      active: true,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as Product
}

export async function updateProduct(
  id: string,
  product: CreateProductInput,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      code: product.code || null,
      name: product.name,
      category: product.category || null,
      cost_price: product.cost_price,
      sale_price: product.sale_price,
      stock_quantity: product.stock_quantity,
      minimum_stock: product.minimum_stock,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as Product
}

export async function updateProductStatus(
  id: string,
  active: boolean,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Usuário não autenticado.')
  }

  const { data, error } = await supabase
    .from('products')
    .update({
      active,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data as Product
}