import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL')
}
if (!supabaseAnonKey) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})

// Server-side client with service role key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = supabaseServiceKey ? createClient(
  supabaseUrl, 
  supabaseServiceKey, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
) : null

// Database types
export interface User {
  address: string
  referrer_address?: string
  total_points: number
  created_at: string
  updated_at: string
}

export interface PointsTransaction {
  id: number
  user_address: string
  amount: number
  type: 'deposit' | 'borrow' | 'swap' | 'liquidate' | 'wrap' | 'liquidity'
  source_tx_hash?: string
  block_number?: number
  created_at: string
}

export interface ProtocolStats {
  id: number
  total_deposits_usdt: number
  total_deposits_a7a5: number
  total_borrows_usdt: number
  total_borrows_a7a5: number
  tvl_usd: number
  last_updated: string
}