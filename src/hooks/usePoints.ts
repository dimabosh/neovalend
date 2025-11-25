import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface PointsData {
  user: {
    address: string;
    total_points: number;
    points_breakdown: Array<{
      category: string;
      balance: number;
      lifetime_earned: number;
    }>;
  };
  recent_transactions: Array<{
    id: number;
    amount: number;
    type: string;
    created_at: string;
    source_tx_hash?: string;
  }>;
}

interface ReferralStats {
  total_referrals: number;
  total_points_earned: number;
  referrals: Array<{
    referred_address: string;
    total_points_earned: number;
    created_at: string;
  }>;
}

export function usePoints() {
  const { address } = useAccount();
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPoints = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/points?address=${address}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setPointsData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address) {
      fetchPoints();
    }
  }, [address]);

  return {
    pointsData,
    loading,
    error,
    refetch: fetchPoints
  };
}

export function useReferrals() {
  const { address } = useAccount();
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReferrals = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/referral?address=${address}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setReferralStats(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async (customCode?: string) => {
    if (!address) throw new Error('Wallet not connected');

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        user_address: address,
        custom_code: customCode
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }

    await fetchReferrals(); // Refresh data
    return result.data;
  };

  const useReferralCode = async (referralCode: string) => {
    if (!address) throw new Error('Wallet not connected');

    const response = await fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'use',
        user_address: address,
        referral_code: referralCode
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.data;
  };

  useEffect(() => {
    if (address) {
      fetchReferrals();
    }
  }, [address]);

  return {
    referralStats,
    loading,
    error,
    generateReferralCode,
    useReferralCode,
    refetch: fetchReferrals
  };
}

export function useLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async (limit: number = 100) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leaderboard?limit=${limit}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      setLeaderboard(result.data.leaderboard);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return {
    leaderboard,
    loading,
    error,
    refetch: fetchLeaderboard
  };
}