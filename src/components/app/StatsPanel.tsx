'use client'

import { useState, useEffect } from 'react'
import { DatabaseService } from '@/lib/database'
import { formatNumber } from '@/lib/utils'

interface ProtocolStats {
  tvl: string
  totalUsers: number
  totalDeposits: string
  totalBorrows: string
  usdtAPY: string
  a7a5APY: string
}

interface TopUser {
  address: string
  total_points: number
}

export default function StatsPanel() {
  const [protocolStats, setProtocolStats] = useState<ProtocolStats>({
    tvl: '0',
    totalUsers: 0,
    totalDeposits: '0',
    totalBorrows: '0',
    usdtAPY: '5.5',
    a7a5APY: '11.0'
  })
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true)
      try {
        // Get protocol stats from database
        const stats = await DatabaseService.getProtocolStats()
        const leaderboard = await DatabaseService.getTopUsers(5)
        
        if (stats) {
          setProtocolStats({
            tvl: (stats.tvl_usd || 0).toFixed(2),
            totalUsers: leaderboard.length,
            totalDeposits: ((stats.total_deposits_usdt || 0) + (stats.total_deposits_a7a5 || 0)).toFixed(2),
            totalBorrows: ((stats.total_borrows_usdt || 0) + (stats.total_borrows_a7a5 || 0)).toFixed(2),
            usdtAPY: '5.5',
            a7a5APY: '11.0'
          })
        }
        
        setTopUsers(leaderboard)
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card-dark p-6 rounded-xl animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Protocol Stats */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Статистика Протокола</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">TVL:</span>
            <span className="text-blue-400 font-semibold text-lg">${protocolStats.tvl}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Пользователей:</span>
            <span className="text-green-400 font-semibold">{protocolStats.totalUsers}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Общие Депозиты:</span>
            <span className="text-purple-400 font-semibold">${protocolStats.totalDeposits}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Общие Займы:</span>
            <span className="text-yellow-400 font-semibold">${protocolStats.totalBorrows}</span>
          </div>
        </div>
      </div>

      {/* Interest Rates */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Процентные Ставки</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">💵</span>
              <span className="text-gray-300">USDT</span>
            </div>
            <div className="text-right">
              <div className="text-green-400 font-semibold">{protocolStats.usdtAPY}%</div>
              <div className="text-xs text-gray-400">Депозит APY</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">🚀</span>
              <span className="text-gray-300">A7A5</span>
            </div>
            <div className="text-right">
              <div className="text-blue-400 font-semibold">{protocolStats.a7a5APY}%</div>
              <div className="text-xs text-gray-400">Депозит APY</div>
            </div>
          </div>
          
          <div className="bg-gray-800 p-3 rounded-lg">
            <div className="text-xs text-gray-400 mb-1">Rebase Bonus A7A5:</div>
            <div className="text-purple-400 font-semibold">+7-8% годовых</div>
          </div>
        </div>
      </div>

      {/* Top Users Leaderboard */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">🏆 Топ Пользователей</h2>
        
        <div className="space-y-3">
          {topUsers.length > 0 ? (
            topUsers.map((user, index) => (
              <div key={user.address} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                  </span>
                  <span className="text-gray-300 font-mono text-sm">
                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                  </span>
                </div>
                <span className="text-purple-400 font-semibold">
                  {formatNumber(user.total_points)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-400 py-4">
              Пока нет активных пользователей
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">📊 Последняя Активность</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-blue-500">💰</span>
              <div>
                <div className="text-white text-sm">Депозит USDT</div>
                <div className="text-xs text-gray-400">2 минуты назад</div>
              </div>
            </div>
            <span className="text-green-400">+$100</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-green-500">📊</span>
              <div>
                <div className="text-white text-sm">Заём A7A5</div>
                <div className="text-xs text-gray-400">5 минут назад</div>
              </div>
            </div>
            <span className="text-yellow-400">$50</span>
          </div>
          
          <div className="text-center text-gray-400 text-xs mt-4">
            Демо режим - реальные транзакции скоро
          </div>
        </div>
      </div>
    </div>
  )
}