import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

export default function DevelopmentAlert() {
  const { t } = useLanguage()
  
  // 🌟 ตั้งค่าเป็น true เลย เพื่อให้แสดงขึ้นมาทันทีที่โหลดเว็บหรือรีเฟรช
  const [isVisible, setIsVisible] = useState(true)

  const handleClose = () => {
    // 🌟 เปลี่ยนแค่ state พอรีเฟรชหน้าเว็บ state ก็จะรีเซ็ตกลับไปเป็น true ใหม่
    setIsVisible(false) 
  }

  if (!isVisible) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999, // ให้อยู่หน้าสุดเสมอ
      background: 'rgba(5, 6, 10, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div className="panel" style={{
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
        padding: '32px 24px',
        border: '1px solid var(--gold)',
        boxShadow: '0 8px 32px rgba(235, 172, 85, 0.15)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <h2 style={{ fontSize: '22px', marginBottom: '16px', color: 'var(--gold)' }}>
          {t('devAlertTitle')}
        </h2>
        <p style={{ color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '24px' }}>
          {t('devAlertDesc')}
        </p>
        <button 
          className="btn btn-primary" 
          onClick={handleClose}
          style={{ width: '100%', fontWeight: 'bold' }}
        >
          {t('devAlertBtn')}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}