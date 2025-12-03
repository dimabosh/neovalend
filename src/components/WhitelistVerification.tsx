'use client'

import { useAccount, useConnect } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useState, useEffect } from 'react'

interface WhitelistVerificationProps {
  onVerified: () => void
}

// Whitelist addresses for testnet access
const WHITELIST_ADDRESSES = [
  '0xdc8b592Cc6b7154038618A2F9128C1bfe05033E1', // Current Deployer address (Phase 6 complete)
  '0x1a4bFAEc349BaCDfda25b209df534697D8a114aD', // New whitelisted address
  '0x38e14BA3B260Bf496ab146768391d67b7F52023E', // Additional whitelisted address
  '0x9876d5A1601D2E796e8Ed5151527609938070d9f', // New whitelist request
  '0x4679B8c6f79Ede34B832D8B3b7fCd2ad873A6dE8', // New whitelist request
  '0xE10A0C3E53aA262998C136D3c7a1C09f3A4eD223', // New whitelist request
  '0x25356AD5A24d0FbD31DBA12431405d0b516cfF90', // New whitelist request
  '0x6642993Fe1cE4bB5131aaf9c65a7c1be002a2eFE', // New whitelist request
  '0xacEE2FcB293F92D2948437EBE8D72F2408942179', // New whitelist request
  '0x7073A3D7d75dfc5Eba105765D79535941Faae963', // New whitelist request
  // Add more addresses as needed
].map(addr => addr.toLowerCase())

export default function WhitelistVerification({ onVerified }: WhitelistVerificationProps) {
  const { address, isConnected } = useAccount()
  const [isVerifying, setIsVerifying] = useState(false)
  const [isWhitelisted, setIsWhitelisted] = useState<boolean | null>(null)
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (isConnected && address) {
      setIsVerifying(true)

      // Simulate verification delay
      setTimeout(() => {
        const isAddressWhitelisted = WHITELIST_ADDRESSES.includes(address.toLowerCase())
        setIsWhitelisted(isAddressWhitelisted)
        setIsVerifying(false)

        if (isAddressWhitelisted) {
          // Grant access after short delay
          setTimeout(() => {
            onVerified()
          }, 1000)
        } else {
          setShowError(true)
        }
      }, 2000)
    } else {
      setIsWhitelisted(null)
      setShowError(false)
    }
  }, [isConnected, address, onVerified])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mx-auto mb-4">
              <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Testnet Access
            </h1>
            <p className="text-gray-400 text-sm">
              Connect your wallet to verify access
            </p>
          </div>

          {/* Wallet Connection */}
          {!isConnected && (
            <div className="text-center">
              <div className="mb-6">
                <ConnectButton.Custom>
                  {({ account, chain, openConnectModal, mounted }) => {
                    if (!mounted) return null

                    return (
                      <button
                        onClick={openConnectModal}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:opacity-90 transition-all duration-200 transform hover:scale-105"
                      >
                        Connect Wallet
                      </button>
                    )
                  }}
                </ConnectButton.Custom>
              </div>
              <p className="text-xs text-gray-500">
                MetaMask, WalletConnect and others supported
              </p>
            </div>
          )}

          {/* Verification Process */}
          {isConnected && isVerifying && (
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-300 mb-2">Verifying access...</p>
              <p className="text-xs text-gray-500">
                Address: {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
          )}

          {/* Success State */}
          {isWhitelisted === true && (
            <div className="text-center">
              <div className="flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-green-400 mb-2">
                Access granted!
              </h3>
              <p className="text-gray-400 text-sm">
                Redirecting to platform...
              </p>
            </div>
          )}

          {/* Error State */}
          {isWhitelisted === false && showError && (
            <div className="text-center">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6">
                <p className="text-gray-300 text-sm mb-2">
                  Your wallet is not in the testing whitelist.
                </p>
                <p className="text-gray-300 text-sm">
                  If this is an error, please contact us.
                </p>
              </div>

              {/* Disconnect Option */}
              <div className="mt-6 pt-4 border-t border-gray-700">
                <ConnectButton.Custom>
                  {({ account, openAccountModal }) => (
                    account && (
                      <button
                        onClick={openAccountModal}
                        className="text-sm text-gray-400 hover:text-gray-300 underline"
                      >
                        Disconnect wallet
                      </button>
                    )
                  )}
                </ConnectButton.Custom>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Neovalend Testnet • Only for whitelisted wallets
          </p>
        </div>
      </div>
    </div>
  )
}