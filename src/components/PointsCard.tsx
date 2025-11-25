'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePoints } from '@/hooks/usePoints';
import { Loader2, TrendingUp, Gift, Users, Zap } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

const categoryIcons = {
  deposit: <TrendingUp className="w-4 h-4" />,
  borrow: <Zap className="w-4 h-4" />,
  swap: <Gift className="w-4 h-4" />,
  referral: <Users className="w-4 h-4" />,
  liquidate: <TrendingUp className="w-4 h-4" />,
  wrap: <Gift className="w-4 h-4" />
};

const categoryNames = {
  deposit: 'Deposits',
  borrow: 'Borrowing',
  swap: 'Swaps',
  referral: 'Referrals',
  liquidate: 'Liquidations',
  wrap: 'Wrap/Unwrap'
};

export default function PointsCard() {
  const { pointsData, loading, error } = usePoints();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="ml-2">Loading points...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          Error loading points: {error}
        </div>
      </Card>
    );
  }

  if (!pointsData) {
    return (
      <Card className="p-6">
        <div className="text-center text-gray-500">
          Connect wallet to view points
        </div>
      </Card>
    );
  }

  const { user, recent_transactions } = pointsData;

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Total Points */}
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">
            {formatNumber(user.total_points)}
          </div>
          <div className="text-sm text-muted-foreground">Total Points</div>
        </div>

        <Separator />

        {/* Points Breakdown */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Points by Category</h3>
          <div className="grid grid-cols-2 gap-3">
            {user.points_breakdown.map((category) => (
              <div
                key={category.category}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  {categoryIcons[category.category as keyof typeof categoryIcons]}
                  <span className="text-sm font-medium">
                    {categoryNames[category.category as keyof typeof categoryNames] || category.category}
                  </span>
                </div>
                <Badge variant="secondary">
                  {formatNumber(category.balance)}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Recent Transactions */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {recent_transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {categoryIcons[tx.type as keyof typeof categoryIcons]}
                  <div>
                    <div className="text-sm font-medium">
                      +{formatNumber(tx.amount)} points
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {categoryNames[tx.type as keyof typeof categoryNames] || tx.type}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(tx.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            
            {recent_transactions.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No recent activity
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}