'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, Address } from 'viem';
import { RESERVE_ASSETS, SIMPLE_FAUCET_ADDRESS, SIMPLE_FAUCET_ABI, ERC20_ABI } from '@/config/contracts';

// Token configuration for faucet
const FAUCET_TOKENS = [
  { symbol: 'NEO', name: 'NEO Token', icon: '🟢', claimAmount: '100' },
  { symbol: 'USDT', name: 'Tether USD', icon: '💵', claimAmount: '1,000' },
  { symbol: 'USDC', name: 'USD Coin', icon: '💲', claimAmount: '1,000' },
  { symbol: 'ETH', name: 'Ethereum', icon: '⟠', claimAmount: '1' },
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', claimAmount: '0.1' },
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
          <span className="text-2xl">{token.icon}</span>
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
            <a href="/" className="text-lg sm:text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">
              NeovaLend
            </a>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors text-sm"
                title="Home"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden md:inline">Home</span>
              </Link>

              <Link
                href="/faucet"
                className="flex items-center space-x-2 text-white transition-colors text-sm"
                title="Faucet"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden md:inline">Faucet</span>
              </Link>

              <a
                href="https://docs.neovalend.finance"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors text-sm"
                title="Docs"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="hidden md:inline">Docs</span>
              </a>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Mobile Burger Menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Menu"
              >
                {isMobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

              <a
                href="/points"
                className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border border-yellow-400/30 hover:border-yellow-400/50 transition-colors"
                title="Points"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </a>

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

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="sm:hidden border-t border-slate-700">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  href="/"
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Home</span>
                </Link>
                <Link
                  href="/faucet"
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-white bg-slate-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Faucet</span>
                </Link>
                <a
                  href="https://docs.neovalend.finance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span>Docs</span>
                </a>
              </div>
            </div>
          )}
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
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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

        {/* Network Info */}
        <div className="mt-8 bg-slate-800/30 border border-slate-700/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">NEO X Testnet Network Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Network Name:</span>
              <span className="text-white ml-2">NEO X Testnet</span>
            </div>
            <div>
              <span className="text-gray-400">Chain ID:</span>
              <span className="text-white ml-2">12227332</span>
            </div>
            <div>
              <span className="text-gray-400">RPC URL:</span>
              <span className="text-white ml-2 text-xs">https://neoxt4seed1.ngd.network/</span>
            </div>
            <div>
              <span className="text-gray-400">Currency:</span>
              <span className="text-white ml-2">GAS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
