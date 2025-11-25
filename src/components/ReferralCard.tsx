'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useReferrals } from '@/hooks/usePoints';
import { Copy, Users, Gift, Plus, Check } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

export default function ReferralCard() {
  const { referralStats, generateReferralCode, loading, error } = useReferrals();
  const [generating, setGenerating] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const result = await generateReferralCode(customCode || undefined);
      toast.success('Referral code generated successfully!');
      setCustomCode('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopiedCode(''), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <div className="animate-pulse">Loading referrals...</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-500">
          Error loading referrals: {error}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Users className="w-6 h-6" />
            Referral System
          </h2>
          <p className="text-muted-foreground mt-2">
            Earn 10% of your referrals' points
          </p>
        </div>

        <Separator />

        {/* Stats */}
        {referralStats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {referralStats.total_referrals}
              </div>
              <div className="text-sm text-muted-foreground">Referrals</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatNumber(referralStats.total_points_earned)}
              </div>
              <div className="text-sm text-muted-foreground">Points Earned</div>
            </div>
          </div>
        )}

        <Separator />

        {/* Generate New Code */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Generate Referral Code</h3>
          <div className="space-y-3">
            <Input
              placeholder="Custom code (optional)"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              maxLength={20}
            />
            <Button
              onClick={handleGenerateCode}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>Generating...</>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate New Code
                </>
              )}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Active Referrals */}
        {referralStats && referralStats.referrals.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Your Referrals</h3>
            <div className="space-y-2">
              {referralStats.referrals.map((referral, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-mono text-sm">
                      {referral.referred_address.slice(0, 6)}...
                      {referral.referred_address.slice(-4)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(referral.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline">
                    <Gift className="w-3 h-3 mr-1" />
                    {formatNumber(referral.total_points_earned)} pts
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it Works */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">How Referrals Work</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Share your referral code with friends</li>
            <li>• They use it when first interacting with Neovalend</li>
            <li>• You earn 10% of all their points</li>
            <li>• They keep 100% of their points</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}