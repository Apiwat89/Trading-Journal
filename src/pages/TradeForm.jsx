import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AIInsight from '../components/AIInsight'
import Lightbox from '../components/Lightbox'

const MAX_FREE_MONTHLY_TRADES = 20   // ✅ สายฟรีได้ 20 ไม้ต่อเดือน
const MAX_PRO_MONTHLY_TRADES = 120   // ✅ สาย Pro ได้ 120 ไม้ต่อเดือน

function getLocalDatetimeString(dateObj = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const year = dateObj.getFullYear()
  const month = pad(dateObj.getMonth() + 1)
  const day = pad(dateObj.getDate())
  const hours = pad(dateObj.getHours())
  const minutes = pad(dateObj.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const emptyForm = {
  direction: 'buy',
  entry_price: '',
  stop_loss: '',
  take_profit: '',
  lot_size: '',
  strategy: '',
  setup: '',
  timeframe: '',
  session: 'asia',
  plan_notes: '',
  news_notes: '',
  exit_price: '',
  profit_loss: '',
  result: 'open',
  duration_minutes: '',
  win_reason: '',
  loss_reason: '',
  lesson: '',
  followed_plan: true,
  mistake_tags: '',
  before_image_url: '',
  after_image_url: '',
  traded_at: getLocalDatetimeString(),
}

const DEFAULT_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']
const DEFAULT_STRATEGIES = ['SMC', 'Price Action', 'EMA Cross', 'Breakout', 'Trend Following']
const DEFAULT_SETUPS = ['BOS + Support', 'Double Top/Bottom', 'Liquidity Sweep', 'Order Block', 'Break & Retest']
const DEFAULT_MISTAKES = [
  'FOMO', 
  'Overtrade', 
  'Revenge trade', 
  'No confirmation', 
  'Didn\'t cut loss', 
  'No news'
]

const resultLabel = { win: '🟢 Win', loss: '🔴 Loss', breakeven: '⚪ Breakeven', open: '🟦 Open' }

function HeroGallery({ before, after }) {
  const hasBefore = Boolean(before)
  const hasAfter = Boolean(after)
  const [tab, setTab] = useState(hasBefore ? 'before' : 'after')
  const [zoomed, setZoomed] = useState(false)

  if (!hasBefore && !hasAfter) return null

  const src = tab === 'before' ? before : after

  return (
    <div className="hero-gallery">
      {hasBefore && hasAfter && (
        <div className="hero-gallery-tabs">
          <button
            type="button"
            className={`hero-gallery-tab ${tab === 'before' ? 'active' : ''}`}
            onClick={() => setTab('before')}
          >
            🟦 Before trading
          </button>
          <button
            type="button"
            className={`hero-gallery-tab ${tab === 'after' ? 'active' : ''}`}
            onClick={() => setTab('after')}
          >
            🟥 After trading
          </button>
        </div>
      )}
      {src ? (
        <div className="hero-gallery-frame" onClick={() => setZoomed(true)}>
          <img src={src} alt={tab === 'before' ? 'Chart before trading' : 'Chart after closing trade'} />
          <span className="hero-gallery-hint">Click to enlarge 🔍</span>
        </div>
      ) : (
        <div className="hero-gallery-empty">No images available for this period</div>
      )}
      {zoomed && <Lightbox src={src} alt="chart" onClose={() => setZoomed(false)} />}
    </div>
  )
}

export default function TradeForm() {
  const { categoryId, id } = useParams() 
  const editing = Boolean(id)
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [resolvedCategoryId, setResolvedCategoryId] = useState(categoryId || null)
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingBefore, setUploadingBefore] = useState(false)
  const [uploadingAfter, setUploadingAfter] = useState(false)
  const [monthlyTradeCount, setMonthlyTradeCount] = useState(0)

  const [availableTags, setAvailableTags] = useState(DEFAULT_MISTAKES)
  const [availableTimeframes, setAvailableTimeframes] = useState(DEFAULT_TIMEFRAMES)
  const [availableStrategies, setAvailableStrategies] = useState(DEFAULT_STRATEGIES)
  const [availableSetups, setAvailableSetups] = useState(DEFAULT_SETUPS)

  const isFree = !profile || profile.tier !== 'pro'
  
  // กำหนดโควต้าสูงสุดตามแพ็กเกจ (Free = 20, Pro = 120)
  const maxLimit = isFree ? MAX_FREE_MONTHLY_TRADES : MAX_PRO_MONTHLY_TRADES

  useEffect(() => {
    const load = async () => {
      if (editing) {
        const { data, error } = await supabase.from('trades').select('*').eq('id', id).single()
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }
        
        let formattedTradedAt = emptyForm.traded_at
        if (data.traded_at) {
          const d = new Date(data.traded_at)
          formattedTradedAt = getLocalDatetimeString(d)
        }

        setForm({
          ...emptyForm,
          ...data,
          mistake_tags: (data.mistake_tags || []).join(', '),
          traded_at: formattedTradedAt,
        })
        setResolvedCategoryId(data.category_id)
        const { data: cat } = await supabase
          .from('categories')
          .select('name')
          .eq('id', data.category_id)
          .single()
        setCategoryName(cat?.name || '')
        setLoading(false)
      } else {
        const { data: cat } = await supabase.from('categories').select('name').eq('id', categoryId).single()
        setCategoryName(cat?.name || '')
        setLoading(false)
      }

      if (user) {
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count } = await supabase
          .from('trades')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('traded_at', startOfMonth.toISOString())

        setMonthlyTradeCount(count || 0)

        const { data: pastData } = await supabase
          .from('trades')
          .select('mistake_tags, timeframe, strategy, setup')
          .eq('user_id', user.id)

        if (pastData) {
          const allUserTags = pastData.flatMap(t => t.mistake_tags || [])
          setAvailableTags([...new Set([...DEFAULT_MISTAKES, ...allUserTags])])

          const userTimeframes = pastData.map(t => t.timeframe).filter(Boolean)
          setAvailableTimeframes([...new Set([...DEFAULT_TIMEFRAMES, ...userTimeframes])])

          const userStrategies = pastData.map(t => t.strategy).filter(Boolean)
          setAvailableStrategies([...new Set([...DEFAULT_STRATEGIES, ...userStrategies])])

          const userSetups = pastData.map(t => t.setup).filter(Boolean)
          setAvailableSetups([...new Set([...DEFAULT_SETUPS, ...userSetups])])
        }
      }
    }
    load()
  }, [editing, id, categoryId, user])

  const isLimitReached = !editing && monthlyTradeCount >= maxLimit

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const uploadImage = async (file, which) => {
    const setUploading = which === 'before' ? setUploadingBefore : setUploadingAfter
    setUploading(true)
    setError('')
    const path = `${user.id}/${Date.now()}_${which}_${file.name}`
    const { error: upErr } = await supabase.storage.from('trade-images').upload(path, file)
    setUploading(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    const { data } = supabase.storage.from('trade-images').getPublicUrl(path)
    setForm((f) => ({ ...f, [which === 'before' ? 'before_image_url' : 'after_image_url']: data.publicUrl }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!editing && isLimitReached) {
      setError(
        isFree
          ? `Free plan is limited to ${MAX_FREE_MONTHLY_TRADES} trades per month. Please upgrade to Pro.`
          : `Pro plan is limited to ${MAX_PRO_MONTHLY_TRADES} trades per month.`
      )
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      ...form,
      user_id: user.id,
      category_id: resolvedCategoryId,
      entry_price: form.entry_price === '' ? null : Number(form.entry_price),
      stop_loss: form.stop_loss === '' ? null : Number(form.stop_loss),
      take_profit: form.take_profit === '' ? null : Number(form.take_profit),
      lot_size: form.lot_size === '' ? null : Number(form.lot_size),
      exit_price: form.exit_price === '' ? null : Number(form.exit_price),
      profit_loss: form.profit_loss === '' ? null : Number(form.profit_loss),
      duration_minutes: form.duration_minutes === '' ? null : Number(form.duration_minutes),
      mistake_tags: form.mistake_tags
        ? form.mistake_tags.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      traded_at: new Date(form.traded_at).toISOString(),
    }

    let saveError
    if (editing) {
      const { error } = await supabase.from('trades').update(payload).eq('id', id)
      saveError = error
    } else {
      const { error } = await supabase.from('trades').insert(payload)
      saveError = error
    }

    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }
    navigate(`/categories/${resolvedCategoryId}`)
  }

  const handleDelete = async () => {
    if (!confirm('Delete this trade?')) return
    await supabase.from('trades').delete().eq('id', id)
    navigate(`/categories/${resolvedCategoryId}`)
  }

  const buildTradePrompt = () => {
    // ถ้าเป็น Free Plan ให้ AI วิเคราะห์สรุปสั้นๆ กระชับ
    if (isFree) {
      return [
        'คุณเป็นโค้ชเทรดมืออาชีพ กำลังอ่านบันทึกการเทรดของผู้ใช้แพ็กเกจ Free',
        'ตอบเป็นภาษาไทย กระชับ สั้นๆ ไม่เกิน 3 บรรทัด',
        'โครงสร้างคำตอบ: 1) สรุปภาพรวมของไม้นี้สั้นๆ 2) คำแนะนำเบื้องต้น 1 ข้อ',
        '--- ข้อมูลไม้นี้ ---',
        `หมวด/สัญลักษณ์: ${categoryName || 'ไม่ระบุ'}`,
        `ทิศทาง: ${form.direction === 'buy' ? 'Buy' : 'Sell'}`,
        `Entry: ${form.entry_price || '-'}, SL: ${form.stop_loss || '-'}, TP: ${form.take_profit || '-'}`,
        `ผลลัพธ์: ${resultLabel[form.result] || form.result}, กำไร/ขาดทุน: ${form.profit_loss || 0}`,
        `เข้าเทรดตามแผนไหม: ${form.followed_plan ? 'ตามแผน' : 'ไม่ตามแผน'}`,
      ].filter(Boolean).join('\n\n')
    }

    // ถ้าเป็น Pro Plan ให้ AI วิเคราะห์เชิงลึกแบบละเอียดครบถ้วน
    const lines = [
      'คุณเป็นโค้ชเทรดมืออาชีพ กำลังอ่านบันทึกของเทรดหนึ่งไม้จากสมุดบันทึกการเทรดของผู้ใช้แพ็กเกจ Pro',
      'ตอบเป็นภาษาไทย กระชับ ใช้หัวข้อย่อยเป็นหลัก ไม่ต้องมีคำนำยืดยาว และไม่ต้องขอโทษหรือออกตัวว่าเป็น AI',
      'โครงสร้างคำตอบ: 1) ประเมินไม้นี้สั้นๆ ว่าการตัดสินใจเข้าเทรดและบริหารความเสี่ยง (SL/TP/lot) สมเหตุสมผลไหม 2) จุดที่ทำได้ดี 3) จุดที่ควรปรับปรุง 4) คำแนะนำ 2-3 ข้อสำหรับไม้ลักษณะนี้ในอนาคต',
      '--- ข้อมูลไม้นี้เชิงลึก ---',
      `หมวด/สัญลักษณ์: ${categoryName || 'ไม่ระบุ'}`,
      `ทิศทาง: ${form.direction === 'buy' ? 'Buy' : 'Sell'}`,
      `Entry: ${form.entry_price || '-'}, SL: ${form.stop_loss || '-'}, TP: ${form.take_profit || '-'}, Lot: ${form.lot_size || '-'}`,
      `Timeframe: ${form.timeframe || '-'}, Session: ${form.session || '-'}`,
      `Strategy: ${form.strategy || '-'}, Setup: ${form.setup || '-'}`,
      `แผนการเทรด/เหตุผลที่เข้า: ${form.plan_notes || '-'}`,
      `ข่าวช่วงที่เทรด: ${form.news_notes || '-'}`,
      `ผลลัพธ์: ${resultLabel[form.result] || form.result}, กำไร/ขาดทุน: ${form.profit_loss || 0}, ระยะเวลาถือ: ${form.duration_minutes || '-'} นาที`,
      `เหตุผลที่ชนะ: ${form.win_reason || '-'}`,
      `เหตุผลที่แพ้: ${form.loss_reason || '-'}`,
      `บทเรียน: ${form.lesson || '-'}`,
      `เข้าเทรดตามแผนไหม: ${form.followed_plan ? 'ตามแผน' : 'ไม่ตามแผน'}`,
      `แท็กข้อผิดพลาด: ${form.mistake_tags || 'ไม่มี'}`,
    ]
    return lines.join('\n')
  }

  const tradeAiSignature = [
    form.result,
    form.profit_loss,
    form.exit_price,
    form.win_reason,
    form.loss_reason,
    form.lesson,
    form.plan_notes,
    form.followed_plan,
    form.mistake_tags,
  ].join('|')

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <Link to={`/categories/${resolvedCategoryId}`} className="breadcrumb">
            ← {categoryName || 'Back to Category'}
          </Link>
          <h1>{editing ? 'Edit Trade' : 'Record New Trade'}</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {isLimitReached ? (
        <div className="panel" style={{ textAlign: 'center', padding: '32px', borderColor: 'var(--gold-glow)' }}>
          <h3 style={{ color: 'var(--gold)', marginBottom: '12px', fontSize: '22px' }}>Monthly Trade Limit Reached</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>
            You have reached the maximum of {maxLimit} trades for this month on the {isFree ? 'Free' : 'Pro'} plan 
            ({monthlyTradeCount}/{maxLimit}). {isFree ? 'Upgrade to Pro for higher limits and advanced AI insights!' : ''}
          </p>
          {isFree && (
            <Link to="/upgrade">
              <button className="btn btn-primary">
                Upgrade to Pro
              </button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {editing && <HeroGallery before={form.before_image_url} after={form.after_image_url} />}

          {editing && (
            <AIInsight
              title="AI analyzes this trade."
              cacheKey={`ai_trade_${id}`}
              signature={tradeAiSignature}
              buildPrompt={buildTradePrompt}
              actionLabel="AI analyze"
            />
          )}

          <form onSubmit={handleSubmit} className="trade-form">
            {!editing && (
              <div style={{ marginBottom: '16px', fontSize: '12px', color: 'var(--text-faint)', fontWeight: 600 }}>
                Monthly Trades Used: {monthlyTradeCount}/{maxLimit} ({isFree ? 'Free Plan' : 'Pro Plan'})
              </div>
            )}

            <label className="field">
              date & time of trade
              <input type="datetime-local" value={form.traded_at} onChange={update('traded_at')} />
            </label>

            <section className="form-section before">
              <h2>🟦 Before Trading</h2>
              <div className="field-grid">
                <label className="field">
                  Direction
                  <select value={form.direction} onChange={update('direction')}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </label>
                <label className="field">
                  Entry
                  <input type="number" step="any" value={form.entry_price} onChange={update('entry_price')} />
                </label>
                <label className="field">
                  Stop Loss
                  <input type="number" step="any" value={form.stop_loss} onChange={update('stop_loss')} />
                </label>
                <label className="field">
                  Take Profit
                  <input type="number" step="any" value={form.take_profit} onChange={update('take_profit')} />
                </label>
                <label className="field">
                  Lot
                  <input type="number" step="any" value={form.lot_size} onChange={update('lot_size')} />
                </label>
                <label className="field">
                  Timeframe
                  <input type="text" list="timeframe-options" placeholder="H1, H4, M15..." value={form.timeframe} onChange={update('timeframe')} />
                  <datalist id="timeframe-options">
                    {availableTimeframes.map(tf => <option key={tf} value={tf} />)}
                  </datalist>
                </label>
                <label className="field">
                  Session
                  <select value={form.session} onChange={update('session')}>
                    <option value="asia">Asia</option>
                    <option value="london">London</option>
                    <option value="newyork">New York</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="field">
                  Strategy
                  <input type="text" list="strategy-options" placeholder="SMC, EMA Cross..." value={form.strategy} onChange={update('strategy')} />
                  <datalist id="strategy-options">
                    {availableStrategies.map(st => <option key={st} value={st} />)}
                  </datalist>
                </label>
              </div>
              <label className="field">
                Setup
                <input type="text" list="setup-options" placeholder="BOS + Support" value={form.setup} onChange={update('setup')} />
                <datalist id="setup-options">
                  {availableSetups.map(su => <option key={su} value={su} />)}
                </datalist>
              </label>
              <label className="field">
                Trading Plan / Reason for Entry
                <textarea rows={3} value={form.plan_notes} onChange={update('plan_notes')} placeholder="e.g., EMA 50/200 is trending upward, waiting for price retest at support..." />
              </label>
              <label className="field">
                News During Trading Period (if any)
                <textarea rows={2} value={form.news_notes} onChange={update('news_notes')} placeholder="e.g., NFP released today at 19:30 UTC" />
              </label>
              <label className="field">
                Chart Before Trading
                <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], 'before')} />
                {uploadingBefore && <span className="hint">Uploading...</span>}
                {form.before_image_url && <img className="preview-img" src={form.before_image_url} alt="before" />}
              </label>
            </section>

            <section className="form-section result">
              <h2>🟩 Result</h2>
              <div className="field-grid">
                <label className="field">
                  Exit
                  <input type="number" step="any" value={form.exit_price} onChange={update('exit_price')} />
                </label>
                <label className="field">
                  Profit/Loss
                  <input type="number" step="any" value={form.profit_loss} onChange={update('profit_loss')} placeholder="+200 or -100" />
                </label>
                <label className="field">
                  Result
                  <select value={form.result} onChange={update('result')}>
                    <option value="open">Open</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="breakeven">Breakeven</option>
                  </select>
                </label>
                <label className="field">
                  Duration Held (Minutes)
                  <input type="number" value={form.duration_minutes} onChange={update('duration_minutes')} />
                </label>
              </div>
            </section>

            <section className="form-section after">
              <h2>🟥 After Trading</h2>
              <label className="field">
                Reason for Winning
                <textarea rows={2} value={form.win_reason} onChange={update('win_reason')} />
              </label>
              <label className="field">
                Reason for Losing
                <textarea rows={2} value={form.loss_reason} onChange={update('loss_reason')} />
              </label>
              <label className="field">
                Lesson Learned
                <textarea rows={2} value={form.lesson} onChange={update('lesson')} />
              </label>
              <label className="field checkbox-field">
                <input type="checkbox" checked={form.followed_plan} onChange={update('followed_plan')} />
                Followed Trading Plan
              </label>
              <label className="field">
                Mistake Tags (comma separated)
                <input
                  type="text"
                  list="mistake-options"
                  value={form.mistake_tags}
                  onChange={update('mistake_tags')}
                  placeholder="FOMO, Overtrade"
                />
                <datalist id="mistake-options">
                  {availableTags.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                Chart After Trading
                <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], 'after')} />
                {uploadingAfter && <span className="hint">Uploading...</span>}
                {form.after_image_url && <img className="preview-img" src={form.after_image_url} alt="after" />}
              </label>
            </section>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Trade'}
              </button>
              {editing && (
                <button type="button" className="btn btn-danger" onClick={handleDelete}>
                  Delete Trade
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}