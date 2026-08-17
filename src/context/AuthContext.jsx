import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// 🌟 กำหนดโควต้าของแต่ละ Tier ที่นี่จุดเดียว
export const TIER_LIMITS = {
  free: { categories: 2, trades: 15, ai: 1, images: 2, name: 'Free' },
  pro: { categories: 10, trades: 120, ai: 5, images: 4, name: 'Pro' },
  pro_premium: { categories: 100, trades: 500, ai: 20, images: 8, name: 'Pro Premium' }
}

function getLocalDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadData(currentSession) {
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      
      if (currentSession?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single()

        if (data && mounted) {
          const today = getLocalDateString()
          let currentProfile = data

          if (data.last_ai_reset_date !== today) {
            const { data: updatedData } = await supabase
              .from('profiles')
              .update({ ai_usage_count: 0, last_ai_reset_date: today })
              .eq('id', currentSession.user.id)
              .select()
              .single()
            if (updatedData) currentProfile = updatedData
          }

          if (['pro', 'pro_premium'].includes(currentProfile.tier) && currentProfile.pro_expires_at) {
            const expiresAt = new Date(currentProfile.pro_expires_at)
            const now = new Date()

            if (now >= expiresAt) {
              const { data: expiredData } = await supabase
                .from('profiles')
                .update({ tier: 'free', pro_expires_at: null })
                .eq('id', currentSession.user.id)
                .select()
                .single()
              
              if (expiredData) currentProfile = expiredData
            }
          }

          setProfile(currentProfile)
        }
      } else {
        if (mounted) setProfile(null)
      }
      if (mounted) setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      loadData(initialSession)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      loadData(currentSession)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const getProTimeRemaining = () => {
    if (!profile || !['pro', 'pro_premium'].includes(profile.tier) || !profile.pro_expires_at) return null

    const now = new Date()
    const expiresAt = new Date(profile.pro_expires_at)
    const diffMs = expiresAt - now

    if (diffMs <= 0) return 'Expired'

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h left`
    } else {
      return `${diffHours}h left`
    }
  }

  const incrementAiUsage = async () => {
    if (!user || !profile) return false
    const currentLimit = TIER_LIMITS[profile.tier || 'free'].ai
    
    if (profile.ai_usage_count >= currentLimit) return false

    const newCount = profile.ai_usage_count + 1
    const { data, error } = await supabase
      .from('profiles')
      .update({ ai_usage_count: newCount })
      .eq('id', user.id)
      .select()
      .single()
    
    if (!error && data) {
      setProfile(data)
      return true
    }
    return false
  }

  // ส่ง limits ปัจจุบันของผู้ใช้ออกไป
  const currentTier = profile?.tier || 'free'
  const limits = TIER_LIMITS[currentTier] || TIER_LIMITS['free']

  const value = {
    session,
    user,
    profile,
    loading,
    limits,
    incrementAiUsage,
    getProTimeRemaining,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}