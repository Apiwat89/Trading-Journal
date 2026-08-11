import React, { createContext, useContext, useState } from 'react'

const LanguageContext = createContext(null)

const translations = {
  en: {
    // Navbar
    dashboard: 'Dashboard',
    categories: 'Categories',
    settings: 'Settings',
    signOut: 'Sign Out',
    upgradePro: 'Upgrade Pro',
    proPlan: 'PRO',

    // Dashboard
    subTitle: 'Overall Trading Performance & Advanced Analytics',
    totalTrades: 'Total Trades',
    winRate: 'Win rate',
    cumulativePnL: 'Cumulative P&L',
    profitFactor: 'Profit factor',
    expectancy: 'Expectancy / Trade',
    maxDrawdown: 'Max Drawdown',
    maxWinStreak: 'Max Win Streak',
    maxLossStreak: 'Max Loss Streak',
    avgWin: 'Average Win',
    avgLoss: 'Average Loss',
    equityCurve: 'Equity Curve',
    monthlyPnL: 'Monthly P&L',
    filterAll: 'All Time',
    filterMonth: 'This Month',
    filterWeek: 'This Week',
    filterToday: 'Today',
    noTradeData: 'No trading data available',
    createCatPrompt: 'Create a category and log your first trade',
    proFeatureTitle: '🔒 Pro Feature',
    proFeatureDesc: 'Upgrade to Pro to unlock advanced analytics, monthly P&L breakdowns, strategy performance, and more deep insights.',
    upgradeToPro: 'Upgrade to Pro'
  },
  th: {
    // Navbar
    dashboard: 'หน้าหลัก',
    categories: 'หมวดหมู่',
    settings: 'ตั้งค่า',
    signOut: 'ออกระบบ',
    upgradePro: 'อัปเกรดโปร',
    proPlan: 'โปร',

    // Dashboard
    subTitle: 'ภาพรวมผลการเทรดและสถิติเชิงลึก',
    totalTrades: 'จำนวนเทรดทั้งหมด',
    winRate: 'อัตราการชนะ',
    cumulativePnL: 'กำไร/ขาดทุนสะสม',
    profitFactor: 'โปรฟิตแฟกเตอร์',
    expectancy: 'ค่าคาดหวัง / ไม้',
    maxDrawdown: 'ดาวน์ดรอปสูงสุด',
    maxWinStreak: 'ชนะติดต่อกันสูงสุด',
    maxLossStreak: 'แพ้ติดต่อกันสูงสุด',
    avgWin: 'กำไรเฉลี่ย',
    avgLoss: 'ขาดทุนเฉลี่ย',
    equityCurve: 'กราฟเส้นทุน (Equity Curve)',
    monthlyPnL: 'กำไร/ขาดทุนรายเดือน',
    filterAll: 'ทั้งหมด',
    filterMonth: 'เดือนนี้',
    filterWeek: 'สัปดาห์นี้',
    filterToday: 'วันนี้',
    noTradeData: 'ยังไม่มีข้อมูลการเทรด',
    createCatPrompt: 'สร้างหมวดหมู่และบันทึกไม้แรกของคุณเลย',
    proFeatureTitle: '🔒 ฟีเจอร์ระดับ Pro',
    proFeatureDesc: 'อัปเกรดเป็นโปรเพื่อปลดล็อกสถิติเชิงลึก กราฟกำไรรายเดือน ประสิทธิภาพกลยุทธ์ และข้อมูลอื่นๆ อีกมากมาย',
    upgradeToPro: 'อัปเกรดเป็น Pro'
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en')

  const toggleLang = () => {
    setLang((prev) => (prev === 'en' ? 'th' : 'en'))
  }

  const t = (key) => {
    return translations[lang][key] || key
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}