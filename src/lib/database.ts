// Stub DatabaseService - Supabase disabled for now
// TODO: Re-enable when Supabase is configured

export interface User {
  address: string;
  referrer_address?: string;
  total_points: number;
  created_at: string;
  updated_at: string;
}

export interface PointsTransaction {
  id: number;
  user_address: string;
  amount: number;
  type: string;
  source_tx_hash?: string;
  block_number?: number;
  created_at: string;
}

export interface ProtocolStats {
  id: number;
  total_deposits_usdt: number;
  total_deposits_a7a5: number;
  total_borrows_usdt: number;
  total_borrows_a7a5: number;
  tvl_usd: number;
  last_updated: string;
}

// Stub DatabaseService that returns empty/default data
export class DatabaseService {
  // User management
  static async createUser(address: string, referrerAddress?: string): Promise<User | null> {
    console.log('[DB Stub] createUser:', address);
    return {
      address,
      referrer_address: referrerAddress,
      total_points: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  static async getUser(address: string): Promise<User | null> {
    return null;
  }

  // Points management
  static async addPoints(
    userAddress: string,
    amount: number,
    type: 'deposit' | 'borrow' | 'swap' | 'liquidate' | 'wrap' | 'liquidity',
    txHash?: string,
    blockNumber?: number
  ): Promise<PointsTransaction | null> {
    console.log('[DB Stub] addPoints:', { userAddress, amount, type });
    return null;
  }

  static async getUserPoints(address: string): Promise<number> {
    return 0;
  }

  static async getUserPointsHistory(address: string): Promise<PointsTransaction[]> {
    return [];
  }

  // Protocol statistics
  static async updateProtocolStats(stats: {
    totalDepositsUSDT?: number;
    totalDepositsA7A5?: number;
    totalBorrowsUSDT?: number;
    totalBorrowsA7A5?: number;
    tvlUSD?: number;
  }): Promise<ProtocolStats | null> {
    console.log('[DB Stub] updateProtocolStats:', stats);
    return null;
  }

  static async getProtocolStats(): Promise<ProtocolStats | null> {
    return {
      id: 1,
      total_deposits_usdt: 0,
      total_deposits_a7a5: 0,
      total_borrows_usdt: 0,
      total_borrows_a7a5: 0,
      tvl_usd: 0,
      last_updated: new Date().toISOString(),
    };
  }

  // Referral system
  static async getReferrals(referrerAddress: string): Promise<User[]> {
    return [];
  }

  // Leaderboard
  static async getTopUsers(limit: number = 10): Promise<User[]> {
    return [];
  }

  // Transaction verification
  static async isTransactionProcessed(txHash: string): Promise<boolean> {
    return false;
  }
}
