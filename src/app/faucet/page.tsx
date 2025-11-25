'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { formatNumber } from '@/lib/utils';
import { SEPOLIA_CONTRACTS, FAUCET_ABI, RESERVE_ASSETS } from '@/config/contracts';
import { Address } from 'viem';
import { TransactionModal } from '@/components/TransactionModal';

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const [selectedToken, setSelectedToken] = useState<'USDT' | 'wA7A5' | 'WBTC' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Check if user can request tokens for each token type
  const { data: canRequestUSDT, error: errorUSDT, isLoading: loadingUSDT } = useReadContract({
    address: SEPOLIA_CONTRACTS.FAUCET as Address,
    abi: FAUCET_ABI,
    functionName: 'canRequest',
    args: address ? [address, RESERVE_ASSETS.USDT.address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000, // Refresh every 5 seconds
    },
  });

  // Debug logging for USDT canRequest
  useEffect(() => {
    if (address && !loadingUSDT) {
      console.log('🔍 USDT canRequest:', {
        canRequest: canRequestUSDT,
        error: errorUSDT,
        faucetAddress: SEPOLIA_CONTRACTS.FAUCET,
        tokenAddress: RESERVE_ASSETS.USDT.address,
        userAddress: address,
      });
    }
  }, [canRequestUSDT, errorUSDT, loadingUSDT, address]);

  const { data: canRequestWA7A5 } = useReadContract({
    address: SEPOLIA_CONTRACTS.FAUCET as Address,
    abi: FAUCET_ABI,
    functionName: 'canRequest',
    args: address ? [address, RESERVE_ASSETS.wA7A5.address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  const { data: canRequestWBTC } = useReadContract({
    address: SEPOLIA_CONTRACTS.FAUCET as Address,
    abi: FAUCET_ABI,
    functionName: 'canRequest',
    args: address ? [address, RESERVE_ASSETS.WBTC.address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  });

  // Get time until next request for each token
  const { data: timeUntilUSDT } = useReadContract({
    address: SEPOLIA_CONTRACTS.FAUCET as Address,
    abi: FAUCET_ABI,
    functionName: 'timeUntilNextRequest',
    args: address ? [address, RESERVE_ASSETS.USDT.address] : undefined,
    query: {
      enabled: !!address && !canRequestUSDT,
      refetchInterval: 1000, // Refresh every second for countdown
    },
  });

  const { data: timeUntilWA7A5 } = useReadContract({
    address: SEPOLIA_CONTRACTS.FAUCET as Address,
    abi: FAUCET_ABI,
    functionName: 'timeUntilNextRequest',
    args: address ? [address, RESERVE_ASSETS.wA7A5.address] : undefined,
    query: {
      enabled: !!address && !canRequestWA7A5,
      refetchInterval: 1000,
    },
  });

  const { data: timeUntilWBTC } = useReadContract({
    address: SEPOLIA_CONTRACTS.FAUCET as Address,
    abi: FAUCET_ABI,
    functionName: 'timeUntilNextRequest',
    args: address ? [address, RESERVE_ASSETS.WBTC.address] : undefined,
    query: {
      enabled: !!address && !canRequestWBTC,
      refetchInterval: 1000,
    },
  });

  // Open modal when transaction starts
  useEffect(() => {
    if (isPending || isConfirming) {
      setModalOpen(true);
    }
  }, [isPending, isConfirming]);

  // Update modal on success/error
  useEffect(() => {
    if (isSuccess && modalOpen) {
      // Keep modal open to show success
    }
    if (error && modalOpen) {
      // Keep modal open to show error
    }
  }, [isSuccess, error, modalOpen]);

  // Format time remaining
  const formatTimeRemaining = (seconds: bigint | undefined): string => {
    if (!seconds || seconds === 0n) return '';

    const totalSeconds = Number(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}ч ${minutes}м`;
    } else if (minutes > 0) {
      return `${minutes}м ${secs}с`;
    } else {
      return `${secs}с`;
    }
  };

  const requestTokens = async (token: 'USDT' | 'wA7A5' | 'WBTC') => {
    if (!address) return;

    try {
      setSelectedToken(token);
      console.log('🚰 Requesting faucet tokens:', {
        token,
        faucetAddress: SEPOLIA_CONTRACTS.FAUCET,
        userAddress: address,
      });

      const functionName =
        token === 'USDT' ? 'requestUSDT' :
        token === 'wA7A5' ? 'requestWA7A5' :
        'requestWBTC';

      console.log('📝 Calling function:', functionName);

      writeContract({
        address: SEPOLIA_CONTRACTS.FAUCET as Address,
        abi: FAUCET_ABI,
        functionName,
      });
    } catch (error: any) {
      console.error('❌ Faucet request failed:', error);
      console.error('Error details:', {
        message: error?.message,
        cause: error?.cause,
        data: error?.data,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo - clickable */}
            <a href="/" className="text-lg sm:text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">
              ₽ubleN
            </a>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors text-sm"
                title="Главная"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden md:inline">Главная</span>
              </Link>

              <Link
                href="/faucet"
                className="flex items-center space-x-2 text-white transition-colors text-sm"
                title="Получить токены"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden md:inline">Получить токены</span>
              </Link>

              <a
                href="https://docs.neovalend.finance"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors text-sm"
                title="Документация"
              >
                <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="hidden md:inline">Документация</span>
              </a>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Mobile Burger Menu */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden p-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Меню"
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
                title="Поинты"
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
                        Подключить кошелек
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
                  <span>Главная</span>
                </Link>
                <Link
                  href="/faucet"
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-white bg-slate-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Получить токены</span>
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
                  <span>Документация</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Testnet Faucet</h1>
          <p className="text-gray-400 text-lg mb-6">
            Получите тестовые токены для использования в Neovalend Protocol
          </p>

          {/* Info Box - moved up */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 max-w-2xl mx-auto">
            <div className="text-sm text-gray-300 space-y-2 text-left">
              <p>• Тестовые токены можно получать раз в 24 часа</p>
              <p>• Эти токены не имеют реальной ценности</p>
              <p>• Используйте их только для тестирования на Sepolia Testnet</p>
              <p>• Не отправляйте реальные токены на testnet адреса</p>
            </div>
          </div>
        </div>

        {!isConnected ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Подключите кошелек</h2>
            <p className="text-gray-400 mb-6">
              Для получения тестовых токенов необходимо подключить кошелек
            </p>
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <Button
                  onClick={openConnectModal}
                  disabled={!mounted}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                >
                  Подключить кошелек
                </Button>
              )}
            </ConnectButton.Custom>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Token Cards - 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* wA7A5 Faucet - first */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <img src="/img/a7a5.png" alt="wA7A5" className="w-12 h-12 rounded-full" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">wA7A5</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Сумма:</span>
                    <span className="text-white font-medium">₽100 000</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ожидание:</span>
                    <span className="text-white font-medium">24 часа</span>
                  </div>
                  {!canRequestWA7A5 && timeUntilWA7A5 && timeUntilWA7A5 > 0n && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
                      <span className="text-yellow-400 text-sm font-medium">
                        ⏱️ Осталось: {formatTimeRemaining(timeUntilWA7A5)}
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={() => requestTokens('wA7A5')}
                    disabled={isPending || isConfirming || !canRequestWA7A5}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isPending ? 'Подтверждение...' : isConfirming ? 'Отправка...' : canRequestWA7A5 ? 'Получить wA7A5' : 'Недоступно'}
                  </Button>
                </div>
              </div>

              {/* USDT Faucet - second */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <img src="/img/usdt.png" alt="USDT" className="w-12 h-12 rounded-full" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">USDT</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Сумма:</span>
                    <span className="text-white font-medium">$1.000</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ожидание:</span>
                    <span className="text-white font-medium">24 часа</span>
                  </div>
                  {!canRequestUSDT && timeUntilUSDT && timeUntilUSDT > 0n && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
                      <span className="text-yellow-400 text-sm font-medium">
                        ⏱️ Осталось: {formatTimeRemaining(timeUntilUSDT)}
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={() => requestTokens('USDT')}
                    disabled={isPending || isConfirming || !canRequestUSDT}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isPending ? 'Подтверждение...' : isConfirming ? 'Отправка...' : canRequestUSDT ? 'Получить USDT' : 'Недоступно'}
                  </Button>
                </div>
              </div>

              {/* WBTC Faucet - third */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <img src="/img/wbtc.svg" alt="WBTC" className="w-12 h-12 rounded-full" />
                  <div>
                    <h3 className="text-lg font-semibold text-white">WBTC</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Сумма:</span>
                    <span className="text-white font-medium">₿0.1</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Ожидание:</span>
                    <span className="text-white font-medium">24 часа</span>
                  </div>
                  {!canRequestWBTC && timeUntilWBTC && timeUntilWBTC > 0n && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
                      <span className="text-yellow-400 text-sm font-medium">
                        ⏱️ Осталось: {formatTimeRemaining(timeUntilWBTC)}
                      </span>
                    </div>
                  )}
                  <Button
                    onClick={() => requestTokens('WBTC')}
                    disabled={isPending || isConfirming || !canRequestWBTC}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    size="lg"
                  >
                    {isPending ? 'Подтверждение...' : isConfirming ? 'Отправка...' : canRequestWBTC ? 'Получить WBTC' : 'Недоступно'}
                  </Button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open && !isPending && !isConfirming) {
            setModalOpen(false);
            setSelectedToken(null);
          }
        }}
        status={
          error ? 'error' :
          isSuccess ? 'success' :
          'pending'
        }
        transactionHash={hash}
        action="faucet"
        amount={
          selectedToken === 'USDT' ? '1 000' :
          selectedToken === 'wA7A5' ? '100 000' :
          selectedToken === 'WBTC' ? '0.1' :
          ''
        }
        symbol={selectedToken || ''}
      />
    </div>
  );
}
