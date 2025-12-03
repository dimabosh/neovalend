import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { type Chain } from 'wagmi/chains'

// NEO X Testnet Chain Definition
const neoXTestnet: Chain = {
  id: 12227332,
  name: 'NEO X Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'GAS',
    symbol: 'GAS',
  },
  rpcUrls: {
    default: {
      http: ['https://neoxt4seed1.ngd.network/'],
    },
    public: {
      http: ['https://neoxt4seed1.ngd.network/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'NEO X Explorer',
      url: 'https://xt4scan.ngd.network',
    },
  },
  testnet: true,
}

export const config = getDefaultConfig({
  appName: 'Neovalend Lending Protocol',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'edf4f8f802f010178b740316aae13384',
  chains: [neoXTestnet],
  ssr: true,
})

export { neoXTestnet }
