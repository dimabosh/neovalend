import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia } from 'wagmi/chains'

// Use Infura RPC for reliable connection
// HARDCODED RPC URLs as fallback (Vercel env vars not applying to preview)
const INFURA_KEY = '746e6062f3664276add2f792620b3a76'

const mainnetWithCustomRPC = {
  ...mainnet,
  rpcUrls: {
    ...mainnet.rpcUrls,
    default: {
      http: [
        `https://mainnet.infura.io/v3/${INFURA_KEY}`
      ],
    },
  },
}

const sepoliaWithCustomRPC = {
  ...sepolia,
  rpcUrls: {
    ...sepolia.rpcUrls,
    default: {
      http: [
        `https://sepolia.infura.io/v3/${INFURA_KEY}`
      ],
    },
  },
}

// Wagmi config with hardcoded Infura RPC (2025-10-08 00:15)

export const config = getDefaultConfig({
  appName: 'Neovalend Lending Protocol',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'edf4f8f802f010178b740316aae13384',
  chains: [sepoliaWithCustomRPC], // Only Sepolia for testnet
  ssr: true,
})// Redeploy trigger: Tue Oct  7 23:38:20 MSK 2025
