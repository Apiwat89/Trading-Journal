import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { computeStats, statsToPromptText, breakdownToPromptText } from '../lib/analytics'
import AIInsight from '../components/AIInsight'
import { useLanguage } from '../context/LanguageContext'

const resultLabel = { win: '🟢 WIN', loss: '🔴 LOSS', breakeven: '⚪ BE', open: '🟦 OPEN' }

export default function CategoryTrades() {
  const { categoryId } = useParams()
  const { user, profile, limits } = useAuth()
  const [category, setCategory] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)
  const { t } = useLanguage()

  const isPro = profile?.tier === 'pro' || profile?.tier === 'pro_premium'

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
  const aiSignature = `${trades.length}-${totalPL.toFixed(2)}-${winRate}-${isPro ? 'pro' : 'free'}`

  const buildCategoryPrompt = () => {
    if (!isPro) {
      return [
        `You are a professional trading coach reviewing the trading statistics for the category/symbol "${category?.name || ''}" of a Free tier user.`,
        'Provide a concise response using bullet points. Do not include a long introduction.',
        'Structure: 1) Brief overview of this symbol 2) 2 basic recommendations for trading this category.',
        '--- Statistics (Free Plan) ---',
        statsToPromptText(stats, `Category ${category?.name || ''}`),
      ].filter(Boolean).join('\n\n')
    }

    const parts = [
      `You are a professional trading coach reviewing the in-depth trading statistics for the category/symbol "${category?.name || ''}" of a Pro tier user.`,
      'Provide a concise response using bullet points. Do not include a long introduction.',
      `Structure: 1) How is the trader performing with ${category?.name || 'this symbol'}? 2) Strengths seen in this category (e.g., strategy or session) 3) Weaknesses/Risks to watch out for 4) 3 actionable recommendations specifically for this category.`,
      '--- In-depth Statistics (Pro Plan) ---',
      statsToPromptText(stats, `Category ${category?.name || ''}`),
      breakdownToPromptText(stats.byStrategy, 'Breakdown by Strategy within this category'),
    ]
    return parts.filter(Boolean).join('\n\n')
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/categories" className="breadcrumb">{t('allCat')}</Link>
          <h1>{category?.name || '...'} {isLocked && '🔒'}</h1>
          {category?.description && <p className="page-sub">{category.description}</p>}
        </div>
        {!isLocked && (
          <Link to={`/categories/${categoryId}/new`} className="btn btn-primary page-header-action">
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
          <span className="stat-value">{totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}</span>
          <span className="stat-label">{t('totalPnL')}</span> 
        </div>
      </div>

      {!loading && trades.length > 0 && (
        <AIInsight
          title={t('aiAnalyze').replace('{category}', category?.name || '')}
          cacheKey={`ai_category_${user?.id || 'anon'}_${categoryId}_${isPro ? 'pro' : 'free'}`}
          signature={aiSignature}
          buildPrompt={buildCategoryPrompt}
          actionLabel={t('aiAnalyzeBtn')}
          disabled={isLocked} // 🌟 บล็อก AI ถ้าหมวดนี้โดนล็อก
          disabledHint={t('aiDisabledHint')}
        />
      )}

      {loading ? (
        <div className="empty-state">{t('noTradesInCategory')}</div>
      ) : (
        <div className="trade-list">
          {trades.map((t) => (
            <Link to={`/trades/${t.id}`} key={t.id} className="trade-card">
              <div className="trade-card-section before">
                <div className="trade-card-row">
                  <span>{t.direction === 'buy' ? '📈 BUY' : '📉 SELL'}</span>
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
                  {new Date(t.traded_at).toLocaleDateString('en-US')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isLocked && (
        <Link to={`/categories/${categoryId}/new`} className="fab" aria-label="Record New Trade">
          +
        </Link>
      )}
    </div>
  )
} 