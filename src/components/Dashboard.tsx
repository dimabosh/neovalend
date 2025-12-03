'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAccount, useChainId } from 'wagmi';
import { Address } from 'viem';
import { SupplyDialog } from './SupplyDialog';
import { BorrowDialog } from './BorrowDialog';
import { RepayDialog } from './RepayDialog';
import { WithdrawDialog } from './WithdrawDialog';
import { CollateralDialog } from './CollateralDialog';
import { useUserAccountData, useReserveData, useTokenData, useAavePool, useUserConfiguration } from '@/hooks/useAavePool';
import { useUserPositions, useAssetPosition, useProtocolStats } from '@/hooks/useUserPositions';
import { RESERVE_ASSETS, getContractConfig } from '@/config/contracts';
import { formatNumber } from '@/lib/utils';

export function Dashboard() {
  const [supplyDialogOpen, setSupplyDialogOpen] = useState(false);
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [repayDialogOpen, setRepayDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [collateralDialogOpen, setCollateralDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<keyof typeof RESERVE_ASSETS>('USDT');
  
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  
  // Only log significant state changes
  if (isConnected && address && !(window as any).lastConnectedAddress) {
    console.log('✅ Wallet connected:', address);
    (window as any).lastConnectedAddress = address;
  }
  
  const accountData = useUserAccountData(address);
  const { activeSuppliedPositions, activeBorrowedPositions, hasSupplied, hasBorrowed } = useUserPositions();
  const protocolStats = useProtocolStats();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Get reserve data for all assets upfront (before any conditional rendering)
  const usdtReserveData = useReserveData(RESERVE_ASSETS.USDT.address as Address);
  const btcReserveData = useReserveData(RESERVE_ASSETS.BTC.address as Address);
  const wgasReserveData = useReserveData(RESERVE_ASSETS.WGAS.address as Address);

  // Debug: log account data when it changes
  if (accountData && !(window as any).lastAccountDataLog) {
    console.log('📊 Account Data from Contract:', {
      totalCollateralBase: accountData.totalCollateralBase,
      totalDebtBase: accountData.totalDebtBase,
      availableBorrowsBase: accountData.availableBorrowsBase,
      currentLiquidationThreshold: accountData.currentLiquidationThreshold,
      ltv: accountData.ltv,
      healthFactor: accountData.healthFactor
    });
    (window as any).lastAccountDataLog = true;
  }

  const openSupplyDialog = (asset: keyof typeof RESERVE_ASSETS) => {
    setSelectedAsset(asset);
    setSupplyDialogOpen(true);
  };

  const openBorrowDialog = (asset: keyof typeof RESERVE_ASSETS) => {
    // Check if user has any collateral enabled
    const hasCollateral = userConfig ?
      Object.values(RESERVE_ASSETS).some(reserve =>
        userConfig.isUsingAsCollateral(reserve.reserveIndex)
      ) : false;

    // If user has deposits but no collateral, show CollateralDialog instead
    if (!hasCollateral && activeSuppliedPositions.length > 0) {
      console.log('⚠️ No collateral, showing CollateralDialog instead of BorrowDialog');
      setSelectedAsset(activeSuppliedPositions[0].asset); // Select first deposit
      setCollateralDialogOpen(true);
      return;
    }

    setSelectedAsset(asset);
    setBorrowDialogOpen(true);
  };

  const openRepayDialog = (asset: keyof typeof RESERVE_ASSETS) => {
    setSelectedAsset(asset);
    setRepayDialogOpen(true);
  };

  const openWithdrawDialog = (asset: keyof typeof RESERVE_ASSETS) => {
    setSelectedAsset(asset);
    setWithdrawDialogOpen(true);
  };

  const openCollateralDialog = (asset: keyof typeof RESERVE_ASSETS) => {
    setSelectedAsset(asset);
    setCollateralDialogOpen(true);
  };

  // Get user configuration for collateral status
  const userConfig = useUserConfiguration(address);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Top Navigation */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo - clickable */}
            <a href="/" className="text-lg sm:text-xl font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">
              ₽ubleN
            </a>

            {/* Desktop Links */}
            <div className="hidden sm:flex items-center space-x-4">
              <a
                href="/faucet"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors text-sm"
                title="Получить токены"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Получить токены</span>
              </a>

              <a
                href="https://docs.neovalend.finance"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors text-sm"
                title="Документация"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>Документация</span>
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
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <a
                        href="/points"
                        className="flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border border-yellow-400/30 hover:border-yellow-400/50 transition-colors"
                        title="Поинты"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </a>

                      <Button
                        onClick={openChainModal}
                        variant="outline"
                        size="sm"
                        className="bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-600 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                      >
                        {chain.hasIcon && (
                          <div className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2">
                            {chain.iconUrl && (
                              <img
                                alt={chain.name ?? 'Chain icon'}
                                src={chain.iconUrl}
                                className="w-3 h-3 sm:w-4 sm:h-4"
                              />
                            )}
                          </div>
                        )}
                        <span className="hidden sm:inline">{chain.name}</span>
                        <span className="sm:hidden">{chain.name?.slice(0, 3)}</span>
                      </Button>

                      <Button
                        onClick={openAccountModal}
                        className="bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-600 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                        variant="outline"
                        size="sm"
                      >
                        <span className="hidden sm:inline">{account.displayName}</span>
                        <span className="sm:hidden">{account.displayName?.slice(0, 6)}</span>
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
                <a
                  href="/faucet"
                  className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-slate-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Получить токены</span>
                </a>

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Protocol Stats - Global data from contracts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Общие депозиты</div>
                <div className="text-2xl font-bold text-white">
                  ₽{formatNumber(Math.round(protocolStats.totalTVL * 90))}
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Общие займы</div>
                <div className="text-2xl font-bold text-white">
                  ₽{formatNumber(Math.round(protocolStats.totalBorrows * 90))}
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-6">
                <div className="text-sm text-gray-400 mb-2">Доступно для займа</div>
                <div className="text-2xl font-bold text-white">
                  ₽{formatNumber(Math.round(protocolStats.totalAvailable * 90))}
                </div>
              </div>
            </div>

            {/* Supplied and Borrowed Sections - Real Data - Only show if user has active positions (non-dust) */}
            {(activeSuppliedPositions.length > 0 || activeBorrowedPositions.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Supplied */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg overflow-visible">
                <div className="p-4 border-b border-slate-700">
                  <h2 className="text-lg font-semibold text-white">Мои депозиты</h2>
                </div>
                <div className="p-4 overflow-visible">
                  {activeSuppliedPositions.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm">Пока нет депозитов</p>
                    </div>
                  ) : (
                    <div className="space-y-3 overflow-visible">
                      {activeSuppliedPositions
                        .sort((a, b) => a.assetConfig.symbol === 'WGAS' ? -1 : 1)
                        .map((position) => {
                          // Get reserve data for this position (no hooks in map!)
                          const reserveData = position.asset === 'USDT' ? usdtReserveData :
                                            position.asset === 'BTC' ? btcReserveData :
                                            wgasReserveData;

                          return (
                        <div key={position.asset} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-700/30 rounded-lg gap-3">
                          <div className="flex items-center justify-between sm:justify-start">
                            <div className="flex items-center space-x-3">
                              <img
                                src={
                                  position.assetConfig.symbol === 'USDT' ? '/img/usdt.png' :
                                  position.assetConfig.symbol === 'BTC' ? '/img/wbtc.svg' :
                                  '/img/a7a5.png'
                                }
                                alt={position.assetConfig.symbol}
                                className="w-8 h-8 rounded-full"
                              />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-white">{position.assetConfig.symbol}</span>
                                  <div className="group relative">
                                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs px-1.5 py-0 cursor-help focus:ring-offset-0">
                                      {reserveData?.currentLiquidityRate
                                        ? `${parseFloat(reserveData.currentLiquidityRate).toFixed(2)}%`
                                        : position.assetConfig.rates.baseRate
                                      }
                                    </Badge>
                                    <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-700 border border-slate-600 rounded-lg text-xs text-gray-300 z-50 shadow-xl">
                                      Годовая процентная ставка (APY) за депозит. Проценты начисляются автоматически и увеличивают ваш баланс.
                                    </div>
                                  </div>
                                  {/* Collateral status icon */}
                                  <button
                                    onClick={() => openCollateralDialog(position.asset)}
                                    className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-700 transition-colors"
                                    title={userConfig?.isUsingAsCollateral(position.assetConfig.reserveIndex) ? 'Залог активен' : 'Не добавлен в залог'}
                                  >
                                    {userConfig?.isUsingAsCollateral(position.assetConfig.reserveIndex) ? (
                                      <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="text-right sm:hidden">
                              <div className="font-medium text-white text-sm">
                                {position.assetConfig.symbol === 'WGAS' ?
                                  `₽${formatNumber(parseFloat(position.supplied))}` :
                                position.assetConfig.symbol === 'BTC' ?
                                  `₿${formatNumber(parseFloat(position.supplied), 4)}` :
                                  `$${formatNumber(parseFloat(position.supplied))}`
                                }
                              </div>
                              <div className="text-xs text-gray-400">
                                {position.assetConfig.symbol === 'WGAS' ? '' :
                                position.assetConfig.symbol === 'BTC' ?
                                  `≈ ₽${formatNumber(parseFloat(position.supplied) * 120000 * 90)}` :
                                  `≈ ₽${formatNumber(parseFloat(position.supplied) * 90)}`
                                }
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end sm:space-x-6">
                            <div className="hidden sm:block text-right min-w-[120px]">
                              <div className="font-medium text-white">
                                {position.assetConfig.symbol === 'WGAS' ?
                                  `₽${formatNumber(parseFloat(position.supplied))}` :
                                position.assetConfig.symbol === 'BTC' ?
                                  `₿${formatNumber(parseFloat(position.supplied), 4)}` :
                                  `$${formatNumber(parseFloat(position.supplied))}`
                                }
                              </div>
                              <div className="text-sm text-gray-400">
                                {position.assetConfig.symbol === 'WGAS' ? '' :
                                position.assetConfig.symbol === 'BTC' ?
                                  `≈ ₽${formatNumber(parseFloat(position.supplied) * 120000 * 90)}` :
                                  `≈ ₽${formatNumber(parseFloat(position.supplied) * 90)}`
                                }
                              </div>
                            </div>
                            <div className="flex space-x-2 sm:flex-col sm:space-x-0 sm:space-y-1 w-full sm:w-auto">
                              <Button
                                onClick={() => openSupplyDialog(position.asset)}
                                size="sm"
                                className="bg-slate-700 hover:bg-slate-600 text-white border-0 text-xs flex-1 sm:flex-none sm:w-24"
                              >
                                Пополнить
                              </Button>
                              <Button
                                onClick={() => openWithdrawDialog(position.asset)}
                                size="sm"
                                className="bg-slate-700 hover:bg-slate-600 text-white border-0 text-xs flex-1 sm:flex-none sm:w-24"
                              >
                                Вывести
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Borrowed */}
              <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg overflow-visible">
                <div className="p-4 border-b border-slate-700">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold text-white">Мои займы</h2>
                    {accountData && hasBorrowed && (
                      <div className="flex items-center space-x-2 group relative">
                        <span className="text-sm text-gray-400">Health Factor</span>
                        <div className="cursor-help">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className={`font-semibold ${
                          accountData.healthFactor === '∞' || parseFloat(accountData.healthFactor) >= 99.99 ? 'text-green-400' :
                          parseFloat(accountData.healthFactor) > 2 ? 'text-green-400' :
                          parseFloat(accountData.healthFactor) > 1.2 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {accountData.healthFactor === '∞' || parseFloat(accountData.healthFactor) >= 99.99 ? '∞' : parseFloat(accountData.healthFactor).toFixed(2)}
                        </span>
                        <div className="invisible group-hover:visible absolute top-full right-0 mt-2 w-64 p-3 bg-slate-700 border border-slate-600 rounded-lg text-xs text-gray-300 z-10">
                          Health Factor показывает безопасность вашей позиции. Если он упадет ниже 1.0, ваш залог может быть ликвидирован. Чем выше значение, тем безопаснее ваша позиция.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 overflow-visible">
                  {activeBorrowedPositions.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm">Пока нет займов</p>
                    </div>
                  ) : (
                    <div className="space-y-3 overflow-visible">
                      {activeBorrowedPositions
                        .sort((a, b) => a.assetConfig.symbol === 'WGAS' ? -1 : 1)
                        .map((position) => {
                          // Get reserve data for this position (no hooks in map!)
                          const reserveData = position.asset === 'USDT' ? usdtReserveData :
                                            position.asset === 'BTC' ? btcReserveData :
                                            wgasReserveData;

                          return (
                        <div key={position.asset} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-700/30 rounded-lg gap-3">
                          <div className="flex items-center justify-between sm:justify-start">
                            <div className="flex items-center space-x-3">
                              <img
                                src={
                                  position.assetConfig.symbol === 'USDT' ? '/img/usdt.png' :
                                  position.assetConfig.symbol === 'BTC' ? '/img/wbtc.svg' :
                                  '/img/a7a5.png'
                                }
                                alt={position.assetConfig.symbol}
                                className="w-8 h-8 rounded-full"
                              />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-white">{position.assetConfig.symbol}</span>
                                  <div className="group relative">
                                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs px-1.5 py-0 cursor-help focus:ring-offset-0">
                                      {reserveData?.currentVariableBorrowRate
                                        ? `${parseFloat(reserveData.currentVariableBorrowRate).toFixed(2)}%`
                                        : position.assetConfig.rates.slope1
                                      }
                                    </Badge>
                                    <div className="invisible group-hover:visible absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-700 border border-slate-600 rounded-lg text-xs text-gray-300 z-50 shadow-xl">
                                      Годовая процентная ставка (APR) по займу. Проценты начисляются на сумму долга и увеличивают его со временем.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="text-right sm:hidden">
                              <div className="font-medium text-white text-sm">
                                {position.assetConfig.symbol === 'WGAS' ?
                                  `₽${formatNumber(parseFloat(position.borrowed))}` :
                                position.assetConfig.symbol === 'BTC' ?
                                  `₿${formatNumber(parseFloat(position.borrowed), 4)}` :
                                  `$${formatNumber(parseFloat(position.borrowed))}`
                                }
                              </div>
                              <div className="text-xs text-gray-400">
                                {position.assetConfig.symbol === 'WGAS' ? '' :
                                position.assetConfig.symbol === 'BTC' ?
                                  `≈ ₽${formatNumber(parseFloat(position.borrowed) * 120000 * 90)}` :
                                  `≈ ₽${formatNumber(parseFloat(position.borrowed) * 90)}`
                                }
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end sm:space-x-6">
                            <div className="hidden sm:block text-right min-w-[120px]">
                              <div className="font-medium text-white">
                                {position.assetConfig.symbol === 'WGAS' ?
                                  `₽${formatNumber(parseFloat(position.borrowed))}` :
                                position.assetConfig.symbol === 'BTC' ?
                                  `₿${formatNumber(parseFloat(position.borrowed), 4)}` :
                                  `$${formatNumber(parseFloat(position.borrowed))}`
                                }
                              </div>
                              <div className="text-sm text-gray-400">
                                {position.assetConfig.symbol === 'WGAS' ? '' :
                                position.assetConfig.symbol === 'BTC' ?
                                  `≈ ₽${formatNumber(parseFloat(position.borrowed) * 120000 * 90)}` :
                                  `≈ ₽${formatNumber(parseFloat(position.borrowed) * 90)}`
                                }
                              </div>
                            </div>
                            <div className="flex space-x-2 sm:flex-col sm:space-x-0 sm:space-y-1 w-full sm:w-auto">
                              <Button
                                onClick={() => openBorrowDialog(position.asset)}
                                size="sm"
                                className="bg-slate-700 hover:bg-slate-600 text-white border-0 text-xs flex-1 sm:flex-none sm:w-24"
                              >
                                Занять
                              </Button>
                              <Button
                                onClick={() => openRepayDialog(position.asset)}
                                size="sm"
                                className="bg-slate-700 hover:bg-slate-600 text-white border-0 text-xs flex-1 sm:flex-none sm:w-24"
                              >
                                Погасить
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* All Assets Table */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-xl font-semibold text-white">Все активы</h2>
                      <button
                        onClick={() => window.location.reload()}
                        className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors group"
                        title="Обновить данные"
                      >
                        <svg
                          className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-gray-400">Доступные активы для депозита и займа</p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400">Актив</th>
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400">Депозиты</th>
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400">Займы</th>
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400 hidden md:table-cell">Использовано</th>
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400 hidden md:table-cell">LTV</th>
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400">Депозит %</th>
                      <th className="text-left py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400">Займ %</th>
                      <th className="text-right py-3 px-3 sm:py-4 sm:px-6 text-xs sm:text-sm font-medium text-gray-400">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(RESERVE_ASSETS).map(([key, reserve]) => (
                      <AssetRow
                        key={key}
                        assetKey={key as keyof typeof RESERVE_ASSETS}
                        reserve={reserve}
                        protocolStats={protocolStats}
                        onSupply={() => openSupplyDialog(key as keyof typeof RESERVE_ASSETS)}
                        onBorrow={() => openBorrowDialog(key as keyof typeof RESERVE_ASSETS)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
      </div>

      {/* Dialogs */}
      <SupplyDialog
        open={supplyDialogOpen}
        onOpenChange={setSupplyDialogOpen}
        asset={selectedAsset}
      />
      
      <BorrowDialog
        open={borrowDialogOpen}
        onOpenChange={setBorrowDialogOpen}
        asset={selectedAsset}
      />

      <RepayDialog
        open={repayDialogOpen}
        onOpenChange={setRepayDialogOpen}
        asset={selectedAsset}
      />

      <WithdrawDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        asset={selectedAsset}
      />

      <CollateralDialog
        open={collateralDialogOpen}
        onOpenChange={setCollateralDialogOpen}
        asset={selectedAsset}
      />
    </div>
  );
}

interface AssetRowProps {
  assetKey: keyof typeof RESERVE_ASSETS;
  reserve: typeof RESERVE_ASSETS[keyof typeof RESERVE_ASSETS];
  protocolStats: ReturnType<typeof useProtocolStats>;
  onSupply: () => void;
  onBorrow: () => void;
}

function AssetRow({ assetKey, reserve, protocolStats, onSupply, onBorrow }: AssetRowProps) {
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  const { address } = useAccount();
  const { setUseAsCollateral } = useAavePool();

  const reserveData = useReserveData(reserve.address as Address);
  const tokenData = useTokenData(reserve.address as Address, config.contracts.POOL as Address, address);

  // Get collateral status
  const userConfig = useUserConfiguration(address);
  const isUsingAsCollateral = userConfig?.isUsingAsCollateral(reserve.reserveIndex) ?? false;

  // Debug logging
  if (address && !(window as any)[`assetDebug_${assetKey}`]) {
    console.log(`🔍 AssetRow Debug [${reserve.symbol}]:`, {
      assetKey,
      reserveAddress: reserve.address,
      userAddress: address,
      tokenBalance: tokenData.balance,
      rawBalance: tokenData.rawBalance,
      decimals: tokenData.decimals,
      symbol: tokenData.symbol
    });
    (window as any)[`assetDebug_${assetKey}`] = true;
  }

  // Get user position for this asset
  const assetPosition = useAssetPosition(assetKey);

  // Get protocol-wide stats for this asset
  const assetStats = protocolStats.stats.find(s => s.asset === assetKey);

  return (
    <tr className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
      <td className="py-3 pl-3 pr-10 sm:py-4 sm:pl-6 sm:pr-14">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <img
            src={
              reserve.symbol === 'USDT' ? '/img/usdt.png' :
              reserve.symbol === 'BTC' ? '/img/wbtc.svg' :
              '/img/a7a5.png'
            }
            alt={reserve.symbol}
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
          />
          <div>
            <div className="font-medium text-white text-xs sm:text-sm whitespace-nowrap">{reserve.symbol}</div>
          </div>
        </div>
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6">
        <div className="text-white text-xs sm:text-sm whitespace-nowrap">
          {assetStats ? (
            reserve.symbol === 'WGAS' ?
              `₽${formatNumber(Math.round(assetStats.supplyAmount))}` :
            reserve.symbol === 'BTC' ?
              `₿${formatNumber(assetStats.supplyAmount, 4)}` :
              `$${formatNumber(Math.round(assetStats.supplyAmount))}`
          ) : '0'}
        </div>
        {assetStats && assetStats.supplyAmount > 0 && reserve.symbol !== 'WGAS' && (
          <div className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
            ≈ ₽{formatNumber(Math.round(assetStats.supplyUSD * 90))}
          </div>
        )}
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6">
        <div className="text-white text-xs sm:text-sm whitespace-nowrap">
          {assetStats ? (
            reserve.symbol === 'WGAS' ?
              `₽${formatNumber(Math.round(assetStats.debtAmount))}` :
            reserve.symbol === 'BTC' ?
              `₿${formatNumber(assetStats.debtAmount, 4)}` :
              `$${formatNumber(Math.round(assetStats.debtAmount))}`
          ) : '0'}
        </div>
        {assetStats && assetStats.debtAmount > 0 && reserve.symbol !== 'WGAS' && (
          <div className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
            ≈ ₽{formatNumber(Math.round(assetStats.debtUSD * 90))}
          </div>
        )}
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6 hidden md:table-cell">
        <div className="text-white text-xs sm:text-sm whitespace-nowrap">
          {assetStats && assetStats.supplyAmount > 0 ?
            `${((assetStats.debtAmount / assetStats.supplyAmount) * 100).toFixed(2)}%`
            : '0.00%'
          }
        </div>
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6 hidden md:table-cell">
        <div className="text-white text-xs sm:text-sm whitespace-nowrap">
          {reserve.collateral.ltv}
        </div>
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6">
        <div className="font-medium text-green-400 text-xs sm:text-sm whitespace-nowrap">
          {reserveData?.currentLiquidityRate
            ? `${parseFloat(reserveData.currentLiquidityRate).toFixed(2)}%`
            : reserve.rates.baseRate
          }
        </div>
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6">
        <div className="font-medium text-orange-400 text-xs sm:text-sm whitespace-nowrap">
          {reserveData?.currentVariableBorrowRate
            ? `${parseFloat(reserveData.currentVariableBorrowRate).toFixed(2)}%`
            : reserve.rates.slope1
          }
        </div>
      </td>

      <td className="py-3 px-3 sm:py-4 sm:px-6 text-right">
        <div className="flex flex-col space-y-1 items-end">
          {/* Show "Deposit" button for all users */}
          <Button
            onClick={onSupply}
            size="sm"
            className="bg-slate-600/50 hover:bg-slate-600 text-white border-0 text-xs whitespace-nowrap w-24"
            disabled={!address}
          >
            {assetPosition.hasSupplied ?
              'Пополнить' :
              'Депозит'
            }
          </Button>

          {/* Show "Borrow" button - always visible (handled in BorrowDialog if no collateral) */}
          <Button
            onClick={onBorrow}
            size="sm"
            className="bg-slate-600/50 hover:bg-slate-600 text-white border-0 text-xs whitespace-nowrap w-24"
            disabled={!address}
          >
            Занять
          </Button>
        </div>
      </td>
    </tr>
  );
}