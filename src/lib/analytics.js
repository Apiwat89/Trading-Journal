// Shared stats math — used by the Dashboard UI and by the AI prompt builders
// so the numbers the AI reasons about always match what's on screen.

export const SESSION_LABELS = {
  asia: 'Asia',
  london: 'London',
  newyork: 'New York',
  other: 'Other',
  ไม่ระบุ: 'N/A',
}
  
export const DIRECTION_LABELS = {
  buy: '🔼 Buy',
  sell: '🔽 Sell',
  ไม่ระบุ: 'N/A',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Aggregate a flat list of trades into count/win-rate/pl, optionally split by plan adherence. */
function buildBreakdown(trades, keyFn) {
  const map = {}
  trades.forEach((t) => {
    const key = keyFn(t)
    if (!map[key]) {
      map[key] = {
        count: 0,
        pl: 0,
        wins: 0,
        losses: 0,
        closed: 0,
        followed: { count: 0, wins: 0, closed: 0 },
        broke: { count: 0, wins: 0, closed: 0 },
      }
    }
    const e = map[key]
    e.count++
    e.pl += Number(t.profit_loss) || 0
    const isClosed = t.result === 'win' || t.result === 'loss'
    if (isClosed) {
      e.closed++
      if (t.result === 'win') e.wins++
      else e.losses++
    }
    const bucket = t.followed_plan === true ? e.followed : t.followed_plan === false ? e.broke : null
    if (bucket) {
      bucket.count++
      if (isClosed) {
        bucket.closed++
        if (t.result === 'win') bucket.wins++
      }
    }
  })
  return map
}

function aggregate(list) {
  const wins = list.filter((t) => t.result === 'win').length
  const losses = list.filter((t) => t.result === 'loss').length
  const closed = wins + losses
  const pl = list.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0)
  return { count: list.length, wins, losses, closed, pl, winRate: closed ? Math.round((wins / closed) * 100) : 0 }
}

function avgOf(list) {
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0
}

export function computeStats(trades, catNameById = {}) {
  const closed = trades.filter((t) => t.result === 'win' || t.result === 'loss')
  const wins = closed.filter((t) => t.result === 'win')
  const losses = closed.filter((t) => t.result === 'loss')
  const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : 0
  const totalPL = trades.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0)
  const grossWin = wins.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.profit_loss) || 0), 0))
  const profitFactor = grossLoss > 0 ? Number((grossWin / grossLoss).toFixed(2)) : grossWin > 0 ? Infinity : 0
  const avgWin = wins.length ? grossWin / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0

  let equity = 0
  const curve = trades.map((t, i) => {
    equity += Number(t.profit_loss) || 0
    return { i: i + 1, equity: Number(equity.toFixed(2)) }
  })

  // current streak
  let streak = 0
  let streakType = null
  for (let i = closed.length - 1; i >= 0; i--) {
    const r = closed[i].result
    if (streakType === null) {
      streakType = r
      streak = 1
    } else if (r === streakType) {
      streak++
    } else {
      break
    }
  }

  const byCategory = buildBreakdown(trades, (t) => catNameById[t.category_id] || 'ไม่ระบุ')
  const byStrategy = buildBreakdown(trades, (t) => t.strategy?.trim() || 'ไม่ระบุ')
  const bySession = buildBreakdown(trades, (t) => t.session || 'other')
  const byDirection = buildBreakdown(trades, (t) => t.direction || 'ไม่ระบุ')

  // plan adherence: does following the plan actually correlate with winning?
  const followedTrades = trades.filter((t) => t.followed_plan === true)
  const brokeTrades = trades.filter((t) => t.followed_plan === false)
  const planAdherence = {
    followed: aggregate(followedTrades),
    broke: aggregate(brokeTrades),
  }

  // mistake tags — not just frequency, but how costly each mistake actually is
  const mistakeStats = {}
  trades.forEach((t) => {
    ;(t.mistake_tags || []).forEach((tag) => {
      mistakeStats[tag] = mistakeStats[tag] || { count: 0, wins: 0, losses: 0, closed: 0, pl: 0 }
      const e = mistakeStats[tag]
      e.count++
      e.pl += Number(t.profit_loss) || 0
      if (t.result === 'win' || t.result === 'loss') {
        e.closed++
        if (t.result === 'win') e.wins++
        else e.losses++
      }
    })
  })
  // kept for backward compatibility with existing prompt text
  const mistakeCounts = {}
  Object.entries(mistakeStats).forEach(([tag, s]) => (mistakeCounts[tag] = s.count))

  // best / worst single trade
  const withPL = trades.filter((t) => t.profit_loss !== null && t.profit_loss !== undefined && t.profit_loss !== '')
  const bestTrade = withPL.length
    ? withPL.reduce((a, b) => (Number(b.profit_loss) > Number(a.profit_loss) ? b : a))
    : null
  const worstTrade = withPL.length
    ? withPL.reduce((a, b) => (Number(b.profit_loss) < Number(a.profit_loss) ? b : a))
    : null

  // avg hold time, win vs loss
  const avgDurationWin = avgOf(wins.filter((t) => t.duration_minutes).map((t) => Number(t.duration_minutes)))
  const avgDurationLoss = avgOf(losses.filter((t) => t.duration_minutes).map((t) => Number(t.duration_minutes)))

  // performance by day of week
  const byDayOfWeek = {}
  trades.forEach((t) => {
    if (!t.traded_at) return
    const d = new Date(t.traded_at)
    if (Number.isNaN(d.getTime())) return
    const key = DAY_NAMES[d.getDay()]
    byDayOfWeek[key] = byDayOfWeek[key] || { count: 0, pl: 0, wins: 0, closed: 0 }
    byDayOfWeek[key].count++
    byDayOfWeek[key].pl += Number(t.profit_loss) || 0
    if (t.result === 'win' || t.result === 'loss') {
      byDayOfWeek[key].closed++
      if (t.result === 'win') byDayOfWeek[key].wins++
    }
  })

  // monthly P/L trend
  const monthMap = {}
  trades.forEach((t) => {
    if (!t.traded_at) return
    const d = new Date(t.traded_at)
    if (Number.isNaN(d.getTime())) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = monthMap[key] || {
      key,
      label: d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }),
      pl: 0,
      count: 0,
    }
    monthMap[key].pl += Number(t.profit_loss) || 0
    monthMap[key].count++
  })
  const monthlyPL = Object.values(monthMap)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => ({ ...m, pl: Number(m.pl.toFixed(2)) }))

  const followedPlanCount = followedTrades.length
  const brokePlanCount = brokeTrades.length

  return {
    winRate,
    totalPL,
    profitFactor,
    avgWin,
    avgLoss,
    curve,
    streak,
    streakType,
    byCategory,
    byStrategy,
    bySession,
    byDirection,
    mistakeCounts,
    mistakeStats,
    planAdherence,
    bestTrade,
    worstTrade,
    avgDurationWin,
    avgDurationLoss,
    byDayOfWeek,
    monthlyPL,
    followedPlanCount,
    brokePlanCount,
    wins,
    losses,
    closed,
  }
}

/** Compact plain-text summary of a stats object, safe to drop into an AI prompt. */
export function statsToPromptText(stats, label) {
  const lines = []
  lines.push(`${label}: ${stats.closed.length} เทรดที่ปิดแล้ว, win rate ${stats.winRate}%`)
  lines.push(`กำไร/ขาดทุนสุทธิ: ${stats.totalPL.toFixed(2)}, profit factor: ${stats.profitFactor === Infinity ? '∞' : stats.profitFactor}`)
  lines.push(`กำไรเฉลี่ยต่อไม้ที่ชนะ: ${stats.avgWin.toFixed(2)}, ขาดทุนเฉลี่ยต่อไม้ที่แพ้: ${stats.avgLoss.toFixed(2)}`)
  if (stats.avgDurationWin || stats.avgDurationLoss) {
    lines.push(`ระยะเวลาถือเฉลี่ย: ไม้ชนะ ${Math.round(stats.avgDurationWin)} นาที, ไม้แพ้ ${Math.round(stats.avgDurationLoss)} นาที`)
  }
  lines.push(`สถานะล่าสุด: ${stats.streak || 0} ${stats.streakType === 'win' ? 'ชนะติดต่อกัน' : stats.streakType === 'loss' ? 'แพ้ติดต่อกัน' : ''}`)
  const fa = stats.planAdherence?.followed
  const ba = stats.planAdherence?.broke
  if (fa && ba) {
    lines.push(
      `เข้าเทรดตามแผน: ${fa.count} ครั้ง (win rate ${fa.winRate}%, กำไร/ขาดทุน ${fa.pl.toFixed(2)}) — ไม่ตามแผน: ${ba.count} ครั้ง (win rate ${ba.winRate}%, กำไร/ขาดทุน ${ba.pl.toFixed(2)})`
    )
  }
  const topMistakes = Object.entries(stats.mistakeStats || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([tag, s]) => `${tag} (${s.count} ครั้ง, win rate ${s.closed ? Math.round((s.wins / s.closed) * 100) : 0}%, กำไร/ขาดทุนรวม ${s.pl.toFixed(2)})`)
    .join('; ')
  if (topMistakes) lines.push(`ข้อผิดพลาดที่พบบ่อย: ${topMistakes}`)
  if (stats.bestTrade) {
    lines.push(`ไม้ที่ดีที่สุด: ${stats.bestTrade.profit_loss}`)
  }
  if (stats.worstTrade) {
    lines.push(`ไม้ที่แย่ที่สุด: ${stats.worstTrade.profit_loss}`)
  }
  return lines.join('\n')
}

/** Turn a byCategory/byStrategy/bySession/byDirection breakdown map into a compact text table. */
export function breakdownToPromptText(breakdown, label) {
  const rows = Object.entries(breakdown)
    .sort((a, b) => b[1].pl - a[1].pl)
    .map(([name, s]) => {
      const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
      return `- ${name}: ${s.count} เทรด, win rate ${wr}%, กำไร/ขาดทุน ${s.pl.toFixed(2)}`
    })
  return rows.length ? `${label}:\n${rows.join('\n')}` : ''
}

/** Day-of-week breakdown map into a compact text table. */
export function dayOfWeekToPromptText(byDayOfWeek) {
  const rows = DAY_NAMES.filter((d) => byDayOfWeek[d]).map((d) => {
    const s = byDayOfWeek[d]
    const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
    return `- วัน${d}: ${s.count} เทรด, win rate ${wr}%, กำไร/ขาดทุน ${s.pl.toFixed(2)}`
  })
  return rows.length ? `แยกตามวันในสัปดาห์:\n${rows.join('\n')}` : ''
}
