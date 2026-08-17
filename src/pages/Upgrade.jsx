import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext' // 🌟 นำเข้าระบบแปลภาษา

export default function Upgrade() {
  const { user, profile, limits } = useAuth()
  const { t } = useLanguage() // 🌟 ดึงฟังก์ชันแปลมาใช้งาน
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
      setMessage(`${t('paymentError')} ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'block', textAlign: 'center', marginBottom: '40px' }}>
        <Link to="/" className="breadcrumb" style={{ justifyContent: 'center', marginBottom: '16px' }}>{t('backToDashboard')}</Link>
        <h1>{t('upgradeTitle')}</h1>
        <p className="page-sub">{t('upgradeSub')}</p>
      </div>

      <div className="pricing-grid">
        
        {/* Free Plan */}
        <div className="panel pricing-card" style={{ opacity: currentTier === 'free' ? 1 : 0.7 }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{t('freePlanName')}</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>0 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>{t('perMonth')}</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-dim)', fontSize: '14px' }}>
              <li>{t('freeF1')}</li>
              <li>{t('freeF2')}</li>
              <li>{t('freeF3')}</li>
              <li>{t('freeF4')}</li>
              <li>{t('freeF5')}</li>
            </ul>
          </div>
          {currentTier === 'free' && <button className="btn btn-ghost" disabled style={{ width: '100%' }}>{t('currentPlanBtn')}</button>}
        </div>

        {/* Pro Plan */}
        <div className="panel pricing-card pro-card">
          <div>
            <div style={{ display: 'inline-block', background: 'var(--gold)', color: '#000', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px' }}>{t('recommendedBadge')}</div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--gold)' }}>{t('proPlanName')}</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>79 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>{t('perMonth')}</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)', fontSize: '14px' }}>
              <li>{t('proF1')}</li>
              <li>{t('proF2')}</li>
              <li>{t('proF3')}</li>
              <li>{t('proF4')}</li>
              <li>{t('proF5')}</li>
            </ul>
          </div>

          <div>
            {message && <div className="alert alert-error" style={{ marginBottom: '12px' }}>{message}</div>}
            {currentTier === 'pro' ? (
              <button className="btn" disabled style={{ width: '100%', background: 'var(--gold)', color: '#000' }}>{t('activeBtn')}</button>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%', background: 'var(--gold)', color: '#000', fontWeight: 'bold' }} onClick={handleCheckout} disabled={loading || currentTier === 'pro_premium'}>
                {loading ? t('connectingBtn') : t('upgradeToProBtn')} 
              </button>
            )}
          </div>
        </div>

        {/* Pro Premium Plan */}
        <div className="panel pricing-card" style={{ borderColor: 'var(--ai-border)', background: 'linear-gradient(160deg, rgba(155, 140, 251, 0.05), transparent)' }}>
          <div>
            <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--ai-2)' }}>{t('premPlanName')}</h3>
            <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '16px' }}>199 THB <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-dim)' }}>{t('perMonth')}</span></div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-dim)', fontSize: '14px' }}>
              <li>{t('premF1')}</li>
              <li>{t('premF2')}</li>
              <li>{t('premF3')}</li>
              <li>{t('premF4')}</li>
              <li><strong style={{ color: 'var(--ai-2)' }}>{t('premF5')}</strong></li>
              <li>{t('premF6')}</li>
            </ul>
          </div>
          <button className="btn btn-ai" disabled style={{ width: '100%', opacity: 0.7, cursor: 'not-allowed' }}>
            {t('comingSoonBtn')}
          </button>
        </div>

      </div>
    </div>
  )
}