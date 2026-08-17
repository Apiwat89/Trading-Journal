import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Navbar() {
  const { user, profile, signOut, getProTimeRemaining } = useAuth()
  const { lang, toggleLang, t } = useLanguage()
  const navigate = useNavigate()

  if (!user) return null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const isPro = profile?.tier === 'pro' || profile?.tier === 'pro_premium'

  return (
    <>
      <header className="navbar">
        <div className="navbar-brand">
          <span className="navbar-mark">◆</span> Trade Journal
        </div>
        
        <nav className="navbar-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('dashboard')}
          </NavLink>
          <NavLink to="/categories" className={({ isActive }) => (isActive ? 'active' : '')}>
            {t('categories')}
          </NavLink>
        </nav>

        {/* --- Pro Badge (Clickable to Upgrade Page) or Upgrade Button --- */}
        <div className="navbar-pro-container">
          {isPro ? (
            <div 
              className="navbar-pro-badge" 
              onClick={() => navigate('/upgrade')}
              style={{ cursor: 'pointer', transition: 'filter 0.15s' }}
              title="Click to view plan details"
            >
              <span>{t('proPlan')}</span>
              <span className="pro-time">({getProTimeRemaining()})</span>
            </div>
          ) : (
            <button 
              className="btn btn-primary btn-small navbar-upgrade-btn" 
              onClick={() => navigate('/upgrade')}
            >
              {t('upgradePro')}
            </button>
          )}
        </div>
        {/* ---------------------------------------------------- */}

        <div className="navbar-user">
          {/* ปุ่มสลับภาษา EN / TH บน Desktop */}
          <button 
            className="btn btn-ghost btn-small" 
            onClick={toggleLang}
            style={{ fontWeight: 'bold', minWidth: '50px', marginRight: '8px' }}
            title="Switch Language"
          >
            {lang === 'en' ? 'English' : 'ไทย'}
          </button>

          <span className="navbar-email">{user.email}</span>
          <button className="btn btn-ghost btn-small" onClick={() => navigate('/settings')} style={{ marginRight: '8px' }}>
            ⚙️ {t('settings')}
          </button>
          <button className="btn btn-ghost btn-small" onClick={handleSignOut}>
            {t('signOut')}
          </button>
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1"/>
            <rect width="7" height="5" x="14" y="3" rx="1"/>
            <rect width="7" height="9" x="14" y="12" rx="1"/>
            <rect width="7" height="5" x="3" y="16" rx="1"/>
          </svg>
          {t('dashboard')}
        </NavLink>
        
        <NavLink to="/categories" className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 12 12 17 22 12"/>
            <polyline points="2 17 12 22 22 17"/>
          </svg>
          {t('categories')}
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          {t('settings')}
        </NavLink>
        
        {/* 🌟 ปุ่มสลับภาษาบนมือถือ แสดงคำว่า ไทย หรือ English ตามภาษาปัจจุบัน */}
        <button className="bottom-nav-item" onClick={toggleLang}>
          <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" x2="22" y1="12" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          {lang === 'en' ? 'English' : 'ไทย'}
        </button>

        <button className="bottom-nav-item" onClick={handleSignOut}>
          <svg className="icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" x2="9" y1="12" y2="12"/>
          </svg>
          {t('signOut')}
        </button>
      </nav>
    </>
  )
}