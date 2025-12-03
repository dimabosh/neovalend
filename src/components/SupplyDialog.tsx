'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAccount, useWaitForTransactionReceipt, usePublicClient, useWriteContract } from 'wagmi';
import { Address, formatUnits } from 'viem';
import { useAavePool, useTokenData, useTokenApproval, useReserveData, useUserAccountData, useUserConfiguration } from '@/hooks/useAavePool';
import { RESERVE_ASSETS, getContractConfig, NEOX_TESTNET_CONTRACTS, POOL_ABI } from '@/config/contracts';
import { useChainId } from 'wagmi';
import { TransactionModal } from './TransactionModal';
import { formatNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

interface SupplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: keyof typeof RESERVE_ASSETS;
}

export function SupplyDialog({ open, onOpenChange, asset }: SupplyDialogProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [approvalStep, setApprovalStep] = useState<'idle' | 'approving' | 'approved'>('idle');
  const [collateralStep, setCollateralStep] = useState<'idle' | 'enabling'>('idle');
  const [isTogglingCollateral, setIsTogglingCollateral] = useState(false);
  const [collateralTxStatus, setCollateralTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [cleanupStep, setCleanupStep] = useState<'idle' | 'checking' | 'approving' | 'repaying' | 'completed'>('idle');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isFirstDeposit, setIsFirstDeposit] = useState(false); // Track if this is first deposit to calculate steps correctly
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: 'default' | 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => {},
  });

  const { address } = useAccount();
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { writeContractAsync: writeContract } = useWriteContract();

  const { supply, setUseAsCollateral: setCollateralStatus } = useAavePool();
  const { approve, approveMax } = useTokenApproval();

  const assetConfig = RESERVE_ASSETS[asset];
  const tokenAddress = assetConfig.address as Address;
  const poolAddress = config.contracts.POOL as Address;

  // 🔍 DEBUG: Log when asset prop changes
  console.log('🔍 [SupplyDialog] Component rendered/updated:', {
    asset,
    symbol: assetConfig.symbol,
    tokenAddress,
    reserveIndex: assetConfig.reserveIndex,
    open
  });

  // Get REAL collateral status from blockchain
  const userConfig = useUserConfiguration(address);
  const isUsingAsCollateral = userConfig?.isUsingAsCollateral(assetConfig.reserveIndex) ?? false;

  // Debug: log collateral status when dialog opens
  if (open && address && !((window as any)[`collateralDebug_${asset}_${address}`])) {
    console.log(`🔍 [${asset}] Collateral Debug:`, {
      reserveIndex: assetConfig.reserveIndex,
      bitmap: userConfig?.bitmap?.toString(16),
      isUsingAsCollateral,
      userConfigExists: !!userConfig,
      address
    });
    (window as any)[`collateralDebug_${asset}_${address}`] = true;
  }

  const {
    balance,
    allowance,
    decimals,
    symbol
  } = useTokenData(tokenAddress, poolAddress, address);

  // Get reserve data first to get aToken address
  const reserveData = useReserveData(tokenAddress);

  // Get aToken balance to check if user has deposits
  // aTokenAddress comes from reserveData (fetched from blockchain)
  const aTokenAddress = reserveData?.aTokenAddress as Address | undefined;
  const { balance: aTokenBalance } = useTokenData(aTokenAddress, undefined, address);

  // Reset isFirstDeposit when dialog opens and user already has deposits
  useEffect(() => {
    if (open && !isLoading && parseFloat(aTokenBalance) > 0 && isFirstDeposit) {
      setIsFirstDeposit(false);
    }
  }, [open, isLoading, aTokenBalance, isFirstDeposit]);

  // Check if user has ANY deposits (including dust)
  // For collateral toggle - show even for dust amounts
  // For display purposes - use meaningful balance check
  const aTokenBalanceNum = parseFloat(aTokenBalance);
  const minMeaningfulBalance = symbol === 'WGAS'
    ? 0.9 // ~$0.01 USD (1 A7A5 = $0.0111)
    : symbol === 'BTC'
    ? 0.00000008 // ~$0.01 USD (1 BTC = $120,000)
    : 0.01; // $0.01 USD for USDT

  const hasAnyDeposits = aTokenBalanceNum > 0; // ANY amount including dust
  const hasMeaningfulDeposits = aTokenBalanceNum >= minMeaningfulBalance; // Only meaningful amounts

  // Get user account data for Health Factor calculation
  const accountData = useUserAccountData(address);

  // Calculate new Health Factor after supply
  const supplyAmountInput = parseFloat(amount || '0');
  const supplyAmountInUSD = symbol === 'WGAS'
    ? supplyAmountInput * 0.0111
    : symbol === 'BTC'
    ? supplyAmountInput * 120000 // WBTC price: $120,000
    : supplyAmountInput; // USDT = $1

  // Handle infinity health factor (when no debt)
  const currentHealthFactor = accountData?.healthFactor === '∞' ? 999 : parseFloat(accountData?.healthFactor || '0');

  // Helper function to format HF display
  const formatHealthFactor = (hf: number) => {
    if (hf > 99.99 || hf === 999) return '∞';
    return hf.toFixed(2);
  };
  const totalCollateralUSD = parseFloat(accountData?.totalCollateralBase || '0');
  const totalDebtUSD = parseFloat(accountData?.totalDebtBase || '0');
  // currentLiquidationThreshold already comes as decimal (0.6 = 60%) from formatUnits(data[3], 4)
  const currentLiquidationThreshold = parseFloat(accountData?.currentLiquidationThreshold || '0');

  // Get liquidation threshold for this specific asset
  const assetLiquidationThreshold = parseFloat(assetConfig.collateral.liquidationThreshold.replace('%', '')) / 100;

  // Calculate weighted average liquidation threshold after adding new collateral
  // Formula: (currentCollateral * currentLT + newCollateral * newAssetLT) / totalNewCollateral
  const newCollateralUSD = totalCollateralUSD + supplyAmountInUSD;
  const newWeightedLiquidationThreshold = newCollateralUSD > 0
    ? ((totalCollateralUSD * currentLiquidationThreshold) + (supplyAmountInUSD * assetLiquidationThreshold)) / newCollateralUSD
    : assetLiquidationThreshold;

  // Calculate new health factor with weighted liquidation threshold
  // DEBT STAYS THE SAME when supplying (only collateral increases)
  // New HF = (newCollateral * newWeightedLT) / currentDebt
  // Since debt doesn't change, HF ALWAYS increases when supplying
  const newHealthFactor = totalDebtUSD > 0 && newCollateralUSD > 0
    ? (newCollateralUSD * newWeightedLiquidationThreshold) / totalDebtUSD
    : currentHealthFactor > 0 ? currentHealthFactor : 999; // Use current HF or very high value if no debt

  // Debug: log HF calculation when amount changes
  if (amount && parseFloat(amount) > 0 && !((window as any).lastSupplyAmount === amount)) {
    (window as any).lastSupplyAmount = amount;
    console.log('🔍 Supply HF Calculation:', {
      symbol,
      amountEntered: amount,
      supplyAmountInUSD: supplyAmountInUSD.toFixed(4),
      currentCollateralUSD: totalCollateralUSD.toFixed(4),
      currentDebtUSD: totalDebtUSD.toFixed(4),
      currentLT: currentLiquidationThreshold.toFixed(4),
      newCollateralUSD: newCollateralUSD.toFixed(4),
      newWeightedLT: newWeightedLiquidationThreshold.toFixed(4),
      currentHealthFactor: currentHealthFactor.toFixed(2),
      newHealthFactor: newHealthFactor.toFixed(2),
      hfDirection: newHealthFactor > currentHealthFactor ? '📈 INCREASING' : '📉 DECREASING'
    });
  }

  const handleSupply = async () => {
    if (!address || !amount) return;

    // Check if this will be first deposit (before supply happens)
    const willBeFirstDeposit = parseFloat(aTokenBalance) === 0;
    setIsFirstDeposit(willBeFirstDeposit);

    setIsLoading(true);

    try {
      // Check if approval is needed
      const amountNumber = parseFloat(amount);
      const allowanceNumber = parseFloat(allowance);

      if (amountNumber > allowanceNumber) {
        // Step 1: Approval (only for first deposit)
        setApprovalStep('approving');
        setTxStatus('pending');
        console.log(willBeFirstDeposit ? '🔓 Step 1/2: Approving token spending...' : '🔓 Approving token spending...');

        // Get approval transaction hash
        const approveHash = await approveMax(tokenAddress, poolAddress);
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

        setApprovalStep('approved');
        console.log(willBeFirstDeposit ? '✅ Step 1/2: Approval completed' : '✅ Approval completed');

        // Small delay before next step to ensure state is updated
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Step 2: Supply
      console.log(willBeFirstDeposit ? '🏦 Step 2/2: Supplying to pool...' : '🏦 Supplying to pool...');
      setTxStatus('pending');
      setApprovalStep('approved');

      // User confirms in wallet - this returns transaction hash
      const supplyHash = await supply(tokenAddress, amount, decimals);
      console.log('📝 Supply transaction sent:', supplyHash);

      // Wait for blockchain confirmation
      console.log('⏳ Waiting for supply confirmation...');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: supplyHash });
      } else {
        // Fallback: wait 15 seconds if publicClient not available
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      console.log('✅ Supply transaction confirmed on blockchain:', supplyHash);

      // Invalidate all queries to refresh data from blockchain
      console.log('🔄 Refreshing data from blockchain...');
      await queryClient.invalidateQueries();

      // Wait a bit for data to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('✅ Deposit successful');

      // Show success modal immediately
      setTxStatus('success');
      setCollateralStep('idle');

      // Close main dialog immediately (TransactionModal will stay open)
      onOpenChange(false);

      // Reset form state after delay
      setTimeout(() => {
        setAmount('');
        setTxStatus('idle');
        setApprovalStep('idle');
        setCollateralStep('idle');
        setIsFirstDeposit(false);
      }, 3000);

    } catch (error) {
      console.error('Supply failed:', error);
      setTxStatus('error');

      // Reset error state after delay
      setTimeout(() => {
        setTxStatus('idle');
        setApprovalStep('idle');
        setCollateralStep('idle');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaxClick = () => {
    setAmount(balance);
  };

  // Constants for dust threshold
  const dustThresholdUSD = 0.01;

  const handleCollateralToggle = async () => {
    if (!address) return;

    // Only allow enabling collateral, not disabling
    if (isUsingAsCollateral) {
      alert('ℹ️ Выключение залога временно недоступно\n\nВы можете только включать активы в качестве залога.');
      return;
    }

    const newStatus = true; // Always enabling

    setIsTogglingCollateral(true);
    setCollateralTxStatus('pending');

    try {
      // STEP 1: Clean up dust borrowing before enabling collateral
      if (newStatus && publicClient && address) {
        console.log('🔍 Checking for borrowing flags before enabling collateral...');
        console.log('📍 User address:', address);
        console.log('📍 Asset:', symbol, 'at', tokenAddress);

        // Get user configuration to check borrowing flag
        const userConfig = await publicClient.readContract({
          address: NEOX_TESTNET_CONTRACTS.POOL as Address,
          abi: POOL_ABI,
          functionName: 'getUserConfiguration',
          args: [address],
        });

        console.log('📊 User config bitmap:', userConfig?.toString());
        console.log('📊 User config hex:', '0x' + Number(userConfig).toString(16));

        // Check if borrowing bit is set for this reserve
        const reserveIndex = assetConfig.reserveIndex;
        const borrowingBit = (Number(userConfig) >> (reserveIndex * 2 + 1)) & 1;

        console.log(`📌 ${symbol} (Reserve ${reserveIndex}):`);
        console.log(`   Borrowing bit position: ${reserveIndex * 2 + 1}`);
        console.log(`   Borrowing bit value: ${borrowingBit}`);
        console.log(`   Calculation: (${Number(userConfig)} >> ${reserveIndex * 2 + 1}) & 1 = ${borrowingBit}`);

        if (borrowingBit === 1) {
          console.log(`⚠️ Borrowing flag detected for ${symbol} (reserve ${reserveIndex}), checking debt...`);

          // Get variable debt balance from reserveData (blockchain)
          const debtTokenAddress = reserveData?.variableDebtTokenAddress as Address | undefined;
          if (!debtTokenAddress) {
            console.log('⚠️ No debt token address available');
            return;
          }
          const debtBalance = await publicClient.readContract({
            address: debtTokenAddress,
            abi: [{
              inputs: [{ name: 'account', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            }],
            functionName: 'balanceOf',
            args: [address],
          });

          // Set cleanup steps for UI
          setCleanupStep('checking');
          setCollateralTxStatus('pending');

          if (debtBalance && debtBalance > 0n) {
            // Case 1: Real debt - need to repay exact amount
            const debtAmount = parseFloat(formatUnits(debtBalance, assetConfig.decimals));
            console.log(`💸 Found real debt: ${debtAmount} ${symbol}`);

            // Repay dust amount + 5% margin to ensure full repayment
            const repayAmount = (debtBalance * 105n) / 100n;
            console.log(`🧹 Step 1/2: Repaying ${formatUnits(repayAmount, assetConfig.decimals)} ${symbol} to clear borrowing flag...`);

            // Check if user has enough token balance to repay
            const tokenBalance = await publicClient.readContract({
              address: tokenAddress,
              abi: [{
                inputs: [{ name: 'owner', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function',
              }],
              functionName: 'balanceOf',
              args: [address],
            });

            // Check if user has enough balance
            if (tokenBalance < repayAmount) {
              console.log(`⚠️ Insufficient ${symbol} balance for repayment`);
              setCollateralTxStatus('error');
              setIsTogglingCollateral(false);
              setCleanupStep('idle');
              alert(`⚠️ Недостаточно ${symbol} для погашения долга\n\nТребуется: ${formatUnits(repayAmount, assetConfig.decimals)} ${symbol}\nВаш баланс: ${formatUnits(tokenBalance, assetConfig.decimals)} ${symbol}\n\nПополните баланс и попробуйте снова.`);
              return;
            }

            // Approve Pool to spend tokens
            setCleanupStep('approving');
            const approveHash = await writeContract({
              address: tokenAddress,
              abi: [{
                inputs: [
                  { name: 'spender', type: 'address' },
                  { name: 'amount', type: 'uint256' }
                ],
                name: 'approve',
                outputs: [{ name: '', type: 'bool' }],
                stateMutability: 'nonpayable',
                type: 'function',
              }],
              functionName: 'approve',
              args: [NEOX_TESTNET_CONTRACTS.POOL, repayAmount],
            });

            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            console.log('✅ Approved for repayment');

            // Repay debt to clear borrowing flag
            setCleanupStep('repaying');
            const repayHash = await writeContract({
              address: NEOX_TESTNET_CONTRACTS.POOL as Address,
              abi: POOL_ABI,
              functionName: 'repay',
              args: [
                tokenAddress,
                repayAmount,
                2n, // Variable rate mode
                address,
              ],
            });

            await publicClient.waitForTransactionReceipt({ hash: repayHash });
            console.log('✅ Step 1/2 Complete: Debt repaid, borrowing flag cleared');
            setCleanupStep('completed');

            // Wait for state to update
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (!debtBalance || debtBalance === 0n) {
            // Case 2: Debt = 0 but borrowing flag set (stuck flag from previous borrow)
            console.log('⚠️ Borrowing flag set but debt = 0 (stuck flag from previous borrow)');
            console.log('🔧 Need supply operation to clear the flag...');

            // Show supply dialog to clear the stuck flag
            setCollateralTxStatus('idle');
            setIsTogglingCollateral(false);
            setCleanupStep('idle');

            // Show alert explaining the situation
            const shouldProceed = confirm(
              `⚠️ Обнаружен технический флаг для ${symbol}\n\n` +
              `Это происходит когда вы ранее брали займ и полностью погасили его.\n\n` +
              `Для активации залога нужно сделать пополнение любой суммы.\n` +
              `После пополнения залог активируется автоматически.\n\n` +
              `Открыть диалог пополнения?`
            );

            if (shouldProceed) {
              // Close collateral toggle, open supply dialog
              // User will supply, then after supply we'll auto-enable collateral
              console.log('💡 User will supply to clear stuck flag');

              // Set a flag that after next supply, we should enable collateral
              sessionStorage.setItem(`enableCollateralAfterSupply_${symbol}`, 'true');

              // Open supply dialog (onOpenChange is already bound to SupplyDialog)
              onOpenChange(true);
            }

            return;
          } else {
            // Case 3: Debt is very small dust (like 2014 wei)
            // For dust amounts, repay exact amount + 10% instead of maxUint256
            const dustDebt = debtBalance;
            const repayDustAmount = (dustDebt * 110n) / 100n; // +10% to ensure full repayment

            console.log(`ℹ️ Borrowing flag set with dust debt: ${dustDebt.toString()} wei (${formatUnits(dustDebt, assetConfig.decimals)} ${symbol})`);
            console.log(`🧹 Step 1/2: Repaying dust debt ${formatUnits(repayDustAmount, assetConfig.decimals)} ${symbol}...`);

            // Repay the dust amount
            setCleanupStep('repaying');
            const repayHash = await writeContract({
              address: NEOX_TESTNET_CONTRACTS.POOL as Address,
              abi: POOL_ABI,
              functionName: 'repay',
              args: [
                tokenAddress,
                repayDustAmount, // Repay exact dust amount + 10%
                2n, // Variable rate mode
                address,
              ],
            });

            await publicClient.waitForTransactionReceipt({ hash: repayHash });
            console.log('✅ Step 1/2 Complete: Dust debt cleared');
            setCleanupStep('completed');

            // Wait for state to update
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // STEP 2: Enable/disable collateral
      console.log(`🔄 ${isUsingAsCollateral ? 'Disabling' : 'Enabling'} ${symbol} as collateral...`);
      console.log('  Current asset prop:', asset);
      console.log('  Current symbol:', symbol);
      console.log('  Token address being used:', tokenAddress);
      console.log('  Expected token for', asset, ':', RESERVE_ASSETS[asset].address);
      console.log('  ❓ Are they equal?', tokenAddress === RESERVE_ASSETS[asset].address);
      const txHash = await setCollateralStatus(tokenAddress, newStatus);
      console.log('📝 Collateral transaction sent:', txHash);

      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }

      console.log(`✅ Collateral status updated for ${symbol}`);

      // Show success modal immediately
      setCollateralTxStatus('success');
      console.log('✅ Showing success modal');

      // Refresh data from blockchain in background (while success modal is showing)
      console.log('🔄 Refreshing data from blockchain in background...');
      await queryClient.invalidateQueries();

      // Additional delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log('✅ Data refreshed, UI should update now');

      // Reset after delay (modal stays open for 3 seconds total)
      setTimeout(() => {
        setCollateralTxStatus('idle');
        setIsTogglingCollateral(false);
      }, 3000);

    } catch (error) {
      console.error('Failed to toggle collateral:', error);
      setCollateralTxStatus('error');

      // Reset error state after delay
      setTimeout(() => {
        setCollateralTxStatus('idle');
        setIsTogglingCollateral(false);
      }, 3000);
    }
  };

  const isInsufficientBalance = parseFloat(amount || '0') > parseFloat(balance);
  const needsApproval = parseFloat(amount || '0') > parseFloat(allowance);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">Пополнить {symbol}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-gray-300">Количество</Label>
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
                МАКС
              </Button>
            </div>
          </div>

          {/* Balance Display */}
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Баланс: {formatNumber(parseFloat(balance), 2)} {symbol}</span>
            {parseFloat(balance) === 0 && (
              <a
                href="/faucet"
                className="text-blue-400 hover:text-blue-300 text-xs underline"
              >
                Получить тестовые токены →
              </a>
            )}
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
                          {formatHealthFactor(currentHealthFactor)} → {formatHealthFactor(newHealthFactor)}
                        </>
                      ) : (
                        formatHealthFactor(currentHealthFactor)
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

                    {/* New HF Indicator (when supplying) - Always moves LEFT (to higher HF) */}
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

          {/* Supply Info */}
          <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-lg space-y-2">
            <div className="text-sm text-gray-300">
              <div className="flex justify-between">
                <span>Доход APY:</span>
                <span className="text-green-400 font-medium">
                  {reserveData?.currentLiquidityRate
                    ? `${parseFloat(reserveData.currentLiquidityRate).toFixed(2)}%`
                    : '~5%'}
                </span>
              </div>
            </div>
          </div>


          {/* Transaction Details */}
          {amount && (
            <div className="text-xs text-gray-400 space-y-1">
              <div>Вы получите: r{symbol} токены</div>
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={handleSupply}
            disabled={!amount || isInsufficientBalance || isLoading || !address}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 disabled:opacity-50 transition-all text-white"
            size="lg"
          >
            {isLoading ? (
              'Обработка...'
            ) : !address ? (
              'Подключить кошелек'
            ) : isInsufficientBalance ? (
              'Недостаточно средств'
            ) : needsApproval ? (
              `Подтвердить и пополнить ${symbol}`
            ) : (
              `Пополнить ${symbol}`
            )}
          </Button>
        </div>
      </DialogContent>

      {/* Transaction Status Modal */}
      <TransactionModal
        open={txStatus !== 'idle'}
        onOpenChange={(open) => {
          if (!open && txStatus !== 'pending') {
            setTxStatus('idle');
            setApprovalStep('idle');
            setCollateralStep('idle');
            setIsFirstDeposit(false);
          }
        }}
        status={txStatus === 'idle' ? 'pending' : txStatus}
        action={
          approvalStep === 'approving' ? 'approve' :
          collateralStep === 'enabling' ? 'approve' :
          'supply'
        }
        amount={formatNumber(parseFloat(amount || '0'), 2)}
        symbol={symbol}
        step={
          isFirstDeposit && approvalStep === 'approving' ? '1/2' :
          isFirstDeposit && approvalStep === 'approved' && txStatus === 'pending' ? '2/2' :
          undefined
        }
        stepDescription={
          isFirstDeposit && approvalStep === 'approving' ? 'Подтверждение токена' :
          isFirstDeposit && approvalStep === 'approved' && txStatus === 'pending' ? 'Пополнение' :
          undefined
        }
        successMessage={successMessage || undefined
        }
      />

      {/* Collateral Choice Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => {
        if (!open) {
          // User clicked outside or pressed Escape = NO
          setConfirmDialog(prev => ({ ...prev, open: false }));
          setAmount('');
          setTxStatus('idle');
          setApprovalStep('idle');
          setCollateralStep('idle');
          onOpenChange(false);
        }
      }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-semibold text-center">
              {confirmDialog.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <p className="text-gray-300 text-center">
              {confirmDialog.description}
            </p>

            <div className="flex space-x-3">
              <Button
                onClick={() => {
                  // User chose "Отмена" - show success and close
                  setConfirmDialog(prev => ({ ...prev, open: false }));
                  setTxStatus('success');

                  // Close main dialog immediately (TransactionModal will stay open)
                  onOpenChange(false);

                  // Reset state after showing success
                  setTimeout(() => {
                    setAmount('');
                    setTxStatus('idle');
                    setApprovalStep('idle');
                    setCollateralStep('idle');
                  }, 3000);
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
                size="lg"
              >
                Отмена
              </Button>
              <Button
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                size="lg"
              >
                Активировать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Collateral Transaction Status Modal */}
      <TransactionModal
        open={collateralTxStatus !== 'idle'}
        onOpenChange={(open) => {
          if (!open && collateralTxStatus !== 'pending') {
            setCollateralTxStatus('idle');
            setIsTogglingCollateral(false);
            setCleanupStep('idle');
          }
        }}
        status={collateralTxStatus === 'idle' ? 'pending' : collateralTxStatus}
        action={isUsingAsCollateral ? 'disable-collateral' : 'enable-collateral'}
        amount=""
        symbol={symbol}
        step={
          cleanupStep === 'checking' ? 'Шаг 1/2: Проверка долга...' :
          cleanupStep === 'approving' ? 'Шаг 1/2: Подтверждение погашения...' :
          cleanupStep === 'repaying' ? 'Шаг 1/2: Погашение долга...' :
          cleanupStep === 'completed' ? 'Шаг 2/2: Активация залога...' :
          undefined
        }
      />
    </Dialog>
  );
}