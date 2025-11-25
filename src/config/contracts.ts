// Contract addresses for Neovalend Protocol on Sepolia Testnet
// Generated from successful protocol deployment and configuration

export const SEPOLIA_CONTRACTS = {
  // Core Protocol Contracts - PRODUCTION (fully configured, all reserves active)
  POOL: '0xD272575622c700C44a1769EbD1a3DbFA74f2ae55', // Pool Proxy (PRODUCTION)
  POOL_CONFIGURATOR: '0xA80b7454e6E66f19de9d0b7a081923Cc85013D68', // PoolConfigurator Proxy (PRODUCTION)
  POOL_ADDRESSES_PROVIDER: '0x77b36e79E28F36b87Bc5EDBe05322DC229e1A0F3', // PoolAddressesProvider
  ACL_MANAGER: '0xc6E9b33550cAb966f114481B6Dce4BDFaa72bCaF', // ACLManager
  
  // Data Providers & UI Helpers
  AAVE_PROTOCOL_DATA_PROVIDER: '0x78f2754af2b839345bDB945EcaEd984FEf083865',
  UI_POOL_DATA_PROVIDER_V3: '0x210536183080517a9c31f38D5956C9A0Ae9706b5',
  UI_INCENTIVE_DATA_PROVIDER_V3: '0xaeF7165Ecf80cA19c8efAE6B08627C417E6b1a41',
  
  // Price Oracle
  AAVE_ORACLE: '0x568b266ef3F109d165e634119768942D06E3e623', // Phase 2.1

  // Interest Rate Strategy
  DEFAULT_INTEREST_RATE_STRATEGY_V2: '0x4438c9B0D2bC0eF81F1a0b0485B742c8E0833d2F', // Phase 2.1
  
  // Token Implementations
  ATOKEN_INSTANCE: '0x8F5b74e604Bc40c131E5945ea1E370a0dB9Da0ca', // Phase 4
  VARIABLE_DEBT_TOKEN_INSTANCE: '0xdC1e7A2308d4f5e293f1B7948235AFE0D712A36b', // Phase 4

  // Gateway for ETH operations
  WRAPPED_TOKEN_GATEWAY_V3: '0x59D8FcbF5a2eCbadaa3A454123D62ecc296ec948', // Phase 5

  // Testnet Faucet
  FAUCET: '0x9113aDE01DC5141aa492E3cd9c142A117311B7Ef', // Phase Faucet (2025-10-10)
} as const;

// Supported Reserve Assets
export const RESERVE_ASSETS = {
  wA7A5: {
    address: '0x18fb744Eb960480179006E3391293c77bB6f8De6', // wA7A5 (Phase 3.2)
    aToken: '0xf5Ff32678389CfC846F13A7F9034C94338445aB9', // rA7A5 (Phase 6)
    variableDebtToken: '0x9c87Db9324f304839DeB156C648D594e6929703B', // Variable Debt wA7A5 (Phase 6)
    symbol: 'wA7A5',
    name: 'Wrapped A7A5 Token',
    decimals: 18,
    reserveIndex: 1, // Aave reserve index (for getUserConfiguration bitmap) - FIXED
    // Interest rate configuration
    rates: {
      baseRate: '8%',
      slope1: '8%',
      slope2: '120%',
      optimalUtilization: '80%',
      reserveFactor: '15%'
    },
    // Collateral parameters (conservative due to rebase risk)
    collateral: {
      ltv: '50%',
      liquidationThreshold: '60%',
      liquidationBonus: '15%'
    }
  },
  USDT: {
    address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Aave Sepolia USDT Faucet
    aToken: '0x3E48331829479C46e583b79A2D03bCEAAc3d0051', // rUSDT (Phase 6)
    variableDebtToken: '0x86a389a826083E12f56F3c40dd92396C40943a3B', // Variable Debt USDT (Phase 6)
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    reserveIndex: 0, // Aave reserve index (for getUserConfiguration bitmap) - FIXED
    // Interest rate configuration
    rates: {
      baseRate: '4%',
      slope1: '4.5%',
      slope2: '60%',
      optimalUtilization: '80%',
      reserveFactor: '15%'
    },
    // Collateral parameters
    collateral: {
      ltv: '80%',
      liquidationThreshold: '82.5%',
      liquidationBonus: '5%'
    }
  },
  WBTC: {
    address: '0x29f2D40B0605204364af54EC677bD022dA425d03', // Sepolia WBTC
    aToken: '0xeb39b50930C20b9CB6e90421c484555D51d267E5', // aWBTC
    variableDebtToken: '0xc815ccfF640ac1eD0ebBD11c5F90f61D361ac3b9', // variableDebtWBTC
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    reserveIndex: 2, // Aave reserve index (for getUserConfiguration bitmap)
    // Interest rate configuration
    rates: {
      baseRate: '0%',
      slope1: '4%',
      slope2: '300%',
      optimalUtilization: '80%',
      reserveFactor: '15%'
    },
    // Collateral parameters (conservative for volatile asset)
    collateral: {
      ltv: '70%',
      liquidationThreshold: '75%',
      liquidationBonus: '10%'
    }
  }
} as const;

// Network Configuration
export const NETWORK_CONFIG = {
  SEPOLIA: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL_SEPOLIA,
    blockExplorer: 'https://sepolia.etherscan.io',
    contracts: SEPOLIA_CONTRACTS,
    reserves: RESERVE_ASSETS
  }
} as const;

// ABI imports - using consistent JSON format
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
    outputs: [
      { name: 'data', type: 'uint256' }
    ],
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

export const FAUCET_ABI = [
  {
    inputs: [],
    name: 'requestUSDT',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'requestWA7A5',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'requestWBTC',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }],
    name: 'canRequest',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }],
    name: 'timeUntilNextRequest',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Helper functions
export function getContractConfig(chainId: number) {
  switch (chainId) {
    case 11155111: // Sepolia
      return NETWORK_CONFIG.SEPOLIA;
    default:
      throw new Error(`Unsupported network: ${chainId}`);
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
export type ContractAddresses = typeof SEPOLIA_CONTRACTS;
export type NetworkConfig = typeof NETWORK_CONFIG[keyof typeof NETWORK_CONFIG];