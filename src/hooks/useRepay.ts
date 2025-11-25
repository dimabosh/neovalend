import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Address, parseUnits } from 'viem';
import { POOL_ABI, ERC20_ABI, getContractConfig } from '@/config/contracts';
import { useChainId } from 'wagmi';
import { useState } from 'react';

export function useRepay() {
  const chainId = useChainId();
  const config = getContractConfig(chainId);
  const [isPending, setIsPending] = useState(false);

  const { writeContractAsync: writeRepay } = useWriteContract();
  const { writeContractAsync: writeApprove } = useWriteContract();

  /**
   * Approve tokens for Pool contract
   */
  const approve = async (tokenAddress: Address, amount: bigint) => {
    try {
      setIsPending(true);
      const hash = await writeApprove({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [config.contracts.POOL as Address, amount],
      });

      console.log('Approval transaction sent:', hash);
      return hash;
    } catch (error) {
      console.error('Approval failed:', error);
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Repay borrowed tokens
   * @param asset - Token address to repay
   * @param amount - Amount to repay in token's smallest unit
   * @param interestRateMode - 1 for stable, 2 for variable (default: 2)
   * @param onBehalfOf - Address to repay for (default: msg.sender)
   */
  const repay = async (
    asset: Address,
    amount: bigint,
    interestRateMode: bigint = BigInt(2),
    onBehalfOf?: Address
  ) => {
    try {
      setIsPending(true);

      // Use max uint256 for full repayment
      const repayAmount = amount;

      const hash = await writeRepay({
        address: config.contracts.POOL as Address,
        abi: POOL_ABI,
        functionName: 'repay',
        args: [
          asset,
          repayAmount,
          interestRateMode,
          onBehalfOf || '0x0000000000000000000000000000000000000000', // Pool uses msg.sender if 0x0
        ],
      });

      console.log('Repay transaction sent:', hash);
      return hash;
    } catch (error) {
      console.error('Repay failed:', error);
      throw error;
    } finally {
      setIsPending(false);
    }
  };

  /**
   * Repay full debt (uses max uint256)
   */
  const repayFull = async (
    asset: Address,
    interestRateMode: bigint = BigInt(2),
    onBehalfOf?: Address
  ) => {
    const MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    return repay(asset, MAX_UINT256, interestRateMode, onBehalfOf);
  };

  return {
    repay,
    repayFull,
    approve,
    isPending,
  };
}
