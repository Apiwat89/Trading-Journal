import { useEffect, useState } from 'react'
import { askGemini, hasGeminiKey } from '../lib/gemini'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>
  })
}

function renderAiText(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let listBuffer = []
  let listType = null

  const flushList = () => {
    if (!listBuffer.length) return
    const Tag = listType === 'ol' ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </Tag>
    )
    listBuffer = []
    listType = null
  }

  lines.forEach((raw) => {
    const line = raw.trim()
    if (!line) {
      flushList()
      return
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)/)
    const numberedMatch = line.match(/^\d+[.)]\s+(.*)/)
    const headingMatch = line.match(/^#{1,4}\s+(.*)/)

    if (bulletMatch) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listBuffer.push(bulletMatch[1])
      return
    }
    if (numberedMatch) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listBuffer.push(numberedMatch[1])
      return
    }
    flushList()
    if (headingMatch) {
      blocks.push(<p key={`h-${blocks.length}`}><strong>{headingMatch[1]}</strong></p>)
      return
    }
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line, `p-${blocks.length}`)}</p>)
  })
  flushList()
  return blocks
}

export default function AIInsight({
  title,
  cacheKey,
  signature,
  buildPrompt,
  disabled,
  disabledHint,
  actionLabel = 'Generate AI Analysis',
}) {
  // 🌟 ดึง limits ออกมาจาก useAuth() เพื่อใช้โควต้าจากส่วนกลาง
  const { profile, limits, incrementAiUsage } = useAuth() 
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const { t } = useLanguage()

  const isFree = profile?.tier === 'free' || !profile?.tier
  
  // 🌟 เปลี่ยนมาใช้โควต้าจาก limits.ai แทนการ Hardcode
  const maxAiCalls = limits.ai 
  const currentAiCalls = profile?.ai_usage_count || 0
  
  // คำนวณโควต้าที่เหลือ
  const remainingQuota = Math.max(0, maxAiCalls - currentAiCalls)
  const isQuotaEmpty = currentAiCalls >= maxAiCalls

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        setResult(JSON.parse(raw))
        setIsExpanded(false)
      } else {
        setResult(null)
        setIsExpanded(true)
      }
    } catch {
      setResult(null)
      setIsExpanded(true)
    }
    setError('')
  }, [cacheKey])

  const run = async (e) => {
    if (e) e.stopPropagation()

    if (isQuotaEmpty) { 
      setError(t('quotaEmpty').replace('{remaining}', remainingQuota).replace('{max}', maxAiCalls).replace('{upgradeMessage}', isFree ? t('upgradeMessageFree') : t('upgradeMessagePro')))
      setIsExpanded(true)
      return
    }

    setLoading(true)
    setError('')
    setIsExpanded(true)
    
    try {
      const canProceed = await incrementAiUsage()
      if (!canProceed) {
        throw new Error(t('canProceed'))
      }

      const prompt = buildPrompt()
      const text = await askGemini(prompt)
      const payload = { text, signature, generatedAt: new Date().toISOString() }
      setResult(payload)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(payload))
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e.message || t('analysisError'))
    } finally {
      setLoading(false)
    }
  }

  const stale = result && result.signature !== signature

  return (
    <div className="ai-card">
      <div 
        className="ai-card-head"
        onClick={() => result && !loading && setIsExpanded(!isExpanded)}
        style={{ cursor: result && !loading ? 'pointer' : 'default', userSelect: 'none' }}
      >
        <span className="ai-badge">
          <span className="ai-dot" />
          {title}
        </span>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!disabled && hasGeminiKey() && (
            <span style={{ fontSize: '11px', color: isQuotaEmpty ? 'var(--loss)' : 'var(--text-faint)', fontWeight: 600 }}>
              {t('quota')}: {remainingQuota}/{maxAiCalls}
            </span>
          )}

          {result && !loading && (
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>
              {isExpanded ? t('hideAnalysis') : t('viewAnalysis')}
            </span>
          )}

          {!disabled && hasGeminiKey() && (
            <button className="btn btn-ai btn-small" onClick={run} disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> {t('Analyzing')}
                </>
              ) : result ? (
                t('regenerate')
              ) : (
                actionLabel
              )}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {disabled ? (
            <div className="ai-card-empty">{disabledHint || 'Not enough data for analysis yet.'}</div>
          ) : !hasGeminiKey() ? (
            <div className="ai-card-empty">
              {t('geminiApiKeyMissing')}
            </div>
          ) : loading && !result ? (
            <div className="ai-skeleton">
              <div className="ai-skeleton-line" style={{ width: '92%' }} />
              <div className="ai-skeleton-line" style={{ width: '78%' }} />
              <div className="ai-skeleton-line" style={{ width: '85%' }} />
            </div>
          ) : result ? (
            <>
              <div className="ai-card-body">{renderAiText(result.text)}</div>
              <div className="ai-card-meta">
                {t('Analyzedon')} {new Date(result.generatedAt).toLocaleString('en-US')}
                {stale ? ` · ${t('dataStale')}` : ''}
              </div>
            </>
          ) : (
            <div className="ai-card-empty">{t('showInsights')}</div>
          )}

          {error && <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
        </>
      )}
    </div>
  )
}