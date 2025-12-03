'use client'

import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { DatabaseService } from '@/lib/database'
import { formatNumber } from '@/lib/utils'

interface UserStats {
  totalDeposits: string
  totalBorrows: string
  availableBorrow: string
  healthFactor: string
  totalPoints: number
}

export default function UserDashboard() {
  const { address } = useAccount()
  const [userStats, setUserStats] = useState<UserStats>({
    totalDeposits: '0',
    totalBorrows: '0', 
    availableBorrow: '0',
    healthFactor: '∞',
    totalPoints: 0
  })
  const [loading, setLoading] = useState(true)

  // Mock user data for demo (replace with real contract calls)
  useEffect(() => {
    const loadUserData = async () => {
      if (!address) return
      
      setLoading(true)
      try {
        // Get points from database
        const points = await DatabaseService.getUserPoints(address)
        
        // Mock contract data for demo
        setUserStats({
          totalDeposits: '0.00',
          totalBorrows: '0.00',
          availableBorrow: '0.00', 
          healthFactor: '∞',
          totalPoints: points
        })
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [address])

  if (loading) {
    return (
      <div className="card-dark p-6 rounded-xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-3/4"></div>
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
      {/* Account Overview */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Account Overview</h2>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Deposits:</span>
            <span className="text-white font-semibold">${userStats.totalDeposits}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Borrows:</span>
            <span className="text-white font-semibold">${userStats.totalBorrows}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Available to Borrow:</span>
            <span className="text-green-400 font-semibold">${userStats.availableBorrow}</span>
          </div>
          
          <hr className="border-gray-700" />
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Health Factor:</span>
            <span className={`font-semibold ${
              userStats.healthFactor === '∞' ? 'text-green-400' :
              parseFloat(userStats.healthFactor) > 1.5 ? 'text-green-400' :
              parseFloat(userStats.healthFactor) > 1.1 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {userStats.healthFactor}
            </span>
          </div>
        </div>
      </div>

      {/* Points & Rewards */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Points & Rewards</h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Total Points:</span>
            <span className="text-purple-400 font-semibold text-xl">{formatNumber(userStats.totalPoints)}</span>
          </div>
          
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-300 mb-2">How to earn points:</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Deposits: +10 points per $1</li>
              <li>• Borrows: +5 points per $1</li>
              <li>• Swaps: +2 points per transaction</li>
              <li>• Referrals: +20% of friends' points</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-dark p-6 rounded-xl">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        
        <div className="space-y-3">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
            💰 Make Deposit
          </button>
          <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
            📊 Take Loan
          </button>
          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-medium transition-colors">
            🔄 Swap Tokens
          </button>
        </div>
      </div>
    </div>
  )
}