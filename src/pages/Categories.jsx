import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Categories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false })

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
    if (!newName.trim()) return

    const { error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: newName.trim(), description: newDesc.trim() || null })

    if (error) {
      setError(error.message)
      return
    }
    setNewName('')
    setNewDesc('')
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this category? All trades in this category will also be deleted.')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Categories</h1>
        <p className="page-sub">Organize your trades by symbols you create yourself, e.g., XAUUSD, EURUSD, PTT</p>
      </div>

      <form onSubmit={handleCreate} className="inline-form">
        <input
          type="text"
          placeholder="Category name, e.g., XAUUSD"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          + Add Category
        </button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : categories.length === 0 ? (
        <div className="empty-state">No categories yet — add your first category above</div>
      ) : (
        <div className="category-grid">
          {categories.map((c) => (
            <div key={c.id} className="category-card">
              <Link to={`/categories/${c.id}`} className="category-card-main">
                <div className="category-card-name">{c.name}</div>
                {c.description && <div className="category-card-desc">{c.description}</div>}
                <div className="category-card-count">{counts[c.id] || 0} trades</div>
              </Link>
              <button className="btn btn-ghost btn-small" onClick={() => handleDelete(c.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
