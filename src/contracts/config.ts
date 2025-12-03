// Contract addresses and configuration for NEO X Testnet
export const CONTRACT_ADDRESSES = {
  NEOX_TESTNET: {
    NEOVALEND_POOL: '0xc6716a9c596c85ae593f8eb0d23afd4f051877cf',
    POOL_DATA_PROVIDER: '0x73a3a6AfD28230118678B4D3926c844D4Ab6A43e',
    UI_POOL_DATA_PROVIDER: '0xbd4d0C482A9f141a916938609a058E4A789B392E',
    AAVE_ORACLE: '0x6e6A9582dc97827621312bEb6095FDCEBFB4679A',
    WRAPPED_TOKEN_GATEWAY: '0x6626f8CBa71ADaD1Ab0D1C0c1999c1632D02726d',
    // Tokens
    WGAS_TOKEN: '0x9b9032D047D7F879F54F5b54aE0EcE03bef39a8e',
    NEO_TOKEN: '0x8B0652a4db1670741dAb3c4bf882afbACDb44D3C',
    USDT_TOKEN: '0xbCEAb9b0cee639E8b37607eBA8370e60789bcE7C',
    USDC_TOKEN: '0x4d7B02c427e3508BbCc14f3079BB364c2Cf2a358',
    ETH_TOKEN: '0x5f2f94b7F57C713EBA6c1b1aaC2Da7617617a609',
    BTC_TOKEN: '0x456b48FA869d0409C953a9042e036Ab667cc47C5',
  },
}

// Network configuration
export const NETWORKS = {
  NEOX_TESTNET: {
    chainId: 12227332,
    name: 'NEO X Testnet',
    rpcUrl: 'https://neoxt4seed1.ngd.network/',
    blockExplorer: 'https://xt4scan.ngd.network',
    currency: {
      name: 'GAS',
      symbol: 'GAS',
      decimals: 18,
    }
  }
}

// Token configurations
export const TOKENS = {
  WGAS: {
    symbol: 'WGAS',
    name: 'Wrapped GAS',
    decimals: 18,
    priceUSD: 2.20,
  },
  NEO: {
    symbol: 'NEO',
    name: 'NEO Token',
    decimals: 18,
    priceUSD: 4.30,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    priceUSD: 1.00,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    priceUSD: 1.00,
  },
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    priceUSD: 3000,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    priceUSD: 90000,
  }
}
