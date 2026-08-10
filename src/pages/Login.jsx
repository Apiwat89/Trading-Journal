import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('') // เพิ่ม State สำหรับ Confirm Password
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else navigate('/')
    } else if (mode === 'signup') {
      // ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        setBusy(false)
        return
      }

      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else {
        setInfo('Registration successful. Please verify your email before logging in.')
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      })
      if (error) {
        setError(error.message)
      } else {
        setInfo('Password reset link has been sent to your email.')
        setMode('signin')
      }
    }
    
    setBusy(false)
  }

  const resetForm = () => {
    setError('')
    setInfo('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">◆ Trade Journal</div>
        <h1>
          {mode === 'signin' ? 'Login' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
        </h1>
        <p className="auth-sub">
          {mode === 'forgot' 
            ? 'Enter your email to receive a password reset link.' 
            : 'Record and analyze your trades, kept private.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          
          {mode !== 'forgot' && (
            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}

          {/* แสดงช่อง Confirm Password เฉพาะตอนโหมดสมัครสมาชิก */}
          {mode === 'signup' && (
            <label>
              Confirm Password
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
          )}

          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-info">{info}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy 
              ? 'Processing...' 
              : mode === 'signin' 
                ? 'Login' 
                : mode === 'signup' 
                  ? 'Sign Up' 
                  : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
          {mode !== 'forgot' && (
            <button
              type="button"
              className="auth-switch"
              style={{ marginTop: 0 }}
              onClick={() => {
                setMode('forgot')
                resetForm()
              }}
            >
              Forgot Password?
            </button>
          )}

          <button
            type="button"
            className="auth-switch"
            style={{ marginTop: 0 }}
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              resetForm()
            }}
          >
            {mode === 'signin' 
              ? "Don't have an account? Sign Up" 
              : 'Back to Login'}
          </button>
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
            Contact Admin (Line)
          </a>
        </div>
      </div>
    </div>
  )
}