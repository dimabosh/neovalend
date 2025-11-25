// Contract addresses and configuration
export const CONTRACT_ADDRESSES = {
  // Ethereum Mainnet addresses (to be deployed)
  ETHEREUM_MAINNET: {
    NEOVALEND_POOL: '0x0000000000000000000000000000000000000000',
    A7A5_TOKEN: '0x0000000000000000000000000000000000000000',
    USDT_TOKEN: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Real USDT on Ethereum
  },
  
  // Sepolia Testnet addresses (Phase 6 deployment - CORRECT)
  SEPOLIA: {
    NEOVALEND_POOL: '0xF772368D6b1F16a0570e2010d5860EeB4681e884', // Pool Proxy (Phase 3.5)
    A7A5_TOKEN: '0x752EbE7b0dD6C6B7a2C0914E99DE9c892655897c', // A7A5Token
    USDT_TOKEN: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Test USDT
    POOL_DATA_PROVIDER: '0x78f2754af2b839345bDB945EcaEd984FEf083865', // AaveProtocolDataProvider
    UI_POOL_DATA_PROVIDER: '0x210536183080517a9c31f38D5956C9A0Ae9706b5', // UiPoolDataProviderV3
  },
}

// Network configuration
export const NETWORKS = {
  ETHEREUM: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: process.env.NEXT_PUBLIC_MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    blockExplorer: 'https://etherscan.io',
    currency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    }
  },
  SEPOLIA: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    blockExplorer: 'https://sepolia.etherscan.io',
    currency: {
      name: 'Sepolia Ether',
      symbol: 'ETH', 
      decimals: 18,
    }
  }
}

// Token configurations
export const TOKENS = {
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    depositAPY: 5.0,
    borrowAPY: 7.0,
    hasRebase: false,
  },
  A7A5: {
    symbol: 'A7A5',
    name: 'A7A5 Rebase Token',
    decimals: 18,
    depositAPY: 7.0,
    borrowAPY: 9.0,
    rebaseAPY: 3.5,
    hasRebase: true,
  }
}