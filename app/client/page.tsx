'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { fetchClients, searchClients, fetchClientById, createClient, updateClient, deleteClient } from '../API/clientApi';
import ProtectedPage from '../protectedPage';
import Sidebar from '../sidebar';

interface User { id: number; name: string; email: string; role: string; }

interface Client {
  id: number;
  full_name: string;
  phone: string;
  email:string;
  nationality: string;
  notes?: string;
  created_at: string;
}

const EMPTY_FORM = { full_name: '', phone: '', email: '', nationality: '', notes: '' };

export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser]         = useState<User | null>(null);
  const [clients, setClients]   = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [sideOpen, setSideOpen] = useState(false);
  const [modal, setModal]       = useState<'create' | 'view' | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
  }, []);

  // Fetch All Clients on mount
  useEffect(() => {
    fetchClients()
      .then(d => { setClients(d); setFiltered(d); })
      .catch(() => {}) 
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q ? clients.filter(c =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.nationality || '').toLowerCase().includes(q)
      ) : clients
    );
  }, [search, clients]);

  // Create new client
 const handleCreate = async (e: FormEvent) => {
  e.preventDefault();
  setError('');
  setSaving(true);
  try {
    const data = await createClient(form);
    setClients(prev => [data, ...prev]);
    setModal(null);
    setForm(EMPTY_FORM);
  } catch (err: any) {
    setError(err.message || 'Could not reach server.');
  } finally {
    setSaving(false);
  }
};

// Delete client
const handleDelete = async (id: number) => {
  if (!confirm('Delete this client? This cannot be undone.')) return;
  try {
    await deleteClient(id);
    setClients(prev => prev.filter(c => c.id !== id));
    if (modal === 'view') setModal(null);
  } catch (err: any) {
    alert(err.message || 'Failed to delete client.');
  }
};

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const openView = (c: Client) => { setSelected(c); setModal('view'); };
  const openCreate = () => { setForm(EMPTY_FORM); setError(''); setModal('create'); };

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const avatarColor = (name: string) => {
    const colors = ['#b07a42','#4a7c6f','#6b5fa0','#8b4a6b','#4a6b8b','#7a6b4a'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  return (
    <ProtectedPage>
    <>
      <style>{`
       @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

        :root {
          --bg:              #ffffff;
          --surface:         #ffffff;
          --surface-2:       #f7f7f7;
          --border:          #e7e7e7;
          --sidebar-bg:      #1a1712;
          --sidebar-border:  #2a2620;
          --sidebar-text:    #a09880;
          --sidebar-active:  #ffffff;
          --sidebar-act-bg:  rgba(255,255,255,0.08);
          --text:            #1a1714;
          --text-2:          #6b6456;
          --text-3:          #b0a898;
          --accent:          #b07a42;
          --accent-h:        #c48d55;
          --shadow:          0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --dot:             rgba(0,0,0,0.045);
          --err-bg:          rgba(180,50,50,0.06);
          --err-bd:          rgba(180,50,50,0.16);
          --err-tx:          #b03030;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .cl-root {
          font-family: 'DM Mono', monospace;
          display: flex; min-height: 100vh;
          background: var(--bg); color: var(--text);
          -webkit-font-smoothing: antialiased;
          position: relative;
        }

        .cl-root::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, var(--dot) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* ── Sidebar styling now lives entirely inside the Sidebar component
           itself (sidebar.tsx) — no need to duplicate .db-side / .db-nav-item
           / etc here. Only the --sidebar-* variables above are required. ── */

        /* ── Main ── */
        .cl-main { flex:1; margin-left:220px; display:flex; flex-direction:column; position:relative; z-index:1; min-height:100vh; }

        .cl-topbar {
          position:sticky; top:0; z-index:30;
          background:var(--bg); border-bottom:1px solid var(--border);
          padding:0 32px; height:60px;
          display:flex; align-items:center; justify-content:space-between;
          backdrop-filter:blur(8px);
        }

        .cl-topbar-left { display:flex; align-items:center; gap:14px; }
        .cl-topbar-title { font-family:'Syne',sans-serif; font-size:16px; font-weight:700; color:var(--text); letter-spacing:-0.3px; }

        .cl-hamburger { display:none; background:none; border:none; cursor:pointer; color:var(--text); padding:4px; }

        .cl-btn-primary {
          background:var(--accent); color:#fff; border:none;
          border-radius:8px; padding:9px 16px;
          font-family:'DM Mono',monospace; font-size:11px;
          font-weight:500; letter-spacing:0.1em; text-transform:uppercase;
          cursor:pointer; transition:background 0.15s,transform 0.1s;
          display:flex; align-items:center; gap:6px;
        }
        .cl-btn-primary:hover { background:var(--accent-h); }
        .cl-btn-primary:active { transform:scale(0.97); }

        /* ── Content ── */
        .cl-content { padding:28px 32px; flex:1; }

        /* Search bar */
        .cl-search-row { display:flex; align-items:center; gap:12px; margin-bottom:20px; }

        .cl-search-wrap { position:relative; flex:1; max-width:360px; }
        .cl-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--text-3); }

        .cl-search {
          width:100%; background:var(--surface);
          border:1px solid var(--border); border-radius:9px;
          padding:10px 14px 10px 38px;
          font-family:'DM Mono',monospace; font-size:12px; color:var(--text);
          outline:none; transition:border-color 0.15s,box-shadow 0.15s;
        }
        .cl-search::placeholder { color:var(--text-3); }
        .cl-search:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(176,122,66,0.1); }

        .cl-count { font-size:15px; color:var(--text-3); letter-spacing:0.04em; }

        /* ── Table card ── */
        .cl-card {
          background:var(--surface); border:1px solid var(--border);
          border-radius:12px; box-shadow:var(--shadow); overflow:hidden;
        }

        .cl-table { width:100%; border-collapse:collapse; }
        .cl-th {
          text-align:left; padding:11px 20px;
          font-size:15px; color:var(--text-3);
          letter-spacing:0.14em; text-transform:uppercase;
          border-bottom:1px solid var(--border); font-weight:500;
        }
        .cl-tr { border-bottom:1px solid var(--border); transition:background 0.1s; cursor:pointer; }
        .cl-tr:last-child { border-bottom:none; }
        .cl-tr:hover { background:var(--surface-2); }

        .cl-td { padding:13px 20px; font-size:15px; color:var(--text); vertical-align:middle; }
        .cl-td-muted { color:var(--text-2); }
        .cl-td-dim { color:var(--text-3); font-size:11px; }

        /* Avatar */
        .cl-avatar {
          width:32px; height:32px; border-radius:8px;
          display:flex; align-items:center; justify-content:center;
          font-family:'Syne',sans-serif; font-size:12px; font-weight:700; color:#fff;
          flex-shrink:0;
        }

        .cl-name-cell { display:flex; align-items:center; gap:10px; }

        /* Action btn */
        .cl-act-btn {
          background:none; border:1px solid var(--border); border-radius:6px;
          padding:5px 10px; font-family:'DM Mono',monospace;
          font-size:10px; color:var(--text-2); cursor:pointer;
          transition:border-color 0.15s,color 0.15s; letter-spacing:0.04em;
        }
        .cl-act-btn:hover { border-color:var(--accent); color:var(--accent); }
        .cl-act-btn.danger:hover { border-color:#c04040; color:#c04040; }

        /* Empty / loader */
        .cl-empty { padding:48px 20px; text-align:center; font-size:12px; color:var(--text-3); }

        @keyframes cl-shimmer {
          0%   { background-position:-400px 0; }
          100% { background-position: 400px 0; }
        }
        .cl-skel {
          height:13px; border-radius:4px;
          background:linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%);
          background-size:800px 100%;
          animation:cl-shimmer 1.4s infinite;
        }

        /* ── Modal ── */
        .cl-backdrop {
          position:fixed; inset:0; background:rgba(0,0,0,0.45);
          z-index:50; display:flex; align-items:center; justify-content:center; padding:20px;
          backdrop-filter:blur(3px);
        }

        .cl-modal {
          background:var(--surface); border:1px solid var(--border);
          border-radius:16px; width:100%; max-width:460px;
          box-shadow:0 24px 60px rgba(0,0,0,0.18);
          overflow:hidden;
          animation:cl-modal-in 0.22s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cl-modal-in {
          from { opacity:0; transform:translateY(12px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        .cl-modal-head {
          display:flex; align-items:center; justify-content:space-between;
          padding:18px 22px; border-bottom:1px solid var(--border);
        }
        .cl-modal-title { font-family:'Syne',sans-serif; font-size:15px; font-weight:700; color:var(--text); letter-spacing:-0.3px; }
        .cl-modal-close {
          background:none; border:none; cursor:pointer; color:var(--text-3);
          font-size:20px; line-height:1; padding:2px 6px; border-radius:4px;
          transition:color 0.15s;
        }
        .cl-modal-close:hover { color:var(--text); }

        .cl-modal-body { padding:22px; }

        /* Form fields */
        .cl-field { margin-bottom:18px; }
        .cl-label { display:block; font-size:13px; color:var(--text-2); letter-spacing:0.14em; text-transform:uppercase; margin-bottom:7px; }
        .cl-input {
          width:100%; background:var(--surface-2); border:1px solid var(--border); border-radius:8px;
          padding:11px 14px; font-family:'DM Mono',monospace; font-size:15px; color:var(--text);
          outline:none; transition:border-color 0.15s,box-shadow 0.15s;
        }
        .cl-input::placeholder { color:var(--text-3); }
        .cl-input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(176,122,66,0.1); }
        .cl-textarea { resize:vertical; min-height:72px; }

        .cl-err {
          font-size:11px; color:var(--err-tx);
          background:var(--err-bg); border:1px solid var(--err-bd);
          border-radius:7px; padding:10px 13px; margin-bottom:16px;
        }

        .cl-modal-foot {
          display:flex; justify-content:flex-end; gap:8px;
          padding:16px 22px; border-top:1px solid var(--border);
        }

        .cl-btn-secondary {
          background:none; border:1px solid var(--border); border-radius:8px;
          padding:9px 16px; font-family:'DM Mono',monospace; font-size:11px;
          color:var(--text-2); cursor:pointer; letter-spacing:0.06em; text-transform:uppercase;
          transition:border-color 0.15s,color 0.15s;
        }
        .cl-btn-secondary:hover { border-color:var(--text-2); color:var(--text); }

        /* View modal detail rows */
        .cl-detail-row { display:flex; gap:8px; padding:10px 0; border-bottom:1px solid var(--border); }
        .cl-detail-row:last-child { border-bottom:none; }
        .cl-detail-key { font-size:10px; color:var(--text-3); letter-spacing:0.1em; text-transform:uppercase; width:100px; flex-shrink:0; padding-top:1px; }
        .cl-detail-val { font-size:12px; color:var(--text); }

        /* ── Entrance ── */
        @keyframes cl-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .cl-content { animation:cl-up 0.4s ease 0.05s both; }

        /* ── Responsive ── */
        @media (max-width:768px) {
          .cl-main { margin-left:0; }
          .cl-hamburger { display:flex; }
          .cl-content { padding:20px 16px; }
          .cl-topbar { padding:0 16px; }
          .cl-search-wrap { max-width:100%; }
          .cl-th:nth-child(3), .cl-td:nth-child(3),
          .cl-th:nth-child(4), .cl-td:nth-child(4) { display:none; }
        }
      `}</style>

      <div className="cl-root">

        <Sidebar activeKey="clients" sideOpen={sideOpen} setSideOpen={setSideOpen} user={user} onLogout={logout} />

        {/* Main */}
        <div className="cl-main">
          <header className="cl-topbar">
            <div className="cl-topbar-left">
              <button className="cl-hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
              <span className="cl-topbar-title">Clients</span>
            </div>
            <button className="cl-btn-primary" onClick={openCreate}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              New client
            </button>
          </header>

          <div className="cl-content">
            {/* Search */}
            <div className="cl-search-row">
              <div className="cl-search-wrap">
                <span className="cl-search-icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </span>
                <input className="cl-search" placeholder="Search name, phone, nationality…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <span className="cl-count">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Table */}
            <div className="cl-card">
              {loading ? (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[1,2,3,4].map(i => <div key={i} className="cl-skel" style={{ width: `${50 + i * 10}%` }} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="cl-empty">
                  {search ? `No clients matching "${search}"` : 'No clients yet — add your first one'}
                </div>
              ) : (
                <table className="cl-table">
                  <thead>
                    <tr>
                      <th className="cl-th">Client</th>
                      <th className="cl-th">Phone</th>
                      <th className="cl-th">Email</th>  
                      <th className="cl-th">Nationality</th>
                      <th className="cl-th">Registered</th>
                      <th className="cl-th" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} className="cl-tr" onClick={() => openView(c)}>
                        <td className="cl-td">
                          <div className="cl-name-cell">
                            <div className="cl-avatar" style={{ background: avatarColor(c.full_name) }}>{initials(c.full_name)}</div>
                            <span style={{ fontWeight: 750 }}>{c.full_name}</span>
                          </div>
                        </td>
                        <td className="cl-td cl-td-muted">{c.phone}</td>
                        <td className="cl-td cl-td-muted">{c.email || '—'}</td>
                        <td className="cl-td cl-td-muted">{c.nationality || '—'}</td>
                        <td className="cl-td cl-td-dim">{c.created_at?.slice(0, 10)}</td>
                        <td className="cl-td" style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="cl-act-btn" onClick={() => openView(c)}>View</button>
                            <button className="cl-act-btn danger" onClick={() => handleDelete(c.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── Create modal ── */}
        {modal === 'create' && (
          <div className="cl-backdrop" onClick={() => setModal(null)}>
            <div className="cl-modal" onClick={e => e.stopPropagation()}>
              <div className="cl-modal-head">
                <span className="cl-modal-title">New client</span>
                <button className="cl-modal-close" onClick={() => setModal(null)}>×</button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="cl-modal-body">
                  {error && <div className="cl-err">{error}</div>}
                  <div className="cl-field">
                    <label className="cl-label">Full name *</label>
                    <input className="cl-input" placeholder="John Doe" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required />
                  </div>
                  <div className="cl-field">
                    <label className="cl-label">Phone *</label>
                    <input className="cl-input" placeholder="+254 700 000 000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                  </div>
                  <div className="cl-field">
                    <label className="cl-label">Email *</label>
                    <input className="cl-input" type="email" placeholder="client@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="cl-field">
                    <label className="cl-label">Nationality</label>
                    <input className="cl-input" placeholder="Kenyan" value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} />
                  </div>
                  <div className="cl-field" style={{ marginBottom: 0 }}>
                    <label className="cl-label">Notes</label>
                    <textarea className="cl-input cl-textarea" placeholder="Allergies, preferences, conditions…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div className="cl-modal-foot">
                  <button type="button" className="cl-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button type="submit" className="cl-btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Create client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── View modal ── */}
        {modal === 'view' && selected && (
          <div className="cl-backdrop" onClick={() => setModal(null)}>
            <div className="cl-modal" onClick={e => e.stopPropagation()}>
              <div className="cl-modal-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="cl-avatar" style={{ background: avatarColor(selected.full_name), width: '38px', height: '38px', fontSize: '14px' }}>
                    {initials(selected.full_name)}
                  </div>
                  <span className="cl-modal-title">{selected.full_name}</span>
                </div>
                <button className="cl-modal-close" onClick={() => setModal(null)}>×</button>
              </div>
              <div className="cl-modal-body">
                {[
                  { key: 'Phone',       val: selected.phone },
                  { key: 'Email',       val: selected.email || '—' },
                  { key: 'Nationality', val: selected.nationality || '—' },
                  { key: 'Registered',  val: selected.created_at?.slice(0, 10) },
                  { key: 'Notes',       val: selected.notes || '—' },
                ].map(({ key, val }) => (
                  <div key={key} className="cl-detail-row">
                    <div className="cl-detail-key">{key}</div>
                    <div className="cl-detail-val">{val}</div>
                  </div>
                ))}
              </div>
              <div className="cl-modal-foot">
                <button className="cl-btn-secondary cl-act-btn danger" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 16px' }}
                  onClick={() => handleDelete(selected.id)}>
                  Delete
                </button>
                <button className="cl-btn-secondary" onClick={() => setModal(null)}>Close</button>
                <button className="cl-btn-primary" onClick={() => { setModal(null); router.push(`/clients/${selected.id}`); }}>
                  View visits →
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
    </ProtectedPage>
  );
}