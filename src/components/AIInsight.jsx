import { useEffect, useState } from 'react'
import { askGemini, hasGeminiKey } from '../lib/gemini'

/**
 * Renders a very small markdown subset (paragraphs, **bold**, "- " bullet
 * lists, "1. " numbered lists) into JSX. We avoid dangerouslySetInnerHTML
 * entirely since this text comes from a third-party API response.
 */
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

/**
 * @param {object} props
 * @param {string} props.title - card heading, e.g. "AI วิเคราะห์ภาพรวมพอร์ต"
 * @param {string} props.cacheKey - stable localStorage key for this analysis context
 * @param {string} props.signature - fingerprint of the underlying data; when it
 *   changes we tell the user their cached analysis may be outdated
 * @param {() => string} props.buildPrompt - returns the prompt text to send
 * @param {boolean} [props.disabled] - true when there isn't enough data yet
 * @param {string} [props.disabledHint] - message shown when disabled
 * @param {string} [props.actionLabel] - button label for the first run
 */
export default function AIInsight({
  title,
  cacheKey,
  signature,
  buildPrompt,
  disabled,
  disabledHint,
  actionLabel = 'ให้ AI วิเคราะห์',
}) {
  const [result, setResult] = useState(null) // { text, signature, generatedAt }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKey)
      setResult(raw ? JSON.parse(raw) : null)
    } catch {
      setResult(null)
    }
    setError('')
  }, [cacheKey])

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const prompt = buildPrompt()
      const text = await askGemini(prompt)
      const payload = { text, signature, generatedAt: new Date().toISOString() }
      setResult(payload)
      try {
        localStorage.setItem(cacheKey, JSON.stringify(payload))
      } catch {
        // localStorage full/unavailable — not fatal, just won't cache
      }
    } catch (e) {
      setError(e.message || 'เกิดข้อผิดพลาดในการวิเคราะห์')
    } finally {
      setLoading(false)
    }
  }

  const stale = result && result.signature !== signature

  return (
    <div className="ai-card">
      <div className="ai-card-head">
        <span className="ai-badge">
          <span className="ai-dot" />
          {title}
        </span>
        {!disabled && hasGeminiKey() && (
          <button className="btn btn-ai btn-small" onClick={run} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> กำลังวิเคราะห์...
              </>
            ) : result ? (
              'วิเคราะห์ใหม่'
            ) : (
              actionLabel
            )}
          </button>
        )}
      </div>

      {disabled ? (
        <div className="ai-card-empty">{disabledHint || 'ยังไม่มีข้อมูลพอให้วิเคราะห์'}</div>
      ) : !hasGeminiKey() ? (
        <div className="ai-card-empty">
          ยังไม่ได้ตั้งค่า Gemini API key — เพิ่ม <code>VITE_GEMINI_API_KEY</code> ในไฟล์ <code>.env</code> แล้วรีสตาร์ท
          dev server เพื่อเปิดใช้ฟีเจอร์นี้
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
            วิเคราะห์เมื่อ {new Date(result.generatedAt).toLocaleString('th-TH')}
            {stale ? ' · ข้อมูลมีการเปลี่ยนแปลงตั้งแต่ครั้งล่าสุด กด "วิเคราะห์ใหม่" เพื่ออัปเดต' : ''}
          </div>
        </>
      ) : (
        <div className="ai-card-empty">กดปุ่มด้านบนให้ Gemini ช่วยอ่านสถิติและสรุปให้ฟัง</div>
      )}

      {error && <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
    </div>
  )
}
