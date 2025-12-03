'use client'

import { useState } from 'react'
import { useNeovalendPool } from '@/hooks/useNeovalendPool'
import { useAccount } from 'wagmi'

interface BorrowModalProps {
  isOpen: boolean
  onClose: () => void
  token: 'USDT' | 'A7A5'
  tokenName: string
  borrowAPY: string
}

export default function BorrowModal({ 
  isOpen, 
  onClose, 
  token, 
  tokenName, 
  borrowAPY 
}: BorrowModalProps) {
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { address } = useAccount()
  const { 
    // borrowUSDT, 
    // borrowA7A5, 
    isPending, 
    isConfirming, 
    isSuccess,
    userBalances 
  } = useNeovalendPool()

  const handleBorrow = async () => {
    if (!amount || !address) return
    
    setIsLoading(true)
    try {
      // Временно показываем уведомление, пока не реализованы функции займа
      alert(`Borrow ${amount} ${token} will be available after smart contracts deployment`)
    } catch (error) {
      console.error('Borrow error:', error)
      alert('Error executing borrow')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMaxClick = () => {
    // Максимальная сумма займа основана на залоге пользователя
    setAmount(token === 'USDT' ? '500' : '2000')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            Borrow {token}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Token Info */}
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                <img 
                  src={token === 'USDT' ? '/img/usdt.png' : '/img/gas.png'} 
                  alt={token}
                  className="w-6 h-6 object-cover rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                    if (nextElement) {
                      nextElement.style.display = 'block'
                    }
                  }}
                />
                <span className="text-lg hidden">
                  {token === 'USDT' ? '💵' : '🚀'}
                </span>
              </div>
              <div>
                <div className="font-semibold text-white">{token}</div>
                <div className="text-sm text-gray-400">{tokenName}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-red-400 font-semibold">{borrowAPY}</div>
              <div className="text-xs text-gray-400">APY</div>
            </div>
          </div>
          
          {/* Special info for A7A5 */}
          {token === 'A7A5' && (
            <div className="mt-3 p-3 bg-gray-800/30 border border-gray-700/50 rounded-lg">
              <div className="text-sm text-gray-300">
                <div className="font-medium mb-1">Borrow A7A5 - features:</div>
                <div className="text-xs space-y-0.5">
                  <div>• Interest rate: +9% annually</div>
                  <div>• Rebase return: +3.5% annually</div>
                  <div className="font-medium text-gray-200">Total rate: {borrowAPY}</div>
                </div>
              </div>
            </div>
          )}
        </div>



        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Borrow Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-2 flex justify-between items-center text-xs">
            <span className="text-gray-400">
              Maximum: {token === 'USDT' ? '500.00' : '2,000.00'} {token}
            </span>
            <button
              onClick={handleMaxClick}
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Transaction Summary */}
        {amount && (
          <div className="bg-gray-800/30 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-300 space-y-2">
              <div className="flex justify-between">
                <span>Borrow:</span>
                <span className="text-white font-medium">{amount} {token}</span>
              </div>
              <div className="flex justify-between">
                <span>Interest rate:</span>
                <span className="text-red-400 font-medium">{borrowAPY}</span>
              </div>
              <div className="flex justify-between">
                <span>Interest to pay (yearly):</span>
                <span className="text-white font-medium">
                  {(parseFloat(amount) * parseFloat(borrowAPY.replace('%', '')) / 100).toFixed(2)} {token}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span>New health factor:</span>
                <span className="text-yellow-400 font-medium">2.45</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {!address ? (
            <div className="text-center py-3 text-gray-400">
              Connect your wallet to continue
            </div>
          ) : (
            <>
              <button
                onClick={handleBorrow}
                disabled={!amount || isLoading || isPending || isConfirming}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Preparing...' :
                 isPending ? 'Confirming in wallet...' :
                 isConfirming ? 'Processing transaction...' :
                 isSuccess ? 'Borrow received!' :
                 `Borrow ${token}`}
              </button>
              
              {/* Cancel Button */}
              <button
                onClick={onClose}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Transaction Status */}
        {isSuccess && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-800/50 rounded-lg">
            <div className="text-green-300 text-sm">
              Borrow received successfully! Monitor your health factor.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}