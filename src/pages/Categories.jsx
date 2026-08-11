import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Categories() {
  const { user, profile, limits } = useAuth() 
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')

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
    if (!window.confirm('Delete this category? All trades in this category will also be deleted.')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  // 🌟 แบ่ง Categories เป็น 2 กลุ่ม (ใช้ได้ กับ โดนล็อก)
  const activeCategories = categories.slice(0, limits.categories)
  const lockedCategories = categories.slice(limits.categories)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Categories</h1>
        <p className="page-sub">Organize your trades by symbols you create yourself</p>
      </div>

      {isLimitReached ? (
        <div className="panel" style={{ textAlign: 'center', padding: '24px', borderColor: 'var(--gold-glow)' }}>
          <h3 style={{ color: 'var(--gold)', marginBottom: '8px' }}>Category Limit Reached</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px' }}>
            You have reached the maximum of {limits.categories} categories on the {limits.name} plan. 
          </p>
          {isFree && <Link to="/upgrade"><button className="btn btn-primary">Upgrade to Pro</button></Link>}
        </div>
      ) : (
        <form onSubmit={handleCreate} className="inline-form">
          <input type="text" placeholder="Category name, e.g., XAUUSD" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={isLimitReached} />
          <button type="submit" className="btn btn-primary" disabled={isLimitReached}>+ Add Category</button>
        </form>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : categories.length === 0 ? (
        <div className="empty-state">No categories yet — add your first category above</div>
      ) : (
        <>
          {/* หมวดหมู่ที่ใช้งานได้ */}
          <div className="category-grid" style={{ marginBottom: '32px' }}>
            {activeCategories.map((c) => (
              <div key={c.id} className="category-card">
                <Link to={`/categories/${c.id}`} className="category-card-main">
                  <div className="category-card-name">{c.name}</div>
                  <div className="category-card-count">{counts[c.id] || 0} trades</div>
                </Link>
                <button className="btn btn-ghost btn-small" onClick={() => handleDelete(c.id)}>Delete</button>
              </div>
            ))}
          </div>

          {/* หมวดหมู่ที่โดนล็อก (ถ้ามี) */}
          {lockedCategories.length > 0 && (
            <>
              <h2 style={{ fontSize: '16px', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>
                🔒 Locked Categories (Upgrade to Pro to unlock)
              </h2>
              <div className="category-grid">
                {lockedCategories.map((c) => (
                  <div key={c.id} className="category-card" style={{ opacity: 0.6, filter: 'grayscale(100%)', borderColor: 'var(--border-strong)' }}>
                    <Link to={`/categories/${c.id}`} className="category-card-main">
                      <div className="category-card-name">🔒 {c.name}</div>
                      <div className="category-card-count">{counts[c.id] || 0} trades</div>
                    </Link>
                    <button className="btn btn-ghost btn-small" onClick={() => handleDelete(c.id)}>Delete</button>
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