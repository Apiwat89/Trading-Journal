import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { computeStats, statsToPromptText, breakdownToPromptText } from '../lib/analytics'
import AIInsight from '../components/AIInsight'

const resultLabel = { win: '🟢 WIN', loss: '🔴 LOSS', breakeven: '⚪ BE', open: '🟦 OPEN' }

export default function CategoryTrades() {
  const { categoryId } = useParams()
  const { user } = useAuth()
  const [category, setCategory] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: cat } = await supabase.from('categories').select('*').eq('id', categoryId).single()
      const { data: trs } = await supabase
        .from('trades')
        .select('*')
        .eq('category_id', categoryId)
        .order('traded_at', { ascending: false })
      setCategory(cat)
      setTrades(trs || [])
      setLoading(false)
    }
    load()
  }, [categoryId])

  const wins = trades.filter((t) => t.result === 'win').length
  const losses = trades.filter((t) => t.result === 'loss').length
  const closed = wins + losses
  const winRate = closed ? Math.round((wins / closed) * 100) : 0
  const totalPL = trades.reduce((sum, t) => sum + (Number(t.profit_loss) || 0), 0)

  const stats = useMemo(() => computeStats(trades), [trades])
  const aiSignature = `${trades.length}-${totalPL.toFixed(2)}-${winRate}`

  const buildCategoryPrompt = () => {
    const parts = [
      `คุณเป็นโค้ชเทรดมืออาชีพ กำลังอ่านสถิติการเทรดเฉพาะหมวด/สัญลักษณ์ "${category?.name || ''}" ของผู้ใช้คนหนึ่ง`,
      'ตอบเป็นภาษาไทย กระชับ ใช้หัวข้อย่อยเป็นหลัก ไม่ต้องมีคำนำยืดยาว',
      `โครงสร้างคำตอบ: 1) เทรดเดอร์คนนี้เทรด ${category?.name || 'สัญลักษณ์นี้'} เป็นยังไงบ้าง 2) จุดแข็งที่เห็นจากข้อมูลของหมวดนี้โดยเฉพาะ (เช่น strategy หรือ session ที่ทำได้ดี) 3) จุดอ่อน/ความเสี่ยงที่ควรระวังในหมวดนี้ 4) คำแนะนำที่ทำได้จริง 3 ข้อสำหรับหมวดนี้โดยเฉพาะ`,
      '--- ข้อมูลสถิติของหมวดนี้ ---',
      statsToPromptText(stats, `หมวด ${category?.name || ''}`),
      breakdownToPromptText(stats.byStrategy, 'แยกตาม Strategy ภายในหมวดนี้'),
    ]
    return parts.filter(Boolean).join('\n\n')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/categories" className="breadcrumb">← All Categories</Link>
          <h1>{category?.name || '...'}</h1>
          {category?.description && <p className="page-sub">{category.description}</p>}
        </div>
        <Link to={`/categories/${categoryId}/new`} className="btn btn-primary page-header-action">
          + Record New Trade
        </Link>
      </div>

      <div className="stat-row">
        <div className="stat-pill">
          <span className="stat-value">{trades.length}</span>
          <span className="stat-label">Total Trades</span>
        </div>
        <div className="stat-pill">
          <span className="stat-value">{winRate}%</span>
          <span className="stat-label">Win rate</span>
        </div>
        <div className={`stat-pill ${totalPL >= 0 ? 'positive' : 'negative'}`}>
          <span className="stat-value">{totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}</span>
          <span className="stat-label">Total P&L</span>
        </div>
      </div>

      {!loading && trades.length > 0 && (
        <AIInsight
          title={`AI analyzes ${category?.name || ''}`}
          cacheKey={`ai_category_${user?.id || 'anon'}_${categoryId}`}
          signature={aiSignature}
          buildPrompt={buildCategoryPrompt}
          actionLabel="AI analyze"
        />
      )}

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : trades.length === 0 ? (
        <div className="empty-state">No trades recorded in this category — start recording your first trade</div>
      ) : (
        <div className="trade-list">
          {trades.map((t) => (
            <Link to={`/trades/${t.id}`} key={t.id} className="trade-card">
              <div className="trade-card-section before">
                <div className="trade-card-row">
                  <span>{t.direction === 'buy' ? '🔼 BUY' : '🔽 SELL'}</span>
                  <span>Entry {t.entry_price ?? '-'}</span>
                  <span>SL {t.stop_loss ?? '-'}</span>
                  <span>TP {t.take_profit ?? '-'}</span>
                  <span>Lot {t.lot_size ?? '-'}</span>
                </div>
                {t.strategy && <div className="trade-card-tag">{t.strategy}</div>} <br />
                {t.plan_notes && <div className="trade-card-tag2">{t.plan_notes}</div>}
              </div>
              <div className="trade-card-section result">
                <span className={`result-badge ${t.result}`}>{resultLabel[t.result]}</span>
                <span className={Number(t.profit_loss) >= 0 ? 'positive' : 'negative'}>
                  {Number(t.profit_loss) >= 0 ? '+' : ''}
                  {t.profit_loss ?? 0}
                </span>
                <span className="trade-card-date">
                  {new Date(t.traded_at).toLocaleDateString('th-TH')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link to={`/categories/${categoryId}/new`} className="fab" aria-label="Record New Trade">
        +
      </Link>
    </div>
  )
}
