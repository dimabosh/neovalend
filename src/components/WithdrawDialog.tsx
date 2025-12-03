'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { parseUnits, Address } from 'viem';
import { RESERVE_ASSETS, getContractConfig } from '@/config/contracts';
import { useReserveData, useTokenData, useUserAccountData, useAavePool } from '@/hooks/useAavePool';
import { useAssetPosition } from '@/hooks/useUserPositions';
import { TransactionModal } from './TransactionModal';
import { formatNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: keyof typeof RESERVE_ASSETS;
}

export function WithdrawDialog({
  open,
  onOpenChange,
  asset,
}: WithdrawDialogProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const { address } = useAccount();
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const { withdraw } = useAavePool();

  // Get asset config
  const assetConfig = RESERVE_ASSETS[asset];
  const tokenAddress = assetConfig.address as Address;

  // Get token data and reserve data
  const { decimals, symbol } = useTokenData(tokenAddress, undefined, address);
  const reserveData = useReserveData(tokenAddress);
  const assetPosition = useAssetPosition(asset);
  const accountData = useUserAccountData(address);

  // Get user's supplied amount from position (aToken balance)
  const suppliedAmount = assetPosition.supplied;

  // Calculate new Health Factor after withdraw
  const withdrawAmountInput = parseFloat(amount || '0');
  const withdrawAmountInUSD = symbol === 'WGAS'
    ? withdrawAmountInput * 0.0111
    : symbol === 'BTC'
    ? withdrawAmountInput * 120000 // WBTC price: $120,000
    : withdrawAmountInput; // USDT = $1

  // Get current account data for Health Factor calculation
  const currentHealthFactor = accountData?.healthFactor === '∞' ? 999 : parseFloat(accountData?.healthFactor || '0');
  const totalCollateralUSD = parseFloat(accountData?.totalCollateralBase || '0');
  const totalDebtUSD = parseFloat(accountData?.totalDebtBase || '0');
  const currentLiquidationThreshold = parseFloat(accountData?.currentLiquidationThreshold || '0');

  // Calculate new health factor after withdrawing
  // COLLATERAL DECREASES when withdrawing (debt stays the same)
  // New HF = ((currentCollateral - withdrawAmount) * currentLT) / currentDebt
  const newCollateralUSD = Math.max(0, totalCollateralUSD - withdrawAmountInUSD);
  const newHealthFactor = totalDebtUSD > 0 && newCollateralUSD > 0
    ? (newCollateralUSD * currentLiquidationThreshold) / totalDebtUSD
    : totalDebtUSD === 0 ? 999 : 0; // If no debt, HF is very high; if collateral = 0 but has debt, HF = 0

  // Debug: log HF calculation when amount changes
  if (amount && parseFloat(amount) > 0 && !((window as any).lastWithdrawAmount === amount)) {
    (window as any).lastWithdrawAmount = amount;
    console.log('🔍 Withdraw HF Calculation:', {
      symbol,
      amountEntered: amount,
      withdrawAmountInUSD: withdrawAmountInUSD.toFixed(4),
      currentCollateralUSD: totalCollateralUSD.toFixed(4),
      currentDebtUSD: totalDebtUSD.toFixed(4),
      newCollateralUSD: newCollateralUSD.toFixed(4),
      currentLT: currentLiquidationThreshold.toFixed(4),
      currentHealthFactor: currentHealthFactor.toFixed(2),
      newHealthFactor: newHealthFactor.toFixed(2),
      hfDirection: newHealthFactor < currentHealthFactor ? '📉 DECREASING' : '📈 INCREASING'
    });
  }

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address) return;

    setIsLoading(true);

    try {
      console.log('💸 Withdrawing from pool...');
      setTxStatus('pending');

      // User confirms in wallet - this returns transaction hash
      const withdrawHash = await withdraw(tokenAddress, amount, decimals);
      console.log('📝 Withdraw transaction sent:', withdrawHash);

      // Wait for blockchain confirmation
      console.log('⏳ Waiting for withdraw confirmation...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
      } else {
        // Fallback: wait 15 seconds if publicClient not available
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      console.log('✅ Withdraw transaction confirmed on blockchain:', withdrawHash);

      // Invalidate all queries to refresh data from blockchain
      console.log('🔄 Refreshing data from blockchain...');
      await queryClient.invalidateQueries();

      // Wait a bit for data to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Show success modal after data is refreshed
      setTxStatus('success');
      console.log('✅ Data refreshed, showing success modal');

      // Close main dialog immediately (TransactionModal will stay open)
      onOpenChange(false);

      // Reset form state after delay
      setTimeout(() => {
        setAmount('');
        setTxStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('Repay failed:', error);
      setTxStatus('error');

      // Reset error state after delay
      setTimeout(() => {
        setTxStatus('idle');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    // Max is the supplied amount (aToken balance)
    setAmount(suppliedAmount);
  };

  const exceedsSupplied = parseFloat(amount || '0') > parseFloat(suppliedAmount);

  // Unified dust threshold of $0.01 for all assets (WBTC, USDT, wA7A5)
  const dustThresholdUSD = 0.01;
  const hasDebt = totalDebtUSD > dustThresholdUSD;
  const isHealthFactorTooLow = hasDebt && newHealthFactor < 1.0; // Prevent withdraw if HF would drop below 1.0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">Withdraw {symbol}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-300">Amount</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pr-16 bg-slate-800 border-slate-700 text-white"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs text-blue-400 hover:text-blue-300"
                onClick={handleMaxClick}
              >
                MAX
              </Button>
            </div>
          </div>

          {/* Balance Display */}
          <div className="space-y-1 text-sm">
            <div className="text-gray-400">
              Available to withdraw: {formatNumber(parseFloat(suppliedAmount), 2)} {symbol}
            </div>
          </div>

          {/* Health Factor Display (if user has debt) */}
          {accountData && hasDebt && (
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg space-y-3">
              <div className="text-sm text-gray-300">
                {/* Health Factor Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Health Factor:</span>
                    <span className={`font-medium ${
                      (amount && parseFloat(amount) > 0 ? newHealthFactor : currentHealthFactor) > 2 ? 'text-green-400' :
                      (amount && parseFloat(amount) > 0 ? newHealthFactor : currentHealthFactor) > 1.2 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {amount && parseFloat(amount) > 0 ? (
                        <>
                          {currentHealthFactor > 5 ? '∞' : currentHealthFactor.toFixed(2)} → {newHealthFactor > 5 ? '∞' : newHealthFactor.toFixed(2)}
                        </>
                      ) : (
                        currentHealthFactor > 5 ? '∞' : currentHealthFactor.toFixed(2)
                      )}
                    </span>
                  </div>

                  {/* Health Factor Progress Bar - REVERSED: Safe (left) to Danger (right) */}
                  <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                    {/* Safe zone (> 2) - LEFT */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-transparent" style={{ width: '30%' }} />
                    {/* Warning zone (1.2 - 2) - MIDDLE */}
                    <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 to-transparent" style={{ left: '30%', width: '30%' }} />
                    {/* Danger zone (< 1.2) - RIGHT */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-transparent" style={{ left: '60%', width: '40%' }} />

                    {/* Current HF Indicator - REVERSED calculation */}
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white transition-all duration-300"
                      style={{
                        left: `${100 - Math.min(Math.max((currentHealthFactor / 5) * 100, 0), 100)}%`
                      }}
                    />

                    {/* New HF Indicator (when withdrawing) - Always moves RIGHT (to lower HF) */}
                    {amount && parseFloat(amount) > 0 && newHealthFactor < currentHealthFactor && (
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-orange-400 transition-all duration-300"
                        style={{
                          left: `${100 - Math.min(Math.max((newHealthFactor / 5) * 100, 0), 100)}%`
                        }}
                      />
                    )}
                  </div>

                  {/* Scale labels - REVERSED */}
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>5.0+</span>
                    <span>2.5</span>
                    <span>1.0</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Withdraw Info */}
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg space-y-2">
            <div className="text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Deposit APY:</span>
                <span className="text-green-400 font-medium">
                  {reserveData?.currentLiquidityRate
                    ? `${parseFloat(reserveData.currentLiquidityRate).toFixed(2)}%`
                    : '0.00%'}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          {amount && (
            <div className="text-xs text-gray-400 space-y-1">
              <div>After withdrawal deposit will be: {formatNumber((parseFloat(suppliedAmount) - parseFloat(amount || '0')), 2)} {symbol}</div>
              {exceedsSupplied && (
                <div className="text-red-400">
                  ⚠️ Amount exceeds your deposit
                </div>
              )}
              {isHealthFactorTooLow && (
                <div className="text-red-400">
                  ⚠️ Health Factor will drop below 1.0 - liquidation risk!
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleWithdraw}
            disabled={isLoading || !amount || exceedsSupplied || isHealthFactorTooLow}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 transition-all text-white"
            size="lg"
          >
            {isLoading ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </div>
      </DialogContent>

      {/* Transaction Status Modal */}
      <TransactionModal
        open={txStatus !== 'idle'}
        onOpenChange={(open) => {
          if (!open && txStatus !== 'pending') {
            setTxStatus('idle');
          }
        }}
        status={txStatus === 'idle' ? 'pending' : txStatus}
        action="supply"
        amount={formatNumber(parseFloat(amount || '0'), 2)}
        symbol={symbol}
      />
    </Dialog>
  );
}
