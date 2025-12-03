'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, Address } from 'viem';
import { RESERVE_ASSETS, SIMPLE_FAUCET_ADDRESS, SIMPLE_FAUCET_ABI } from '@/config/contracts';

// Helper function to get token logo
function getTokenLogo(symbol: string): string {
  switch (symbol) {
    case 'NEO': return '/img/neo.png';
    case 'USDT': return '/img/usdt.png';
    case 'USDC': return '/img/usdc.png';
    case 'ETH': return '/img/eth.png';
    case 'BTC': return '/img/btc.svg';
    default: return '/img/neo.png';
  }
}

// Token configuration for faucet
const FAUCET_TOKENS = [
  { symbol: 'NEO', name: 'NEO Token', claimAmount: '100' },
  { symbol: 'USDT', name: 'Tether USD', claimAmount: '1,000' },
  { symbol: 'USDC', name: 'USD Coin', claimAmount: '1,000' },
  { symbol: 'ETH', name: 'Ethereum', claimAmount: '1' },
  { symbol: 'BTC', name: 'Bitcoin', claimAmount: '0.1' },
];

function TokenCard({
  token,
  faucetAddress,
  userAddress
}: {
  token: typeof FAUCET_TOKENS[0];
  faucetAddress: Address;
  userAddress?: Address;
}) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const reserveAsset = RESERVE_ASSETS[token.symbol as keyof typeof RESERVE_ASSETS];
  const tokenAddress = reserveAsset?.address as Address;
  const decimals = reserveAsset?.decimals || 18;

  // Check if user can claim
  const { data: canClaimData, refetch: refetchCanClaim } = useReadContract({
    address: faucetAddress,
    abi: SIMPLE_FAUCET_ABI,
    functionName: 'canClaim',
    args: userAddress && tokenAddress ? [userAddress, tokenAddress] : undefined,
    query: {
      enabled: !!(userAddress && tokenAddress && faucetAddress),
      refetchInterval: 30000,
    }
  });

  // Get faucet balance for this token
  const { data: faucetBalance } = useReadContract({
    address: faucetAddress,
    abi: SIMPLE_FAUCET_ABI,
    functionName: 'getBalance',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: {
      enabled: !!(tokenAddress && faucetAddress),
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
      enabled: !!(tokenAddress && faucetAddress),
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
      refetchCanClaim();
    }
  }, [isSuccess, refetchCanClaim]);

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
    : token.claimAmount;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <img
            src={getTokenLogo(token.symbol)}
            alt={token.symbol}
            className="w-10 h-10 rounded-full"
          />
          <div>
            <div className="font-semibold text-white">{token.symbol}</div>
            <div className="text-xs text-gray-400">{token.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Claim Amount</div>
          <div className="text-white font-medium">{formattedClaimAmount}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
        <span>Faucet Balance:</span>
        <span>{formattedFaucetBalance} {token.symbol}</span>
      </div>

      {!userAddress ? (
        <Button
          disabled
          className="w-full bg-slate-700 text-gray-400"
        >
          Connect Wallet
        </Button>
      ) : !canClaim && timeUntilClaim > BigInt(0) ? (
        <Button
          disabled
          className="w-full bg-slate-700 text-gray-400"
        >
          Cooldown: {formatTimeRemaining(timeUntilClaim)}
        </Button>
      ) : (
        <Button
          onClick={handleClaim}
          disabled={isLoading || !canClaim}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {isConfirming ? 'Confirming...' : 'Claiming...'}
            </span>
          ) : (
            `Claim ${formattedClaimAmount} ${token.symbol}`
          )}
        </Button>
      )}
    </div>
  );
}

export default function FaucetPage() {
  const { address: userAddress, isConnected } = useAccount();

  const faucetAddress = SIMPLE_FAUCET_ADDRESS as Address;
  const isFaucetDeployed = Boolean(faucetAddress && faucetAddress.length > 2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <a href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity cursor-pointer">
              <img src="/img/logo_2.png" alt="NeovaLend" className="h-8 sm:h-10 w-auto object-contain" />
              <span className="text-lg sm:text-xl font-bold text-white">NeovaLend</span>
            </a>

            {/* Connect Button */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                if (!mounted || !account || !chain) {
                  return (
                    <Button
                      onClick={openConnectModal}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                    >
                      Connect Wallet
                    </Button>
                  )
                }

                if (chain.unsupported) {
                  return (
                    <Button
                      onClick={openChainModal}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Wrong network
                    </Button>
                  )
                }

                return (
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={openChainModal}
                      variant="outline"
                      size="sm"
                      className="bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-600 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                    >
                      {chain.hasIcon && chain.iconUrl && (
                        <img src={chain.iconUrl} alt={chain.name} className="w-4 h-4 mr-2" />
                      )}
                      {chain.name}
                    </Button>

                    <Button
                      onClick={openAccountModal}
                      variant="outline"
                      size="sm"
                      className="bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-600 font-mono text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                    >
                      {account.displayName}
                    </Button>
                  </div>
                )
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Testnet Token Faucet</h1>
          <p className="text-gray-400 text-lg mb-2">
            Get free testnet tokens to try NeovaLend on NEO X Testnet
          </p>
          <p className="text-gray-500 text-sm">
            24 hour cooldown between claims
          </p>
        </div>

        {!isFaucetDeployed ? (
          /* Faucet Not Deployed - Show setup instructions */
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 mb-8">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-yellow-400 font-semibold mb-2">Faucet Not Deployed</h3>
                <p className="text-gray-300 text-sm mb-3">
                  The faucet contract needs to be deployed. For now, you can get testnet GAS from the official NEO X faucet.
                </p>
                <a
                  href="https://neoxwish.ngd.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Get GAS from NEO X Faucet
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* Faucet Deployed - Show Token Cards */
          <>
            {!isConnected && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6 text-center">
                <p className="text-blue-400">Connect your wallet to claim tokens</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {FAUCET_TOKENS.map((token) => (
                <TokenCard
                  key={token.symbol}
                  token={token}
                  faucetAddress={faucetAddress}
                  userAddress={userAddress}
                />
              ))}
            </div>
          </>
        )}

        {/* GAS Faucet Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <img src="/img/gas.png" alt="GAS" className="w-10 h-10 rounded-full" />
          </div>

          <h2 className="text-xl font-semibold text-white mb-2">Need GAS for transactions?</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Get testnet GAS tokens from the official NEO X faucet to pay for transaction fees.
          </p>

          <a
            href="https://neoxwish.ngd.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Get GAS from NEO X Faucet
          </a>
        </div>
      </div>
    </div>
  );
}
