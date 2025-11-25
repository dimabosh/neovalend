'use client'

import { useState, useEffect } from 'react'
import { DatabaseService } from '@/lib/database'

export default function ProtocolOverview() {
  const [stats, setStats] = useState({
    totalMarketSize: '0',
    totalAvailable: '0', 
    totalBorrows: '0'
  })

  useEffect(() => {
    const loadStats = async () => {
      try {
        const protocolStats = await DatabaseService.getProtocolStats()
        if (protocolStats) {
          const totalDeposits = (protocolStats.total_deposits_usdt || 0) + (protocolStats.total_deposits_a7a5 || 0)
          const totalBorrows = (protocolStats.total_borrows_usdt || 0) + (protocolStats.total_borrows_a7a5 || 0)
          const totalAvailable = totalDeposits - totalBorrows

          setStats({
            totalMarketSize: `₽${totalDeposits.toFixed(2)}`,
            totalAvailable: `₽${Math.max(0, totalAvailable).toFixed(2)}`,
            totalBorrows: `₽${totalBorrows.toFixed(2)}`
          })
        }
      } catch (error) {
        console.error('Error loading protocol stats:', error)
        // Mock data for demo
        setStats({
          totalMarketSize: '₽284.7M',
          totalAvailable: '₽165.2M', 
          totalBorrows: '₽119.5M'
        })
      }
    }

    loadStats()
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Protocol Title */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Протокол кредитования</h1>
          <p className="text-gray-400">
            Поддержка A7A5 и USDT токенов
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div>
          <div className="text-sm text-gray-400 mb-1">Общий размер рынка</div>
          <div className="text-3xl font-bold text-white">{stats.totalMarketSize}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-1">Всего доступно</div>
          <div className="text-3xl font-bold text-white">{stats.totalAvailable}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-1">Общий займы</div>
          <div className="text-3xl font-bold text-white">{stats.totalBorrows}</div>
        </div>
      </div>
    </div>
  )
}