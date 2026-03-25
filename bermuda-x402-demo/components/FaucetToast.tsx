'use client'

import React from 'react'
import { CheckCircle, AlertCircle, Droplets } from 'lucide-react'

interface FaucetToastProps {
  toast: { type: 'success' | 'error'; message: string } | null
}

export function FaucetToast({ toast }: FaucetToastProps) {
  if (!toast) return null

  return (
    <div className="fixed bottom-40 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium whitespace-nowrap
        ${toast.type === 'success'
          ? 'bg-emerald-900/90 border-emerald-700/50 text-emerald-200'
          : 'bg-red-900/90 border-red-700/50 text-red-200'
        }`}
      >
        {toast.type === 'success'
          ? <><Droplets className="w-4 h-4 shrink-0" />{toast.message}</>
          : <><AlertCircle className="w-4 h-4 shrink-0" />{toast.message}</>
        }
        {toast.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0 ml-1" />}
      </div>
    </div>
  )
}
