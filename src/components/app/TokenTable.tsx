'use client'

import { useState } from 'react'
import { useNeovalendPool } from '@/hooks/useNeovalendPool'
import { useAccount } from 'wagmi'
import DepositModal from './DepositModal'
import BorrowModal from './BorrowModal'

interface TokenData {
  symbol: string
  name: string
  icon: string
  totalSupplied: string
  totalSuppliedUSD: string
  supplyAPY: string
  totalBorrowed: string
  totalBorrowedUSD: string
  borrowAPY: string
  rewardAPY?: string
}

export default function TokenTable() {
  const [searchTerm, setSearchTerm] = useState('')
  const [depositModal, setDepositModal] = useState<{ isOpen: boolean, token: 'USDT' | 'A7A5', tokenName: string, supplyAPY: string }>({
    isOpen: false,
    token: 'USDT',
    tokenName: '',
    supplyAPY: ''
  })
  const [borrowModal, setBorrowModal] = useState<{ isOpen: boolean, token: 'USDT' | 'A7A5', tokenName: string, borrowAPY: string }>({
    isOpen: false,
    token: 'USDT',
    tokenName: '',
    borrowAPY: ''
  })

  const tokens: TokenData[] = [
    {
      symbol: 'A7A5',
      name: 'A7A5 Token',
      icon: '/img/a7a5.png',
      totalSupplied: '1.2M',
      totalSuppliedUSD: '₽240M',
      supplyAPY: '10.5%',
      totalBorrowed: '600K',
      totalBorrowedUSD: '₽120M',
      borrowAPY: '12.5%'
    },
    {
      symbol: 'USDT',
      name: 'Tether USD',
      icon: '/img/usdt.png',
      totalSupplied: '847.2K',
      totalSuppliedUSD: '₽84.7M',
      supplyAPY: '5.0%',
      totalBorrowed: '423.1K', 
      totalBorrowedUSD: '₽42.3M',
      borrowAPY: '7.0%'
    }
  ]

  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openDepositModal = (token: TokenData) => {
    setDepositModal({
      isOpen: true,
      token: token.symbol as 'USDT' | 'A7A5',
      tokenName: token.name,
      supplyAPY: token.supplyAPY
    })
  }

  const openBorrowModal = (token: TokenData) => {
    setBorrowModal({
      isOpen: true,
      token: token.symbol as 'USDT' | 'A7A5',
      tokenName: token.name,
      borrowAPY: token.borrowAPY
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-white">Активы протокола</h2>
      </div>

      {/* Table */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
            {/* Header */}
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Токен
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  Всего предоставлено
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  APY депозита
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  Всего займов
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  APY займа
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  Действия
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {filteredTokens.map((token, index) => (
                <tr 
                  key={token.symbol}
                  className={`border-t border-gray-800 hover:bg-gray-800/30 transition-colors ${
                    index % 2 === 0 ? 'bg-gray-900/20' : ''
                  }`}
                >
                  {/* Token */}
                  <td className="py-6 px-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden">
                        <img 
                          src={token.icon} 
                          alt={token.symbol}
                          className="w-12 h-12 object-cover rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                            if (nextElement) {
                              nextElement.style.display = 'block'
                            }
                          }}
                        />
                        <span className="text-2xl hidden">
                          {token.symbol === 'USDT' ? '💵' : '🚀'}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-white">{token.symbol}</div>
                        <div className="text-sm text-gray-400">{token.name}</div>
                      </div>
                    </div>
                  </td>

                  {/* Total Supplied */}
                  <td className="py-6 px-6 text-right">
                    <div className="font-semibold text-white">{token.totalSupplied}</div>
                    <div className="text-sm text-gray-400">{token.totalSuppliedUSD}</div>
                  </td>

                  {/* Supply APY */}
                  <td className="py-6 px-6 text-right">
                    <div className="relative group">
                      <div className={`font-semibold text-white ${token.symbol === 'A7A5' ? 'cursor-help' : ''}`}>
                        {token.supplyAPY}
                      </div>
                      
                      {/* Deposit Tooltip - only for A7A5 */}
                      {token.symbol === 'A7A5' && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                          <div className="text-xs text-white">
                            <div className="font-medium mb-1 text-white">
                              Депозит A7A5:
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-white">Ставка: +7%</div>
                              <div className="text-yellow-500">Возврат ребейза: +3.5%</div>
                              <div className="text-white font-medium mt-1 pt-1 border-t border-gray-700">Итого: 10.5%</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Total Borrowed */}
                  <td className="py-6 px-6 text-right">
                    <div className="font-semibold text-white">{token.totalBorrowed}</div>
                    <div className="text-sm text-gray-400">{token.totalBorrowedUSD}</div>
                  </td>

                  {/* Borrow APY */}
                  <td className="py-6 px-6 text-right">
                    <div className="relative group">
                      <div className={`font-semibold text-white ${token.symbol === 'A7A5' ? 'cursor-help' : ''}`}>{token.borrowAPY}</div>
                      
                      {/* Borrow Tooltip - only for A7A5 */}
                      {token.symbol === 'A7A5' && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                          <div className="text-xs text-white">
                            <div className="font-medium mb-1 text-white">
                              Займ A7A5:
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-white">Ставка: +9%</div>
                              <div className="text-red-400">Возврат ребейза: +3.5%</div>
                              <div className="text-white font-medium mt-1 pt-1 border-t border-gray-700">Итого: 12.5%</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-6 px-6 text-right">
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => openDepositModal(token)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Депозит
                      </button>
                      <button 
                        onClick={() => openBorrowModal(token)}
                        className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        Займ
                      </button>
                      <button 
                        onClick={() => alert('Обмен скоро будет доступен')}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
                        </svg>
                        Обмен
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>

      {/* No results */}
      {filteredTokens.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-4">🔍</div>
          <div>Токены не найдены</div>
        </div>
      )}

      {/* Modals */}
      <DepositModal
        isOpen={depositModal.isOpen}
        onClose={() => setDepositModal({ ...depositModal, isOpen: false })}
        token={depositModal.token}
        tokenName={depositModal.tokenName}
        supplyAPY={depositModal.supplyAPY}
      />
      
      <BorrowModal
        isOpen={borrowModal.isOpen}
        onClose={() => setBorrowModal({ ...borrowModal, isOpen: false })}
        token={borrowModal.token}
        tokenName={borrowModal.tokenName}
        borrowAPY={borrowModal.borrowAPY}
      />
    </div>
  )
}