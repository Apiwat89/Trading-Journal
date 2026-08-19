import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Categories() {
  const { user, profile, limits } = useAuth() 
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')
  const { t } = useLanguage()

  const isFree = profile?.tier === 'free' || !profile?.tier
  const isLimitReached = categories.length >= limits.categories

  const load = async () => {
    setLoading(true)
    // 🌟 เปลี่ยนเป็น ascending: true (เก่าสุดอยู่บน จะได้ไม่โดนล็อก)
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true }) 

    const { data: trades } = await supabase.from('trades').select('category_id')

    const countMap = {}
    ;(trades || []).forEach((t) => {
      countMap[t.category_id] = (countMap[t.category_id] || 0) + 1
    })

    setCategories(cats || [])
    setCounts(countMap)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')

    if (isLimitReached) {
      setError(`${limits.name} plan is limited to ${limits.categories} categories. Please upgrade.`)
      return
    }
    if (!newName.trim()) return

    const { error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim() || null })

    if (error) setError(error.message)
    else { setNewName(''); setNewDesc(''); load() }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('DeleteCat'))) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  // 🌟 แบ่ง Categories เป็น 2 กลุ่ม (ใช้ได้ กับ โดนล็อก)
  const activeCategories = categories.slice(0, limits.categories)
  const lockedCategories = categories.slice(limits.categories)

  if (loading) return <div className="page-loading">Loading...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('Categories')}</h1>
        <p className="page-sub">{t('categorySub')}</p>
      </div>

      {isLimitReached ? (
        <div className="panel" style={{ textAlign: 'center', padding: '24px', borderColor: 'var(--gold-glow)' }}>
          <h3 style={{ color: 'var(--gold)', marginBottom: '8px' }}>{t('categoryLimitReached')}</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px' }}>
            {t('categoryLimitDesc').replace('{limit}', limits.categories).replace('{plan}', limits.name)}
          </p>
          {isFree && <Link to="/upgrade"><button className="btn btn-primary">{t('upgradeToPro')}</button></Link>}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="inline-form">
        <div 
            id="tour-add-category" 
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px', 
              marginBottom: '24px', 
              width: '100%'
            }}
          > 
            <input 
              type="text" 
              placeholder={t('exampleCategory')} 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              disabled={isLimitReached} 
              style={{ flex: '1 1 200px' }} 
            />
            {/* 🌟 ลบ class="page-header-action" ออกไปเลยครับ และเพิ่ม whiteSpace: 'nowrap' กันข้อความตกบรรทัด */}
            <button 
              className="btn btn-primary" 
              onClick={() => setShowForm(true)}
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }} 
            >
              {t('addCategory')}
            </button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="empty-state">{t('noCategories')}</div>
      ) : (
        <>
          {/* หมวดหมู่ที่ใช้งานได้ */}
          <div className="category-grid" style={{ marginBottom: '32px' }}>
            {activeCategories.map((c, index) => (
              <div 
                key={c.id} 
                id={index === 0 ? "tour-category-card-0" : ""} /* 🌟 เติม id สำหรับชี้เป้าสปอตไลต์ */
                className="category-card"
              >
                <Link to={`/categories/${c.id}`} className="category-card-main">
                  <div className="category-card-name">{c.name}</div>
                  <div className="category-card-count">{counts[c.id] || 0} {t('trades')}</div>
                </Link>
                <button className="btn btn-ghost btn-small" onClick={() => handleDelete(c.id)}>{t('delete')}</button>
              </div>
            ))}
          </div>

          {/* หมวดหมู่ที่โดนล็อก (ถ้ามี) */}
          {lockedCategories.length > 0 && (
            <>
              <h2 style={{ fontSize: '16px', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>
                {t('categoryLocked')}
              </h2>
              <div className="category-grid">
                {lockedCategories.map((c) => (
                  <div key={c.id} className="category-card" style={{ opacity: 0.6, filter: 'grayscale(100%)', borderColor: 'var(--border-strong)' }}>
                    <Link to={`/categories/${c.id}`} className="category-card-main">
                      <div className="category-card-name">🔒 {c.name}</div>
                      <div className="category-card-count">{counts[c.id] || 0} {t('trades')}</div>
                    </Link>
                    <button className="btn btn-ghost btn-small" onClick={() => handleDelete(c.id)}>{t('delete')}</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
} 