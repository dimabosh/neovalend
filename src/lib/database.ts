import { supabase, supabaseAdmin, User, PointsTransaction, ProtocolStats } from './supabase'

// Database service functions for A7A5 Lending Protocol

export class DatabaseService {
  // User management
  static async createUser(address: string, referrerAddress?: string): Promise<User | null> {
    if (!supabaseAdmin) {
      console.warn('Supabase admin not available')
      return null
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        address: address.toLowerCase(),
        referrer_address: referrerAddress?.toLowerCase(),
        total_points: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating user:', error)
      return null
    }

    return data
  }

  static async getUser(address: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('address', address.toLowerCase())
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // User not found, create new user
        return await this.createUser(address)
      }
      console.error('Error fetching user:', error)
      return null
    }

    return data
  }

  // Points management
  static async addPoints(
    userAddress: string,
    amount: number,
    type: 'deposit' | 'borrow' | 'swap' | 'liquidate' | 'wrap' | 'liquidity',
    txHash?: string,
    blockNumber?: number
  ): Promise<PointsTransaction | null> {
    if (!supabaseAdmin) {
      console.warn('Supabase admin not available')
      return null
    }

    // Ensure user exists first
    await this.getUser(userAddress)

    const { data, error } = await supabaseAdmin
      .from('points_transactions')
      .insert({
        user_address: userAddress.toLowerCase(),
        amount,
        type,
        source_tx_hash: txHash,
        block_number: blockNumber
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding points:', error)
      return null
    }

    return data
  }

  static async getUserPoints(address: string): Promise<number> {
    const user = await this.getUser(address)
    return user?.total_points || 0
  }

  static async getUserPointsHistory(address: string): Promise<PointsTransaction[]> {
    const { data, error } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('user_address', address.toLowerCase())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching points history:', error)
      return []
    }

    return data || []
  }

  // Protocol statistics
  static async updateProtocolStats(stats: {
    totalDepositsUSDT?: number
    totalDepositsA7A5?: number
    totalBorrowsUSDT?: number
    totalBorrowsA7A5?: number
    tvlUSD?: number
  }): Promise<ProtocolStats | null> {
    if (!supabaseAdmin) {
      console.warn('Supabase admin not available')
      return null
    }

    const { data, error } = await supabaseAdmin
      .from('protocol_stats')
      .update({
        total_deposits_usdt: stats.totalDepositsUSDT,
        total_deposits_a7a5: stats.totalDepositsA7A5,
        total_borrows_usdt: stats.totalBorrowsUSDT,
        total_borrows_a7a5: stats.totalBorrowsA7A5,
        tvl_usd: stats.tvlUSD,
        last_updated: new Date().toISOString()
      })
      .eq('id', 1)
      .select()
      .single()

    if (error) {
      console.error('Error updating protocol stats:', error)
      return null
    }

    return data
  }

  static async getProtocolStats(): Promise<ProtocolStats | null> {
    const { data, error } = await supabase
      .from('protocol_stats')
      .select('*')
      .eq('id', 1)
      .single()

    if (error) {
      console.error('Error fetching protocol stats:', error)
      return null
    }

    return data
  }

  // Referral system
  static async getReferrals(referrerAddress: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('referrer_address', referrerAddress.toLowerCase())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching referrals:', error)
      return []
    }

    return data || []
  }

  // Leaderboard
  static async getTopUsers(limit: number = 10): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('total_points', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching leaderboard:', error)
      return []
    }

    return data || []
  }

  // Transaction verification - check if transaction already processed
  static async isTransactionProcessed(txHash: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('points_transactions')
      .select('id')
      .eq('source_tx_hash', txHash)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking transaction:', error)
      return false
    }

    return !!data
  }
}