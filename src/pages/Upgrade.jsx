import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Upgrade() {
  const { user, profile, limits } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const currentTier = profile?.tier || 'free'

  const handleCheckout = async () => {
    if (!user) return
    setLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { userId: user.id, email: user.email },
      })

      if (error) throw error
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
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'block', textAlign: 'center', marginBottom: '40px' }}>
        <Link to="/" className="breadcrumb" style={{ justifyContent: 'center', marginBottom: '16px' }}>← Back to Dashboard</Link>
        <h1>Upgrade Your Plan</h1>
        <p className="page-sub">Choose the right plan to accelerate your trading journey.</p>
      </div>

      <div className="pricing-grid">
        
        {/* Free Plan */}
        <div className="panel pricing-card" style={{ opacity: currentTier === 'free' ? 1 : 0.7 }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Starter (Free)</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>0 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>/ month</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-dim)', fontSize: '14px' }}>
              <li>✓ Record up to 15 trades / month</li>
              <li>✓ Create up to 2 categories</li>
              <li>✓ Basic AI trade summaries (1 time / day)</li>
              <li>✓ Basic statistical overview</li>
              <li>✓ Attach 2 images / trade</li>
            </ul>
          </div>
          {currentTier === 'free' && <button className="btn btn-ghost" disabled style={{ width: '100%' }}>Current Plan</button>}
        </div>

        {/* Pro Plan */}
        <div className="panel pricing-card pro-card">
          <div>
            <div style={{ display: 'inline-block', background: 'var(--gold)', color: '#000', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px' }}>RECOMMENDED</div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--gold)' }}>Pro Plan</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>79 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>/ month</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)', fontSize: '14px' }}>
              <li>✓ Record up to 120 trades / month</li>
              <li>✓ Create up to 10 categories</li>
              <li>✓ Advanced AI analysis (5 times / day)</li>
              <li>✓ Unlock all advanced stats</li>
              <li>✓ Expanded storage to 4 images / trade</li>
            </ul>
          </div>

          <div>
            {message && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{message}</div>}
            {currentTier === 'pro' ? (
              <button className="btn" disabled style={{ width: '100%', background: 'var(--gold)', color: '#000' }}>Active</button>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', background: 'var(--gold)', color: '#000', fontWeight: 'bold' }} onClick={handleCheckout} disabled={loading || currentTier === 'pro_premium'}>
                {loading ? 'Connecting...' : 'Upgrade to Pro'} 
              </button>
            )}
          </div>
        </div>

        {/* Pro Premium Plan */}
        <div className="panel pricing-card" style={{ borderColor: 'var(--ai-border)', background: 'linear-gradient(160deg, rgba(155, 140, 251, 0.05), transparent)' }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--ai-2)' }}>Pro Premium</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>199 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>/ month</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-dim)', fontSize: '14px' }}>
              <li>✓ Record up to 500 trades / month</li>
              <li>✓ Unlimited categories</li>
              <li>✓ Deep AI analysis (20 times / day)</li>
              <li>✓ Unlock all advanced stats</li>
              <li>✓ <strong style={{ color: 'var(--ai-2)' }}>AI Vision (Reads charts from images)</strong></li>
              <li>✓ Expanded storage to 8 images / trade</li>
            </ul>
          </div>
          <button className="btn btn-ai" disabled style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed' }}>
            Coming Soon...
          </button>
        </div>

      </div>
    </div>
  )
}