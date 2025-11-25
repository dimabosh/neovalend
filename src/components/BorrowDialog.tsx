'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount, useReadContract, useChainId, usePublicClient } from 'wagmi';
import { Address } from 'viem';
import { useAavePool, useUserAccountData, useTokenData, useReserveData, useOraclePrice, useUserConfiguration } from '@/hooks/useAavePool';
import { RESERVE_ASSETS, ERC20_ABI, getContractConfig } from '@/config/contracts';
import { TransactionModal } from './TransactionModal';
import { CollateralDialog } from './CollateralDialog';
import { formatNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useUserPositions } from '@/hooks/useUserPositions';

interface BorrowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: keyof typeof RESERVE_ASSETS;
}

export function BorrowDialog({ open, onOpenChange, asset }: BorrowDialogProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [showCollateralDialog, setShowCollateralDialog] = useState(false);

  const { address } = useAccount();
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { borrow, setUseAsCollateral } = useAavePool();

  // Get user positions to check for deposits without collateral
  const { activeSuppliedPositions } = useUserPositions();

  // Get user configuration for collateral status
  const userConfig = useUserConfiguration(address);

  // Check if user has any collateral enabled
  const hasAnyCollateral = userConfig ?
    Object.values(RESERVE_ASSETS).some(reserve =>
      userConfig.isUsingAsCollateral(reserve.reserveIndex)
    ) : false;

  const reserveConfig = RESERVE_ASSETS[asset];
  const tokenAddress = reserveConfig.address as Address;

  // Get token data from contract
  const { decimals, symbol } = useTokenData(tokenAddress, undefined, address);

  // Get reserve data for real interest rates
  const reserveData = useReserveData(tokenAddress);

  // Get asset price from Oracle
  const oraclePriceData = useOraclePrice(tokenAddress);

  // Get pool's available liquidity (underlying token balance in aToken contract)
  const aTokenAddress = reserveConfig.aToken as Address | undefined;

  // Available liquidity = underlying token balance held by aToken contract
  const { data: underlyingBalance } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: aTokenAddress ? [aTokenAddress] : undefined,
    query: {
      enabled: !!aTokenAddress,
    }
  });

  const availableLiquidity = underlyingBalance && decimals ?
    parseFloat((underlyingBalance as bigint).toString()) / Math.pow(10, decimals) : 0;

  // Get user's account data for borrowing power calculation
  const accountData = useUserAccountData(address);

  // Debug: log account data
  if (accountData && open && !(window as any).borrowDialogDebug) {
    console.log('🔍 BorrowDialog AccountData:', accountData);
    console.log('🔍 Available Liquidity:', availableLiquidity, symbol);
    console.log('🔍 Underlying Balance:', underlyingBalance?.toString());
    console.log('🔍 aToken Address:', aTokenAddress);
    console.log('🔍 Token Address:', tokenAddress);
    (window as any).borrowDialogDebug = true;
  }

  const handleBorrow = async () => {
    if (!address || !amount) return;

    // Check if user has any collateral - if not, show CollateralDialog
    if (!hasAnyCollateral && activeSuppliedPositions.length > 0) {
      console.log('⚠️ No collateral enabled, showing CollateralDialog');
      onOpenChange(false); // Close borrow dialog
      setShowCollateralDialog(true); // Open collateral dialog
      return;
    }

    setIsLoading(true);

    try {
      console.log('💰 Borrowing from pool...');
      console.log(`Borrowing ${amount} ${symbol}`);
      setTxStatus('pending');

      // User confirms in wallet - this returns transaction hash
      const hash = await borrow(tokenAddress, amount, decimals);
      console.log('📝 Transaction sent:', hash);

      // Wait for blockchain confirmation
      console.log('⏳ Waiting for blockchain confirmation...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      } else {
        // Fallback: wait 15 seconds if publicClient not available
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      console.log('✅ Transaction confirmed on blockchain:', hash);

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
      console.error('Borrow failed:', error);
      setTxStatus('error');

      // Reset error state after delay
      setTimeout(() => {
        setTxStatus('idle');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate if borrow amount is safe
  // Get asset price from Oracle (dynamic)
  const assetPriceUSD = oraclePriceData?.priceUSD || 1;

  const borrowAmountInput = parseFloat(amount || '0');

  // Convert user input to USD using Oracle price
  // User enters token amount, multiply by Oracle price to get USD
  const borrowAmountInUSD = borrowAmountInput * assetPriceUSD;

  // Available to borrow in USD from protocol
  const maxByCollateralUSD = parseFloat(accountData?.availableBorrowsBase || '0');

  // Pool liquidity: availableLiquidity is in token units
  // Multiply by Oracle price to get USD value
  const poolLiquidityUSD = availableLiquidity * assetPriceUSD;

  const availableToBorrowUSD = Math.min(maxByCollateralUSD, poolLiquidityUSD);
  const isExceedingLimit = borrowAmountInUSD > availableToBorrowUSD;
  const isSafeAmount = borrowAmountInUSD <= availableToBorrowUSD * 0.9; // 90% safety margin

  // Calculate new health factor after borrow
  // Handle infinity health factor (when no debt)
  const currentHealthFactor = accountData?.healthFactor === '∞' ? 999 : parseFloat(accountData?.healthFactor || '0');
  const totalCollateralUSD = parseFloat(accountData?.totalCollateralBase || '0');
  const totalDebtUSD = parseFloat(accountData?.totalDebtBase || '0');
  // liquidationThreshold already comes as decimal (0.6 = 60%) from formatUnits(data[3], 4)
  const liquidationThreshold = parseFloat(accountData?.currentLiquidationThreshold || '0');

  // New HF = (totalCollateral * liquidationThreshold) / (currentDebt + newBorrow)
  const newDebtUSD = totalDebtUSD + borrowAmountInUSD;
  const newHealthFactor = newDebtUSD > 0 && totalCollateralUSD > 0
    ? (totalCollateralUSD * liquidationThreshold) / newDebtUSD
    : currentHealthFactor > 0 ? currentHealthFactor : 999; // Use current HF or very high value if no debt

  const isHealthFactorWarning = newHealthFactor < 1.5; // Warning if HF below 1.5

  // Debug: log validation when amount changes
  if (amount && parseFloat(amount) > 0 && !((window as any).lastBorrowAmount === amount)) {
    (window as any).lastBorrowAmount = amount;
    console.log('💰 Borrow Validation:', {
      symbol,
      amountEntered: amount,
      borrowAmountInUSD: borrowAmountInUSD.toFixed(4),
      currentCollateralUSD: totalCollateralUSD.toFixed(4),
      currentDebtUSD: totalDebtUSD.toFixed(4),
      newDebtUSD: newDebtUSD.toFixed(4),
      liquidationThreshold: liquidationThreshold.toFixed(4),
      currentHealthFactor: currentHealthFactor.toFixed(2),
      newHealthFactor: newHealthFactor.toFixed(2),
      hfDirection: newHealthFactor < currentHealthFactor ? '📉 DECREASING' : '📈 INCREASING',
      maxByCollateralUSD: maxByCollateralUSD.toFixed(4),
      poolLiquidityUSD: poolLiquidityUSD.toFixed(4),
      availableToBorrowUSD: availableToBorrowUSD.toFixed(4),
      isExceedingLimit,
      isSafeAmount,
      isHealthFactorWarning
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">Занять {symbol}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning if no collateral but has deposits */}
          {activeSuppliedPositions.length > 0 && accountData && parseFloat(accountData.availableBorrowsBase) === 0 && (
            <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <svg className="w-6 h-6 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-orange-400 mb-2">
                    Вы еще не добавили активы в качестве залога
                  </h3>
                  <p className="text-xs text-gray-300 mb-3">
                    Чтобы занять токены, сначала добавьте ваши депозиты в качестве залога:
                  </p>
                  <div className="space-y-2">
                    {activeSuppliedPositions.map((position) => (
                      <div key={position.asset} className="flex items-center justify-between bg-slate-800/50 p-2 rounded">
                        <div className="flex items-center space-x-2">
                          <img
                            src={
                              position.assetConfig.symbol === 'USDT' ? '/img/usdt.png' :
                              position.assetConfig.symbol === 'WBTC' ? '/img/wbtc.svg' :
                              '/img/a7a5.png'
                            }
                            alt={position.assetConfig.symbol}
                            className="w-5 h-5 rounded-full"
                          />
                          <span className="text-sm text-white">{position.assetConfig.symbol}</span>
                          <span className="text-xs text-gray-400">
                            ({formatNumber(parseFloat(position.supplied), 2)})
                          </span>
                        </div>
                        <Button
                          onClick={async () => {
                            try {
                              await setUseAsCollateral(position.assetConfig.address as Address, true);
                              // Refresh data after enabling collateral
                              await queryClient.invalidateQueries();
                            } catch (error) {
                              console.error('Failed to enable collateral:', error);
                            }
                          }}
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-7 px-3"
                        >
                          Добавить
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-300">Количество</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>

          {/* Borrow Power Display */}
          {accountData && (
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg space-y-3">
              <div className="text-sm text-gray-300">
                <div className="flex justify-between mb-2">
                  <span>Доступно для займа:</span>
                  <span className="font-medium">
                    {symbol === 'wA7A5' ?
                      `₽${formatNumber(Math.round(availableToBorrowUSD * 90))}` :
                      symbol === 'WBTC' ?
                      `${formatNumber(availableToBorrowUSD / assetPriceUSD, 4)} BTC ($${formatNumber(Math.round(availableToBorrowUSD))})` :
                      `$${formatNumber(Math.round(availableToBorrowUSD))}`
                    }
                  </span>
                </div>

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

                    {/* New HF Indicator (when borrowing) - Always moves RIGHT (to lower HF) */}
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

          {/* Borrow Info */}
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg space-y-2">
            <div className="text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Процентная ставка:</span>
                <span className="text-orange-400 font-medium">
                  {reserveData?.currentVariableBorrowRate
                    ? `${parseFloat(reserveData.currentVariableBorrowRate).toFixed(2)}%`
                    : reserveConfig.rates.baseRate}
                </span>
              </div>
            </div>
          </div>

          {/* Risk Warnings */}
          {amount && (
            <div className="text-xs space-y-1">
              {isExceedingLimit && (
                <div className="text-red-400">
                  ❌ Превышает доступный лимит займа
                </div>
              )}
              {!isSafeAmount && !isExceedingLimit && (
                <div className="text-orange-400">
                  ⚠️ Высокая утилизация - рассмотрите меньшую сумму
                </div>
              )}
              {isHealthFactorWarning && !isExceedingLimit && (
                <div className="text-orange-400">
                  ⚠️ Health Factor ниже 1.5 - повышенный риск ликвидации
                </div>
              )}
              {isSafeAmount && !isHealthFactorWarning && (
                <div className="text-green-400">
                  ✅ Безопасная сумма займа
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleBorrow}
            disabled={
              !amount ||
              isExceedingLimit ||
              isLoading ||
              !address ||
              !accountData?.availableBorrowsBase ||
              parseFloat(accountData.availableBorrowsBase) === 0
            }
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 transition-all text-white"
            size="lg"
          >
            {isLoading ? (
              'Обработка...'
            ) : !address ? (
              'Подключить кошелек'
            ) : !accountData?.availableBorrowsBase || parseFloat(accountData.availableBorrowsBase) === 0 ? (
              'Нет залога'
            ) : isExceedingLimit ? (
              'Превышает лимит займа'
            ) : (
              `Занять ${symbol}`
            )}
          </Button>

          {/* Help Text */}
          {(!accountData?.availableBorrowsBase || parseFloat(accountData.availableBorrowsBase) === 0) && (
            <div className="text-xs text-gray-400 text-center">
              Сначала внесите залог, чтобы получить займ
            </div>
          )}
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
        action="borrow"
        amount={formatNumber(parseFloat(amount || '0'), 2)}
        symbol={symbol}
      />

      {/* Collateral Dialog - shown when trying to borrow without collateral */}
      <CollateralDialog
        open={showCollateralDialog}
        onOpenChange={setShowCollateralDialog}
        asset={activeSuppliedPositions.length > 0 ? activeSuppliedPositions[0].asset : undefined}
      />
    </Dialog>
  );
}