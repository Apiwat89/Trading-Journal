import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

// ฟังก์ชันสำหรับแปลงวันที่เป็น พิกัดเวลาท้องถิ่น 'YYYY-MM-DD' (แก้ปัญหาติดเวลา UTC)
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
        // ดึงข้อมูลแพ็กเกจและโควต้า AI
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single()

        if (data && mounted) {
          // ใช้ฟังก์ชันดึงวันที่ตามเวลาท้องถิ่นของเครื่องผู้ใช้
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

          // ---------------------------------------------------------
          // ระบบเช็กวันหมดอายุ Pro อัตโนมัติ (ถ้าหมดเวลา ให้ดรอปกลับเป็น free)
          // ---------------------------------------------------------
          if (currentProfile.tier === 'pro' && currentProfile.pro_expires_at) {
            const expiresAt = new Date(currentProfile.pro_expires_at)
            const now = new Date()

            if (now >= expiresAt) {
              // ถ้าหมดเวลาแล้ว -> อัปเดตฐานข้อมูลกลับเป็น free ทันที
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

  // ฟังก์ชันคำนวณเวลา Pro ที่เหลืออยู่แบบเรียลไทม์
  const getProTimeRemaining = () => {
    if (!profile || profile.tier !== 'pro' || !profile.pro_expires_at) return null

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

  // ฟังก์ชันสำหรับเรียกใช้เวลาที่กดใช้ AI เพื่อเพิ่มจำนวนนับทีละ 1
  const incrementAiUsage = async () => {
    if (!user || !profile) return false
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

  const value = {
    session,
    user,
    profile,
    loading,
    incrementAiUsage,
    getProTimeRemaining,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}