'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, Address } from 'viem';
import { RESERVE_ASSETS, SIMPLE_FAUCET_ADDRESS, SIMPLE_FAUCET_ABI } from '@/config/contracts';

interface GetTokensDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: keyof typeof RESERVE_ASSETS;
}

// Helper function to get icon
function getAssetIcon(symbol: string): string {
  switch (symbol) {
    case 'WGAS': return '/img/gas.png';
    case 'NEO': return '/img/neo.png';
    case 'USDT': return '/img/usdt.png';
    case 'USDC': return '/img/usdc.png';
    case 'ETH': return '/img/eth.png';
    case 'BTC': return '/img/btc.svg';
    default: return '/img/neo.png';
  }
}

export function GetTokensDialog({ open, onOpenChange, asset }: GetTokensDialogProps) {
  const { address: userAddress } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [claimSuccess, setClaimSuccess] = useState(false);

  const reserve = RESERVE_ASSETS[asset];
  const tokenAddress = reserve?.address as Address;
  const decimals = reserve?.decimals || 18;
  const faucetAddress = SIMPLE_FAUCET_ADDRESS as Address;
  const isFaucetDeployed = Boolean(faucetAddress && faucetAddress.length > 2);

  // Check if user can claim
  const { data: canClaimData, refetch: refetchCanClaim } = useReadContract({
    address: faucetAddress,
    abi: SIMPLE_FAUCET_ABI,
    functionName: 'canClaim',
    args: userAddress && tokenAddress ? [userAddress, tokenAddress] : undefined,
    query: {
      enabled: !!(userAddress && tokenAddress && isFaucetDeployed && open),
      refetchInterval: 10000,
    }
  });

  // Get faucet balance for this token
  const { data: faucetBalance } = useReadContract({
    address: faucetAddress,
    abi: SIMPLE_FAUCET_ABI,
    functionName: 'getBalance',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!(tokenAddress && isFaucetDeployed && open),
      refetchInterval: 30000,
    }
  });

  // Get claim amount
  const { data: claimAmount } = useReadContract({
    address: faucetAddress,
    abi: SIMPLE_FAUCET_ABI,
    functionName: 'claimAmounts',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!(tokenAddress && isFaucetDeployed && open),
    }
  });

  const { writeContractAsync } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) {
      setIsClaiming(false);
      setTxHash(undefined);
      setClaimSuccess(true);
      refetchCanClaim();
      // Auto-close after 2 seconds on success
      setTimeout(() => {
        setClaimSuccess(false);
        onOpenChange(false);
      }, 2000);
    }
  }, [isSuccess, refetchCanClaim, onOpenChange]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsClaiming(false);
      setTxHash(undefined);
      setClaimSuccess(false);
    }
  }, [open]);

  const handleClaim = async () => {
    if (!tokenAddress || !faucetAddress) return;

    try {
      setIsClaiming(true);
      const hash = await writeContractAsync({
        address: faucetAddress,
        abi: SIMPLE_FAUCET_ABI,
        functionName: 'claim',
        args: [tokenAddress],
      });
      setTxHash(hash);
    } catch (error) {
      console.error('Claim failed:', error);
      setIsClaiming(false);
    }
  };

  const canClaim = canClaimData?.[0] ?? false;
  const timeUntilClaim = canClaimData?.[1] ?? BigInt(0);
  const isLoading = isClaiming || isConfirming;

  // Format time remaining
  const formatTimeRemaining = (seconds: bigint) => {
    const secs = Number(seconds);
    if (secs <= 0) return '';
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Format balance
  const formattedFaucetBalance = faucetBalance
    ? parseFloat(formatUnits(faucetBalance as bigint, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

  const formattedClaimAmount = claimAmount
    ? parseFloat(formatUnits(claimAmount as bigint, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })
    : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <img
              src={getAssetIcon(reserve?.symbol || '')}
              alt={reserve?.symbol}
              className="w-8 h-8 rounded-full"
            />
            <span>Get {reserve?.symbol}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isFaucetDeployed ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-400">Faucet not deployed yet</p>
            </div>
          ) : claimSuccess ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400 font-semibold text-lg">Tokens Claimed!</p>
              <p className="text-gray-400 mt-2">
                {formattedClaimAmount} {reserve?.symbol} has been sent to your wallet
              </p>
            </div>
          ) : (
            <>
              {/* Claim Amount Info */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400">Claim Amount</span>
                  <span className="text-white font-semibold text-lg">
                    {formattedClaimAmount} {reserve?.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Faucet Balance</span>
                  <span className="text-gray-300">
                    {formattedFaucetBalance} {reserve?.symbol}
                  </span>
                </div>
              </div>

              {/* Cooldown Info */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-300">Cooldown Period</span>
                </div>
                <p className="text-sm text-gray-400">
                  You can claim tokens once every 24 hours per token type.
                </p>
              </div>

              {/* Status */}
              {!userAddress ? (
                <div className="text-center py-2">
                  <p className="text-yellow-400">Connect your wallet to claim</p>
                </div>
              ) : !canClaim && timeUntilClaim > BigInt(0) ? (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                  <p className="text-orange-400">
                    Cooldown active: {formatTimeRemaining(timeUntilClaim)} remaining
                  </p>
                </div>
              ) : !canClaim ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                  <p className="text-red-400">
                    Faucet has insufficient balance
                  </p>
                </div>
              ) : null}

              {/* Claim Button */}
              <Button
                onClick={handleClaim}
                disabled={isLoading || !canClaim || !userAddress}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {isConfirming ? 'Confirming...' : 'Claiming...'}
                  </span>
                ) : !userAddress ? (
                  'Connect Wallet'
                ) : !canClaim && timeUntilClaim > BigInt(0) ? (
                  `Cooldown: ${formatTimeRemaining(timeUntilClaim)}`
                ) : (
                  `Claim ${formattedClaimAmount} ${reserve?.symbol}`
                )}
              </Button>

              {/* Transaction Hash */}
              {txHash && (
                <div className="text-center">
                  <a
                    href={`https://xt4scan.ngd.network/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    View transaction on explorer
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
