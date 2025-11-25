'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { CONTRACT_ADDRESSES, TOKENS } from '@/contracts/config'
import NeovalendPoolABI from '@/contracts/abis/NeovalendPool.json'

// Get contract address based on current network
const getContractAddress = (chainId: number) => {
  switch (chainId) {
    case 1: // Ethereum Mainnet
      return CONTRACT_ADDRESSES.ETHEREUM_MAINNET.NEOVALEND_POOL
    case 11155111: // Sepolia Testnet
      return CONTRACT_ADDRESSES.SEPOLIA.NEOVALEND_POOL
    default:
      return CONTRACT_ADDRESSES.SEPOLIA.NEOVALEND_POOL
  }
}

export function useNeovalendPool() {
  const { address, chainId } = useAccount()
  const contractAddress = getContractAddress(chainId || 11155111)
  
  // Write contract hook
  const { writeContract, data: hash, isPending } = useWriteContract()
  
  // Wait for transaction receipt
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  // Read user deposit balances
  const { data: userBalances, refetch: refetchBalances } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: NeovalendPoolABI,
    functionName: 'getUserDepositBalance',
    args: [address],
    query: {
      enabled: !!address,
    },
  })

  // Read pool statistics
  const { data: poolStats, refetch: refetchStats } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: NeovalendPoolABI,
    functionName: 'getPoolStats',
    query: {
      enabled: true,
    },
  })

  // Supply USDT (Aave v3 method)
  const supplyUSDT = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')

    const amountParsed = parseUnits(amount, TOKENS.USDT.decimals)

    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'supply',
      args: [CONTRACT_ADDRESSES.SEPOLIA.USDT_TOKEN, amountParsed, address, 0], // asset, amount, onBehalfOf, referralCode
    })
  }

  // Supply A7A5 (Aave v3 method)
  const supplyA7A5 = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')

    const amountParsed = parseUnits(amount, TOKENS.A7A5.decimals)

    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'supply',
      args: [CONTRACT_ADDRESSES.SEPOLIA.A7A5_TOKEN, amountParsed, address, 0], // asset, amount, onBehalfOf, referralCode
    })
  }

  // Withdraw USDT
  const withdrawUSDT = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')
    
    const amountParsed = parseUnits(amount, TOKENS.USDT.decimals)
    
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'withdrawUSDT',
      args: [amountParsed],
    })
  }

  // Withdraw A7A5
  const withdrawA7A5 = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')
    
    const amountParsed = parseUnits(amount, TOKENS.A7A5.decimals)
    
    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'withdrawA7A5',
      args: [amountParsed],
    })
  }

  // Format user balances for display
  const formatUserBalances = () => {
    if (!userBalances) return { usdtBalance: '0', a7a5Balance: '0' }
    
    const [usdtRaw, a7a5Raw] = userBalances as [bigint, bigint]
    
    return {
      usdtBalance: formatUnits(usdtRaw, TOKENS.USDT.decimals),
      a7a5Balance: formatUnits(a7a5Raw, TOKENS.A7A5.decimals),
    }
  }

  // Format pool stats for display
  const formatPoolStats = () => {
    if (!poolStats) return null
    
    const stats = poolStats as any
    
    return {
      totalUsdtDeposits: formatUnits(stats.totalUsdtDeposits, TOKENS.USDT.decimals),
      totalA7a5Deposits: formatUnits(stats.totalA7a5Deposits, TOKENS.A7A5.decimals),
      totalUsdtBorrows: formatUnits(stats.totalUsdtBorrows, TOKENS.USDT.decimals),
      totalA7a5Borrows: formatUnits(stats.totalA7a5Borrows, TOKENS.A7A5.decimals),
      lastRebaseTimestamp: Number(stats.lastRebaseTimestamp),
    }
  }

  return {
    // Contract interactions (Aave v3 methods)
    supplyUSDT,
    supplyA7A5,
    withdrawUSDT,
    withdrawA7A5,
    // Legacy names for compatibility
    depositUSDT: supplyUSDT,
    depositA7A5: supplyA7A5,
    
    // Transaction state
    isPending,
    isConfirming,
    isSuccess,
    hash,
    
    // Data
    userBalances: formatUserBalances(),
    poolStats: formatPoolStats(),
    
    // Refetch functions
    refetchBalances,
    refetchStats,
    
    // Utilities
    contractAddress,
  }
}