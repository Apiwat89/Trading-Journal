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
const resultLabel = { win: '🟢 Win', loss: '🔴 Loss', breakeven: '⚪ Breakeven', open: '🟦 Open' }
const DEFAULT_ROW_LIMIT = 8

function pl(n) {
  const v = Number(n) || 0
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

/** Turn a byCategory/byStrategy/bySession/byDirection breakdown map into flat table rows. */
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

/**
 * Generic breakdown table. Caps rows at `limit` and lets the user expand to
 * see the rest — so free-text fields like strategy/mistake tags can't grow
 * into an endless list as more trades get logged.
 */
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

export default function Dashboard() {
  const { user } = useAuth()
  const [trades, setTrades] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

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

  const stats = useMemo(() => computeStats(trades, catNameById), [trades, catNameById])

  const categoryRows = useMemo(() => toRows(stats.byCategory), [stats.byCategory])
  const strategyRows = useMemo(() => toRows(stats.byStrategy), [stats.byStrategy])
  const sessionRows = useMemo(() => toRows(stats.bySession, { labelMap: SESSION_LABELS }), [stats.bySession])
  const directionRows = useMemo(() => toRows(stats.byDirection, { labelMap: DIRECTION_LABELS }), [stats.byDirection])
  const mistakeRows = useMemo(() => toRows(stats.mistakeStats, { sortBy: 'count' }), [stats.mistakeStats])
  const dayRows = useMemo(
    () =>
      DAY_ORDER.filter((d) => stats.byDayOfWeek[d]).map((d) => {
        const s = stats.byDayOfWeek[d]
        return {
          key: d,
          label: d,
          count: s.count,
          winRate: s.closed ? Math.round((s.wins / s.closed) * 100) : 0,
          pl: s.pl,
        }
      }),
    [stats.byDayOfWeek]
  )

  const aiSignature = `${trades.length}-${stats.totalPL.toFixed(2)}-${stats.winRate}-${stats.closed.length}-${stats.followedPlanCount}-${stats.brokePlanCount}`

  const buildOverallPrompt = () => {
    const parts = [
      'คุณเป็นโค้ชเทรดมืออาชีพที่กำลังอ่านสถิติจากสมุดบันทึกการเทรดของผู้ใช้คนหนึ่ง',
      'ช่วยวิเคราะห์ภาพรวมพอร์ตทั้งหมดของเขา แล้วตอบเป็นภาษาไทย กระชับ ตรงประเด็น ใช้หัวข้อย่อย (bullet) เป็นหลัก ไม่ต้องมีคำนำยืดยาว',
      'โครงสร้างคำตอบ: 1) สรุปภาพรวมสั้นๆ ว่าตอนนี้เทรดเดอร์คนนี้ "เป็นยังไง" 2) จุดแข็งที่เห็นจากข้อมูล 3) จุดที่ควรระวัง/จุดอ่อน (รวมถึงวินัยการเทรด ผลกระทบของการไม่ตามแผน และข้อผิดพลาดที่พบบ่อยถ้ามี) 4) เวลา/session/วันที่เทรดได้ดีหรือแย่เป็นพิเศษถ้าข้อมูลชี้ให้เห็น 5) คำแนะนำที่ทำได้จริง 3-5 ข้อสำหรับก้าวต่อไป',
      '--- ข้อมูลสถิติ ---',
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Overall Trading Performance</p>
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
              <span className="stat-value">{trades.length}</span>
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
            <div className={`stat-pill ${stats.streakType === 'win' ? 'positive' : stats.streakType === 'loss' ? 'negative' : ''}`}>
              <span className="stat-value">
                {stats.streak || 0} {stats.streakType === 'win' ? 'W' : stats.streakType === 'loss' ? 'L' : ''}
              </span>
              <span className="stat-label">Current Streak</span>
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
            cacheKey={`ai_overall_${user?.id || 'anon'}`}
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
              {stats.monthlyPL.length > 12 && (
                <p className="panel-note">Showing last 12 months of {stats.monthlyPL.length} months</p>
              )}
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
              {fa.count > 0 && ba.count > 0 && (
                <p className="panel-note">
                  {fa.winRate >= ba.winRate
                    ? `Execute trades according to the plan to achieve a win rate approximately ${fa.winRate - ba.winRate}% higher.`
                    : `Not following the plan has a win rate approximately ${ba.winRate - fa.winRate}% higher, but this may be due to a small sample size. Consider reviewing your trading plan and adherence.`}
                </p>
              )}
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
            <StatsTable title="Categorized by Direction (Buy/Sell)" rows={directionRows} />
          </div>

          {dayRows.length > 0 && <StatsTable title="Categorized by Day of the Week" rows={dayRows} limit={7} />}

          {mistakeRows.length > 0 && (
            <StatsTable title="Common Mistakes and Their Costs" rows={mistakeRows} valueLabel="Total P&L" />
          )}

          {(stats.avgDurationWin > 0 || stats.avgDurationLoss > 0) && (
            <div className="panel">
              <h2>Average Holding Time</h2>
              <div className="compare-grid">
                <div className="compare-card good">
                  <div className="compare-card-title">Winning Trades</div>
                  <div className="compare-card-value">{Math.round(stats.avgDurationWin)} minutes</div>
                </div>
                <div className="compare-card bad">
                  <div className="compare-card-title">Losing Trades</div>
                  <div className="compare-card-value">{Math.round(stats.avgDurationLoss)} minutes</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
