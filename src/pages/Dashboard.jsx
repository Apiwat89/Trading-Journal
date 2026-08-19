import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  computeStats,
  statsToPromptText,
  breakdownToPromptText,
  dayOfWeekToPromptText,
  mistakeStatsToPromptText,
  recentTradesToPromptText,
  SESSION_LABELS,
  DIRECTION_LABELS,
  AI_PROMPT_CONFIG // 🌟 ดึงตัวแปรตั้งค่าที่เพิ่งสร้างมาใช้!
} from '../lib/analytics'
import AIInsight from '../components/AIInsight'
import { useLanguage } from '../context/LanguageContext'

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DEFAULT_ROW_LIMIT = 8

function pl(n) {
  const v = Number(n) || 0
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

function toRows(data, { labelMap, sortBy = 'pl' } = {}) {
  const rows = Object.entries(data).map(([name, s]) => ({
    key: name,
    label: labelMap ? labelMap[name] || name : name,
    count: s.count,
    winRate: s.closed ? Math.round((s.wins / s.closed) * 100) : 0,
    pl: s.pl,
  }))
  return sortBy === 'count' ? rows.sort((a, b) => b.count - a.count) : rows.sort((a, b) => b.pl - a.pl)
}

function StatsTable({ title, rows, limit = DEFAULT_ROW_LIMIT, valueLabel, t }) {
  const [expanded, setExpanded] = useState(false)
  if (!rows.length) return null
  const visible = expanded ? rows : rows.slice(0, limit)
  const hidden = rows.length - visible.length

  return (
    <div className="panel">
      <h2>{title}</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t('item')}</th>
            <th>{t('trades')}</th>
            <th>{t('winRateTbl')}</th>
            <th>{valueLabel || t('profitLoss')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{r.count}</td>
              <td>{r.winRate}%</td>
              <td className={r.pl >= 0 ? 'positive' : 'negative'}>{pl(r.pl)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button type="button" className="table-expand-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded 
            ? t('collapse') 
            : t('showMore').replace('{hidden}', hidden).replace('{total}', rows.length)}
        </button>
      )}
    </div>
  )
}

function TradeHighlightCard({ label, trade, catNameById, tone, t, lang, getResultLabel }) {
  if (!trade) return null
  return (
    <Link to={`/trades/${trade.id}`} className={`compare-card ${tone}`}>
      <div className="compare-card-title">{label}</div>
      <div className={`compare-card-value ${Number(trade.profit_loss) >= 0 ? 'positive' : 'negative'}`}>
        {pl(trade.profit_loss)}
      </div>
      <div className="compare-stats">
        <div>
          <span>{t('category')}</span>
          <strong>{catNameById[trade.category_id] || t('na')}</strong>
        </div>
        <div>
          <span>{t('strategy')}</span>
          <strong>{trade.strategy || t('na')}</strong>
        </div>
        <div>
          <span>{t('result')}</span>
          <strong>{getResultLabel(trade.result)}</strong>
        </div>
        <div>
          <span>{t('date')}</span>
          <strong>{trade.traded_at ? new Date(trade.traded_at).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US') : '-'}</strong>
        </div>
      </div>
    </Link>
  )
}

function ProLockOverlay({ t }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 10,
      background: 'rgba(5, 6, 10, 0.65)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '14px',
      border: '1px solid var(--gold-glow)',
      padding: '24px',
      textAlign: 'center'
    }}>
      <h3 style={{ color: 'var(--gold)', marginBottom: '8px', fontSize: '20px' }}>{t('proFeatureTitle')}</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px', maxWidth: '350px' }}>
        {t('proFeatureDesc')}
      </p>
      <Link to="/upgrade">
        <button className="btn btn-primary">
          {t('upgradeToPro')}
        </button>
      </Link>
    </div>
  )
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [trades, setTrades] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('all')
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
    const queryParams = new URLSearchParams(window.location.search)
    if (queryParams.get('upgrade') === 'success' && user) {
      const updateProStatus = async () => {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const { error } = await supabase
          .from('profiles')
          .update({
            tier: 'pro',
            pro_expires_at: expiresAt
          })
          .eq('id', user.id)

        if (!error) {
          window.history.replaceState({}, document.title, window.location.pathname)
          window.location.reload()
        }
      }
      updateProStatus()
    }
  }, [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: trs } = await supabase.from('trades').select('*').order('traded_at', { ascending: true })
      const { data: cats } = await supabase.from('categories').select('*')
      setTrades(trs || [])
      setCategories(cats || [])
      setLoading(false)
    }
    load()
  }, [])

  const catNameById = useMemo(() => {
    const map = {}
    categories.forEach((c) => (map[c.id] = c.name))
    return map
  }, [categories])

  const stats = useMemo(() => computeStats(trades, catNameById, dateFilter), [trades, catNameById, dateFilter])

  const categoryRows = useMemo(() => toRows(stats.byCategory), [stats.byCategory])
  const strategyRows = useMemo(() => toRows(stats.byStrategy), [stats.byStrategy])
  const sessionRows = useMemo(() => toRows(stats.bySession, { labelMap: SESSION_LABELS }), [stats.bySession])
  const directionRows = useMemo(() => toRows(stats.byDirection, { labelMap: DIRECTION_LABELS }), [stats.byDirection])
  
  const dayRows = useMemo(
    () =>
      DAY_ORDER.filter((d) => stats.byDayOfWeek[d]).map((d) => {
        const s = stats.byDayOfWeek[d]
        return {
          key: d,
          label: t(`day${d}`), 
          count: s.count,
          winRate: s.closed ? Math.round((s.wins / s.closed) * 100) : 0,
          pl: s.pl,
        }
      }),
    [stats.byDayOfWeek, t]
  )

  const mistakeRows = useMemo(() => toRows(stats.mistakeStats, { sortBy: 'count' }), [stats.mistakeStats])

  const aiSignature = `${trades.length}-${stats.totalPL.toFixed(2)}-${stats.winRate}-${stats.closed.length}-${dateFilter}-${lang}`

  const buildOverallPrompt = () => {
    if (!isPro) {
      return [
        t('aiFree1'),
        t('aiFree2'),
        t('aiFree3'),
        statsToPromptText(stats, t('aiStatAll')),
        recentTradesText
      ].filter(Boolean).join('\n\n')
    }

    const parts = [
      t('aiPro1'),
      t('aiPro2'),
      statsToPromptText(stats, t('aiStatAll')),  
      // 🌟 ส่งค่าจำกัดเฉพาะหมวดลงไปตามที่ตั้งค่าไว้!
      breakdownToPromptText(stats.byCategory, t('aiStatCat'), AI_PROMPT_CONFIG.MAX_CATEGORY),
      breakdownToPromptText(stats.byStrategy, t('aiStatStrat'), AI_PROMPT_CONFIG.MAX_STRATEGY),
      breakdownToPromptText(stats.bySession, t('aiStatSession'), AI_PROMPT_CONFIG.MAX_SESSION),
      breakdownToPromptText(stats.byDirection, t('aiStatDir'), AI_PROMPT_CONFIG.MAX_DIRECTION),
      dayOfWeekToPromptText(stats.byDayOfWeek, AI_PROMPT_CONFIG.MAX_DAY_OF_WEEK),
      mistakeStatsToPromptText(stats.mistakeStats, t('mistakeAnalysis'), pl, AI_PROMPT_CONFIG.MAX_MISTAKE_TAGS),
      recentTradesToPromptText(stats.closed, catNameById, pl, AI_PROMPT_CONFIG.MAX_RECENT_TRADES)
    ]
    return parts.filter(Boolean).join('\n\n')
  }

  const fa = stats.planAdherence.followed
  const ba = stats.planAdherence.broke
  const hasPlanData = fa.count > 0 || ba.count > 0
  const recentMonths = stats.monthlyPL.slice(-12)
  const recentTrades = [...stats.closed].reverse().slice(0, 5)

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>{t('dashboard')}</h1>
          <p className="page-sub">{t('subTitle')}</p>
        </div>

        <div id="tour-filter" style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {[
            { id: 'all', label: t('filterAll') },
            { id: 'month', label: t('filterMonth') },
            { id: 'week', label: t('filterWeek') },
            { id: 'today', label: t('filterToday') }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDateFilter(f.id)}
              style={{
                background: dateFilter === f.id ? 'var(--gold)' : 'transparent',
                color: dateFilter === f.id ? '#000' : 'var(--text-dim)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="empty-state">
          {t('noTradeData1')} <Link to="/categories">{t('noTradeData2')}</Link>
        </div>
      ) : (
        <>
          <div id="tour-dashboard-stats" className="stat-row">
            <div className="stat-pill">
              <span className="stat-value">{stats.totalTrades}</span>
              <span className="stat-label">{t('totalTrades')}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value">{stats.winRate}%</span>
              <span className="stat-label">{t('winRate')} ({stats.wins.length}W / {stats.losses.length}L)</span>
            </div>
            <div className={`stat-pill ${stats.totalPL >= 0 ? 'positive' : 'negative'}`}>
              <span className="stat-value">{pl(stats.totalPL)}</span>
              <span className="stat-label">{t('cumulativePnL')}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor}</span>
              <span className="stat-label">{t('profitFactor')}</span>
            </div>
            <div className={`stat-pill ${stats.expectancy >= 0 ? 'positive' : 'negative'}`}>
              <span className="stat-value">{pl(stats.expectancy)}</span>
              <span className="stat-label">{t('expectancy')}</span>
            </div>
            <div className="stat-pill negative">
              <span className="stat-value">-{stats.maxDrawdown.toFixed(2)}</span>
              <span className="stat-label">{t('maxDrawdown')}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value" style={{ color: 'var(--win)' }}>{stats.maxWinStreak}W</span>
              <span className="stat-label">{t('maxWinStreak')}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value" style={{ color: 'var(--loss)' }}>{stats.maxLossStreak}L</span>
              <span className="stat-label">{t('maxLossStreak')}</span>
            </div>
            <div className="stat-pill positive">
              <span className="stat-value">{stats.avgWin.toFixed(2)}</span>
              <span className="stat-label">{t('avgWin')}</span>
            </div>
            <div className="stat-pill negative">
              <span className="stat-value">-{stats.avgLoss.toFixed(2)}</span>
              <span className="stat-label">{t('avgLoss')}</span>
            </div>
          </div>
          <div id="tour-ai">  
            <AIInsight
              title={t('aiAnalyzePort')}
              cacheKey={`ai_overall_${user?.id || 'anon'}_${dateFilter}`}
              signature={aiSignature}
              buildPrompt={buildOverallPrompt}
              actionLabel={t('aiAnalyzeBtn')}
            /> 
          </div>

          <div className="panel">
            <h2>{t('equityCurve')}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="i" stroke="var(--text-dim)" fontSize={12} />
                <YAxis stroke="var(--text-dim)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                  labelFormatter={(label) => `${t('tradeNumberLabel')}${label}`} /* 🌟 เพิ่มบรรทัดนี้เข้ามาครับ */
                />
                <Line 
                  type="monotone" 
                  dataKey="equity" 
                  name={t('equityTooltip')}
                  stroke="var(--win)" 
                  strokeWidth={2.5} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ position: 'relative', marginTop: '24px' }}>
            {!isPro && <ProLockOverlay t={t} />}
            
            <div style={{ 
              filter: !isPro ? 'blur(6px)' : 'none', 
              pointerEvents: !isPro ? 'none' : 'auto', 
              userSelect: !isPro ? 'none' : 'auto', 
              opacity: !isPro ? 0.4 : 1,
              transition: 'all 0.3s ease'
            }}>
              
              {recentMonths.length > 1 && (
                <div className="panel">
                  <h2>{t('monthlyPnL')}</h2>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={recentMonths}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" stroke="var(--text-dim)" fontSize={12} />
                      <YAxis stroke="var(--text-dim)" fontSize={12} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                        labelStyle={{ color: 'var(--text-dim)' }}
                      />
                      <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
                        {recentMonths.map((m, i) => (
                          <Cell key={i} fill={m.pl >= 0 ? 'var(--win)' : 'var(--loss)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {hasPlanData && (
                <div className="panel">
                  <h2>{t('planVsNoPlan')}</h2>
                  <div className="compare-grid">
                    <div className="compare-card good">
                      <div className="compare-card-title">{t('followingPlan')}</div>
                      <div className="compare-card-value">{fa.count} {t('trades')}</div>
                      <div className="compare-stats">
                        <div>
                          <span>{t('winRateTbl')}</span>
                          <strong>{fa.winRate}%</strong>
                        </div>
                        <div>
                          <span>{t('winsLosses')}</span>
                          <strong>{fa.wins}W / {fa.losses}L</strong>
                        </div>
                        <div>
                          <span>{t('cumulativePnL')}</span>
                          <strong className={fa.pl >= 0 ? 'positive' : 'negative'}>{pl(fa.pl)}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="compare-card bad">
                      <div className="compare-card-title">{t('notFollowingPlan')}</div>
                      <div className="compare-card-value">{ba.count} {t('trades')}</div>
                      <div className="compare-stats">
                        <div>
                          <span>{t('winRateTbl')}</span>
                          <strong>{ba.winRate}%</strong>
                        </div>
                        <div>
                          <span>{t('winsLosses')}</span>
                          <strong>{ba.wins}W / {ba.losses}L</strong>
                        </div>
                        <div>
                          <span>{t('cumulativePnL')}</span>
                          <strong className={ba.pl >= 0 ? 'positive' : 'negative'}>{pl(ba.pl)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(stats.bestTrade || stats.worstTrade) && (
                <div className="panel">
                  <h2>{t('bestTrade').replace('🏆 ', '').replace('💀 ', '')} / {t('worstTrade').replace('🏆 ', '').replace('💀 ', '')}</h2>
                  <div className="compare-grid">
                    <TradeHighlightCard label={t('bestTrade')} trade={stats.bestTrade} catNameById={catNameById} tone="good" t={t} lang={lang} getResultLabel={getResultLabel} />
                    <TradeHighlightCard label={t('worstTrade')} trade={stats.worstTrade} catNameById={catNameById} tone="bad" t={t} lang={lang} getResultLabel={getResultLabel} />
                  </div>
                </div>
              )}

              <div className="panel-grid">
                <StatsTable title={t('catBySymbol')} rows={categoryRows} t={t} />
                <StatsTable title={t('catByStrategy')} rows={strategyRows} t={t} />
                <StatsTable title={t('catBySession')} rows={sessionRows} t={t} />
                <StatsTable title={t('catByDirection')} rows={directionRows} t={t} />
                {dayRows.length > 0 && <StatsTable title={t('perfByDay')} rows={dayRows} t={t} />}
                {mistakeRows.length > 0 && <StatsTable title={t('mistakeAnalysis')} rows={mistakeRows} valueLabel={t('totalLossImpact')} t={t} />}
              </div>

              <div className="panel" style={{ marginTop: '24px' }}>
                <h2>{t('recentTrades')}</h2>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('date')}</th>
                        <th>{t('catgory')}</th>
                        <th>{t('direction')}</th>
                        <th>{t('strategy')}</th>
                        <th>{t('result')}</th>
                        <th>{t('profitLoss')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map((t_row) => (
                        <tr key={t_row.id}>
                          <td>{t_row.traded_at ? new Date(t_row.traded_at).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US') : '-'}</td>
                          <td><strong>{catNameById[t_row.category_id] || t('na')}</strong></td>
                          <td style={{ textTransform: 'uppercase', fontWeight: 'bold', color: t_row.direction === 'buy' ? 'var(--win)' : 'var(--loss)' }}>
                            {t_row.direction}
                          </td>
                          <td>{t_row.strategy || '-'}</td>
                          <td>{getResultLabel(t_row.result)}</td>
                          <td className={Number(t_row.profit_loss) >= 0 ? 'positive' : 'negative'}>
                            {t_row.profit_loss !== null ? pl(t_row.profit_loss) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}