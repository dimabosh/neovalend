'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUserAccountData, useAavePool, useUserConfiguration } from '@/hooks/useAavePool'
import { useAccount, usePublicClient } from 'wagmi'
import { useState } from 'react'
import { Address } from 'viem'
import { RESERVE_ASSETS } from '@/config/contracts'
import { TransactionModal } from './TransactionModal'
import { useQueryClient } from '@tanstack/react-query'
import { useUserPositions } from '@/hooks/useUserPositions'

interface CollateralDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset?: keyof typeof RESERVE_ASSETS
}

export function CollateralDialog({ open, onOpenChange, asset }: CollateralDialogProps) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()
  const accountData = useUserAccountData(address)
  const { setUseAsCollateral } = useAavePool()
  const userConfig = useUserConfiguration(address)
  const { positions } = useUserPositions()

  const [isEnabling, setIsEnabling] = useState(false)
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [currentAsset, setCurrentAsset] = useState<keyof typeof RESERVE_ASSETS | undefined>(asset)

  // Check if any asset is already used as collateral
  const hasAnyCollateral = userConfig ?
    Object.values(RESERVE_ASSETS).some(reserve =>
      userConfig.isUsingAsCollateral(reserve.reserveIndex)
    ) : false

  // Get asset config for the currently selected asset
  const assetConfig = currentAsset ? RESERVE_ASSETS[currentAsset] : null
  const isAssetCollateral = assetConfig && userConfig ?
    userConfig.isUsingAsCollateral(assetConfig.reserveIndex) : false

  const handleEnableCollateral = async (assetKey?: keyof typeof RESERVE_ASSETS) => {
    const targetAsset = assetKey || currentAsset
    if (!address || !targetAsset) return

    const targetAssetConfig = RESERVE_ASSETS[targetAsset]
    if (!targetAssetConfig) return

    // Set current asset for TransactionModal display
    setCurrentAsset(targetAsset)
    setIsEnabling(true)
    setTxStatus('pending')

    try {
      console.log('🔓 Enabling collateral for', targetAssetConfig.symbol)
      console.log('  Asset:', targetAsset)
      console.log('  Token Address:', targetAssetConfig.address)
      console.log('  Reserve Index:', targetAssetConfig.reserveIndex)

      // Debug bitmap
      if (userConfig) {
        console.log('📊 User Configuration Debug:')
        console.log('  Bitmap value:', userConfig.bitmap.toString())
        console.log('  Bitmap hex:', '0x' + userConfig.bitmap.toString(16))
        console.log('  Bitmap binary:', userConfig.bitmap.toString(2).padStart(8, '0'))
        console.log('  isUsingAsCollateral(', targetAssetConfig.reserveIndex, '):', userConfig.isUsingAsCollateral(targetAssetConfig.reserveIndex))

        // Check all reserves
        console.log('  Checking all reserves:')
        for (let i = 0; i < 10; i++) {
          const isCollateral = userConfig.isUsingAsCollateral(i)
          if (isCollateral) {
            console.log(`    Reserve ${i}: COLLATERAL ✅`)
          }
        }
      }

      const hash = await setUseAsCollateral(targetAssetConfig.address as Address, true)
      console.log('📝 Transaction sent:', hash)
      console.log('  View on Sepolia:', `https://sepolia.etherscan.io/tx/${hash}`)

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
      } else {
        await new Promise(resolve => setTimeout(resolve, 15000))
      }

      console.log('✅ Collateral enabled')

      // Refresh data aggressively with specific query keys
      console.log('🔄 Invalidating queries...')

      // Invalidate specific queries for immediate update
      await queryClient.invalidateQueries({ queryKey: ['readContract'] })
      await queryClient.invalidateQueries({ queryKey: ['balance'] })

      // Wait longer for blockchain state to propagate
      console.log('⏳ Waiting for blockchain state update (5s)...')
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Force another complete refresh
      console.log('🔄 Second invalidation...')
      await queryClient.invalidateQueries()
      console.log('✅ Data refreshed')

      setTxStatus('success')

      setTimeout(() => {
        setTxStatus('idle')
        setIsEnabling(false)
        onOpenChange(false)

        // Final refresh after closing
        queryClient.invalidateQueries()
      }, 2000)

    } catch (error) {
      console.error('Failed to enable collateral:', error)
      setTxStatus('error')
      setTimeout(() => {
        setTxStatus('idle')
        setIsEnabling(false)
      }, 3000)
    }
  }

  // Get all available assets and their collateral status
  // Only show assets that have been deposited (balance > dust threshold)
  const dustThreshold = 0.01
  const allAssets = Object.entries(RESERVE_ASSETS)
    .map(([key, config]) => {
      const position = positions.find(p => p.asset === key)
      const suppliedAmount = position ? parseFloat(position.supplied) : 0

      return {
        key: key as keyof typeof RESERVE_ASSETS,
        config,
        isCollateral: userConfig ? userConfig.isUsingAsCollateral(config.reserveIndex) : false,
        hasDeposit: suppliedAmount >= dustThreshold,
        suppliedAmount
      }
    })
    .filter(asset => asset.hasDeposit) // Only show deposited assets

  // Format health factor to show ∞ if > 99.99, otherwise 2 decimal places
  const formatHealthFactor = (hf: string) => {
    if (hf === '∞') return '∞'
    const numHf = parseFloat(hf)
    return numHf > 99.99 ? '∞' : numHf.toFixed(2)
  }

  return (
    <>
      <Dialog open={open && txStatus === 'idle'} onOpenChange={onOpenChange}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Collateral Management
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Health Factor Display - always show if we have account data */}
            {accountData && (
              <div className="text-center pb-4 border-b border-slate-700">
                <div className="text-sm text-gray-400 mb-2">Health Factor</div>
                <div className={`text-5xl font-bold mb-2 ${
                  formatHealthFactor(accountData.healthFactor) === '∞' ? 'text-green-400' :
                  parseFloat(accountData.healthFactor) >= 2 ? 'text-green-400' :
                  parseFloat(accountData.healthFactor) >= 1.5 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {formatHealthFactor(accountData.healthFactor)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatHealthFactor(accountData.healthFactor) === '∞' ? 'No debt' : 'Liquidation risk at HF < 1.0'}
                </div>
              </div>
            )}

            {/* Assets list with their collateral status */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-400 mb-3">Available assets</div>

              {allAssets.map(({ key, config, isCollateral }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isCollateral
                      ? 'bg-green-900/20 border-green-700/50'
                      : 'bg-slate-700/50 border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isCollateral ? 'bg-green-600/20' : 'bg-slate-600/50'
                    }`}>
                      {isCollateral ? (
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isCollateral ? 'text-green-400' : 'text-white'}`}>
                        {config.symbol}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {isCollateral ? 'Active as collateral' : 'Not used'}
                      </div>
                    </div>
                  </div>

                  {!isCollateral && (
                    <Button
                      onClick={() => handleEnableCollateral(key)}
                      disabled={isEnabling || !address}
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                    >
                      Enable
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Close button */}
            <div className="pt-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                className="w-full bg-slate-700 hover:bg-slate-600 border-slate-600 text-white"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Modal */}
      <TransactionModal
        open={txStatus !== 'idle'}
        onOpenChange={(open) => {
          if (!open && txStatus !== 'pending') {
            setTxStatus('idle')
            setIsEnabling(false)
          }
        }}
        status={txStatus === 'idle' ? 'pending' : txStatus}
        action="enable-collateral"
        amount=""
        symbol={currentAsset ? RESERVE_ASSETS[currentAsset].symbol : ''}
      />
    </>
  )
}
