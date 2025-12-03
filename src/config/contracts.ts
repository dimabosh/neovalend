// Contract addresses for Neovalend Protocol on NEO X Testnet
// Deployed via GitHub Actions - Phase 1-6 Complete

export const NEOX_TESTNET_CONTRACTS = {
  // Core Protocol Contracts
  POOL: '0xc6716a9c596c85ae593f8eb0d23afd4f051877cf',
  POOL_CONFIGURATOR: '0x9FFb0f2AF3B613cFAD0e035A787D2f2017C2FAEB',
  POOL_ADDRESSES_PROVIDER: '0x547131d90dd9EfB1cFC253038788De5a5C2bC1Ba',
  ACL_MANAGER: '0x4dea05b5392D48256f2f3572c92559ad0eAa8459',

  // Data Providers & UI Helpers
  AAVE_PROTOCOL_DATA_PROVIDER: '0x73a3a6AfD28230118678B4D3926c844D4Ab6A43e',
  UI_POOL_DATA_PROVIDER_V3: '0xbd4d0C482A9f141a916938609a058E4A789B392E',
  UI_INCENTIVE_DATA_PROVIDER_V3: '0x8Ac74680dBD5111563f80B00bcDeaCB6d53Fdd10',

  // Price Oracle
  AAVE_ORACLE: '0x6e6A9582dc97827621312bEb6095FDCEBFB4679A',

  // Interest Rate Strategy
  DEFAULT_INTEREST_RATE_STRATEGY_V2: '0xB9b6e54BE8a948eeF0653E6CE3eB67138216fE07',

  // Token Implementations
  ATOKEN_INSTANCE: '0x4d12c902Fc2E755163b820ADC0931F93A17E9232',
  VARIABLE_DEBT_TOKEN_INSTANCE: '0x5255Ba17B81Bcbe7b67d8eCdcd31A100f7474647',

  // Gateway for native GAS operations
  WRAPPED_TOKEN_GATEWAY_V3: '0x6626f8CBa71ADaD1Ab0D1C0c1999c1632D02726d',
} as const;

// Supported Reserve Assets on NEO X Testnet
export const RESERVE_ASSETS = {
  WGAS: {
    address: '0x9b9032D047D7F879F54F5b54aE0EcE03bef39a8e',
    symbol: 'WGAS',
    name: 'Wrapped GAS',
    decimals: 18,
    reserveIndex: 0,
    priceUSD: 2.20,
    collateral: {
      ltv: '75%',
      liquidationThreshold: '80%',
      liquidationBonus: '5%'
    }
  },
  NEO: {
    address: '0x8B0652a4db1670741dAb3c4bf882afbACDb44D3C',
    symbol: 'NEO',
    name: 'NEO Token',
    decimals: 18,
    reserveIndex: 1,
    priceUSD: 4.30,
    collateral: {
      ltv: '65%',
      liquidationThreshold: '70%',
      liquidationBonus: '10%'
    }
  },
  USDT: {
    address: '0xbCEAb9b0cee639E8b37607eBA8370e60789bcE7C',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    reserveIndex: 2,
    priceUSD: 1.00,
    collateral: {
      ltv: '80%',
      liquidationThreshold: '85%',
      liquidationBonus: '5%'
    }
  },
  USDC: {
    address: '0x4d7B02c427e3508BbCc14f3079BB364c2Cf2a358',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    reserveIndex: 3,
    priceUSD: 1.00,
    collateral: {
      ltv: '80%',
      liquidationThreshold: '85%',
      liquidationBonus: '5%'
    }
  },
  ETH: {
    address: '0x5f2f94b7F57C713EBA6c1b1aaC2Da7617617a609',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    reserveIndex: 4,
    priceUSD: 3000,
    collateral: {
      ltv: '80%',
      liquidationThreshold: '82.5%',
      liquidationBonus: '5%'
    }
  },
  BTC: {
    address: '0x456b48FA869d0409C953a9042e036Ab667cc47C5',
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    reserveIndex: 5,
    priceUSD: 90000,
    collateral: {
      ltv: '70%',
      liquidationThreshold: '75%',
      liquidationBonus: '10%'
    }
  }
} as const;

// Network Configuration
export const NETWORK_CONFIG = {
  NEOX_TESTNET: {
    chainId: 12227332,
    name: 'NEO X Testnet',
    rpcUrl: 'https://neoxt4seed1.ngd.network/',
    blockExplorer: 'https://xt4scan.ngd.network',
    nativeCurrency: {
      name: 'GAS',
      symbol: 'GAS',
      decimals: 18
    },
    contracts: NEOX_TESTNET_CONTRACTS,
    reserves: RESERVE_ASSETS
  }
} as const;

// ABI imports
export const POOL_ABI = [
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' }
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    name: 'withdraw',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' }
    ],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' }
    ],
    name: 'repay',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserAccountData',
    outputs: [
      { name: 'totalCollateralBase', type: 'uint256' },
      { name: 'totalDebtBase', type: 'uint256' },
      { name: 'availableBorrowsBase', type: 'uint256' },
      { name: 'currentLiquidationThreshold', type: 'uint256' },
      { name: 'ltv', type: 'uint256' },
      { name: 'healthFactor', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'useAsCollateral', type: 'bool' }
    ],
    name: 'setUserUseReserveAsCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserConfiguration',
    outputs: [{ name: 'data', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'asset', type: 'address' }],
    name: 'getReserveData',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'configuration', type: 'uint256' },
          { name: 'liquidityIndex', type: 'uint128' },
          { name: 'currentLiquidityRate', type: 'uint128' },
          { name: 'variableBorrowIndex', type: 'uint128' },
          { name: 'currentVariableBorrowRate', type: 'uint128' },
          { name: 'currentStableBorrowRate', type: 'uint128' },
          { name: 'lastUpdateTimestamp', type: 'uint40' },
          { name: 'id', type: 'uint16' },
          { name: 'aTokenAddress', type: 'address' },
          { name: 'stableDebtTokenAddress', type: 'address' },
          { name: 'variableDebtTokenAddress', type: 'address' },
          { name: 'interestRateStrategyAddress', type: 'address' },
          { name: 'accruedToTreasury', type: 'uint128' },
          { name: 'unbacked', type: 'uint128' },
          { name: 'isolationModeTotalDebt', type: 'uint128' }
        ]
      }
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getReservesList',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const;

export const ORACLE_ABI = [
  {
    inputs: [{ name: 'asset', type: 'address' }],
    name: 'getAssetPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export const WRAPPED_TOKEN_GATEWAY_ABI = [
  {
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' }
    ],
    name: 'depositETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' }
    ],
    name: 'withdrawETH',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// SimpleFaucet contract address (deploy via scripts/deploy/phase-faucet.js)
export const SIMPLE_FAUCET_ADDRESS = '' as const; // TODO: Set after deployment

export const SIMPLE_FAUCET_ABI = [
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokens', type: 'address[]' }],
    name: 'claimMultiple',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    name: 'canClaim',
    outputs: [
      { name: 'canClaim', type: 'bool' },
      { name: 'timeUntilClaim', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'claimAmounts',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cooldownPeriod',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Helper functions
export function getContractConfig(chainId: number) {
  switch (chainId) {
    case 12227332: // NEO X Testnet
      return NETWORK_CONFIG.NEOX_TESTNET;
    default:
      throw new Error(`Unsupported network: ${chainId}. Only NEO X Testnet (12227332) is supported.`);
  }
}

export function getReserveByAddress(address: string) {
  return Object.values(RESERVE_ASSETS).find(
    reserve => reserve.address.toLowerCase() === address.toLowerCase()
  );
}

export function getReserveBySymbol(symbol: string) {
  return Object.values(RESERVE_ASSETS).find(
    reserve => reserve.symbol.toLowerCase() === symbol.toLowerCase()
  );
}

// Type definitions
export type ReserveAsset = typeof RESERVE_ASSETS[keyof typeof RESERVE_ASSETS];
export type ContractAddresses = typeof NEOX_TESTNET_CONTRACTS;
export type NetworkConfig = typeof NETWORK_CONFIG[keyof typeof NETWORK_CONFIG];
