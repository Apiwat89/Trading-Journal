import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext' // 🌟 นำเข้า useLanguage

export default function Settings() {
  const { user } = useAuth()
  const { t } = useLanguage() // 🌟 ดึง t มาใช้
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    
    if (password !== confirmPassword) {
      setError(t('passwordMismatch')) // 🌟 ใช้คำแปล
      return
    }
    if (password.length < 6) {
      setError(t('passwordTooShort')) // 🌟 ใช้คำแปล
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })
    setLoading(false)

    if (updateError) {
      setError(updateError.message) // error จากระบบ supabase
    } else {
      setMessage(t('passwordUpdated')) // 🌟 ใช้คำแปล
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <h1>{t('settings')}</h1>
          <p className="page-sub">{t('settingsDesc')}</p>
        </div>
      </div>

      <div className="panel">
        <h2>{t('changePassword')}</h2>
        <form onSubmit={handleUpdatePassword} style={{ marginTop: '18px' }}>
          <label className="field">
            {t('newPassword')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <label className="field">
            {t('confirmNewPassword')}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-info" style={{ color: 'var(--win)', borderColor: 'var(--win)' }}>{message}</div>}

          <div style={{ marginTop: '16px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('updating') : t('updatePasswordBtn')}
            </button>
          </div>
        </form>
      </div>

      {/* --- ปุ่มติดต่อแอดมินผ่าน Line --- */}
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <a 
            href="https://line.me/ti/p/~earth123a" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#06C755', // สีเขียวเอกลักษณ์ของ Line
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              width: '100%',
              boxShadow: '0 4px 12px rgba(6, 199, 85, 0.25)',
              transition: 'filter 0.2s ease'
            }}
          > 
            {t('contactAdminLine')}
          </a>
        </div>
    </div>
  )
}