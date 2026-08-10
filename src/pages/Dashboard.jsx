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
  SESSION_LABELS,
  DIRECTION_LABELS,
} from '../lib/analytics'
import AIInsight from '../components/AIInsight'

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_LABELS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }
const resultLabel = { win: '🟢 Win', loss: '🔴 Loss', breakeven: '⚪ Breakeven', open: '🟦 Open' }
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

function StatsTable({ title, rows, limit = DEFAULT_ROW_LIMIT, valueLabel = 'Profit/Loss' }) {
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
            <th>Item</th>
            <th>Trades</th>
            <th>Win Rate</th>
            <th>{valueLabel}</th>
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
          {expanded ? 'Collapse' : `Show ${hidden} More Items (Total ${rows.length})`}
        </button>
      )}
    </div>
  )
}

function TradeHighlightCard({ label, trade, catNameById, tone }) {
  if (!trade) return null
  return (
    <Link to={`/trades/${trade.id}`} className={`compare-card ${tone}`}>
      <div className="compare-card-title">{label}</div>
      <div className={`compare-card-value ${Number(trade.profit_loss) >= 0 ? 'positive' : 'negative'}`}>
        {pl(trade.profit_loss)}
      </div>
      <div className="compare-stats">
        <div>
          <span>Category</span>
          <strong>{catNameById[trade.category_id] || 'N/A'}</strong>
        </div>
        <div>
          <span>Strategy</span>
          <strong>{trade.strategy || 'N/A'}</strong>
        </div>
        <div>
          <span>Result</span>
          <strong>{resultLabel[trade.result] || trade.result}</strong>
        </div>
        <div>
          <span>Date</span>
          <strong>{trade.traded_at ? new Date(trade.traded_at).toLocaleDateString('th-TH') : '-'}</strong>
        </div>
      </div>
    </Link>
  )
}

function ProLockOverlay() {
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
      <h3 style={{ color: 'var(--gold)', marginBottom: '8px', fontSize: '20px' }}>🔒 Pro Feature</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px', maxWidth: '350px' }}>
        Upgrade to Pro to unlock advanced analytics, monthly P&L breakdowns, strategy performance, and more deep insights.
      </p>
      <Link to="/upgrade">
        <button className="btn btn-primary">
          Upgrade to Pro
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

  const isPro = profile?.tier === 'pro'

  // --- ส่วนเพิ่มใหม่: เช็กว่าถ้ากลับมาจากหน้าจ่ายเงินสำเร็จ ให้บันทึกเวลา Pro ลง Supabase ทันที ---
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search)
    if (queryParams.get('upgrade') === 'success' && user) {
      const updateProStatus = async () => {
        // คำนวณเวลาหมดอายุล่วงหน้า 30 วันจากปัจจุบัน
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        
        const { error } = await supabase
          .from('profiles')
          .update({
            tier: 'pro',
            pro_expires_at: expiresAt
          })
          .eq('id', user.id)

        if (!error) {
          // ล้าง URL query ออกแล้วรีเฟรชหน้าเพื่อให้สิทธิ์ Pro อัปเดตทันที
          window.history.replaceState({}, document.title, window.location.pathname)
          window.location.reload()
        }
      }
      updateProStatus()
    }
  }, [user])
  // --------------------------------------------------------------------------------

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
          label: DAY_LABELS[d] || d,
          count: s.count,
          winRate: s.closed ? Math.round((s.wins / s.closed) * 100) : 0,
          pl: s.pl,
        }
      }),
    [stats.byDayOfWeek]
  )

  const mistakeRows = useMemo(() => toRows(stats.mistakeStats, { sortBy: 'count' }), [stats.mistakeStats])

  const aiSignature = `${trades.length}-${stats.totalPL.toFixed(2)}-${stats.winRate}-${stats.closed.length}-${dateFilter}`

  const buildOverallPrompt = () => {
    if (!isPro) {
      return [
        'คุณเป็นโค้ชเทรดมืออาชีพ กำลังอ่านสถิติภาพรวมพอร์ตของผู้ใช้แพ็กเกจ Free',
        'ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ใช้หัวข้อย่อยเป็นหลัก ไม่ต้องมีคำนำยืดยาว',
        'โครงสร้างคำตอบ: 1) สรุปภาพรวมพอร์ตสั้นๆ 2) ประเมินทิศทางกราฟ 3) คำแนะนำสั้นๆ 2-3 ข้อ',
        statsToPromptText(stats, 'ภาพรวมพอร์ตทั้งหมด'),
      ].filter(Boolean).join('\n\n')
    }

    const parts = [
      'คุณเป็นโค้ชเทรดมืออาชีพที่กำลังอ่านสถิติเชิงลึกจากสมุดบันทึกการเทรดของผู้ใช้แพ็กเกจ Pro',
      'ช่วยวิเคราะห์พอร์ตทั้งหมดของเขาอย่างละเอียด ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ใช้หัวข้อย่อย (bullet)',
      statsToPromptText(stats, 'ภาพรวมทั้งหมด'),  
      breakdownToPromptText(stats.byCategory, 'แยกตามหมวด/สัญลักษณ์'),
      breakdownToPromptText(stats.byStrategy, 'แยกตาม Strategy'),
      breakdownToPromptText(stats.bySession, 'แยกตาม Session'),
      breakdownToPromptText(stats.byDirection, 'แยกตามทิศทาง (Buy/Sell)'),
      dayOfWeekToPromptText(stats.byDayOfWeek),
    ]
    return parts.filter(Boolean).join('\n\n')
  }

  if (loading) return <div className="page-loading">Loading...</div>

  const fa = stats.planAdherence.followed
  const ba = stats.planAdherence.broke
  const hasPlanData = fa.count > 0 || ba.count > 0
  const recentMonths = stats.monthlyPL.slice(-12)
  const recentTrades = [...stats.closed].reverse().slice(0, 5)

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Overall Trading Performance & Advanced Analytics</p>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: 'var(--surface-2)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {['all', 'month', 'week', 'today'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setDateFilter(f)}
              style={{
                background: dateFilter === f ? 'var(--gold)' : 'transparent',
                color: dateFilter === f ? '#000' : 'var(--text-dim)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease',
              }}
            >
              {f === 'all' ? 'All Time' : f === 'month' ? 'This Month' : f === 'week' ? 'This Week' : 'Today'}
            </button>
          ))}
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="empty-state">
          No trading data available — <Link to="/categories">Create a category and log your first trade</Link>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-pill">
              <span className="stat-value">{stats.totalTrades}</span>
              <span className="stat-label">Total Trades</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value">{stats.winRate}%</span>
              <span className="stat-label">Win rate ({stats.wins.length}W / {stats.losses.length}L)</span>
            </div>
            <div className={`stat-pill ${stats.totalPL >= 0 ? 'positive' : 'negative'}`}>
              <span className="stat-value">{pl(stats.totalPL)}</span>
              <span className="stat-label">Cumulative P&L</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value">{stats.profitFactor === Infinity ? '∞' : stats.profitFactor}</span>
              <span className="stat-label">Profit factor</span>
            </div>
            <div className={`stat-pill ${stats.expectancy >= 0 ? 'positive' : 'negative'}`}>
              <span className="stat-value">{pl(stats.expectancy)}</span>
              <span className="stat-label">Expectancy / Trade</span>
            </div>
            <div className="stat-pill negative">
              <span className="stat-value">-{stats.maxDrawdown.toFixed(2)}</span>
              <span className="stat-label">Max Drawdown</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value" style={{ color: 'var(--win)' }}>{stats.maxWinStreak}W</span>
              <span className="stat-label">Max Win Streak</span>
            </div>
            <div className="stat-pill">
              <span className="stat-value" style={{ color: 'var(--loss)' }}>{stats.maxLossStreak}L</span>
              <span className="stat-label">Max Loss Streak</span>
            </div>
            <div className="stat-pill positive">
              <span className="stat-value">{stats.avgWin.toFixed(2)}</span>
              <span className="stat-label">Average Win</span>
            </div>
            <div className="stat-pill negative">
              <span className="stat-value">-{stats.avgLoss.toFixed(2)}</span>
              <span className="stat-label">Average Loss</span>
            </div>
          </div>

          <AIInsight
            title="AI analyzes portfolio."
            cacheKey={`ai_overall_${user?.id || 'anon'}_${dateFilter}`}
            signature={aiSignature}
            buildPrompt={buildOverallPrompt}
            actionLabel="AI analyze"
          />

          <div className="panel">
            <h2>Equity Curve</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stats.curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="i" stroke="var(--text-dim)" fontSize={12} />
                <YAxis stroke="var(--text-dim)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                />
                <Line type="monotone" dataKey="equity" stroke="var(--win)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ position: 'relative', marginTop: '24px' }}>
            {!isPro && <ProLockOverlay />}
            
            <div style={{ 
              filter: !isPro ? 'blur(6px)' : 'none', 
              pointerEvents: !isPro ? 'none' : 'auto', 
              userSelect: !isPro ? 'none' : 'auto', 
              opacity: !isPro ? 0.4 : 1,
              transition: 'all 0.3s ease'
            }}>
              
              {recentMonths.length > 1 && (
                <div className="panel">
                  <h2>Monthly P&L</h2>
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
                  <h2>Following Plan vs Not Following Plan</h2>
                  <div className="compare-grid">
                    <div className="compare-card good">
                      <div className="compare-card-title">Following Plan</div>
                      <div className="compare-card-value">{fa.count} Trades</div>
                      <div className="compare-stats">
                        <div>
                          <span>Win rate</span>
                          <strong>{fa.winRate}%</strong>
                        </div>
                        <div>
                          <span>Wins / Losses</span>
                          <strong>{fa.wins}W / {fa.losses}L</strong>
                        </div>
                        <div>
                          <span>Cumulative P&L</span>
                          <strong className={fa.pl >= 0 ? 'positive' : 'negative'}>{pl(fa.pl)}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="compare-card bad">
                      <div className="compare-card-title">Not Following Plan</div>
                      <div className="compare-card-value">{ba.count} Trades</div>
                      <div className="compare-stats">
                        <div>
                          <span>Win rate</span>
                          <strong>{ba.winRate}%</strong>
                        </div>
                        <div>
                          <span>Wins / Losses</span>
                          <strong>{ba.wins}W / {ba.losses}L</strong>
                        </div>
                        <div>
                          <span>Cumulative P&L</span>
                          <strong className={ba.pl >= 0 ? 'positive' : 'negative'}>{pl(ba.pl)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(stats.bestTrade || stats.worstTrade) && (
                <div className="panel">
                  <h2>Best / Worst Trade</h2>
                  <div className="compare-grid">
                    <TradeHighlightCard label="🏆 Best Trade" trade={stats.bestTrade} catNameById={catNameById} tone="good" />
                    <TradeHighlightCard label="💀 Worst Trade" trade={stats.worstTrade} catNameById={catNameById} tone="bad" />
                  </div>
                </div>
              )}

              <div className="panel-grid">
                <StatsTable title="Categorized by Symbol" rows={categoryRows} />
                <StatsTable title="Categorized by Strategy" rows={strategyRows} />
                <StatsTable title="Categorized by Session" rows={sessionRows} />
                <StatsTable title="Categorized by Direction" rows={directionRows} />
                {dayRows.length > 0 && <StatsTable title="Performance by Day of Week" rows={dayRows} />}
                {mistakeRows.length > 0 && <StatsTable title="Mistake Tags Analysis" rows={mistakeRows} valueLabel="Total Loss Impact" />}
              </div>

              <div className="panel" style={{ marginTop: '24px' }}>
                <h2>Recent Trades</h2>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Symbol</th>
                        <th>Direction</th>
                        <th>Strategy</th>
                        <th>Result</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentTrades.map((t) => (
                        <tr key={t.id}>
                          <td>{t.traded_at ? new Date(t.traded_at).toLocaleDateString('th-TH') : '-'}</td>
                          <td><strong>{catNameById[t.category_id] || 'N/A'}</strong></td>
                          <td style={{ textTransform: 'uppercase', fontWeight: 'bold', color: t.direction === 'buy' ? 'var(--win)' : 'var(--loss)' }}>
                            {t.direction}
                          </td>
                          <td>{t.strategy || '-'}</td>
                          <td>{resultLabel[t.result] || t.result}</td>
                          <td className={Number(t.profit_loss) >= 0 ? 'positive' : 'negative'}>
                            {t.profit_loss !== null ? pl(t.profit_loss) : '-'}
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