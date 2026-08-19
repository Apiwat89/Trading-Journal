import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

export default function SpotlightTour() {
  const { t } = useLanguage() // 🌟 ดึง t() มาใช้งาน
  const [isVisible, setIsVisible] = useState(() => !localStorage.getItem('hasSeenTour'))
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState(null)
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  
  const [isLocating, setIsLocating] = useState(true)
  const locatingRef = useRef(true)

  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = windowSize.w <= 768

  useEffect(() => {
    const handleStartTour = () => {
      navigate('/')
      setCurrentStep(0)
      setIsVisible(true)
    }
    window.addEventListener('start-tour', handleStartTour)
    return () => window.removeEventListener('start-tour', handleStartTour)
  }, [navigate])

  useEffect(() => {
    const path = location.pathname
    
    if (path === '/categories' && currentStep === 0) setCurrentStep(1)
    if (path.match(/^\/categories\/[^/]+$/) && currentStep === 2) setCurrentStep(3)
    if (path.match(/^\/categories\/[^/]+\/new$/) && currentStep === 3) setCurrentStep(4)
    if (path.match(/^\/categories\/[^/]+$/) && currentStep === 4) setCurrentStep(5)
    if (path.match(/^\/trades\/[^/]+$/) && (currentStep === 6 || currentStep === 5)) setCurrentStep(7)
    // 🌟 ดักจับตอนกดปุ่มเมนู Dashboard แล้วค่อยขยับไปสเตปโชว์ภาพรวม
    if (path === '/' && currentStep === 8) setCurrentStep(9)
    if (path === '/settings' && currentStep === 11) setCurrentStep(12)
    if (path === '/upgrade' && currentStep === 13) setCurrentStep(14)
    
  }, [location.pathname, currentStep])

  const getStepData = (step) => {
    switch(step) {
      case 0: return {
        targetId: isMobile ? 'tour-categories-mobile' : 'tour-categories-desktop',
        title: t('tourStep0Title'),
        desc: t('tourStep0Desc'),
        showNext: true,
        onNext: () => navigate('/categories')
      }
      case 1: return {
        targetId: 'tour-add-category',
        title: t('tourStep1Title'),
        desc: t('tourStep1Desc'),
        showNext: true,
        onNext: () => setCurrentStep(2)
      }
      case 2: return {
        targetId: 'tour-category-card-0',
        title: t('tourStep2Title'),
        desc: t('tourStep2Desc'),
        showNext: false,
      }
      case 3: return {
        targetId: isMobile ? 'tour-new-trade-mobile' : 'tour-new-trade-desktop',
        title: t('tourStep3Title'),
        desc: t('tourStep3Desc'),
        showNext: false,
      }
      case 4: return {
        targetId: '.trade-form', 
        title: t('tourStep4Title'),
        desc: (
          <>
            {t('tourStep4Desc1')}<strong>{t('tourStep4Desc2')}</strong>{t('tourStep4Desc3')}<br/><br/>
            <span style={{ color: 'var(--win)', fontWeight: 'bold' }}>
              {t('tourStep4Hint')}
            </span>
          </>
        ),
        showNext: false,
        scrollPosition: 'start', 
        tooltipFixed: true 
      }
      case 5: return {
        targetId: 'tour-category-ai',
        title: t('tourStep5Title'),
        desc: t('tourStep5Desc'),
        showNext: true,
        onNext: () => setCurrentStep(6)
      }
      case 6: return {
        targetId: 'tour-trade-card',
        title: t('tourStep6Title'),
        desc: t('tourStep6Desc'),
        showNext: false,
      }
      case 7: return {
        targetId: 'tour-trade-ai',
        title: t('tourStep7Title'),
        desc: t('tourStep7Desc'),
        showNext: true,
        onNext: () => setCurrentStep(8) // ขยับไปสเตปชี้ปุ่ม Dashboard
      }
      case 8: return {
        // 🌟 สเตปใหม่: ล็อกสปอตไลต์ไปที่ปุ่มเมนู Dashboard ก่อนวาร์ป
        targetId: isMobile ? 'tour-dashboard-mobile' : 'tour-dashboard-desktop',
        title: t('tourStep8Title'),
        desc: t('tourStep8Desc'),
        showNext: true,
        onNext: () => navigate('/') // กดแล้วพาวาร์ปกลับหน้า Dashboard
      }
      case 9: return {
        targetId: 'tour-dashboard-stats',
        title: t('tourStep9Title'),
        desc: t('tourStep9Desc'),
        showNext: true,
        onNext: () => setCurrentStep(10),
        tooltipFixed: isMobile 
      }
      case 10: return {
        targetId: 'tour-ai', 
        title: t('tourStep10Title'),
        desc: t('tourStep10Desc'),
        showNext: true,
        onNext: () => setCurrentStep(11),
        tooltipFixed: isMobile 
      }
      case 11: return {
        targetId: isMobile ? 'tour-settings-mobile' : 'tour-settings-desktop', 
        title: t('tourStep11Title'),
        desc: t('tourStep11Desc'),
        showNext: true,
        onNext: () => navigate('/settings')
      }
      case 12: return {
        targetId: null, 
        title: t('tourStep12Title'),
        desc: t('tourStep12Desc'),
        showNext: true,
        onNext: () => setCurrentStep(13) 
      }
      case 13: return {
        targetId: 'tour-upgrade-desktop',
        title: t('tourStep13Title'),
        desc: t('tourStep13Desc'),
        showNext: true,
        onNext: () => navigate('/upgrade')
      }
      case 14: return {
        targetId: null, 
        title: t('tourStep14Title'),
        desc: t('tourStep14Desc'),
        showNext: true,
        nextText: t('tourFinishBtn'),
        onNext: () => handleClose()
      }
      default: return null
    }
  }

  const stepData = getStepData(currentStep)

  const updateSpotlightPosition = useCallback(() => {
    if (locatingRef.current) return 

    if (stepData && stepData.targetId) {
      const el = stepData.targetId.startsWith('.') 
        ? document.querySelector(stepData.targetId) 
        : document.getElementById(stepData.targetId)

      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
      } else {
        setTargetRect(null)
      }
    } else {
      setTargetRect(null)
    }
    setWindowSize({ w: window.innerWidth, h: window.innerHeight })
  }, [stepData])

  useEffect(() => {
    if (!isVisible || !stepData) return

    setIsLocating(true)
    locatingRef.current = true
    setTargetRect(null) 

    let innerTimeout;
    const initTimeout = setTimeout(() => {
      let el = null
      if (stepData.targetId) {
        el = stepData.targetId.startsWith('.') 
          ? document.querySelector(stepData.targetId) 
          : document.getElementById(stepData.targetId)

        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: stepData.scrollPosition || 'center' })
        }
      }
      
      innerTimeout = setTimeout(() => {
        locatingRef.current = false
        setIsLocating(false)
        updateSpotlightPosition()
      }, 500) 

    }, 100) 

    return () => {
      clearTimeout(initTimeout)
      if (innerTimeout) clearTimeout(innerTimeout)
    }
  }, [currentStep, isVisible, location.pathname]) 

  useEffect(() => {
    if (!isVisible) return
    window.addEventListener('resize', updateSpotlightPosition)
    window.addEventListener('scroll', updateSpotlightPosition)
    return () => {
      window.removeEventListener('resize', updateSpotlightPosition)
      window.removeEventListener('scroll', updateSpotlightPosition)
    }
  }, [updateSpotlightPosition, isVisible])

  const handleClose = () => {
    setIsVisible(false)
    localStorage.setItem('hasSeenTour', 'true')
  }

  if (!isVisible || !stepData) return null

  const padding = 8
  let tooltipTop = '50%'
  let tooltipLeft = '50%'
  let transform = 'translate(-50%, -50%)'

  if (targetRect) {
    const isBottomNavTarget = stepData.targetId?.includes('-mobile')

    if (isBottomNavTarget) {
      tooltipTop = `${targetRect.top - padding - 24}px` 
      tooltipLeft = '50%' 
      transform = 'translate(-50%, -100%)' 
    } else {
      tooltipTop = `${targetRect.top + targetRect.height + padding + 16}px`
      tooltipLeft = targetRect.left
      transform = 'none'

      if (targetRect.left + 320 > windowSize.w) {
        tooltipLeft = Math.max(10, targetRect.left + targetRect.width - 320)
      }
      if (targetRect.top + targetRect.height + 250 > windowSize.h && !isBottomNavTarget) {
        tooltipTop = `${targetRect.top - padding - 24}px` 
        transform = 'translateY(-100%)'
      }
      if (tooltipLeft < 10) tooltipLeft = 10
    }
  }

  let tooltipStyle = {
    position: 'absolute', top: tooltipTop, left: tooltipLeft, transform: transform,
    width: '320px', padding: '24px', border: '1px solid var(--gold)',
    boxShadow: '0 8px 32px rgba(235, 172, 85, 0.2)', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'auto', zIndex: 10000
  }

  if (stepData.tooltipFixed) {
    tooltipStyle = {
      ...tooltipStyle,
      position: 'fixed',
      top: isMobile ? '24px' : 'auto', 
      bottom: isMobile ? 'auto' : '24px', 
      left: isMobile ? '50%' : 'auto',    
      right: isMobile ? 'auto' : '24px',
      transform: isMobile ? 'translateX(-50%)' : 'none',
      width: isMobile ? '90vw' : '320px',
      maxWidth: '350px'
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      
      {targetRect && !isLocating ? (
        <div style={{
          position: 'absolute', top: targetRect.top - padding, left: targetRect.left - padding,
          width: targetRect.width + padding * 2, height: targetRect.height + padding * 2,
          borderRadius: '8px', boxShadow: '0 0 0 9999px rgba(5, 6, 10, 0.85)', 
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', pointerEvents: 'none'
        }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5, 6, 10, 0.85)', pointerEvents: 'none', transition: 'all 0.4s ease' }} />
      )}

      <div className="panel" style={tooltipStyle}>
        {isLocating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '140px' }}>
            <style>{`
              @keyframes tourSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            <div style={{ 
              width: '40px', height: '40px', 
              border: '4px solid rgba(235, 172, 85, 0.15)', 
              borderTopColor: 'var(--gold)', 
              borderRadius: '50%', 
              animation: 'tourSpin 1s linear infinite',
              marginBottom: '16px'
            }} />
            <div style={{ color: 'var(--gold)', fontSize: '16px', fontWeight: 'bold' }}>
              {t('tourLocating')}
            </div>
          </div>
        ) : (
          <>
            <button onClick={handleClose} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
              {t('tourSkipBtn')}
            </button>

            <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--gold)', minHeight: '28px', paddingRight: '20px' }}>
              {stepData.title}
            </h3>
            <p style={{ color: 'var(--text)', fontSize: '14.5px', lineHeight: '1.6', marginBottom: '24px', minHeight: '85px' }}>
              {stepData.desc}
            </p>

            {stepData.showNext && (
              <button className="btn btn-primary" onClick={stepData.onNext} style={{ width: '100%', padding: '10px', fontWeight: 'bold', background: stepData.nextText ? 'var(--win)' : 'var(--gold)', color: '#000', borderColor: stepData.nextText ? 'var(--win)' : 'var(--gold)' }}>
                {stepData.nextText || t('tourNextBtn')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}