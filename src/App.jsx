import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext' // 🌟 นำเข้า LanguageProvider
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Categories from './pages/Categories'
import CategoryTrades from './pages/CategoryTrades'
import TradeForm from './pages/TradeForm'
import Settings from './pages/Settings'
import Upgrade from './pages/Upgrade'
import SpotlightTour from './components/SpotlightTour'

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider> {/* 🌟 ครอบไว้ชั้นนอกสุดเพื่อให้ทุกหน้าใช้งานภาษาได้ */}
        <AppContent />
        <SpotlightTour /> {/* 🌟 เรียกใช้งานตรงนี้เลย */}
      </LanguageProvider>
    </AuthProvider>
  )
}

function AppContent() {
  const location = useLocation()
  
  // เช็คว่าตอนนี้อยู่หน้า Login หรือเปล่า
  const isLogin = location.pathname === '/login'

  // ถ้าเป็นหน้า Login ให้เรนเดอร์หน้า Login เพียวๆ เต็มจอ
  if (isLogin) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  // หน้าอื่นๆ จะมี Navbar และกรอบแอป (app-main) ครอบไว้เหมือนเดิม
  return (
    <>
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute>
                <Categories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories/:categoryId"
            element={
              <ProtectedRoute>
                <CategoryTrades />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories/:categoryId/new"
            element={
              <ProtectedRoute>
                <TradeForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trades/:id"
            element={
              <ProtectedRoute>
                <TradeForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/upgrade"
            element={
              <ProtectedRoute>
                <Upgrade />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </>
  )
}