/**
 * @fileoverview Supabase Points System Integration
 * @description Handles points, referrals, and activity tracking for Neovalend Protocol
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service client with elevated permissions
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// TYPES
// ============================================

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
  type: 'deposit' | 'borrow' | 'swap' | 'liquidate' | 'wrap' | 'referral';
  source_tx_hash?: string;
  block_number?: number;
  created_at: string;
}

export interface ReferralCode {
  id: number;
  code: string;
  user_address: string;
  max_uses?: number;
  current_uses: number;
  expires_at?: string;
  is_active: boolean;
}

export interface UserActivity {
  id: number;
  user_address: string;
  activity_type: string;
  token_address?: string;
  amount?: number;
  usd_value?: number;
  tx_hash?: string;
  block_number?: number;
  points_earned: number;
  metadata?: any;
  created_at: string;
}

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Create or update user
 */
export async function upsertUser(address: string, referrerAddress?: string) {
  const { data, error } = await supabase
    .from('users')
    .upsert({
      address: address.toLowerCase(),
      referrer_address: referrerAddress?.toLowerCase(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data as User;
}

/**
 * Get user with points breakdown
 */
export async function getUserWithPoints(address: string) {
  // Get user data
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();

  if (userError) throw userError;

  // Get points breakdown by category
  const { data: pointsBreakdown, error: pointsError } = await supabase
    .from('user_point_balances')
    .select('*')
    .eq('user_address', address.toLowerCase());

  if (pointsError) throw pointsError;

  return {
    ...user,
    points_breakdown: pointsBreakdown || []
  };
}

// ============================================
// POINTS SYSTEM
// ============================================

/**
 * Award points to user (handles referrals automatically)
 */
export async function awardPoints(
  userAddress: string,
  category: string,
  points: number,
  activityType?: string,
  usdValue?: number,
  txHash?: string
) {
  const { data, error } = await supabase.rpc('award_points', {
    p_user_address: userAddress.toLowerCase(),
    p_category: category,
    p_points: points,
    p_activity_type: activityType,
    p_usd_value: usdValue,
    p_tx_hash: txHash
  });

  if (error) throw error;
  return data;
}

/**
 * Get user's points history
 */
export async function getPointsHistory(
  userAddress: string, 
  limit: number = 50,
  offset: number = 0
) {
  const { data, error } = await supabase
    .from('points_transactions')
    .select('*')
    .eq('user_address', userAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as PointsTransaction[];
}

/**
 * Get points leaderboard
 */
export async function getLeaderboard(limit: number = 100) {
  const { data, error } = await supabase
    .from('user_leaderboard')
    .select('*')
    .limit(limit);

  if (error) throw error;
  return data;
}

// ============================================
// REFERRAL SYSTEM
// ============================================

/**
 * Generate referral code for user
 */
export async function generateReferralCode(
  userAddress: string,
  customCode?: string,
  maxUses?: number,
  expiresAt?: string
) {
  const code = customCode || `REF${Date.now().toString(36).toUpperCase()}`;
  
  const { data, error } = await supabase
    .from('referral_codes')
    .insert({
      code,
      user_address: userAddress.toLowerCase(),
      max_uses: maxUses,
      expires_at: expiresAt,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data as ReferralCode;
}

/**
 * Use referral code
 */
export async function useReferralCode(
  referralCode: string,
  newUserAddress: string
) {
  // Check if code exists and is valid
  const { data: code, error: codeError } = await supabase
    .from('referral_codes')
    .select('*')
    .eq('code', referralCode.toUpperCase())
    .eq('is_active', true)
    .single();

  if (codeError) throw new Error('Invalid referral code');

  // Check usage limits
  if (code.max_uses && code.current_uses >= code.max_uses) {
    throw new Error('Referral code usage limit exceeded');
  }

  // Check expiry
  if (code.expires_at && new Date() > new Date(code.expires_at)) {
    throw new Error('Referral code has expired');
  }

  // Create referral relationship
  const { data: referral, error: referralError } = await supabase
    .from('referrals')
    .insert({
      referrer_address: code.user_address,
      referred_address: newUserAddress.toLowerCase(),
      referral_code: referralCode.toUpperCase(),
      status: 'active'
    })
    .select()
    .single();

  if (referralError) throw referralError;

  // Update code usage count
  await supabase
    .from('referral_codes')
    .update({
      current_uses: code.current_uses + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', code.id);

  return referral;
}

/**
 * Get user's referral statistics
 */
export async function getReferralStats(userAddress: string) {
  const { data: stats, error } = await supabase
    .from('referrals')
    .select(`
      *,
      referred:users!referrals_referred_address_fkey(address, total_points, created_at)
    `)
    .eq('referrer_address', userAddress.toLowerCase())
    .eq('status', 'active');

  if (error) throw error;
  
  const totalReferrals = stats?.length || 0;
  const totalPointsEarned = stats?.reduce((sum, ref) => sum + (ref.total_points_earned || 0), 0) || 0;

  return {
    total_referrals: totalReferrals,
    total_points_earned: totalPointsEarned,
    referrals: stats || []
  };
}

// ============================================
// ACTIVITY TRACKING
// ============================================

/**
 * Track user activity
 */
export async function trackActivity(
  userAddress: string,
  activityType: string,
  amount?: number,
  usdValue?: number,
  txHash?: string,
  tokenAddress?: string,
  blockNumber?: number,
  metadata?: any
) {
  // Calculate points based on activity
  const pointsEarned = await calculatePointsForActivity(activityType, usdValue || 0);

  const { data: activity, error } = await supabase
    .from('user_activities')
    .insert({
      user_address: userAddress.toLowerCase(),
      activity_type: activityType,
      token_address: tokenAddress?.toLowerCase(),
      amount,
      usd_value: usdValue,
      tx_hash: txHash,
      block_number: blockNumber,
      points_earned: pointsEarned,
      metadata
    })
    .select()
    .single();

  if (error) throw error;

  // Award points if earned
  if (pointsEarned > 0) {
    await awardPoints(
      userAddress,
      activityType,
      pointsEarned,
      activityType,
      usdValue,
      txHash
    );
  }

  return activity as UserActivity;
}

/**
 * Calculate points for activity based on current multipliers
 */
export async function calculatePointsForActivity(
  activityType: string,
  usdValue: number
): Promise<number> {
  const { data: multiplier, error } = await supabase
    .from('points_multipliers')
    .select('*')
    .eq('activity_type', activityType)
    .eq('is_active', true)
    .single();

  if (error || !multiplier) return 0;

  // Base calculation: points per $100
  const basePoints = (usdValue / 100) * multiplier.base_rate;
  const finalPoints = basePoints * multiplier.multiplier;

  // Apply daily limits if set
  if (multiplier.max_daily_points) {
    // Would need to check daily usage here
    return Math.min(finalPoints, multiplier.max_daily_points);
  }

  return Math.max(0, finalPoints);
}

/**
 * Get user activity history
 */
export async function getActivityHistory(
  userAddress: string,
  activityType?: string,
  limit: number = 50,
  offset: number = 0
) {
  let query = supabase
    .from('user_activities')
    .select('*')
    .eq('user_address', userAddress.toLowerCase());

  if (activityType) {
    query = query.eq('activity_type', activityType);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data as UserActivity[];
}

// ============================================
// PROTOCOL STATS
// ============================================

/**
 * Update protocol statistics
 */
export async function updateProtocolStats(stats: {
  total_deposits_usdt?: number;
  total_deposits_a7a5?: number;
  total_borrows_usdt?: number;
  total_borrows_a7a5?: number;
  tvl_usd?: number;
}) {
  const { data, error } = await supabase
    .from('protocol_stats')
    .upsert({
      id: 1, // Single row for protocol stats
      ...stats,
      last_updated: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get protocol statistics
 */
export async function getProtocolStats() {
  const { data, error } = await supabase
    .from('protocol_stats')
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get daily protocol activity
 */
export async function getDailyActivity(days: number = 30) {
  const { data, error } = await supabase
    .from('daily_protocol_activity')
    .select('*')
    .gte('activity_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('activity_date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get user statistics
 */
export async function getUserStats(userAddress: string) {
  // Get total activity count and volume
  const { data: activities, error: actError } = await supabase
    .from('user_activities')
    .select('activity_type, usd_value, points_earned')
    .eq('user_address', userAddress.toLowerCase());

  if (actError) throw actError;

  // Get referral stats
  const referralStats = await getReferralStats(userAddress);

  // Aggregate activity stats
  const activityStats = activities?.reduce((acc, activity) => {
    const type = activity.activity_type;
    if (!acc[type]) {
      acc[type] = { count: 0, volume: 0, points: 0 };
    }
    acc[type].count += 1;
    acc[type].volume += activity.usd_value || 0;
    acc[type].points += activity.points_earned || 0;
    return acc;
  }, {} as Record<string, { count: number; volume: number; points: number }>);

  return {
    activity_stats: activityStats || {},
    referral_stats: referralStats,
    total_activities: activities?.length || 0,
    total_volume: activities?.reduce((sum, a) => sum + (a.usd_value || 0), 0) || 0,
    total_points_from_activities: activities?.reduce((sum, a) => sum + (a.points_earned || 0), 0) || 0
  };
}