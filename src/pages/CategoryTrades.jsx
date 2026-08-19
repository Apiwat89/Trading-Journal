import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { 
  computeStats, 
  statsToPromptText, 
  breakdownToPromptText,
  mistakeStatsToPromptText,
  recentTradesToPromptText
} from '../lib/analytics'
import AIInsight from '../components/AIInsight'
import { useLanguage } from '../context/LanguageContext'

function pl(n) {
  const v = Number(n) || 0
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

export default function CategoryTrades() {
  const { categoryId } = useParams()
  const { user, profile, limits } = useAuth()
  const [category, setCategory] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const { lang, t } = useLanguage()

  const isPro = profile?.tier === 'pro' || profile?.tier === 'pro_premium'

  const getResultLabel = (res) => {
    if (res === 'win') return t('resultWin')
    if (res === 'loss') return t('resultLoss')
    if (res === 'breakeven') return t('resultBE')
    if (res === 'open') return t('resultOpen')
    return res
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      
      if (user) {
        const { data: allCats } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
        
        const catIndex = allCats?.findIndex(c => c.id === categoryId)
        if (catIndex !== -1 && catIndex >= limits.categories) {
          setIsLocked(true)
        } else {
          setIsLocked(false)
        }
      }

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
  }, [categoryId, user, limits.categories])

  const wins = trades.filter((t) => t.result === 'win').length
  const losses = trades.filter((t) => t.result === 'loss').length
  const closed = wins + losses
  const winRate = closed ? Math.round((wins / closed) * 100) : 0
  const totalPL = trades.reduce((sum, t) => sum + (Number(t.profit_loss) || 0), 0)

  const stats = useMemo(() => computeStats(trades), [trades])
  const aiSignature = `${trades.length}-${totalPL.toFixed(2)}-${winRate}-${isPro ? 'pro' : 'free'}-${lang}`

  const buildCategoryPrompt = () => {
    const catName = category?.name || ''
    const catMap = { [categoryId]: catName } 

    // 🌟 ดึงแค่สิ่งที่จำเป็นจริงๆ สำหรับ 1 สัญลักษณ์ (เอาแค่ Top 3 ข้อผิดพลาด และ 5 ไม้ล่าสุด)
    const mistakeText = mistakeStatsToPromptText(stats.mistakeStats, t('mistakeAnalysis'), pl, 3) 
    const recentTradesText = recentTradesToPromptText(stats.closed, catMap, pl, 5) 

    if (!isPro) {
      return [
        `${t('aiFree1')} (Focus: ${catName})`,
        t('aiFree2'),
        t('aiCatFreeStruct'), // 🌟 ใช้คำสั่งโครงสร้างภาษาตามที่ผู้ใช้เลือก
        statsToPromptText(stats, `${t('category')} ${catName}`),
      ].filter(Boolean).join('\n\n')
    }

    const parts = [
      `${t('aiPro1')} (Focus: ${catName})`,
      t('aiPro2'),
      t('aiCatProStruct'), // 🌟 ใช้คำสั่งโครงสร้างภาษาตามที่ผู้ใช้เลือก
      statsToPromptText(stats, `${t('category')} ${catName}`),  
      breakdownToPromptText(stats.byStrategy, t('catByStrategy'), 5), // 🌟 ส่งแค่ 5 กลยุทธ์
      mistakeText,
      recentTradesText
    ]
    return parts.filter(Boolean).join('\n\n')
  }

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/categories" className="breadcrumb">{t('allCat')}</Link>
          <h1>{category?.name || '...'} {isLocked && '🔒'}</h1>
          {category?.description && <p className="page-sub">{category.description}</p>}
        </div>
        {!isLocked && (
          <Link id="tour-new-trade-desktop" to={`/categories/${categoryId}/new`} className="btn btn-primary page-header-action">
            {t('newTrade')}
          </Link>
        )}
      </div>

      {isLocked && (
        <div className="panel" style={{ backgroundColor: 'rgba(255, 82, 82, 0.1)', borderColor: 'var(--loss)', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--loss)', marginBottom: '8px' }}>{t('lockedCategory')}</h3>
          <p style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '16px' }}>
            {t('lockedCategoryDesc').replace('{limit}', limits.categories).replace('{plan}', limits.name)}
          </p>
          {!isPro && <Link to="/upgrade"><button className="btn btn-primary">{t('upgradeToProUnlock')}</button></Link>}
        </div>
      )}

      <div className="stat-row">
        <div className="stat-pill">
          <span className="stat-value">{trades.length}</span>
          <span className="stat-label">{t('totalTrades')}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-value">{winRate}%</span>
          <span className="stat-label">{t('winRate')}</span>
        </div>
        <div className={`stat-pill ${totalPL >= 0 ? 'positive' : 'negative'}`}>
          <span className="stat-value">{pl(totalPL)}</span>
          <span className="stat-label">{t('totalPnL')}</span> 
        </div>
      </div>

      {!loading && trades.length > 0 && (
        <div id="tour-category-ai">
          <AIInsight
            title={t('aiAnalyze').replace('{category}', category?.name || '')}
            cacheKey={`ai_category_${user?.id || 'anon'}_${categoryId}_${isPro ? 'pro' : 'free'}`}
            signature={aiSignature}
            buildPrompt={buildCategoryPrompt}
            actionLabel={t('aiAnalyzeBtn')}
            disabled={isLocked}
            disabledHint={t('aiDisabledHint')}
          />
        </div>
      )}

      {loading ? (
        <div className="empty-state">{t('noTradesInCategory')}</div>
      ) : (
        <div className="trade-list">
          {trades.map((t_row, index) => (
            <Link id={index === 0 ? "tour-trade-card" : ""} to={`/trades/${t_row.id}`} key={t_row.id} className="trade-card">
              <div className="trade-card-section before">
                <div className="trade-card-row">
                  <span style={{ fontWeight: 'bold', color: t_row.direction === 'buy' ? 'var(--win)' : 'var(--loss)' }}>
                    {t_row.direction === 'buy' ? `📈 BUY` : `📉 SELL`}
                  </span>
                  <span>Entry {t_row.entry_price ?? '-'}</span>
                  <span>SL {t_row.stop_loss ?? '-'}</span>
                  <span>TP {t_row.take_profit ?? '-'}</span>
                  <span>Lot {t_row.lot_size ?? '-'}</span>
                </div>
                {t_row.strategy && <div className="trade-card-tag">{t_row.strategy}</div>} <br />
                {t_row.plan_notes && <div className="trade-card-tag2">{t_row.plan_notes}</div>}
              </div>
              <div className="trade-card-section result">
                <span className={`result-badge ${t_row.result}`}>{getResultLabel(t_row.result)}</span>
                <span className={Number(t_row.profit_loss) >= 0 ? 'positive' : 'negative'}>
                  {pl(t_row.profit_loss)}
                </span>
                <span className="trade-card-date">
                  {new Date(t_row.traded_at).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isLocked && (
        <Link id="tour-new-trade-mobile" to={`/categories/${categoryId}/new`} className="fab" aria-label="Record New Trade">
          +
        </Link>
      )}
    </div>
  )
}