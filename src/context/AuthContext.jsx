import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null) // เพิ่ม state สำหรับเก็บ profile
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
          // เช็กว่าข้ามวันหรือยัง ถัาข้ามวันแล้วให้รีเซ็ตโควต้า AI กลับเป็น 0
          const today = new Date().toISOString().split('T')[0]
          if (data.last_ai_reset_date !== today) {
            const { data: updatedData } = await supabase
              .from('profiles')
              .update({ ai_usage_count: 0, last_ai_reset_date: today })
              .eq('id', currentSession.user.id)
              .select()
              .single()
            setProfile(updatedData || data)
          } else {
            setProfile(data)
          }
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
    profile, // ส่ง profile ออกไปให้หน้าอื่นใช้ได้
    loading,
    incrementAiUsage, // ส่งฟังก์ชันนับการใช้ AI ออกไป
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}