'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchActiveVisits, createVisit, completeVisit } from '../API/visitApi';
import { fetchClients } from '../API/clientApi';
import ProtectedPage from '../protectedPage';
import Sidebar from '../sidebar';

//  Types 
interface User { id: number; name: string; email: string; role: string; }
interface Client { id: number; full_name: string; phone: string; }
interface Visit {
  room_number: string;
  id: number;
  client_id: number;
  client_name?: string;
  reason: string;
  notes?: string;
  status: 'active' | 'completed';
  created_at: string;
  completed_at?: string;
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function duration(start: string, end?: string) {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const d = Math.floor(h / 24 );
  return m ? ` ${d}days  ${m}m` : `${h}h`;
}

const FILTERS = ['all', 'active', 'completed'] as const;
type Filter = typeof FILTERS[number];

export default function VisitsPage() {
  const router = useRouter();
  const [user, setUser]             = useState<User | null>(null);
  const [visits, setVisits]         = useState<Visit[]>([]);
  const [clients, setClients]       = useState<Client[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sideOpen, setSideOpen]     = useState(false);
  const [filter, setFilter]         = useState<Filter>('all');
  const [search, setSearch]         = useState('');
  const [showModal, setShowModal]   = useState(false);
  const [checkOutId, setCheckOutId] = useState<number | null>(null);
  const [mounted, setMounted]       = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]       = useState('');
const [form, setForm] = useState({
  isGroup: false,
  groupName: '',
  reason: '',
  notes: '',
  client_id: '',
  room_number: '',
});

// Group members: each has a client + room
const [groupMembers, setGroupMembers] = useState([
  { client_id: '', room_number: '' }
]);
const [leaderIndex, setLeaderIndex] = useState(0);

const addMember = () => setGroupMembers(m => [...m, { client_id: '', room_number: '' }]);
const removeMember = (i: number) => {
  setGroupMembers(m => m.filter((_, idx) => idx !== i));
  setLeaderIndex(li => (i === li ? 0 : li > i ? li - 1 : li));
};
const updateMember = (i: number, field: string, value: string) =>
  setGroupMembers(m => m.map((mem, idx) => idx === i ? { ...mem, [field]: value } : mem));


  //  Load visits + clients
  const load = () => {
    setLoading(true);
    // const headers = () => {
    //   const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    //   return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    // };
    Promise.allSettled([
      fetchActiveVisits(),
      fetchClients(),
    ]).then(([v, c]) => {
      if (v.status === 'fulfilled') setVisits(v.value as Visit[]);
      if (c.status === 'fulfilled') setClients(c.value);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    load();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  //  Filtered list
  const filtered = visits.filter(v => {
    const matchFilter = filter === 'all' || v.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (v.client_name || '').toLowerCase().includes(q) ||
      v.reason.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  //  Stats
  const activeCount    = visits.filter(v => v.status === 'active').length;
  const completedCount = visits.filter(v => v.status === 'completed').length;
  const todayCount     = visits.filter(v =>
    new Date(v.created_at).toDateString() === new Date().toDateString()
  ).length;

  //  Complete visit 
 const handleCheckOut = async (id: number) => {
  setCheckOutId(id);
  try {
    const updated = await completeVisit(id);
    setVisits(prev => prev.map(v => v.id === id ? { ...v, ...updated } : v));
  } catch (err: any) {
    alert(err.message || 'Failed to complete visit.');
  } finally {
    setCheckOutId(null);
  }
};

  //  Create visit 
const handleSubmit = async () => {
  setFormErr('');

  if (!form.reason.trim()) {
    setFormErr('Please enter a reason for the visit.');
    return;
  }

  if (form.isGroup) {
    const invalid = groupMembers.some(m => !m.client_id);
    if (invalid) { setFormErr('Please select a client for each member.'); return; }
    if (groupMembers.length < 2) { setFormErr('A group visit needs at least 2 members.'); return; }

    setSubmitting(true);
    try {
      const group_id = crypto.randomUUID();
      const results = await Promise.all(
        groupMembers.map((member, i) =>
          createVisit({
            client_id:       Number(member.client_id),
            reason:          form.isGroup && form.groupName
                              ? `[${form.groupName}] ${form.reason}`
                              : form.reason,
            room_number:     member.room_number || undefined,
            notes:           form.notes || undefined,
            group_id,
            group_name:      form.groupName || undefined,
            is_group_leader: i === leaderIndex,
          })
        )
      );
      const enriched = (results as Visit[]).map((v, i) => ({
        ...v,
        client_name: clients.find(c => c.id === Number(groupMembers[i].client_id))?.full_name,
      }));
      setVisits(prev => [...enriched, ...prev]);
      setShowModal(false);
      setForm({ isGroup: false, groupName: '', reason: '', notes: '', client_id: '', room_number: '' });
      setGroupMembers([{ client_id: '', room_number: '' }]);
      setLeaderIndex(0);
    } catch (err: any) {
      setFormErr(err.message || 'One or more check-ins failed.');
    } finally {
      setSubmitting(false);
    }
  } else {
    if (!form.client_id) { setFormErr('Please select a client.'); return; }
    setSubmitting(true);
    try {
      const data = await createVisit({
        client_id:   Number(form.client_id),
        reason:      form.reason,
        room_number: form.room_number || undefined,
        notes:       form.notes || undefined,
      });
      const client = clients.find(c => c.id === Number(form.client_id));
      setVisits(prev => [{ ...data, client_name: client?.full_name } as Visit, ...prev]);
      setShowModal(false);
      setForm({ isGroup: false, groupName: '', reason: '', notes: '', client_id: '', room_number: '' });
    } catch (err: any) {
      setFormErr(err.message || 'Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }
};

  const statusColor = (s: string) => s === 'active' ? 'var(--badge-amber-tx)' : 'var(--badge-green-tx)';
  const statusBg    = (s: string) => s === 'active' ? 'var(--badge-amber-bg)' : 'var(--badge-green-bg)';

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
          --dot:             rgba(0,0,0,0.05);
          --badge-green-bg:  #eaf4ee;
          --badge-green-tx:  #2d7a47;
          --badge-amber-bg:  #fef4e4;
          --badge-amber-tx:  #9a6520;
          --badge-red-bg:    #fdeeed;
          --badge-red-tx:    #b03030;
          --shadow:          0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .db-root {
          font-family: 'DM Mono', monospace;
          display: flex; min-height: 100vh;
          background: var(--bg); color: var(--text);
          -webkit-font-smoothing: antialiased;
        }

        .db-root::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, var(--dot) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* ── Sidebar ── */
        .db-side {
          width: 220px; flex-shrink: 0;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }
         .db-side-head { padding: 28px 20px 24px; border-bottom: 1px solid var(--sidebar-border); display: flex; align-items: center; gap: 10px; }
        .db-logo { flex-shrink: 0; border-radius: 6px; }
        .db-brand-text { display: flex; flex-direction: column; }
        .db-brand { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; letter-spacing: -0.8px; }
        .db-brand-sub { font-size: 13px; color: #383430; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 3px; }
        .db-nav { flex: 1; padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .db-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          font-size: 18px; color: var(--sidebar-text);
          cursor: pointer; transition: background 0.15s, color 0.15s;
          letter-spacing: 0.02em; border: none; background: none; width: 100%; text-align: left;
        }
        .db-nav-item:hover { background: rgba(255,255,255,0.05); color: #d4cfc8; }
        .db-nav-item.active { background: var(--sidebar-act-bg); color: var(--sidebar-active); }
        .db-nav-item svg { opacity: 0.5; flex-shrink: 0; transition: opacity 0.15s; }
        .db-nav-item:hover svg { opacity: 0.75; }
        .db-nav-item.active svg { opacity: 1; }

        .db-side-foot { padding: 16px 20px; border-top: 1px solid var(--sidebar-border); }
        .db-user-name { font-size: 16px; color: #706a62; }
        .db-user-role { font-size: 14px; color: #403c38; margin-top: 2px; text-transform: capitalize; letter-spacing: 0.06em; }
        .db-logout {
          margin-top: 12px; font-size: 14px; color: #4a4640;
          background: none; border: none; cursor: pointer;
          letter-spacing: 0.08em; text-transform: uppercase; transition: color 0.15s; padding: 0;
        }
        .db-logout:hover { color: #c9a96e; }

        /* ── Main ── */
        .db-main { flex: 1; margin-left: 220px; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 100vh; }

        .db-topbar {
          position: sticky; top: 0; z-index: 30;
          background: var(--bg); border-bottom: 1px solid var(--border);
          padding: 0 32px; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          backdrop-filter: blur(8px);
        }
        .db-topbar-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-topbar-date { font-size: 18px; color: var(--text-3); letter-spacing: 0.08em; }
        .db-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--text); padding: 4px; }

        .db-content { padding: 32px; flex: 1; }

        /* ── Stats ── */
        .db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; animation: db-up 0.5s ease 0.05s both; }
        .db-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px 22px; box-shadow: var(--shadow);
          position: relative; overflow: hidden;
        }
        .db-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); opacity: 0.4; }
        .db-stat:first-child::before { opacity: 1; }
        .db-stat-label { font-size: 13px; color: var(--text-2); letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 10px; }
        .db-stat-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.8px; line-height: 1; }
        .db-stat-sub { font-size: 14px; color: var(--text-3); margin-top: 6px; }

        /* ── Toolbar ── */
        .db-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; animation: db-up 0.5s ease 0.1s both; }

        .db-search {
          flex: 1; min-width: 200px; max-width: 320px;
          display: flex; align-items: center; gap: 8px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 0 12px; height: 36px;
        }
        .db-search svg { opacity: 0.35; flex-shrink: 0; }
        .db-search input { border: none; background: none; outline: none; font-family: 'DM Mono', monospace; font-size: 16px; color: var(--text); flex: 1; }
        .db-search input::placeholder { color: var(--text-3); }

        .db-filters { display: flex; gap: 4px; }
        .db-filter-btn {
          height: 36px; padding: 0 14px; border-radius: 8px;
          font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.04em;
          border: 1px solid var(--border); background: var(--surface); color: var(--text-2);
          cursor: pointer; transition: all 0.15s; text-transform: capitalize;
        }
        .db-filter-btn:hover { color: var(--text); border-color: var(--accent); }
        .db-filter-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }

        .db-btn-primary {
          height: 36px; padding: 0 16px; border-radius: 8px;
          font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase;
          background: var(--accent); color: #fff; border: none;
          cursor: pointer; transition: background 0.15s;
          display: flex; align-items: center; gap: 6px; white-space: nowrap; margin-left: auto;
        }
        .db-btn-primary:hover { background: var(--accent-h); }
        .db-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Card / Table ── */
        .db-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; animation: db-up 0.5s ease 0.15s both; }
        .db-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .db-card-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .db-card-count { font-size: 14px; color: var(--text-3); letter-spacing: 0.06em; }

        .db-table { width: 100%; border-collapse: collapse; }
        .db-th { text-align: left; padding: 10px 20px; font-size: 13px; color: var(--text-3); letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid var(--border); font-weight: 500; }
        .db-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .db-tr:last-child { border-bottom: none; }
        .db-tr:hover { background: var(--surface-2); }
        .db-td { padding: 12px 20px; font-size: 16px; color: var(--text); vertical-align: middle; }
        .db-td-muted { color: var(--text-2); }
        .db-td-mono { font-size: 15px; color: var(--text-2); }

        .db-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 5px;
          font-size: 14px; font-weight: 500; letter-spacing: 0.04em; text-transform: capitalize;
        }
        .db-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.7; }

        .db-dur { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 14px; color: var(--text-2); background: var(--surface-2); border: 1px solid var(--border); }

        .db-checkout {
          height: 28px; padding: 0 10px; border-radius: 6px;
          font-family: 'DM Mono', monospace; font-size: 14px; letter-spacing: 0.04em;
          background: none; border: 1px solid var(--border); color: var(--text-2);
          cursor: pointer; transition: all 0.15s; white-space: nowrap;
        }
        .db-checkout:hover { border-color: var(--accent); color: var(--accent); }
        .db-checkout:disabled { opacity: 0.4; cursor: not-allowed; }

        .db-empty { padding: 48px 20px; text-align: center; font-size: 16px; color: var(--text-3); }

        @keyframes db-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .db-skel {
          background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%);
          background-size: 800px 100%; animation: db-shimmer 1.4s infinite; border-radius: 4px; height: 12px;
        }

        /* ── Modal ── */
        .db-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 50;
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: db-fade 0.2s ease;
        }
        @keyframes db-fade { from { opacity: 0; } to { opacity: 1; } }

        .db-modal {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; width: 100%; max-width: 440px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.15); overflow: hidden;
          animation: db-slide 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes db-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .db-modal-head { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .db-modal-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-modal-close { background: none; border: none; cursor: pointer; color: var(--text-3); transition: color 0.15s; padding: 2px; }
        .db-modal-close:hover { color: var(--text); }

        .db-modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
        .db-modal-foot { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }

        .db-field { display: flex; flex-direction: column; gap: 6px; }
        .db-label { font-size: 13px; color: var(--text-2); letter-spacing: 0.14em; text-transform: uppercase; }

        .db-select, .db-input, .db-textarea {
          font-family: 'DM Mono', monospace; font-size: 16px; color: var(--text);
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 8px; padding: 10px 12px;
          outline: none; width: 100%; transition: border-color 0.15s;
        }
        .db-select:focus, .db-input:focus, .db-textarea:focus { border-color: var(--accent); }
        .db-textarea { resize: vertical; min-height: 80px; }

        .db-err { font-size: 15px; color: var(--badge-red-tx); background: var(--badge-red-bg); border-radius: 6px; padding: 8px 12px; }

        .db-btn-secondary {
          height: 36px; padding: 0 16px; border-radius: 8px;
          font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.04em;
          background: none; border: 1px solid var(--border); color: var(--text-2);
          cursor: pointer; transition: all 0.15s;
        }
        .db-btn-secondary:hover { color: var(--text); border-color: var(--text-2); }

        .db-side-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 35; }

        @keyframes db-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1100px) { .db-stats { grid-template-columns: repeat(2, 1fr); } }

        @media (max-width: 768px) {
          .db-side { transform: translateX(-100%); }
          .db-side.open { transform: translateX(0); }
          .db-side-overlay.open { display: block; }
          .db-main { margin-left: 0; }
          .db-hamburger { display: flex; }
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-content { padding: 20px 16px; }
          .db-topbar { padding: 0 16px; }
          .db-btn-primary span { display: none; }
          .db-table th:nth-child(3), .db-table td:nth-child(3),
          .db-table th:nth-child(4), .db-table td:nth-child(4) { display: none; }
        }

        @media (max-width: 480px) {
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-value { font-size: 18px; }
          .db-toolbar { gap: 8px; }
        }
      `}</style>

      <div className="db-root">

        {/* ── Sidebar ── */}
       <Sidebar activeKey="visits" sideOpen={sideOpen} setSideOpen={setSideOpen} user={user} onLogout={logout} />

        {/* ── Main ── */}
        <div className="db-main">
          <header className="db-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="db-hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
              <span className="db-topbar-title">Visits</span>
            </div>
            <span className="db-topbar-date">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </header>

          <div className="db-content">

            {/* ── Stats ── */}
            <div className="db-stats">
              {[
                { label: 'Active now',      value: loading ? '—' : String(activeCount),    sub: 'Currently on site' },
                { label: 'Completed today', value: loading ? '—' : String(todayCount),     sub: "Today's check-ins" },
                { label: 'Total visits',    value: loading ? '—' : String(visits.length),  sub: 'All time' },
                { label: 'Completed',       value: loading ? '—' : String(completedCount), sub: 'Checked out' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="db-stat" style={{ opacity: mounted ? 1 : 0 }}>
                  <div className="db-stat-label">{label}</div>
                  <div className="db-stat-value">{value}</div>
                  <div className="db-stat-sub">{sub}</div>
                </div>
              ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="db-toolbar">
              <div className="db-search">
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by client or reason…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, lineHeight: 1 }}>✕</button>
                )}
              </div>

              <div className="db-filters">
                {FILTERS.map(f => (
                  <button key={f} className={`db-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f}
                  </button>
                ))}
              </div>

              <button className="db-btn-primary" onClick={() => setShowModal(true)}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Check in</span>
              </button>
            </div>

            {/* ── Table ── */}
            <div className="db-card">
              <div className="db-card-head">
                <span className="db-card-title">
                  {filter === 'all' ? 'All visits' : filter === 'active' ? 'Active visits' : 'Completed visits'}
                </span>
                <span className="db-card-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {loading ? (
                <div style={{ padding: '24px 20px' }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                      <div className="db-skel" style={{ width: '25%' }} />
                      <div className="db-skel" style={{ width: '20%' }} />
                      <div className="db-skel" style={{ width: '28%' }} />
                      <div className="db-skel" style={{ width: '15%' }} />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="db-empty">
                  {search ? `No visits matching "${search}"` : `No ${filter === 'all' ? '' : filter} visits found`}
                </div>
              ) : (
                <table className="db-table">
                  <thead>
                    <tr>
                      <th className="db-th">Client</th>
                      <th className="db-th">Reason</th>
                      <th className="db-th">Room</th>
                      <th className="db-th">Started</th>
                      <th className="db-th">Completed</th>
                      <th className="db-th">Duration</th>
                      <th className="db-th">Status</th>
                      <th className="db-th" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(v => (
                      <tr key={v.id} className="db-tr">
                        <td className="db-td" style={{ fontWeight: 500 }}>
                          {v.client_name || `Client #${v.client_id}`}
                        </td>
                        <td className="db-td db-td-muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.reason}
                        </td>
                        <td className="db-td db-td-muted">{v.room_number || '—'}</td>
                        <td className="db-td db-td-mono">{fmtDate(v.created_at)}</td>
                        <td className="db-td db-td-mono">
                          {v.completed_at ? fmtDate(v.completed_at) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                        </td>
                        <td className="db-td">
                          <span className="db-dur">{duration(v.created_at, v.completed_at)}</span>
                        </td>
                        <td className="db-td">
                          <span className="db-badge" style={{ color: statusColor(v.status), background: statusBg(v.status) }}>
                            {v.status}
                          </span>
                        </td>
                        <td className="db-td" style={{ textAlign: 'right' }}>
                          {v.status === 'active' && (
                            <button
                              className="db-checkout"
                              disabled={checkOutId === v.id}
                              onClick={() => handleCheckOut(v.id)}
                            >
                              {checkOutId === v.id ? '…' : 'Check out'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Check-in Modal ── */}
      {showModal && (
        <div
          className="db-overlay"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setFormErr(''); } }}
        >
          <div className="db-modal">
            <div className="db-modal-head">
              <span className="db-modal-title">New check-in</span>
              <button className="db-modal-close" onClick={() => { setShowModal(false); setFormErr(''); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

           <div className="db-modal-body">

              {/* Group toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'var(--surface-2)',
                borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500 }}>Group visit</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                    Multiple clients checking in together
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isGroup: !f.isGroup }))}
                  style={{
                    width: '40px', height: '22px', borderRadius: '99px', border: 'none',
                    cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    background: form.isGroup ? 'var(--accent)' : 'var(--border)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: '3px',
                    left: form.isGroup ? '21px' : '3px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* Group name — shown when group is on */}
              {form.isGroup && (
                <div className="db-field">
                  <label className="db-label">Group name (optional)</label>
                  <input
                    className="db-input"
                    placeholder="e.g. Adidas Group, Safari Team…"
                    value={form.groupName}
                    onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
                  />
                </div>
              )}

              {/* Reason — always shown */}
              <div className="db-field">
                <label className="db-label">Reason *</label>
                <input
                  className="db-input"
                  placeholder="Reason for visit…"
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>

              {/* Single visit fields */}
              {!form.isGroup && (
                <>
                  <div className="db-field">
                    <label className="db-label">Client *</label>
                    <select
                      className="db-select"
                      value={form.client_id}
                      onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                    >
                      <option value="">Select a client…</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>
                      ))}
                    </select>
                  </div>
                  <div className="db-field">
                    <label className="db-label">Room number</label>
                    <input
                      className="db-input"
                      placeholder="London, Texas"
                      value={form.room_number}
                      onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Group members — each with client + room */}
              {form.isGroup && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="db-label" style={{ margin: 0 }}>
                      Members ({groupMembers.length})
                    </label>
                    <button
                      type="button"
                      onClick={addMember}
                      style={{
                        fontSize: '10px', color: 'var(--accent)', background: 'none',
                        border: 'none', cursor: 'pointer', letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      + Add member
                    </button>
                  </div>

                  {groupMembers.map((member, i) => (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto',
                        gap: '8px', alignItems: 'center',
                        padding: '10px', background: 'var(--surface-2)',
                        borderRadius: '8px', border: '1px solid var(--border)',
                      }}>
                        <input
                          type="radio"
                          name="group-leader"
                          checked={leaderIndex === i}
                          onChange={() => setLeaderIndex(i)}
                          title="Bill to this member"
                        />
                        <select
                          className="db-select"
                          style={{ padding: '8px 10px', fontSize: '11px' }}
                          value={member.client_id}
                          onChange={e => updateMember(i, 'client_id', e.target.value)}
                        >
                          <option value="">Select client…</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name}</option>
                          ))}
                        </select>
                        <input
                          className="db-input"
                          style={{ padding: '8px 10px', fontSize: '11px' }}
                          placeholder="Room (optional)"
                          value={member.room_number}
                          onChange={e => updateMember(i, 'room_number', e.target.value)}
                        />
                        {groupMembers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMember(i)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-3)', fontSize: '16px', lineHeight: 1,
                              padding: '4px',
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Notes */}
              <div className="db-field">
                <label className="db-label">Notes (optional)</label>
                <textarea
                  className="db-textarea"
                  placeholder="Any additional notes…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {/* Check-in time */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center',
                padding: '10px 12px', background: 'var(--surface-2)',
                borderRadius: '8px', border: '1px solid var(--border)' }}>
                <svg width="13" height="13" fill="none" stroke="var(--text-3)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>
                  Check-in time: <strong style={{ color: 'var(--text)' }}>
                    {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </span>
              </div>

              {formErr && <div className="db-err">{formErr}</div>}
            </div>

            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={() => { setShowModal(false); setFormErr(''); }}>
                Cancel
              </button>
              <button className="db-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ margin: 0 }}>
                {submitting ? 'Checking in…' : 'Confirm check-in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    </ProtectedPage>
  );
}