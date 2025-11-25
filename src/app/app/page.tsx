'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const DynamicDashboard = dynamic(() => import('@/components/Dashboard').then(mod => ({ default: mod.Dashboard })), {
  loading: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ),
  ssr: false
})

export default function AppPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <DynamicDashboard />
    </Suspense>
  )
}