import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import AIInsight from '../components/AIInsight'
import Lightbox from '../components/Lightbox'

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
  traded_at: new Date().toISOString().slice(0, 16),
}

const MISTAKE_OPTIONS = ['FOMO', 'Overtrade', 'Revenge trade', 'ไม่รอ confirmation', 'ไม่ตัดขาดทุนตามแผน', 'ไม่มีข่าว']

const resultLabel = { win: '🟢 Win', loss: '🔴 Loss', breakeven: '⚪ Breakeven', open: '🟦 กำลังเปิดอยู่' }

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
            🟦 ก่อนเทรด
          </button>
          <button
            type="button"
            className={`hero-gallery-tab ${tab === 'after' ? 'active' : ''}`}
            onClick={() => setTab('after')}
          >
            🟥 หลังปิดเทรด
          </button>
        </div>
      )}
      {src ? (
        <div className="hero-gallery-frame" onClick={() => setZoomed(true)}>
          <img src={src} alt={tab === 'before' ? 'กราฟก่อนเทรด' : 'กราฟหลังปิดเทรด'} />
          <span className="hero-gallery-hint">คลิกเพื่อขยาย 🔍</span>
        </div>
      ) : (
        <div className="hero-gallery-empty">ไม่มีรูปสำหรับช่วงนี้</div>
      )}
      {zoomed && <Lightbox src={src} alt="chart" onClose={() => setZoomed(false)} />}
    </div>
  )
}

export default function TradeForm() {
  const { categoryId, id } = useParams() // categoryId when creating, id when editing
  const editing = Boolean(id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [resolvedCategoryId, setResolvedCategoryId] = useState(categoryId || null)
  const [categoryName, setCategoryName] = useState('')
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingBefore, setUploadingBefore] = useState(false)
  const [uploadingAfter, setUploadingAfter] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (editing) {
        const { data, error } = await supabase.from('trades').select('*').eq('id', id).single()
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }
        setForm({
          ...emptyForm,
          ...data,
          mistake_tags: (data.mistake_tags || []).join(', '),
          traded_at: data.traded_at ? data.traded_at.slice(0, 16) : emptyForm.traded_at,
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
      }
    }
    load()
  }, [editing, id, categoryId])

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
    if (!confirm('ลบเทรดนี้?')) return
    await supabase.from('trades').delete().eq('id', id)
    navigate(`/categories/${resolvedCategoryId}`)
  }

  const buildTradePrompt = () => {
    const lines = [
      'คุณเป็นโค้ชเทรดมืออาชีพ กำลังอ่านบันทึกของเทรดหนึ่งไม้จากสมุดบันทึกการเทรดของผู้ใช้',
      'ตอบเป็นภาษาไทย กระชับ ใช้หัวข้อย่อยเป็นหลัก ไม่ต้องมีคำนำยืดยาว และไม่ต้องขอโทษหรือออกตัวว่าเป็น AI',
      'โครงสร้างคำตอบ: 1) ประเมินไม้นี้สั้นๆ ว่าการตัดสินใจเข้าเทรดและบริหารความเสี่ยง (SL/TP/lot) สมเหตุสมผลไหม 2) จุดที่ทำได้ดี 3) จุดที่ควรปรับปรุง 4) คำแนะนำ 2-3 ข้อสำหรับไม้ลักษณะนี้ในอนาคต',
      '--- ข้อมูลไม้นี้ ---',
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

  if (loading) return <div className="page-loading">กำลังโหลด...</div>

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <div>
          <Link to={`/categories/${resolvedCategoryId}`} className="breadcrumb">
            ← {categoryName || 'กลับ'}
          </Link>
          <h1>{editing ? 'แก้ไขเทรด' : 'บันทึกเทรดใหม่'}</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {editing && <HeroGallery before={form.before_image_url} after={form.after_image_url} />}

      {editing && (
        <AIInsight
          title="AI วิเคราะห์ไม้นี้"
          cacheKey={`ai_trade_${id}`}
          signature={tradeAiSignature}
          buildPrompt={buildTradePrompt}
          actionLabel="ให้ AI วิเคราะห์ไม้นี้"
        />
      )}

      <form onSubmit={handleSubmit} className="trade-form">
        <label className="field">
          วันเวลาที่เทรด
          <input type="datetime-local" value={form.traded_at} onChange={update('traded_at')} />
        </label>

        <section className="form-section before">
          <h2>🟦 ก่อนเทรด</h2>
          <div className="field-grid">
            <label className="field">
              ทิศทาง
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
              <input type="text" placeholder="H1, H4, M15..." value={form.timeframe} onChange={update('timeframe')} />
            </label>
            <label className="field">
              Session
              <select value={form.session} onChange={update('session')}>
                <option value="asia">Asia</option>
                <option value="london">London</option>
                <option value="newyork">New York</option>
                <option value="other">อื่นๆ</option>
              </select>
            </label>
            <label className="field">
              Strategy
              <input type="text" placeholder="SMC, EMA Cross..." value={form.strategy} onChange={update('strategy')} />
            </label>
            <label className="field">
              Setup
              <input type="text" placeholder="BOS + Support" value={form.setup} onChange={update('setup')} />
            </label>
          </div>
          <label className="field">
            แผนการเทรด / เหตุผลที่เข้าออเดอร์
            <textarea rows={3} value={form.plan_notes} onChange={update('plan_notes')} placeholder="เช่น EMA 50/200 เป็นขาขึ้น รอราคา retest แนวรับ..." />
          </label>
          <label className="field">
            ข่าวช่วงเวลาที่เทรด (ถ้ามี)
            <textarea rows={2} value={form.news_notes} onChange={update('news_notes')} placeholder="เช่น NFP วันนี้ 19:30 น." />
          </label>
          <label className="field">
            รูปกราฟก่อนเข้าเทรด
            <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], 'before')} />
            {uploadingBefore && <span className="hint">กำลังอัปโหลด...</span>}
            {form.before_image_url && <img className="preview-img" src={form.before_image_url} alt="before" />}
          </label>
        </section>

        <section className="form-section result">
          <h2>🟩 ผลการเทรด</h2>
          <div className="field-grid">
            <label className="field">
              Exit
              <input type="number" step="any" value={form.exit_price} onChange={update('exit_price')} />
            </label>
            <label className="field">
              กำไร/ขาดทุน
              <input type="number" step="any" value={form.profit_loss} onChange={update('profit_loss')} placeholder="+200 หรือ -100" />
            </label>
            <label className="field">
              ผลลัพธ์
              <select value={form.result} onChange={update('result')}>
                <option value="open">กำลังเปิดอยู่</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </label>
            <label className="field">
              ระยะเวลาถือ (นาที)
              <input type="number" value={form.duration_minutes} onChange={update('duration_minutes')} />
            </label>
          </div>
        </section>

        <section className="form-section after">
          <h2>🟥 วิเคราะห์หลังเทรด</h2>
          <label className="field">
            🏆 เหตุผลที่ชนะ
            <textarea rows={2} value={form.win_reason} onChange={update('win_reason')} />
          </label>
          <label className="field">
            ❌ เหตุผลที่แพ้
            <textarea rows={2} value={form.loss_reason} onChange={update('loss_reason')} />
          </label>
          <label className="field">
            🧠 บทเรียน
            <textarea rows={2} value={form.lesson} onChange={update('lesson')} />
          </label>
          <label className="field checkbox-field">
            <input type="checkbox" checked={form.followed_plan} onChange={update('followed_plan')} />
            เข้าเทรดตามแผนที่วางไว้
          </label>
          <label className="field">
            แท็กข้อผิดพลาด (คั่นด้วย , )
            <input
              type="text"
              list="mistake-options"
              value={form.mistake_tags}
              onChange={update('mistake_tags')}
              placeholder="FOMO, Overtrade"
            />
            <datalist id="mistake-options">
              {MISTAKE_OPTIONS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <label className="field">
            รูปกราฟหลังปิดเทรด
            <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0], 'after')} />
            {uploadingAfter && <span className="hint">กำลังอัปโหลด...</span>}
            {form.after_image_url && <img className="preview-img" src={form.after_image_url} alt="after" />}
          </label>
        </section>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          {editing && (
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              ลบเทรดนี้
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
