import { useWriteContract, useReadContract, useAccount } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { POOL_ABI, ERC20_ABI, getContractConfig } from '@/config/contracts';
import { useChainId } from 'wagmi';

export function useAavePool() {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const config = getContractConfig(chainId);

  const { writeContractAsync } = useWriteContract();

  // Supply (Deposit) function
  const supply = async (assetAddress: Address, amount: string, decimals: number) => {
    const amountWei = parseUnits(amount, decimals);

    const hash = await writeContractAsync({
      address: config.contracts.POOL as Address,
      abi: POOL_ABI,
      functionName: 'supply',
      args: [assetAddress, amountWei, userAddress!, 0]
    });

    return hash;
  };

  // Withdraw function
  const withdraw = async (assetAddress: Address, amount: string, decimals: number) => {
    const amountWei = parseUnits(amount, decimals);

    const hash = await writeContractAsync({
      address: config.contracts.POOL as Address,
      abi: POOL_ABI,
      functionName: 'withdraw',
      args: [assetAddress, amountWei, userAddress!]
    });

    return hash;
  };

  // Borrow function
  const borrow = async (assetAddress: Address, amount: string, decimals: number) => {
    const amountWei = parseUnits(amount, decimals);

    const hash = await writeContractAsync({
      address: config.contracts.POOL as Address,
      abi: POOL_ABI,
      functionName: 'borrow',
      args: [assetAddress, amountWei, BigInt(2), 0, userAddress!] // 2 = variable rate
    });

    return hash;
  };

  // Repay function
  const repay = async (assetAddress: Address, amount: string, decimals: number) => {
    const amountWei = parseUnits(amount, decimals);

    const hash = await writeContractAsync({
      address: config.contracts.POOL as Address,
      abi: POOL_ABI,
      functionName: 'repay',
      args: [assetAddress, amountWei, BigInt(2), userAddress!] // 2 = variable rate
    });

    return hash;
  };

  // Set asset as collateral
  const setUseAsCollateral = async (assetAddress: Address, useAsCollateral: boolean) => {
    const hash = await writeContractAsync({
      address: config.contracts.POOL as Address,
      abi: POOL_ABI,
      functionName: 'setUserUseReserveAsCollateral',
      args: [assetAddress, useAsCollateral]
    });

    return hash;
  };

  return {
    supply,
    withdraw,
    borrow,
    repay,
    setUseAsCollateral
  };
}

// Hook for reading user account data
export function useUserAccountData(userAddress?: Address) {
  const chainId = useChainId();
  const config = getContractConfig(chainId);

  const { data: accountData, error, isLoading } = useReadContract({
    address: config.contracts.POOL as Address,
    abi: POOL_ABI,
    functionName: 'getUserAccountData',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
    }
  });

  // Debug logging
  if (error && !(window as any).userAccountDataError) {
    console.error('❌ getUserAccountData error:', error);
    (window as any).userAccountDataError = true;
  }

  if (!accountData) return null;

  // Type assertion for account data array
  const data = accountData as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

  return {
    totalCollateralBase: formatUnits(data[0], 8), // in base currency (USD)
    totalDebtBase: formatUnits(data[1], 8),
    availableBorrowsBase: formatUnits(data[2], 8),
    currentLiquidationThreshold: formatUnits(data[3], 4), // in percentage (4 decimals)
    ltv: formatUnits(data[4], 4), // in percentage
    healthFactor: data[5] > BigInt(0) ? formatUnits(data[5], 18) : '∞'
  };
}

// Hook for reading user configuration (collateral status)
export function useUserConfiguration(userAddress?: Address) {
  const chainId = useChainId();
  const config = getContractConfig(chainId);

  const { data: configData } = useReadContract({
    address: config.contracts.POOL as Address,
    abi: POOL_ABI,
    functionName: 'getUserConfiguration',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!userAddress,
      refetchInterval: 2000, // Refetch every 2 seconds
      gcTime: 0, // Don't cache results (always fetch fresh from blockchain)
    }
  });

  if (!configData) return null;

  // getUserConfiguration returns a struct with a bitmap
  const data = configData as any;
  const bitmap = BigInt(data.data || data || 0);

  return {
    bitmap,
    // Helper to check if reserve at index is used as collateral
    isUsingAsCollateral: (reserveIndex: number) => {
      // In Aave, bit (reserveIndex * 2 + 1) indicates if asset is used as collateral
      // bit (reserveIndex * 2) is for borrowing
      const collateralBit = reserveIndex * 2 + 1;  // FIX: Was reserveIndex * 2 (borrowing bit)
      return (bitmap & (BigInt(1) << BigInt(collateralBit))) !== BigInt(0);
    }
  };
}

// Hook for reading reserve data
export function useReserveData(assetAddress?: Address) {
  const chainId = useChainId();
  const config = getContractConfig(chainId);

  const { data: reserveData } = useReadContract({
    address: config.contracts.POOL as Address,
    abi: POOL_ABI,
    functionName: 'getReserveData',
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
    }
  });

  if (!reserveData) return null;

  // Use simplified approach with any type to avoid complex TypeScript tuple type errors
  const data = reserveData as any;
  
  return {
    // Current rates (in RAY format - 27 decimals) - simplified for display
    currentLiquidityRate: data?.currentLiquidityRate ? 
      formatUnits(data.currentLiquidityRate, 25) : '0',
    currentVariableBorrowRate: data?.currentVariableBorrowRate ? 
      formatUnits(data.currentVariableBorrowRate, 25) : '0',
    currentStableBorrowRate: data?.currentStableBorrowRate ? 
      formatUnits(data.currentStableBorrowRate, 25) : '0',
    
    // Indexes (in RAY format) 
    liquidityIndex: data?.liquidityIndex ? formatUnits(data.liquidityIndex, 27) : '1',
    variableBorrowIndex: data?.variableBorrowIndex ? formatUnits(data.variableBorrowIndex, 27) : '1',
    
    // Last update timestamp
    lastUpdateTimestamp: data?.lastUpdateTimestamp || Date.now(),
    
    // Token addresses from actual data
    aTokenAddress: data?.aTokenAddress || '0x0',
    stableDebtTokenAddress: data?.stableDebtTokenAddress || '0x0', 
    variableDebtTokenAddress: data?.variableDebtTokenAddress || '0x0',
    interestRateStrategyAddress: data?.interestRateStrategyAddress || '0x0'
  };
}

// Hook for token balance and allowance
export function useTokenData(tokenAddress?: Address, spenderAddress?: Address, userAddress?: Address) {
  // Fallback to useAccount if userAddress not provided
  const { address: accountAddress } = useAccount();
  const finalUserAddress = userAddress || accountAddress;

  const { data: balance, error: balanceError, isLoading: balanceLoading } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: finalUserAddress ? [finalUserAddress] : undefined,
    query: {
      enabled: !!(tokenAddress && finalUserAddress),
    }
  });

  const { data: allowance, error: allowanceError } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: finalUserAddress && spenderAddress ? [finalUserAddress, spenderAddress] : undefined,
    query: {
      enabled: !!(tokenAddress && finalUserAddress && spenderAddress),
    }
  });

  const { data: decimals, error: decimalsError } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!tokenAddress,
    }
  });

  const { data: symbol, error: symbolError } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress,
    }
  });

  // Log only errors or successful balance reads
  if (balanceError || decimalsError || symbolError) {
    console.error('Token data error:', { tokenAddress, errors: { balance: balanceError?.message, decimals: decimalsError?.message, symbol: symbolError?.message } });
  } else if (balance && decimals && symbol && !(window as any).tokenDataLogged) {
    console.log('💰 Token data loaded:', { symbol, balance: formatUnits(balance as bigint, decimals as number) });
    (window as any).tokenDataLogged = true;
  }

  return {
    balance: balance && decimals ? formatUnits(balance as bigint, decimals as number) : '0',
    allowance: allowance && decimals ? formatUnits(allowance as bigint, decimals as number) : '0',
    decimals: (decimals as number) || 18,
    symbol: (symbol as string) || 'Unknown',
    // Raw values for debugging
    rawBalance: balance?.toString() || '0',
    rawDecimals: decimals?.toString() || '18'
  };
}

// Hook for approving token spending
export function useTokenApproval() {
  const { writeContractAsync } = useWriteContract();

  const approve = async (tokenAddress: Address, spenderAddress: Address, amount: string, decimals: number) => {
    const amountWei = parseUnits(amount, decimals);

    const hash = await writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, amountWei]
    });

    return hash;
  };

  // Approve maximum amount
  const approveMax = async (tokenAddress: Address, spenderAddress: Address) => {
    // Maximum uint256 value: 2^256 - 1
    const maxAmount = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');

    const hash = await writeContractAsync({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spenderAddress, maxAmount]
    });

    return hash;
  };

  return { approve, approveMax };
}

// Hook for getting asset price from Oracle
export function useOraclePrice(assetAddress?: Address) {
  const chainId = useChainId();
  const config = getContractConfig(chainId);

  const { data: priceData } = useReadContract({
    address: config.contracts.AAVE_ORACLE as Address,
    abi: [
      {
        inputs: [{ name: 'asset', type: 'address' }],
        name: 'getAssetPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
    functionName: 'getAssetPrice',
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
    }
  });

  if (!priceData) return null;

  // Oracle returns price in 8 decimals (like Chainlink)
  // e.g. WBTC: 12000000000000 = $120,000.00
  const priceInUSD = parseFloat(formatUnits(priceData as bigint, 8));

  return {
    priceUSD: priceInUSD,
    priceRaw: priceData as bigint,
  };
}