'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRepay } from '@/hooks/useRepay';
import { useAccount, useReadContract, useChainId, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, Address } from 'viem';
import { erc20Abi } from 'viem';
import { RESERVE_ASSETS, getContractConfig } from '@/config/contracts';
import { useReserveData, useTokenData, useUserAccountData } from '@/hooks/useAavePool';
import { useAssetPosition } from '@/hooks/useUserPositions';
import { TransactionModal } from './TransactionModal';
import { formatNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface RepayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: keyof typeof RESERVE_ASSETS;
}

export function RepayDialog({
  open,
  onOpenChange,
  asset,
}: RepayDialogProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const { address } = useAccount();
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const { repay, approve } = useRepay();

  // Get asset config
  const assetConfig = RESERVE_ASSETS[asset];
  const tokenAddress = assetConfig.address as Address;
  const poolAddress = config.contracts.POOL as Address;

  // Get token data and reserve data
  const { balance, decimals, symbol } = useTokenData(tokenAddress, poolAddress, address);
  const reserveData = useReserveData(tokenAddress);
  const assetPosition = useAssetPosition(asset);
  const accountData = useUserAccountData(address);

  // Get user's wallet balance
  const { data: walletBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get user's borrowed amount from position
  const borrowedAmount = assetPosition.borrowed;

  // Calculate new Health Factor after repay
  const repayAmountInput = parseFloat(amount || '0');
  const repayAmountInUSD = symbol === 'WGAS'
    ? repayAmountInput * 0.0111
    : symbol === 'BTC'
    ? repayAmountInput * 120000 // WBTC price: $120,000
    : repayAmountInput; // USDT = $1

  // Get current account data for Health Factor calculation
  const currentHealthFactor = accountData?.healthFactor === '∞' ? 999 : parseFloat(accountData?.healthFactor || '0');
  const totalCollateralUSD = parseFloat(accountData?.totalCollateralBase || '0');
  const totalDebtUSD = parseFloat(accountData?.totalDebtBase || '0');
  const currentLiquidationThreshold = parseFloat(accountData?.currentLiquidationThreshold || '0');

  // Calculate new health factor after repaying
  // COLLATERAL STAYS THE SAME when repaying (only debt decreases)
  // New HF = (currentCollateral * currentLT) / (currentDebt - repayAmount)
  const newDebtUSD = Math.max(0, totalDebtUSD - repayAmountInUSD);
  const newHealthFactor = newDebtUSD > 0 && totalCollateralUSD > 0
    ? (totalCollateralUSD * currentLiquidationThreshold) / newDebtUSD
    : 999; // If debt becomes 0, HF is very high (no liquidation risk)

  // Debug: log HF calculation when amount changes
  if (amount && parseFloat(amount) > 0 && !((window as any).lastRepayAmount === amount)) {
    (window as any).lastRepayAmount = amount;
    console.log('🔍 Repay HF Calculation:', {
      symbol,
      amountEntered: amount,
      repayAmountInUSD: repayAmountInUSD.toFixed(4),
      currentCollateralUSD: totalCollateralUSD.toFixed(4),
      currentDebtUSD: totalDebtUSD.toFixed(4),
      newDebtUSD: newDebtUSD.toFixed(4),
      currentLT: currentLiquidationThreshold.toFixed(4),
      currentHealthFactor: currentHealthFactor.toFixed(2),
      newHealthFactor: newHealthFactor.toFixed(2),
      hfDirection: newHealthFactor > currentHealthFactor ? '📈 INCREASING' : '📉 DECREASING'
    });
  }

  // Get allowance for Pool contract
  const { data: allowanceData } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && poolAddress ? [address, poolAddress] : undefined,
  });

  const allowance = allowanceData ? formatUnits(allowanceData, decimals) : '0';

  const handleRepay = async () => {
    if (!amount || parseFloat(amount) <= 0 || !address) return;

    setIsLoading(true);

    try {
      const amountInWei = parseUnits(amount, decimals);

      // Check if approval is needed
      if (parseFloat(amount) > parseFloat(allowance)) {
        console.log('🔓 Approving tokens...');
        setTxStatus('pending');

        // Get approval transaction hash
        const approveHash = await approve(tokenAddress, amountInWei);
        console.log('📝 Approval transaction sent:', approveHash);

        // Wait for approval transaction to be confirmed on blockchain
        console.log('⏳ Waiting for approval confirmation...');
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          console.log('✅ Approval confirmed on blockchain');
        } else {
          // Fallback: wait 15 seconds if publicClient not available
          await new Promise(resolve => setTimeout(resolve, 15000));
        }

        // Small delay before next step to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('💸 Repaying...');
      setTxStatus('pending');

      // User confirms in wallet - this returns transaction hash
      const repayHash = await repay(tokenAddress, amountInWei, BigInt(2), address);
      console.log('📝 Repay transaction sent:', repayHash);

      // Wait for blockchain confirmation
      console.log('⏳ Waiting for repay confirmation...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: repayHash });
      } else {
        // Fallback: wait 15 seconds if publicClient not available
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      console.log('✅ Repay transaction confirmed on blockchain:', repayHash);

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
    // Max is the minimum of wallet balance and borrowed amount
    const maxAmount = Math.min(parseFloat(balance), parseFloat(borrowedAmount));
    setAmount(maxAmount.toString());
  };

  const isInsufficientBalance = parseFloat(amount || '0') > parseFloat(balance);
  const exceedsBorrowed = parseFloat(amount || '0') > parseFloat(borrowedAmount);
  const needsApproval = parseFloat(amount || '0') > parseFloat(allowance);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">Repay {symbol}</DialogTitle>
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
              Wallet balance: {formatNumber(parseFloat(balance), 2)} {symbol}
            </div>
            <div className="text-gray-400">
              Current loan: {formatNumber(parseFloat(borrowedAmount), 2)} {symbol}
            </div>
          </div>

          {/* Health Factor Display (if user has debt) */}
          {accountData && totalDebtUSD > 0 && (
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

                    {/* New HF Indicator (when repaying) - Always moves LEFT (to higher HF) */}
                    {amount && parseFloat(amount) > 0 && newHealthFactor > currentHealthFactor && (
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-green-400 transition-all duration-300"
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

          {/* Repay Info */}
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg space-y-2">
            <div className="text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Borrow APY:</span>
                <span className="text-orange-400 font-medium">
                  {reserveData?.currentVariableBorrowRate
                    ? `${parseFloat(reserveData.currentVariableBorrowRate).toFixed(2)}%`
                    : '~5%'}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          {amount && (
            <div className="text-xs text-gray-400 space-y-1">
              <div>After repayment loan will be: {formatNumber((parseFloat(borrowedAmount) - parseFloat(amount || '0')), 2)} {symbol}</div>
              {needsApproval && (
                <div className="text-orange-400">
                  ⚠️ Transaction confirmation required
                </div>
              )}
              {isInsufficientBalance && (
                <div className="text-red-400">
                  ⚠️ Insufficient wallet balance
                </div>
              )}
              {exceedsBorrowed && (
                <div className="text-red-400">
                  ⚠️ Amount exceeds current loan
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleRepay}
            disabled={isLoading || !amount || isInsufficientBalance || exceedsBorrowed}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 transition-all text-white"
            size="lg"
          >
            {isLoading ? 'Repaying...' : needsApproval ? 'Approve and repay' : 'Repay'}
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
        action="repay"
        amount={formatNumber(parseFloat(amount || '0'), 2)}
        symbol={symbol}
      />
    </Dialog>
  );
}
