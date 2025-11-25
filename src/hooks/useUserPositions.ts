import { useReadContract, useAccount } from 'wagmi';
import { Address, formatUnits } from 'viem';
import { ERC20_ABI, getContractConfig, RESERVE_ASSETS } from '@/config/contracts';
import { useChainId } from 'wagmi';
import { useReserveData, useOraclePrice } from './useAavePool';

export interface UserPosition {
  asset: keyof typeof RESERVE_ASSETS;
  assetConfig: typeof RESERVE_ASSETS[keyof typeof RESERVE_ASSETS];
  supplied: string;
  borrowed: string;
  aTokenAddress?: string;
  debtTokenAddress?: string;
  suppliedUSD: string;
  borrowedUSD: string;
}

// Hook for getting user's positions across all assets
export function useUserPositions() {
  const chainId = useChainId();
  const { address } = useAccount();
  const config = getContractConfig(chainId);

  const positions: UserPosition[] = [];

  // Get positions for each reserve asset
  Object.entries(RESERVE_ASSETS).forEach(([assetKey, assetConfig]) => {
    const reserveData = useReserveData(assetConfig.address as Address);

    // Get aToken balance (supplied amount)
    const { data: aTokenBalance } = useReadContract({
      address: reserveData?.aTokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
      query: {
        enabled: !!(address && reserveData?.aTokenAddress && reserveData.aTokenAddress !== '0x0'),
      }
    });

    // Get variable debt token balance (borrowed amount)
    const { data: debtTokenBalance } = useReadContract({
      address: reserveData?.variableDebtTokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: address ? [address] : undefined,
      query: {
        enabled: !!(address && reserveData?.variableDebtTokenAddress && reserveData.variableDebtTokenAddress !== '0x0'),
      }
    });

    const supplied = aTokenBalance ? formatUnits(aTokenBalance as bigint, assetConfig.decimals) : '0';
    const borrowed = debtTokenBalance ? formatUnits(debtTokenBalance as bigint, assetConfig.decimals) : '0';

    // Simple USD calculation (assuming 1:1 for now, can be improved with price oracles)
    const suppliedUSD = supplied;
    const borrowedUSD = borrowed;

    positions.push({
      asset: assetKey as keyof typeof RESERVE_ASSETS,
      assetConfig,
      supplied,
      borrowed,
      aTokenAddress: reserveData?.aTokenAddress,
      debtTokenAddress: reserveData?.variableDebtTokenAddress,
      suppliedUSD,
      borrowedUSD
    });
  });

  // Filter to only positions with non-dust amounts ($0.01 USD threshold for both supply and borrow)
  const dustThresholdUSD = 0.01;
  const activeSuppliedPositions = positions.filter(p => parseFloat(p.suppliedUSD) >= dustThresholdUSD);
  const activeBorrowedPositions = positions.filter(p => parseFloat(p.borrowedUSD) >= dustThresholdUSD);

  // Calculate totals
  const totalSuppliedUSD = positions.reduce((sum, p) => sum + parseFloat(p.suppliedUSD), 0);
  const totalBorrowedUSD = positions.reduce((sum, p) => sum + parseFloat(p.borrowedUSD), 0);

  return {
    positions,
    activeSuppliedPositions,
    activeBorrowedPositions,
    totalSuppliedUSD: totalSuppliedUSD.toFixed(2),
    totalBorrowedUSD: totalBorrowedUSD.toFixed(2),
    hasSupplied: activeSuppliedPositions.length > 0,
    hasBorrowed: activeBorrowedPositions.length > 0
  };
}

// Hook for getting position for a specific asset
export function useAssetPosition(assetKey: keyof typeof RESERVE_ASSETS) {
  const { address } = useAccount();
  const assetConfig = RESERVE_ASSETS[assetKey];
  const reserveData = useReserveData(assetConfig.address as Address);

  // Get aToken balance (supplied amount)
  const { data: aTokenBalance, isLoading: aTokenLoading } = useReadContract({
    address: reserveData?.aTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && reserveData?.aTokenAddress && reserveData.aTokenAddress !== '0x0'),
    }
  });

  // Get variable debt token balance (borrowed amount)
  const { data: debtTokenBalance, isLoading: debtTokenLoading } = useReadContract({
    address: reserveData?.variableDebtTokenAddress as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && reserveData?.variableDebtTokenAddress && reserveData.variableDebtTokenAddress !== '0x0'),
    }
  });

  const supplied = aTokenBalance ? formatUnits(aTokenBalance as bigint, assetConfig.decimals) : '0';
  const borrowed = debtTokenBalance ? formatUnits(debtTokenBalance as bigint, assetConfig.decimals) : '0';

  return {
    supplied,
    borrowed,
    hasSupplied: parseFloat(supplied) > 0,
    hasBorrowed: parseFloat(borrowed) > 0,
    aTokenAddress: reserveData?.aTokenAddress,
    debtTokenAddress: reserveData?.variableDebtTokenAddress,
    isLoading: aTokenLoading || debtTokenLoading,
    // Additional useful data
    suppliedFormatted: parseFloat(supplied).toFixed(4),
    borrowedFormatted: parseFloat(borrowed).toFixed(4)
  };
}

// Hook for getting protocol-wide statistics (TVL, total borrows)
export function useProtocolStats() {
  const chainId = useChainId();

  // Get data for each asset
  const stats = Object.entries(RESERVE_ASSETS).map(([assetKey, assetConfig]) => {
    const reserveData = useReserveData(assetConfig.address as Address);
    const oraclePrice = useOraclePrice(assetConfig.address as Address);

    // Get total supply from aToken (TVL for this asset)
    const { data: totalSupply } = useReadContract({
      address: reserveData?.aTokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'totalSupply',
      query: {
        enabled: !!(reserveData?.aTokenAddress && reserveData.aTokenAddress !== '0x0'),
      }
    });

    // Get total debt from variableDebtToken
    const { data: totalDebt } = useReadContract({
      address: reserveData?.variableDebtTokenAddress as Address,
      abi: ERC20_ABI,
      functionName: 'totalSupply',
      query: {
        enabled: !!(reserveData?.variableDebtTokenAddress && reserveData.variableDebtTokenAddress !== '0x0'),
      }
    });

    const supplyAmount = totalSupply ? parseFloat(formatUnits(totalSupply as bigint, assetConfig.decimals)) : 0;
    const debtAmount = totalDebt ? parseFloat(formatUnits(totalDebt as bigint, assetConfig.decimals)) : 0;

    // Convert to USD using oracle price
    const priceUSD = oraclePrice?.priceUSD || 1;
    const supplyUSD = supplyAmount * priceUSD;
    const debtUSD = debtAmount * priceUSD;

    return {
      asset: assetKey,
      symbol: assetConfig.symbol,
      supplyAmount,
      debtAmount,
      supplyUSD,
      debtUSD
    };
  });

  // Calculate totals
  const totalTVL = stats.reduce((sum, s) => sum + s.supplyUSD, 0);
  const totalBorrows = stats.reduce((sum, s) => sum + s.debtUSD, 0);
  const totalAvailable = totalTVL - totalBorrows;

  return {
    stats,
    totalTVL,
    totalBorrows,
    totalAvailable
  };
}