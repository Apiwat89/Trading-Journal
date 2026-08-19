// 🌟 ศูนย์รวมการตั้งค่าจำนวนข้อมูลที่จะส่งให้ AI (แก้ตัวเลขตรงนี้ได้เลย!)
export const AI_PROMPT_CONFIG = {
  MAX_CATEGORY: 10,      // จำกัดจำนวนหมวดหมู่/สัญลักษณ์ (Top N)
  MAX_STRATEGY: 10,      // จำกัดจำนวนกลยุทธ์ (Top N)
  MAX_SESSION: 5,        // จำกัดจำนวนช่วงเวลา (Top N Session)
  MAX_DIRECTION: 2,      // จำกัดทิศทาง (ปกติมีแค่ Buy/Sell คือ 2)
  MAX_DAY_OF_WEEK: 7,    // จำกัดวัน (สูงสุด 7 วัน)
  MAX_MISTAKE_TAGS: 5,   // จำกัดแท็กข้อผิดพลาดที่ทำบ่อยสุด (Top N)
  MAX_RECENT_TRADES: 5, // จำกัดประวัติการเทรดล่าสุด (N ไม้ล่าสุด)
}

export const SESSION_LABELS = {
  asia: 'Asia Session',
  london: 'London Session',
  newyork: 'New York Session',
}

export const DIRECTION_LABELS = {
  buy: '📈 Buy',
  sell: '📉 Sell',
}

// ฟังก์ชันคำนวณสถิติเชิงลึกทั้งหมด
export function computeStats(trades, catNameById = {}, dateFilter = 'all') {
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
    return true
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

  const winProb = closed.length ? wins.length / closed.length : 0
  const lossProb = closed.length ? losses.length / closed.length : 0
  const expectancy = Number(((winProb * avgWin) - (lossProb * avgLoss)).toFixed(2))

  const sorted = [...filteredTrades].sort((a, b) => new Date(a.traded_at || 0) - new Date(b.traded_at || 0))

  let currentEquity = 0
  let peakEquity = 0
  let maxDrawdown = 0
  const curve = []

  let currentStreak = 0
  let streakType = null 
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

  const activeStreakType = streakType || 'none'
  const activeStreakCount = currentStreak

  const byCategory = {}
  const byStrategy = {}
  const bySession = {}
  const byDirection = {}
  const byDayOfWeek = {}
  const mistakeStats = {}

  closed.forEach((t) => {
    const pl = Number(t.profit_loss) || 0
    const isWin = t.result === 'win'

    const catKey = t.category_id || 'unknown'
    const catLabel = catNameById[catKey] || 'Uncategorized'
    if (!byCategory[catLabel]) byCategory[catLabel] = { count: 0, wins: 0, closed: 0, pl: 0 }
    byCategory[catLabel].count++
    byCategory[catLabel].closed++
    byCategory[catLabel].pl += pl
    if (isWin) byCategory[catLabel].wins++

    const strat = t.strategy || 'Unspecified'
    if (!byStrategy[strat]) byStrategy[strat] = { count: 0, wins: 0, closed: 0, pl: 0 }
    byStrategy[strat].count++
    byStrategy[strat].closed++
    byStrategy[strat].pl += pl
    if (isWin) byStrategy[strat].wins++

    const ses = t.session || 'other'
    if (!bySession[ses]) bySession[ses] = { count: 0, wins: 0, closed: 0, pl: 0 }
    bySession[ses].count++
    bySession[ses].closed++
    bySession[ses].pl += pl
    if (isWin) bySession[ses].wins++

    const dir = t.direction || 'buy'
    if (!byDirection[dir]) byDirection[dir] = { count: 0, wins: 0, closed: 0, pl: 0 }
    byDirection[dir].count++
    byDirection[dir].closed++
    byDirection[dir].pl += pl
    if (isWin) byDirection[dir].wins++

    if (t.traded_at) {
      const dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(t.traded_at).getDay()]
      if (!byDayOfWeek[dayStr]) byDayOfWeek[dayStr] = { count: 0, wins: 0, closed: 0, pl: 0 }
      byDayOfWeek[dayStr].count++
      byDayOfWeek[dayStr].closed++
      byDayOfWeek[dayStr].pl += pl
      if (isWin) byDayOfWeek[dayStr].wins++
    }

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

  let bestTrade = null
  let worstTrade = null
  closed.forEach((t) => {
    const pl = Number(t.profit_loss) || 0
    if (!bestTrade || pl > Number(bestTrade.profit_loss)) bestTrade = t
    if (!worstTrade || pl < Number(worstTrade.profit_loss)) worstTrade = t
  })

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
  })
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
    `- อัตราชนะ (Win Rate): ${stats.winRate}% (${stats.wins.length} ชนะ / ${stats.losses.length} แพ้)`,
    `- กำไรขาดทุนสะสม (Cumulative P&L): ${stats.totalPL.toFixed(2)}`,
    `- Profit Factor: ${stats.profitFactor}`,
    `- Expectancy ต่อไม้: ${stats.expectancy}`,
    `- Max Drawdown: ${stats.maxDrawdown.toFixed(2)}`,
    `- Max Win/Loss Streak: ${stats.maxWinStreak}W / ${stats.maxLossStreak}L`,
    `- กำไรเฉลี่ย (Avg Win): ${stats.avgWin.toFixed(2)} | ขาดทุนเฉลี่ย (Avg Loss): ${stats.avgLoss.toFixed(2)}`,
  ].filter(Boolean).join('\n')
}

// 🌟 ยุบการตัด Limit เข้ามาอยู่ในนี้เลย เพื่อให้ครอบคลุม Session, Direction, Strat, Category ครบทั้งหมด
export function breakdownToPromptText(obj, name = '', limit = 10) {
  const entries = Object.entries(obj).sort((a, b) => b[1].count - a[1].count)
  const sliced = entries.slice(0, limit)
  
  if (sliced.length === 0) return ''

  const rows = sliced.map(([k, s]) => {
    const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
    return `  * ${k}: ${s.count} ไม้, Win Rate ${wr}%, P&L ${s.pl.toFixed(2)}`
  })
  
  const title = entries.length > limit 
    ? `--- สถิติแยกตาม ${name} (Top ${limit}) ---` 
    : `--- สถิติแยกตาม ${name} ---`

  return [title, ...rows].join('\n')
}

// 🌟 เพิ่มการจัดอันดับและลิมิตให้ส่วนวิเคราะห์วัน
export function dayOfWeekToPromptText(obj, limit = AI_PROMPT_CONFIG.MAX_DAY_OF_WEEK) {
  const entries = Object.entries(obj).sort((a, b) => b[1].count - a[1].count)
  const sliced = entries.slice(0, limit)
  
  if (sliced.length === 0) return ''

  const rows = sliced.map(([k, s]) => {
    const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
    return `  * วัน ${k}: ${s.count} ไม้, Win Rate ${wr}%, P&L ${s.pl.toFixed(2)}`
  })

  const title = entries.length > limit 
    ? `--- สถิติแยกตามวันในสัปดาห์ (Top ${limit}) ---` 
    : `--- สถิติแยกตามวันในสัปดาห์ ---`

  return [title, ...rows].join('\n')
}

// 🌟 Mistake Tags พร้อมรับค่าลิมิต
export function mistakeStatsToPromptText(mistakeStats, title = 'Mistake Tags', formatMoney, limit = AI_PROMPT_CONFIG.MAX_MISTAKE_TAGS) {
  const mistakeEntries = Object.entries(mistakeStats || {})
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)

  if (mistakeEntries.length === 0) return ''

  const rows = mistakeEntries.map(([tag, s]) => {
    const wr = s.closed ? Math.round((s.wins / s.closed) * 100) : 0
    const plStr = formatMoney ? formatMoney(s.pl) : s.pl.toFixed(2)
    return `- Tag: "${tag}" | Occurred: ${s.count} times | Win Rate: ${wr}% | P&L Impact: ${plStr}`
  })

  const heading = Object.keys(mistakeStats || {}).length > limit 
    ? `--- ${title} (Top ${limit}) ---` 
    : `--- ${title} ---`

  return [heading, ...rows].join('\n')
}

// 🌟 Recent Trades พร้อมรับค่าลิมิต
export function recentTradesToPromptText(closedTrades, catNameById = {}, formatMoney, limit = AI_PROMPT_CONFIG.MAX_RECENT_TRADES) {
  const recentTradesForAI = [...(closedTrades || [])]
    .reverse()
    .slice(0, limit)
    
  if (recentTradesForAI.length === 0) return ''

  const rows = recentTradesForAI.map((tr, index) => {
    const cat = catNameById[tr.category_id] || 'N/A'
    const date = tr.traded_at ? new Date(tr.traded_at).toLocaleDateString('en-US') : '-'
    const plStr = formatMoney ? formatMoney(tr.profit_loss) : Number(tr.profit_loss || 0).toFixed(2)
    return `${index + 1}. [${date}] ${cat} | ${tr.direction?.toUpperCase() || '-'} | Strat: ${tr.strategy || '-'} | Result: ${tr.result} | P&L: ${plStr}`
  })

  return [`--- Recent Trades (${recentTradesForAI.length} Latest) ---`, ...rows].join('\n')
}