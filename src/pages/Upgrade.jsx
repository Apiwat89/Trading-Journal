import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Upgrade() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const isPro = profile?.tier === 'pro'

  const handleCheckout = async () => {
    if (!user) return
    setLoading(true)
    setMessage('')

    try {
      // เรียกใช้งาน Supabase Edge Function เพื่อสร้าง Checkout Session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { userId: user.id, email: user.email },
      })

      if (error) throw error
      // ถ้า Edge Function ส่ง url กลับมา ให้พาผู้ใช้พุ่งไปหน้าจ่ายเงินของ Stripe ได้เลย
      if (data && data.url) {
        window.location.href = data.url
      } else {
        throw new Error('Failed to retrieve checkout URL.')
      }
    } catch (err) {
      setMessage(`Payment Error: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <Link to="/" className="breadcrumb">← Back to Dashboard</Link>
          <h1>Upgrade Plan</h1>
          <p className="page-sub">Unlock unlimited potential and advanced AI analytics for your trading journey.</p>
        </div>
      </div>

      {isPro ? (
        <div className="panel" style={{ textAlign: 'center', padding: '32px', borderColor: 'var(--win)' }}>
          <h3 style={{ color: 'var(--win)', marginBottom: '12px', fontSize: '22px' }}>✨ You are currently on Pro Plan</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '20px' }}>
            Enjoy unlimited categories, unlimited monthly trades, and full AI insights!
          </p>
          <Link to="/" className="btn btn-primary">Go to Dashboard</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }}>
          
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Free Plan</h3>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>0 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>/ forever</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-dim)', fontSize: '14px' }}>
                <li>✓ Max 3 Categories</li>
                <li>✓ Max 20 Trades / month</li>
                <li>✓ AI Analysis (2 times / day)</li>
                <li>✓ Basic Dashboard & Equity Curve</li>
              </ul>
            </div>
            <button className="btn btn-ghost" disabled style={{ width: '100%' }}>Current Plan</button>
          </div>

          <div className="panel" style={{ borderColor: 'var(--gold-glow)', background: 'rgba(212, 175, 55, 0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'inline-block', background: 'var(--gold)', color: '#000', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px' }}>POPULAR</div>
              <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--gold)' }}>Pro Plan</h3>
              <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>35 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>/ month</span></div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)', fontSize: '14px' }}>
                <li>✓ <strong>Unlimited</strong> Categories</li>
                <li>✓ Max 120 Trades / month</li>
                <li>✓ AI Analysis (<strong>8 times / day</strong>) <strong>Pro Analysis</strong></li>
                <li>✓ Full Advanced Dashboard & Deep Analytics</li>
              </ul>
            </div>

            <div>
              {message && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{message}</div>}
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'var(--gold)', color: '#000', fontWeight: 'bold' }}
                onClick={handleCheckout}
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Pay'} 
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}