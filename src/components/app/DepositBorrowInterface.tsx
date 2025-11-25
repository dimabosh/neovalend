'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { DatabaseService } from '@/lib/database'

type TabType = 'deposit' | 'borrow' | 'repay' | 'withdraw'
type TokenType = 'USDT' | 'A7A5'

export default function DepositBorrowInterface() {
  const { address } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('deposit')
  const [selectedToken, setSelectedToken] = useState<TokenType>('USDT')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { writeContract, data: hash, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const tabs = [
    { id: 'deposit', label: 'Депозит', color: 'blue' },
    { id: 'borrow', label: 'Заём', color: 'green' },
    { id: 'repay', label: 'Погасить', color: 'yellow' },
    { id: 'withdraw', label: 'Вывести', color: 'purple' }
  ] as const

  const tokens = [
    {
      symbol: 'USDT',
      name: 'Tether USD',
      icon: '💵',
      depositAPY: '5.5%',
      borrowAPY: '6.5%',
      balance: '0.00'
    },
    {
      symbol: 'A7A5',
      name: 'A7A5 Token',
      icon: '🚀',
      depositAPY: '11.0%',
      borrowAPY: '13.5%',
      balance: '0.00'
    }
  ]

  const selectedTokenInfo = tokens.find(t => t.symbol === selectedToken)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !address) return

    setIsLoading(true)
    try {
      // Mock contract interaction
      console.log(`${activeTab} ${amount} ${selectedToken}`)
      
      // Add points to database based on action
      let points = 0
      const amountNum = parseFloat(amount)
      
      switch (activeTab) {
        case 'deposit':
          points = Math.floor(amountNum * 10) // 10 points per $1 deposited
          break
        case 'borrow':
          points = Math.floor(amountNum * 5) // 5 points per $1 borrowed
          break
        case 'repay':
        case 'withdraw':
          points = Math.floor(amountNum * 2) // 2 points per $1 repaid/withdrawn
          break
      }

      if (points > 0) {
        // Map activeTab to database transaction types
        let dbTransactionType: 'deposit' | 'borrow' | 'swap' | 'liquidate' | 'wrap' | 'liquidity'
        switch (activeTab) {
          case 'deposit':
            dbTransactionType = 'deposit'
            break
          case 'borrow':
            dbTransactionType = 'borrow'
            break
          case 'repay':
          case 'withdraw':
            dbTransactionType = 'swap' // Use 'swap' for repay/withdraw operations
            break
          default:
            dbTransactionType = 'deposit'
        }

        await DatabaseService.addPoints(
          address,
          points,
          dbTransactionType,
          `mock_tx_${Date.now()}`, // Mock transaction hash
          12345678 // Mock block number
        )
      }

      // Reset form
      setAmount('')
      
      // Show success message
      alert(`${activeTab} выполнен успешно! Получено ${points} поинтов.`)
      
    } catch (error) {
      console.error('Transaction error:', error)
      alert('Ошибка транзакции')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="card-dark p-6 rounded-xl">
      {/* Tab Navigation */}
      <div className="flex space-x-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? `bg-${tab.color}-600 text-white`
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Token Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-400 mb-3">
          Выберите Токен
        </label>
        <div className="grid grid-cols-2 gap-3">
          {tokens.map((token) => (
            <button
              key={token.symbol}
              onClick={() => setSelectedToken(token.symbol as TokenType)}
              className={`p-4 rounded-lg border-2 transition-colors ${
                selectedToken === token.symbol
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 bg-gray-700/50 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{token.icon}</span>
                <div className="text-left">
                  <div className="text-white font-semibold">{token.symbol}</div>
                  <div className="text-xs text-gray-400">{token.name}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Amount Input */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Сумма
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              step="0.01"
              min="0"
              required
            />
            <div className="absolute right-3 top-3 text-gray-400">
              {selectedToken}
            </div>
          </div>
        </div>

        {/* Token Info */}
        {selectedTokenInfo && (
          <div className="bg-gray-800 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">APY (Депозит):</span>
              <span className="text-green-400">{selectedTokenInfo.depositAPY}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">APY (Заём):</span>
              <span className="text-yellow-400">{selectedTokenInfo.borrowAPY}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Баланс:</span>
              <span className="text-white">{selectedTokenInfo.balance} {selectedToken}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !amount}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
            activeTab === 'deposit' ? 'bg-blue-600 hover:bg-blue-700' :
            activeTab === 'borrow' ? 'bg-green-600 hover:bg-green-700' :
            activeTab === 'repay' ? 'bg-yellow-600 hover:bg-yellow-700' :
            'bg-purple-600 hover:bg-purple-700'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? 'Обработка...' : 
           activeTab === 'deposit' ? 'Внести Депозит' :
           activeTab === 'borrow' ? 'Взять Заём' :
           activeTab === 'repay' ? 'Погасить Заём' :
           'Вывести Средства'}
        </button>
      </form>

      {/* Transaction Status */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
          Ошибка: {error.message}
        </div>
      )}
      
      {isSuccess && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500 rounded-lg text-green-400 text-sm">
          Транзакция выполнена успешно!
        </div>
      )}
    </div>
  )
}