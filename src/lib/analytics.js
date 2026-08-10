export const SESSION_LABELS = {
  asia: 'Asia Session',
  london: 'London Session',
  newyork: 'New York Session',
}

export const DIRECTION_LABELS = {
  buy: 'Buy (Long)',
  sell: 'Sell (Short)',
}

// ฟังก์ชันคำนวณสถิติเชิงลึกทั้งหมด
export function computeStats(trades, catNameById = {}, dateFilter = 'all') {
  // 1. กรองข้อมูลตามช่วงเวลา (Date Filter)
  const now = new Date()
  const filteredTrades = trades.filter((t) => {
    if (!t.traded_at) return true
    const tDate = new Date(t.traded_at)
    if (dateFilter === 'today') {
      return tDate.toDateString() === now.toDateString()
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return tDate >= weekAgo
    }
    if (dateFilter === 'month') {
      return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()
    }
    return true // 'all'
  })

  const closed = filteredTrades.filter((t) => t.result && t.result !== 'open')
  const wins = closed.filter((t) => t.result === 'win')
  const losses = closed.filter((t) => t.result === 'loss')
  const breakevens = closed.filter((t) => t.result === 'breakeven')

  const totalPL = closed.reduce((sum, t) => sum + (Number(t.profit_loss) || 0), 0)
  const winRate = closed.length ? Math.round((wins.length / closed.length) * 100) : 0

  const grossProfit = wins.reduce((sum, t) => sum + (Number(t.profit_loss) || 0), 0)
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (Number(t.profit_loss) || 0), 0))
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Infinity : 0) : Number((grossProfit / grossLoss).toFixed(2))

  const avgWin = wins.length ? grossProfit / wins.length : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0

  // ข้อ 1: Expectancy (ค่าคาดหวังต่อไม้) = (Win% * AvgWin) - (Loss% * AvgLoss)
  const winProb = closed.length ? wins.length / closed.length : 0
  const lossProb = closed.length ? losses.length / closed.length : 0
  const expectancy = Number(((winProb * avgWin) - (lossProb * avgLoss)).toFixed(2))

  // เรียงลำดับตามเวลาเพื่อทำ Equity Curve และคำนวณ Drawdown / Streaks
  const sorted = [...filteredTrades].sort((a, b) => new Date(a.traded_at || 0) - new Date(b.traded_at || 0))

  let currentEquity = 0
  let peakEquity = 0
  let maxDrawdown = 0
  const curve = []

  let currentStreak = 0
  let streakType = null // 'win' or 'loss'
  let maxWinStreak = 0
  let maxLossStreak = 0

  sorted.forEach((t, i) => {
    const pl = Number(t.profit_loss) || 0
    if (t.result && t.result !== 'open') {
      currentEquity += pl
      if (currentEquity > peakEquity) {
        peakEquity = currentEquity
      }
      const dd = peakEquity - currentEquity
      if (dd > maxDrawdown) {
        maxDrawdown = dd
      }

      // คำนวณ Streak
      if (t.result === 'win') {
        if (streakType === 'win') {
          currentStreak++
        } else {
          streakType = 'win'
          currentStreak = 1
        }
        if (currentStreak > maxWinStreak) maxWinStreak = currentStreak
      } else if (t.result === 'loss') {
        if (streakType === 'loss') {
          currentStreak++
        } else {
          streakType = 'loss'
          currentStreak = 1
        }
        if (currentStreak > maxLossStreak) maxLossStreak = currentStreak
      }
    }
    curve.push({ i: i + 1, equity: Number(currentEquity.toFixed(2)), date: t.traded_at ? new Date(t.traded_at).toLocaleDateString() : '' })
  })

  // หากไม่มีไม้ปิด ให้ใช้ค่าเริ่มต้นของ streak
  const activeStreakType = streakType || 'none'
  const activeStreakCount = currentStreak

  // Breakdown ตามหมวดหมู่, กลยุทธ์, Session, ทิศทาง, วันในสัปดาห์
  const byCategory = {}
  const byStrategy = {}
  const bySession = {}
  const byDirection = {}
  const byDayOfWeek = {}
  const mistakeStats = {}

  closed.forEach((t) => {
    const pl = Number(t.profit_loss) || 0
    const isWin = t.result === 'win'

    // Category
    const catKey = t.category_id || 'unknown'
    const catLabel = catNameById[catKey] || 'Uncategorized'
    if (!byCategory[catLabel]) byCategory[catLabel] = { count: 0, wins: 0, closed: 0, pl: 0 }
    byCategory[catLabel].count++
    byCategory[catLabel].closed++
    byCategory[catLabel].pl += pl
    if (isWin) byCategory[catLabel].wins++

    // Strategy
    const strat = t.strategy || 'Unspecified'
    if (!byStrategy[strat]) byStrategy[strat] = { count: 0, wins: 0, closed: 0, pl: 0 }
    byStrategy[strat].count++
    byStrategy[strat].closed++
    byStrategy[strat].pl += pl
    if (isWin) byStrategy[strat].wins++

    // Session
    const ses = t.session || 'other'
    if (!bySession[ses]) bySession[ses] = { count: 0, wins: 0, closed: 0, pl: 0 }
    bySession[ses].count++
    bySession[ses].closed++
    bySession[ses].pl += pl
    if (isWin) bySession[ses].wins++

    // Direction
    const dir = t.direction || 'buy'
    if (!byDirection[dir]) byDirection[dir] = { count: 0, wins: 0, closed: 0, pl: 0 }
    byDirection[dir].count++
    byDirection[dir].closed++
    byDirection[dir].pl += pl
    if (isWin) byDirection[dir].wins++

    // Day of week
    if (t.traded_at) {
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t.traded_at).getDay()]
      if (!byDayOfWeek[dayStr]) byDayOfWeek[dayStr] = { count: 0, wins: 0, closed: 0, pl: 0 }
      byDayOfWeek[dayStr].count++
      byDayOfWeek[dayStr].closed++
      byDayOfWeek[dayStr].pl += pl
      if (isWin) byDayOfWeek[dayStr].wins++
    }

    // Mistake Tags
    if (Array.isArray(t.mistake_tags)) {
      t.mistake_tags.forEach((tag) => {
        if (!mistakeStats[tag]) mistakeStats[tag] = { count: 0, wins: 0, closed: 0, pl: 0 }
        mistakeStats[tag].count++
        mistakeStats[tag].closed++
        mistakeStats[tag].pl += pl
        if (isWin) mistakeStats[tag].wins++
      })
    }
  })

  // Best / Worst Trade
  let bestTrade = null
  let worstTrade = null
  closed.forEach((t) => {
    const pl = Number(t.profit_loss) || 0
    if (!bestTrade || pl > Number(bestTrade.profit_loss)) bestTrade = t
    if (!worstTrade || pl < Number(worstTrade.profit_loss)) worstTrade = t
  })

  // Monthly P&L
  const monthlyMap = {}
  closed.forEach((t) => {
    if (!t.traded_at) return
    const d = new Date(t.traded_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!monthlyMap[key]) monthlyMap[key] = { label: key, pl: 0, count: 0 }
    monthlyMap[key].pl += Number(t.profit_loss) || 0
    monthlyMap[key].count++
  })
  const monthlyPL = Object.values(monthlyMap).sort((a, b) => a.label.localeCompare(b.label))

  // Plan Adherence
  const planAdherence = {
    followed: { count: 0, wins: 0, losses: 0, pl: 0, winRate: 0 },
    broke: { count: 0, wins: 0, losses: 0, pl: 0, winRate: 0 },
  }
  closed.forEach((t) => {
    const key = t.followed_plan ? 'followed' : 'broke'
    planAdherence[key].count++
    planAdherence[key].pl += Number(t.profit_loss) || 0
    if (t.result === 'win') planAdherence[key].wins++
    if (t.result === 'loss') planAdherence[key].losses++
  }
  )
  ;['followed', 'broke'].forEach((k) => {
    const item = planAdherence[k]
    const totalClosed = item.wins + item.losses
    item.winRate = totalClosed ? Math.round((item.wins / totalClosed) * 100) : 0
  })

  return {
    totalTrades: filteredTrades.length,
    closed,
    wins,
    losses,
    breakevens,
    totalPL,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    expectancy,
    maxDrawdown,
    maxWinStreak,
    maxLossStreak,
    streak: activeStreakCount,
    streakType: activeStreakType,
    curve,
    byCategory,
    byStrategy,
    bySession,
    byDirection,
    byDayOfWeek,
    mistakeStats,
    bestTrade,
    worstTrade,
    monthlyPL,
    planAdherence,
  }
}

export function statsToPromptText(stats, title = '') {
  return [
    title ? `=== ${title} ===` : '',
    `- จำนวนไม้ทั้งหมด (Closed): ${stats.closed.length}`,
    `- อسبةชนะ (Win Rate): ${stats.winRate}% (${stats.wins.length} ชนะ / ${stats.losses.length} แพ้)`,
    `- กำไรขาดทุนสะสม (Cumulative P&L): ${stats.totalPL.toFixed(2)}`,
    `- Profit Factor: ${stats.profitFactor}`,
    `- Expectancy ต่อไม้: ${stats.expectancy}`,
    `- Max Drawdown: ${stats.maxDrawdown.toFixed(2)}`,
    `- Max Win/Loss Streak: ${stats.maxWinStreak}W / ${stats.maxLossStreak}L`,
    `- กำไรเฉลี่ย (Avg Win): ${stats.avgWin.toFixed(2)} | ขาดทุนเฉลี่ย (Avg Loss): ${stats.avgLoss.toFixed(2)}`,
  ].filter(Boolean).join('\n')
}

export function breakdownToPromptText(obj, name = '') {
  const rows = Object.entries(obj).map(([k, s]) => {
    const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
    return `  * ${k}: ${s.count} ไม้, Win Rate ${wr}%, P&L ${s.pl.toFixed(2)}`
  })
  return [`--- สถิติแยกตาม ${name} ---`, ...rows].join('\n')
}

export function dayOfWeekToPromptText(obj) {
  const rows = Object.entries(obj).map(([k, s]) => {
    const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
    return `  * วัน ${k}: ${s.count} ไม้, Win Rate ${wr}%, P&L ${s.pl.toFixed(2)}`
  })
  return ['--- สถิติแยกตามวันในสัปดาห์ ---', ...rows].join('\n')
}