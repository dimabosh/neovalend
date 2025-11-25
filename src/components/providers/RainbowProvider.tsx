'use client'

import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/config/wagmi'
import { useState } from 'react'

export function RainbowProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1_000 * 30, // 30 seconds - shorter cache for DeFi data
        networkMode: 'offlineFirst',
        refetchOnWindowFocus: true, // Refetch when window regains focus
        retry: 0,
        staleTime: 1_000 * 5, // 5 seconds - more aggressive staleness for real-time data
      },
    },
  }))

  // RainbowKit provider initialized

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#667eea',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          showRecentTransactions={true}
          appInfo={{
            appName: 'Neovalend Lending',
            learnMoreUrl: 'https://neovalend.finance',
            disclaimer: () => (
              <div className="text-sm text-gray-400 text-center">
                ₽ubleN - лендинговый протокол
              </div>
            ),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}