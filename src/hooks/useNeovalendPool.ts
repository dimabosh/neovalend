'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { CONTRACT_ADDRESSES, TOKENS } from '@/contracts/config'
import NeovalendPoolABI from '@/contracts/abis/NeovalendPool.json'

// Get contract address based on current network
const getContractAddress = (chainId: number) => {
  switch (chainId) {
    case 12227332: // NEO X Testnet
      return CONTRACT_ADDRESSES.NEOX_TESTNET.NEOVALEND_POOL
    default:
      return CONTRACT_ADDRESSES.NEOX_TESTNET.NEOVALEND_POOL
  }
}

export function useNeovalendPool() {
  const { address, chainId } = useAccount()
  const contractAddress = getContractAddress(chainId || 12227332)

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
      args: [CONTRACT_ADDRESSES.NEOX_TESTNET.USDT_TOKEN, amountParsed, address, 0],
    })
  }

  // Supply WGAS
  const supplyWGAS = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')

    const amountParsed = parseUnits(amount, TOKENS.WGAS.decimals)

    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'supply',
      args: [CONTRACT_ADDRESSES.NEOX_TESTNET.WGAS_TOKEN, amountParsed, address, 0],
    })
  }

  // Withdraw USDT
  const withdrawUSDT = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')

    const amountParsed = parseUnits(amount, TOKENS.USDT.decimals)

    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'withdraw',
      args: [CONTRACT_ADDRESSES.NEOX_TESTNET.USDT_TOKEN, amountParsed, address],
    })
  }

  // Withdraw WGAS
  const withdrawWGAS = async (amount: string) => {
    if (!address) throw new Error('Wallet not connected')

    const amountParsed = parseUnits(amount, TOKENS.WGAS.decimals)

    return writeContract({
      address: contractAddress as `0x${string}`,
      abi: NeovalendPoolABI,
      functionName: 'withdraw',
      args: [CONTRACT_ADDRESSES.NEOX_TESTNET.WGAS_TOKEN, amountParsed, address],
    })
  }

  // Format user balances for display
  const formatUserBalances = () => {
    if (!userBalances) return { usdtBalance: '0', wgasBalance: '0' }

    const [usdtRaw, wgasRaw] = userBalances as [bigint, bigint]

    return {
      usdtBalance: formatUnits(usdtRaw, TOKENS.USDT.decimals),
      wgasBalance: formatUnits(wgasRaw, TOKENS.WGAS.decimals),
    }
  }

  // Format pool stats for display
  const formatPoolStats = () => {
    if (!poolStats) return null

    const stats = poolStats as any

    return {
      totalUsdtDeposits: formatUnits(stats.totalUsdtDeposits || 0n, TOKENS.USDT.decimals),
      totalWgasDeposits: formatUnits(stats.totalWgasDeposits || 0n, TOKENS.WGAS.decimals),
      totalUsdtBorrows: formatUnits(stats.totalUsdtBorrows || 0n, TOKENS.USDT.decimals),
      totalWgasBorrows: formatUnits(stats.totalWgasBorrows || 0n, TOKENS.WGAS.decimals),
    }
  }

  return {
    // Contract interactions (Aave v3 methods)
    supplyUSDT,
    supplyWGAS,
    withdrawUSDT,
    withdrawWGAS,
    // Legacy names for compatibility
    depositUSDT: supplyUSDT,
    depositA7A5: supplyWGAS,
    supplyA7A5: supplyWGAS,
    withdrawA7A5: withdrawWGAS,

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
