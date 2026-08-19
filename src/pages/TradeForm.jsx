import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AIInsight from '../components/AIInsight'
import Lightbox from '../components/Lightbox'
import { useLanguage } from '../context/LanguageContext'

function getLocalDatetimeString(dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const year = dateObj.getFullYear()
  const month = pad(dateObj.getMonth() + 1)
  const day = pad(dateObj.getDate())
  const hours = pad(dateObj.getHours())
  const minutes = pad(dateObj.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function pl(n) {
  const v = Number(n) || 0
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

const emptyForm = {
  direction: 'buy', entry_price: '', stop_loss: '', take_profit: '', lot_size: '',
  strategy: '', setup: '', timeframe: '', session: 'asia', plan_notes: '', news_notes: '',
  exit_price: '', profit_loss: '', result: 'open', duration_minutes: '', win_reason: '',
  loss_reason: '', lesson: '', followed_plan: true, mistake_tags: '',
  before_image_url: '', before_image_url_2: '', 
  after_image_url: '', after_image_url_2: '', 
  traded_at: getLocalDatetimeString(),
}

const DEFAULT_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']
const DEFAULT_STRATEGIES = ['SMC', 'Price Action', 'EMA Cross', 'Breakout', 'Trend Following']
const DEFAULT_SETUPS = ['BOS + Support', 'Double Top/Bottom', 'Liquidity Sweep', 'Order Block', 'Break & Retest']
const DEFAULT_MISTAKES = ['FOMO', 'Overtrade', 'Revenge trade', 'No confirmation', 'Didn\'t cut loss', 'No news']

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1280
        const MAX_HEIGHT = 1280
        let width = img.width
        let height = img.height
        
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' })), 'image/jpeg', 0.7)
      }
    }
    reader.onerror = (error) => reject(error)
  })
}

// 🌟 ระบบ Gallery
function HeroGallery({ form, isPro }) {
  const [zoomed, setZoomed] = useState(null)
  const [activeTab, setActiveTab] = useState(0)
  const { t } = useLanguage()

  const images = []
  if (form.before_image_url) images.push({ label: '🟦 ' + t('Before') + ' (1)', url: form.before_image_url, locked: false })
  if (form.before_image_url_2) images.push({ label: '🟦 ' + t('Before') + ' (2)', url: form.before_image_url_2, locked: !isPro })
  if (form.after_image_url) images.push({ label: '🟥 ' + t('After') + ' (1)', url: form.after_image_url, locked: false })
  if (form.after_image_url_2) images.push({ label: '🟥 ' + t('After') + ' (2)', url: form.after_image_url_2, locked: !isPro })

  if (images.length === 0) return null

  const currentImg = images[activeTab]

  return (
    <div className="hero-gallery">
      <div className="hero-gallery-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {images.map((img, i) => (
          <button 
            key={i} 
            type="button" 
            className={`hero-gallery-tab ${activeTab === i ? 'active' : ''}`} 
            onClick={() => setActiveTab(i)}
            style={{ opacity: img.locked ? 0.6 : 1 }}
          >
            {img.locked ? `${img.label}` : img.label}
          </button>
        ))}
      </div>

      <div className="hero-gallery-frame" style={{ position: 'relative', background: '#000', borderRadius: '14px', overflow: 'hidden', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentImg.locked ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2 style={{ color: 'var(--loss)', marginBottom: '12px', fontSize: '32px' }}>🔒</h2>
            <h3 style={{ color: 'var(--text)', marginBottom: '8px' }}>{t('imageLocked')}</h3>
            <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px' }}>
              {t('imageLockedDesc')}
            </p>
          </div>
        ) : (
          <>
            <img 
              src={currentImg.url} 
              alt="chart" 
              style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', cursor: 'zoom-in' }} 
              onClick={() => setZoomed(currentImg.url)}
            />
            <span className="hero-gallery-hint">{t('clickToEnlarge')} 🔍</span>
          </>
        )}
      </div>

      {zoomed && <Lightbox src={zoomed} alt="chart" onClose={() => setZoomed(null)} />}
    </div>
  )
}

export default function TradeForm() {
  const { lang, t } = useLanguage()
  const { categoryId, id } = useParams() 
  const editing = Boolean(id)
  const { user, profile, limits } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [resolvedCategoryId, setResolvedCategoryId] = useState(categoryId || null)
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState('') 
  const [monthlyTradeCount, setMonthlyTradeCount] = useState(0)
  const [isLockedCategory, setIsLockedCategory] = useState(false)

  const [availableTags, setAvailableTags] = useState(DEFAULT_MISTAKES)
  const [availableTimeframes, setAvailableTimeframes] = useState(DEFAULT_TIMEFRAMES)
  const [availableStrategies, setAvailableStrategies] = useState(DEFAULT_STRATEGIES)
  const [availableSetups, setAvailableSetups] = useState(DEFAULT_SETUPS)

  const isFree = profile?.tier === 'free' || !profile?.tier
  const isPro = profile?.tier === 'pro' || profile?.tier === 'pro_premium'
  const maxLimit = limits.trades

  useEffect(() => {
    const load = async () => {
      let currentCatId = categoryId

      if (editing) {
        const { data, error } = await supabase.from('trades').select('*').eq('id', id).single()
        if (error) { setError(error.message); setLoading(false); return }
        
        let formattedTradedAt = emptyForm.traded_at
        if (data.traded_at) formattedTradedAt = getLocalDatetimeString(new Date(data.traded_at))

        setForm({ ...emptyForm, ...data, mistake_tags: (data.mistake_tags || []).join(', '), traded_at: formattedTradedAt })
        currentCatId = data.category_id
        setResolvedCategoryId(currentCatId)
        
        const { data: cat } = await supabase.from('categories').select('name').eq('id', currentCatId).single()
        setCategoryName(cat?.name || '')
      } else {
        const { data: cat } = await supabase.from('categories').select('name').eq('id', categoryId).single()
        setCategoryName(cat?.name || '')
      }

      if (user && currentCatId) {
        const { data: allCats } = await supabase.from('categories').select('id').eq('user_id', user.id).order('created_at', { ascending: true })
        const catIndex = allCats?.findIndex(c => c.id === currentCatId)
        if (catIndex !== -1 && catIndex >= limits.categories) {
          setIsLockedCategory(true)
          if (!editing) {
            setError(`${t('categoryLockedDesc')}`)
            setLoading(false)
            return 
          }
        }
      }

      if (user) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const { count } = await supabase.from('trades').select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('traded_at', startOfMonth.toISOString())
        setMonthlyTradeCount(count || 0)

        const { data: pastData } = await supabase.from('trades').select('mistake_tags, timeframe, strategy, setup').eq('user_id', user.id)
        if (pastData) {
          setAvailableTags([...new Set([...DEFAULT_MISTAKES, ...pastData.flatMap(t => t.mistake_tags || [])])])
          setAvailableTimeframes([...new Set([...DEFAULT_TIMEFRAMES, ...pastData.map(t => t.timeframe).filter(Boolean)])])
          setAvailableStrategies([...new Set([...DEFAULT_STRATEGIES, ...pastData.map(t => t.strategy).filter(Boolean)])])
          setAvailableSetups([...new Set([...DEFAULT_SETUPS, ...pastData.map(t => t.setup).filter(Boolean)])])
        }
      }
      setLoading(false)
    }
    load()
  }, [editing, id, categoryId, user, limits.categories])

  const isLimitReached = !editing && monthlyTradeCount >= maxLimit

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const removeImage = (field) => {
    setForm((f) => ({ ...f, [field]: '' }))
  }

  const uploadImage = async (file, field) => {
    if (isLockedCategory) return 

    setUploading(field)
    setError('')
    
    try {
      const compressedFile = await compressImage(file)
      const path = `${user.id}/${Date.now()}_${field}_${compressedFile.name}`
      const { error: upErr } = await supabase.storage.from('trade-images').upload(path, compressedFile)
      if (upErr) throw upErr
      
      const { data } = supabase.storage.from('trade-images').getPublicUrl(path)
      setForm((f) => ({ ...f, [field]: data.publicUrl }))
    } catch (err) {
      setError(err.message || t('imageUploadFailed'))
    } finally {
      setUploading('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLockedCategory || error) return 

    if (!editing && isLimitReached) {
      setError(`${t('monthlyLimitDesc', { limits: limits.name, maxLimit })}`)
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      ...form, user_id: user.id, category_id: resolvedCategoryId,
      entry_price: form.entry_price === '' ? null : Number(form.entry_price),
      stop_loss: form.stop_loss === '' ? null : Number(form.stop_loss),
      take_profit: form.take_profit === '' ? null : Number(form.take_profit),
      lot_size: form.lot_size === '' ? null : Number(form.lot_size),
      exit_price: form.exit_price === '' ? null : Number(form.exit_price),
      profit_loss: form.profit_loss === '' ? null : Number(form.profit_loss),
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      mistake_tags: form.mistake_tags ? form.mistake_tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
      traded_at: new Date(form.traded_at).toISOString(),
    }

    let saveError
    if (editing) {
      const { error: err } = await supabase.from('trades').update(payload).eq('id', id)
      saveError = err
    } else {
      const { error: err } = await supabase.from('trades').insert(payload)
      saveError = err
    }

    setSaving(false)
    if (saveError) setError(saveError.message)
    else navigate(`/categories/${resolvedCategoryId}`)
  }

  const handleDelete = async () => {
    if (!confirm(t('deleteTradeConfirm'))) return
    await supabase.from('trades').delete().eq('id', id)
    navigate(`/categories/${resolvedCategoryId}`)
  }

  // 🌟 ฟังก์ชันเตรียมข้อมูลให้ AI อ่านง่ายๆ และมีโครงสร้างชัดเจน
  const buildTradePrompt = () => {
    const tradeDetails = [
      `--- ${t('tradeDataHeader')} ---`,
      `- ${t('direction')}: ${form.direction.toUpperCase()} | ${t('Entry')}: ${form.entry_price || '-'} | P&L: ${pl(form.profit_loss)} | ${t('Result')}: ${form.result}`,
      `- ${t('Strategy')}: ${form.strategy || '-'} | ${t('Setup')}: ${form.setup || '-'} | ${t('session')}: ${form.session || '-'}`,
      `- ${t('TradingPlan')}: ${form.plan_notes || '-'}`,
      `- ${t('ReasonForWinning')}/${t('ReasonForLosing')}: ${form.win_reason || form.loss_reason || '-'}`,
      `- ${t('LessonLearned')}: ${form.lesson || '-'}`,
      `- ${t('MistakeTags')}: ${form.mistake_tags || '-'}`
    ].join('\n')

    if (isFree) {
      return [
        t('aiFree1') + ` (Focus: Single Trade)`,
        t('aiFree2'),
        t('aiTradeFreeStruct'), 
        tradeDetails
      ].join('\n\n')
    }

    return [
      t('aiPro1') + ` (Focus: Single Trade)`,
      t('aiPro2'),
      t('aiTradeProStruct'), 
      tradeDetails
    ].join('\n\n')
  }

  const renderImageSlot = (field, label, isLockedForUser) => {
    const url = form[field]
    
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '8px' }}>
          {label} {isLockedForUser && <span style={{ color: 'var(--loss)' }}>(🔒 {t('proOnly')})</span>}
        </div>
        
        {url ? (
          <div style={{ position: 'relative', display: 'inline-block', opacity: isLockedForUser ? 0.4 : 1 }}>
            <img className="preview-img" src={url} alt={label} style={{ marginTop: 0, border: isLockedForUser ? '1px solid var(--loss)' : '1px solid var(--border)' }} />
            {!isLockedForUser && !isLockedCategory && (
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={() => removeImage(field)} 
                style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px', fontSize: '12px' }}
              >
                {t('removeImage')}
              </button>
            )}
          </div>
        ) : (
          <label className="field" style={{ margin: 0 }}>
            <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], field)} disabled={isLockedCategory || isLockedForUser} />
            {uploading === field && <span className="hint">{t('uploadingCompressing')}</span>}
          </label>
        )}
      </div>
    )
  }

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <Link to={`/categories/${resolvedCategoryId}`} className="breadcrumb">← {categoryName || 'Back'}</Link>
          <h1>{editing ? t('EditTrade') : t('RecordNewTrade')}</h1>
        </div>
      </div>

      {error && !error.includes('locked') && <div className="alert alert-error">{error}</div>}

      {editing && isLockedCategory && (
        <div className="panel" style={{ backgroundColor: 'rgba(255, 82, 82, 0.1)', borderColor: 'var(--loss)', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--loss)', marginBottom: '8px' }}>{t('tradeLocked')}</h3>
          <p style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '0' }}>
            {t('tradeLockedDesc')}
          </p>
        </div>
      )}

      {error && error.includes('locked') && !editing ? null : isLimitReached && !editing ? (
        <div className="panel" style={{ textAlign: 'center', padding: '32px', borderColor: 'var(--gold-glow)' }}>
          <h3 style={{ color: 'var(--gold)', marginBottom: '12px', fontSize: '22px' }}>{t('monthlyTradeLimitReached')}</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '20px' }}>
            {t('monthlyLimitDesc')} <strong>{limits.name}</strong> {t('monthlyLimitDesc2')} {maxLimit} {t('monthlyLimitDesc3')}
          </p>
          {isFree && <Link to="/upgrade"><button className="btn btn-primary">{t('upgradeToPro')}</button></Link>}
        </div>
      ) : (
        <>
          {editing && <HeroGallery form={form} isPro={isPro} />}
          
          {/* 🌟 จุดที่แก้ไข: ครอบ id="tour-trade-ai" ให้คลุมกล่อง AI อย่างถูกต้อง 🌟 */}
          {editing && (
            <div id="tour-trade-ai">
              <AIInsight 
                title={t('AIAnalyzetrade')} 
                cacheKey={`ai_trade_${id}`} 
                signature={`${form.result}-${form.profit_loss}-${lang}`} 
                buildPrompt={buildTradePrompt} 
                actionLabel={t('aiAnalyzeBtn')} 
                disabled={isLockedCategory} 
                disabledHint={t('aiDisabledHint')}  
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="trade-form">
            {!editing && (
              <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-faint)', fontWeight: 600 }}>
                {t('monthlyTradesUsed')} {monthlyTradeCount}/{maxLimit} ({limits.name})
              </div>
            )}

            <fieldset disabled={isLockedCategory} style={{ border: 'none', padding: 0, margin: 0 }}>
              <label className="field">{t('dateAndTimeOfTrade')}<input type="datetime-local" value={form.traded_at} onChange={update('traded_at')} /></label>

              <section className="form-section before">
                <h2>🟦 {t('BeforeTrading')}</h2>
                <div className="field-grid">
                  <label className="field">{t('direction')}<select value={form.direction} onChange={update('direction')}><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
                  <label className="field">{t('Entry')}<input type="number" step="any" value={form.entry_price} onChange={update('entry_price')} /></label>
                  <label className="field">{t('StopLoss')}<input type="number" step="any" value={form.stop_loss} onChange={update('stop_loss')} /></label>
                  <label className="field">{t('TakeProfit')}<input type="number" step="any" value={form.take_profit} onChange={update('take_profit')} /></label>
                  <label className="field">{t('LotSize')}<input type="number" step="any" value={form.lot_size} onChange={update('lot_size')} /></label>
                  <label className="field">{t('Timeframe')}<input type="text" list="timeframe-options" value={form.timeframe} onChange={update('timeframe')} /><datalist id="timeframe-options">{availableTimeframes.map(tf => <option key={tf} value={tf} />)}</datalist></label>
                  <label className="field">{t('session')}<select value={form.session} onChange={update('session')}><option value="asia">Asia</option><option value="london">London</option><option value="newyork">New York</option><option value="other">Other</option></select></label>
                  <label className="field">{t('Strategy')}<input type="text" list="strategy-options" value={form.strategy} onChange={update('strategy')} /><datalist id="strategy-options">{availableStrategies.map(st => <option key={st} value={st} />)}</datalist></label>
                </div>
                <label className="field">{t('Setup')}<input type="text" list="setup-options" value={form.setup} onChange={update('setup')} /><datalist id="setup-options">{availableSetups.map(su => <option key={su} value={su} />)}</datalist></label>
                <label className="field">{t('TradingPlan')}<textarea rows={3} value={form.plan_notes} onChange={update('plan_notes')} /></label>
                <label className="field">{t('News')}<textarea rows={2} value={form.news_notes} onChange={update('news_notes')} /></label>

                {/* 🌟 รูป Before 1 & 2 */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                  {renderImageSlot('before_image_url', t('ChartBeforeTrading') + ' (1)', false)}
                  {(isPro || form.before_image_url_2) && renderImageSlot('before_image_url_2', t('ChartBeforeTrading') + ' (2)', !isPro)}
                </div>
              </section>

              <section className="form-section after">
                <h2>🟥 {t('AfterTrading')}</h2>
                <div className="field-grid">
                  <label className="field">{t('Exit')}<input type="number" step="any" value={form.exit_price} onChange={update('exit_price')} /></label>
                  <label className="field">{t('ProfitLoss')}<input type="number" step="any" value={form.profit_loss} onChange={update('profit_loss')} /></label>
                  <label className="field">{t('Result')}<select value={form.result} onChange={update('result')}><option value="open">Open</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></label>
                  <label className="field">{t('Duration')}<input type="number" value={form.duration_minutes} onChange={update('duration_minutes')} /></label>
                </div>
                <label className="field">{t('ReasonForWinning')}<textarea rows={2} value={form.win_reason} onChange={update('win_reason')} /></label>
                <label className="field">{t('ReasonForLosing')}<textarea rows={2} value={form.loss_reason} onChange={update('loss_reason')} /></label>
                <label className="field">{t('LessonLearned')}<textarea rows={2} value={form.lesson} onChange={update('lesson')} /></label>
                <label className="field checkbox-field"><input type="checkbox" checked={form.followed_plan} onChange={update('followed_plan')} /> {t('FollowedTradingPlan')}</label>
                <label className="field">{t('MistakeTags')}<input type="text" list="mistake-options" value={form.mistake_tags} onChange={update('mistake_tags')} /><datalist id="mistake-options">{availableTags.map((m) => <option key={m} value={m} />)}</datalist></label>
                
                {/* 🌟 รูป After 1 & 2 */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
                  {renderImageSlot('after_image_url', t('ChartAfterTrading') + ' (1)', false)}
                  {(isPro || form.after_image_url_2) && renderImageSlot('after_image_url_2', t('ChartAfterTrading') + ' (2)', !isPro)}
                </div>
              </section>
            </fieldset>

            <div className="form-actions">
              {!isLockedCategory && (
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('Saving') : t('SaveTrade')}</button>
              )}
              {editing && <button type="button" className="btn btn-danger" onClick={handleDelete}>{t('deleteTrade')}</button>}
            </div>
          </form>
        </>
      )}
    </div>
  )
}