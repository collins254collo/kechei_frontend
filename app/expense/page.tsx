'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchExpenses, createExpense, deleteExpense } from '../API/expenseApi';
import { fetchActiveVisits, fetchVisits } from '../API/visitApi'; 
import ProtectedPage from '../protectedPage';
import Sidebar from '../sidebar';

//  Types 
interface User    { id: number; name: string; email: string; role: string; }
interface Visit {
  id: number;
  client_id: number;
  client_name?: string;
  full_name?: string;
  reason: string;
  status: 'active' | 'completed';
  created_at?: string;
  check_in?: string;
  group_id?: string;
  group_name?: string;
  is_group_leader?: boolean;
}
interface Expense {
  id: number;
  visit_id: number;
  visit_full_name?: string;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
}

const CATEGORIES = ['accommodation', 'food', 'transport', 'activities', 'equipment', 'medical', 'laundry', 'other'];

const CAT_COLORS: Record<string, string> = {
  accommodation: '#6d8fa0',
  food:          '#b07a42',
  transport:     '#7a6db0',
  activities:    '#4a9a6a',
  equipment:     '#a06060',
  medical:       '#4a8aa0',
  laundry:       '#8a7a50',
  other:         '#808080',
};

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }
function fmtDate(d: string) {
  if (!d) return '—';``
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpensesPage() {
  const router = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sideOpen, setSideOpen] = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]   = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [form, setForm] = useState({
    visit_id: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '',
  });


const load = () => {
  setLoading(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  Promise.allSettled([
    fetchExpenses(),
    fetchActiveVisits(),
  ]).then(([e, v]) => {
    if (e.status === 'fulfilled') setExpenses(e.value);
    if (v.status === 'fulfilled') setVisits(v.value as Visit[]);
  }).finally(() => setLoading(false));
};

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) setUser(JSON.parse(stored));
    load();
  }, []);

  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); };

  //  Derived 
  const filtered = expenses.filter(e => {
    const matchCat = catFilter === 'all' || e.category === catFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (e.visit_full_name || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  const totalAll   = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalMonth = expenses.filter(e => {
    const d = new Date(e.expense_date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, e) => s + Number(e.amount), 0);

  // per-category totals
  const byCat = CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    count: expenses.filter(e => e.category === cat).length,
  })).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  const maxCat = byCat[0]?.total || 1;

  const groupOptions = Object.values(
  visits.reduce((acc, v) => {
    if (!v.group_id) return acc;
    if (!acc[v.group_id]) {
      acc[v.group_id] = { group_id: v.group_id, group_name: v.group_name, members: [] as Visit[], leaderVisit: undefined as Visit | undefined };
    }
    acc[v.group_id].members.push(v);
    if (v.is_group_leader) acc[v.group_id].leaderVisit = v;
    return acc;
  }, {} as Record<string, { group_id: string; group_name?: string; members: Visit[]; leaderVisit?: Visit }>)
).map(g => ({ ...g, leaderVisit: g.leaderVisit || g.members[0] }));

const selectedGroup = groupOptions.find(g => String(g.leaderVisit!.id) === form.visit_id);

  //  Submit 
 const handleSubmit = async () => {
  if (!form.visit_id)  { setFormErr('Please select a visit.'); return; }
  if (!form.category)  { setFormErr('Please select a category.'); return; }
  if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) { setFormErr('Enter a valid amount.'); return; }

  setSubmitting(true);
  setFormErr('');

  try {
    const data = await createExpense({
      visit_id: Number(form.visit_id),
      category: form.category,
      amount: Number(form.amount),
      expense_date: form.expense_date,
      description: form.description || undefined,
    });

    setExpenses(prev => [data, ...prev]);
    setShowModal(false);
    setForm({ visit_id: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], description: '' });
  } catch (err: any) {
    setFormErr(err.message || 'Network error. Try again.');
  } finally {
    setSubmitting(false);
  }
};

 const handleDelete = async (id: number) => {
  setDeleteId(id);
  try {
    await deleteExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id)); 
  } catch (err: any) {
    alert(err.message || 'Failed to delete.');
  } finally {
    setDeleteId(null);
  }
};
  return (
    <ProtectedPage>
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

        :root {
          --bg: #ffffff; --surface: #ffffff; --surface-2: #f7f7f7; --border: #e7e7e7;
          --sidebar-bg: #1a1712; --sidebar-border: #2a2620; --sidebar-text: #a09880;
          --sidebar-active: #ffffff; --sidebar-act-bg: rgba(255,255,255,0.08);
          --text: #1a1714; --text-2: #6b6456; --text-3: #b0a898;
          --accent: #b07a42; --accent-h: #c48d55; --dot: rgba(0,0,0,0.05);
          --badge-green-bg: #eaf4ee; --badge-green-tx: #2d7a47;
          --badge-amber-bg: #fef4e4; --badge-amber-tx: #9a6520;
          --badge-red-bg: #fdeeed; --badge-red-tx: #b03030;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .db-root { font-family: 'DM Mono', monospace; display: flex; min-height: 100vh; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
        .db-root::before { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; background-image: radial-gradient(circle, var(--dot) 1px, transparent 1px); background-size: 28px 28px; }

        .db-side { width: 220px; flex-shrink: 0; background: var(--sidebar-bg); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 40; transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
        .db-side-head { padding: 28px 20px 24px; border-bottom: 1px solid var(--sidebar-border); display: flex; align-items: center; gap: 10px; }
        .db-logo { flex-shrink: 0; border-radius: 6px; }
        .db-brand-text { display: flex; flex-direction: column; }
        .db-brand { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; letter-spacing: -0.8px; }
        .db-brand-sub { font-size: 9px; color: #9c9690; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 3px; }
        .db-nav { flex: 1; padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .db-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 18px; color: var(--sidebar-text); cursor: pointer; transition: background 0.15s, color 0.15s; letter-spacing: 0.02em; border: none; background: none; width: 100%; text-align: left; }
        .db-nav-item:hover { background: rgba(255,255,255,0.05); color: #d4cfc8; }
        .db-nav-item.active { background: var(--sidebar-act-bg); color: var(--sidebar-active); }
        .db-nav-item svg { opacity: 0.5; flex-shrink: 0; transition: opacity 0.15s; }
        .db-nav-item.active svg { opacity: 1; }
        .db-nav-item:hover svg { opacity: 0.75; }
        .db-side-foot { padding: 16px 20px; border-top: 1px solid var(--sidebar-border); }
        .db-user-name { font-size: 12px; color: #706a62; }
        .db-user-role { font-size: 10px; color: #403c38; margin-top: 2px; text-transform: capitalize; letter-spacing: 0.06em; }
        .db-logout { margin-top: 12px; font-size: 10px; color: #4a4640; background: none; border: none; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase; transition: color 0.15s; padding: 0; }
        .db-logout:hover { color: #c9a96e; }

        .db-main { flex: 1; margin-left: 220px; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 100vh; }
        .db-topbar { position: sticky; top: 0; z-index: 30; background: var(--bg); border-bottom: 1px solid var(--border); padding: 0 32px; height: 60px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(8px); }
        .db-topbar-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-topbar-date { font-size: 14px; color: var(--text-3); letter-spacing: 0.08em; }
        .db-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--text); padding: 4px; }
        .db-content { padding: 32px; flex: 1; }

        .db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; animation: db-up 0.5s ease 0.05s both; }
        .db-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 22px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .db-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); opacity: 0.4; }
        .db-stat:first-child::before { opacity: 1; }
        .db-stat-label { font-size: 9px; color: var(--text-2); letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 10px; }
        .db-stat-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.8px; line-height: 1; }
        .db-stat-sub { font-size: 10px; color: var(--text-3); margin-top: 6px; }

        /* layout row */
        .db-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px; animation: db-up 0.5s ease 0.1s both; }

        .db-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
        .db-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .db-card-title { font-family: 'Syne', roboto; font-size: 18px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .db-card-count { font-size: 15px; color: var(--text-3); letter-spacing: 0.06em; }

        /* toolbar */
        .db-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .db-search { flex: 1; min-width: 180px; max-width: 300px; display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; height: 34px; }
        .db-search svg { opacity: 0.35; flex-shrink: 0; }
        .db-search input { border: none; background: none; outline: none; font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text); flex: 1; }
        .db-search input::placeholder { color: var(--text-3); }

        .db-cat-scroll { display: flex; gap: 6px; flex-wrap: wrap; }
        .db-cat-chip { height: 30px; padding: 0 12px; border-radius: 20px; font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.04em; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; transition: all 0.15s; text-transform: capitalize; white-space: nowrap; }
        .db-cat-chip:hover { color: var(--text); }
        .db-cat-chip.active { color: #fff; border-color: transparent; }

        .db-btn-primary { height: 34px; padding: 0 14px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--accent); color: #fff; border: none; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px; white-space: nowrap; margin-left: auto; }
        .db-btn-primary:hover { background: var(--accent-h); }

        .db-table { width: 100%; border-collapse: collapse; }
        .db-th { text-align: left; padding: 10px 20px; font-size: 15px; color: var(--text-3); letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid var(--border); font-weight: 750; }
        .db-th-r { text-align: right; }
        .db-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .db-tr:last-child { border-bottom: none; }
        .db-tr:hover { background: var(--surface-2); }
        .db-td { padding: 11px 20px; font-size: 15px; color: var(--text); vertical-align: middle; }
        .db-td-muted { color: var(--text-2); }
        .db-td-r { text-align: right; }
        .db-td-mono { font-size: 15px; color: var(--text-2); }

        .db-cat-dot { display: inline-flex; align-items: center; gap: 6px; }
        .db-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .db-del-btn { background: none; border: none; cursor: pointer; color: var(--text-3); padding: 8px; border-radius: 4px; transition: color 0.15s, background 0.15s; line-height: 1; }
        .db-del-btn:hover { color: var(--badge-red-tx); background: var(--badge-red-bg); }
        .db-del-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .db-empty { padding: 48px 20px; text-align: center; font-size: 12px; color: var(--text-3); }

        /* category breakdown bars */
        .db-expbar { padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
        .db-expbar:last-child { border-bottom: none; }
        .db-expbar-cat { width: 90px; font-size: 15px; color: var(--text-2); text-transform: capitalize; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .db-expbar-track { flex: 1; height: 8px; background: var(--border); border-radius: 99px; overflow: hidden; }
        .db-expbar-fill { height: 100%; border-radius: 99px; transition: width 0.7s cubic-bezier(0.16,1,0.3,1); }
        .db-expbar-val { font-size: 15px; color: var(--text-2); width: 88px; text-align: right; flex-shrink: 0; }

        @keyframes db-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .db-skel { background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%); background-size: 800px 100%; animation: db-shimmer 1.4s infinite; border-radius: 4px; height: 12px; }

        /* Modal */
        .db-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; animation: db-fade 0.2s ease; }
        @keyframes db-fade { from { opacity: 0; } to { opacity: 1; } }
        .db-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 460px; box-shadow: 0 24px 48px rgba(0,0,0,0.15); overflow: hidden; animation: db-slide 0.25s cubic-bezier(0.16,1,0.3,1); }
        @keyframes db-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .db-modal-head { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .db-modal-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-modal-close { background: none; border: none; cursor: pointer; color: var(--text-3); transition: color 0.15s; padding: 2px; }
        .db-modal-close:hover { color: var(--text); }
        .db-modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
        .db-modal-foot { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }
        .db-field { display: flex; flex-direction: column; gap: 6px; }
        .db-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .db-label { font-size: 9px; color: var(--text-2); letter-spacing: 0.14em; text-transform: uppercase; }
        .db-select, .db-input, .db-textarea { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; outline: none; width: 100%; transition: border-color 0.15s; }
        .db-select:focus, .db-input:focus, .db-textarea:focus { border-color: var(--accent); }
        .db-textarea { resize: vertical; min-height: 72px; }
        .db-err { font-size: 11px; color: var(--badge-red-tx); }
        .db-btn-secondary { height: 36px; padding: 0 16px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.04em; background: none; border: 1px solid var(--border); color: var(--text-2); cursor: pointer; transition: all 0.15s; }
        .db-btn-secondary:hover { color: var(--text); border-color: var(--text-2); }

        .db-side-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 35; }
        .db-side-overlay.open { display: block; }

        @keyframes db-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1100px) {
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .db-side { transform: translateX(-100%); }
          .db-side.open { transform: translateX(0); }
          .db-main { margin-left: 0; }
          .db-hamburger { display: flex; }
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-content { padding: 20px 16px; }
          .db-topbar { padding: 0 16px; }
          .db-btn-primary span { display: none; }
        }
        @media (max-width: 480px) {
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-value { font-size: 18px; }
          .db-field-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="db-root">
        <Sidebar activeKey="expenses" sideOpen={sideOpen} setSideOpen={setSideOpen} user={user} onLogout={logout} />

        {/* Main */}
        <div className="db-main">
          <header className="db-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="db-hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
              </button>
              <span className="db-topbar-title">Expenses</span>
            </div>
            <span className="db-topbar-date">{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </header>

          <div className="db-content">
            {/* Stat cards */}
            <div className="db-stats">
              {[
                { label: 'Total expenses',    value: loading ? '—' : fmt(totalAll),                           sub: 'All time' },
                { label: 'This month',        value: loading ? '—' : fmt(totalMonth),                         sub: new Date().toLocaleString('en-KE', { month: 'long' }) },
                { label: 'Total records',     value: loading ? '—' : String(expenses.length),                  sub: 'Expense entries' },
                { label: 'Categories used',   value: loading ? '—' : String(byCat.length),                    sub: `of ${CATEGORIES.length} available` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="db-stat" style={{ opacity: mounted ? 1 : 0 }}>
                  <div className="db-stat-label">{label}</div>
                  <div className="db-stat-value">{value}</div>
                  <div className="db-stat-sub">{sub}</div>
                </div>
              ))}
            </div>

            {/* Layout: table + breakdown */}
            <div className="db-layout">
              {/* Left: table */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">All expenses</span>
                  <span className="db-card-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Toolbar inside card */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div className="db-toolbar" style={{ marginBottom: '10px' }}>
                    <div className="db-search">
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                      <input type="text" placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} />
                      {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>✕</button>}
                    </div>
                    <button className="db-btn-primary" onClick={() => setShowModal(true)}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                      <span>Add expense</span>
                    </button>
                  </div>
                  <div className="db-cat-scroll">
                    <button className={`db-cat-chip ${catFilter === 'all' ? 'active' : ''}`} style={catFilter === 'all' ? { background: 'var(--accent)' } : {}} onClick={() => setCatFilter('all')}>All</button>
                    {CATEGORIES.map(cat => (
                      <button key={cat} className={`db-cat-chip ${catFilter === cat ? 'active' : ''}`}
                        style={catFilter === cat ? { background: CAT_COLORS[cat] } : {}}
                        onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div style={{ padding: '24px 20px' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div className="db-skel" style={{ width: '22%' }} />
                        <div className="db-skel" style={{ width: '18%' }} />
                        <div className="db-skel" style={{ width: '30%' }} />
                        <div className="db-skel" style={{ width: '14%' }} />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="db-empty">{search || catFilter !== 'all' ? 'No expenses match your filters' : 'No expenses recorded yet'}</div>
                ) : (
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th className="db-th">Category</th>
                        <th className="db-th">Visit / Client</th>
                        <th className="db-th">Date</th>
                        <th className="db-th db-th-r">Amount</th>
                        <th className="db-th" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(exp => (
                        <tr key={exp.id} className="db-tr">
                          <td className="db-td">
                            <span className="db-cat-dot">
                              <span className="db-dot" style={{ background: CAT_COLORS[exp.category] || '#888' }} />
                              <span style={{ textTransform: 'capitalize' }}>{exp.category}</span>
                            </span>
                          </td>
                          <td className="db-td db-td-muted" style={{ fontSize: '15px' }}>
                            {exp.visit_full_name || `Visit #${exp.visit_id}`}
                          </td>
                          <td className="db-td db-td-mono">{fmtDate(exp.expense_date)}</td>
                          <td className="db-td db-td-r" style={{ fontWeight: 750 }}>{fmt(exp.amount)}</td>
                          <td className="db-td" style={{ textAlign: 'right', paddingRight: '16px' }}>
                            <button className="db-del-btn" disabled={deleteId === exp.id} onClick={() => handleDelete(exp.id)} title="Delete">
                              {deleteId === exp.id
                                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                              }
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Right: breakdown */}
              <div className="db-card" style={{ alignSelf: 'start' }}>
                <div className="db-card-head">
                  <span className="db-card-title">By category</span>
                </div>
                {loading ? (
                  <div style={{ padding: '20px' }}>
                    {[1,2,3,4].map(i => <div key={i} className="db-skel" style={{ marginBottom: '14px' }} />)}
                  </div>
                ) : byCat.length === 0 ? (
                  <div className="db-empty">No data yet</div>
                ) : (
                  <div style={{ padding: '8px 0' }}>
                    {byCat.map(({ cat, total, count }) => (
                      <div key={cat} className="db-expbar">
                        <div className="db-expbar-cat" style={{ color: CAT_COLORS[cat] }}>{cat}</div>
                        <div className="db-expbar-track">
                          <div className="db-expbar-fill" style={{ width: `${(total / maxCat) * 100}%`, background: CAT_COLORS[cat] }} />
                        </div>
                        <div className="db-expbar-val">{fmt(total)}</div>
                      </div>
                    ))}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '15px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Grand total</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.4px' }}>{fmt(totalAll)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="db-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setFormErr(''); } }}>
          <div className="db-modal">
            <div className="db-modal-head">
              <span className="db-modal-title">Add expense</span>
              <button className="db-modal-close" onClick={() => { setShowModal(false); setFormErr(''); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="db-modal-body">
             <div className="db-field">
                <label className="db-label">Visit / Client *</label>
                <select className="db-select" value={form.visit_id} onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))}>
                  <option value="">Select a visit…</option>
                  {groupOptions.length > 0 && (
                    <optgroup label="Groups (shared cost)">
                      {groupOptions.map(g => (
                        <option key={g.group_id} value={g.leaderVisit!.id}>
                          {g.group_name || 'Group'} — {g.members.length} members
                          {g.leaderVisit!.created_at
                            ? ` · ${new Date(g.leaderVisit!.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`
                            : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Individual visits">
                    {visits.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.client_name || v.full_name || `Visit #${v.id}`}
                        {v.group_name ? ` (${v.group_name})` : ''} — {' '}
                        {v.created_at
                          ? new Date(v.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
                          : v.check_in
                          ? new Date(v.check_in).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
                          : '—'
                        } ({v.status})
                      </option>
                    ))}
                  </optgroup>
                </select>
                {selectedGroup && (
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
                    Billed as one shared line across {selectedGroup.members.length} members of {selectedGroup.group_name || 'this group'}.
                  </div>
                )}
              </div>

              <div className="db-field-row">
                <div className="db-field">
                  <label className="db-label">Category *</label>
                  <select className="db-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">Select…</option>
                    {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
                  </select>
                </div>
                <div className="db-field">
                  <label className="db-label">Amount (KES) *</label>
                  <input className="db-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>

              <div className="db-field">
                <label className="db-label">Date *</label>
                <input className="db-input" type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>

              <div className="db-field">
                <label className="db-label">Description (optional)</label>
                <textarea className="db-textarea" placeholder="Brief note about this expense…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {formErr && <div className="db-err">{formErr}</div>}
            </div>
            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={() => { setShowModal(false); setFormErr(''); }}>Cancel</button>
              <button className="db-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ margin: 0 }}>
                {submitting ? 'Saving…' : 'Add expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    </ProtectedPage>
  );
}