'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchActiveVisits, Visit } from '../API/visitApi';
import { fetchInvoices } from '../API/invoiceApi';
import { fetchClientById } from '../API/clientApi';
import ProtectedPage from '../protectedPage';

// Types
interface User { id: number; name: string; email: string; role: string; }
interface Invoice { id: number; invoice_number: string; full_name: string; total_amount: number; total_expenses: number; status: 'unpaid' | 'partial' | 'paid'; issued_date: string; }

interface EnrichedVisit extends Visit {
  client_name: string;
  client_phone: string;
}

// Nav items 
const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/dashboard' },
  { key: 'clients', label: 'Clients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', href: '/client' },
  { key: 'visit', label: 'Visits', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', href: '/visit' },
  { key: 'expenses', label: 'Expenses', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', href: '/expense' },
  { key: 'invoices', label: 'Invoices', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/invoice' },
  { key: 'payments', label: 'Payments', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', href: '/payment' },
];

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }

function formatDate(dateString: string | undefined) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-KE', { 
    day: '2-digit', 
    month: 'short',
    year: 'numeric'
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [visits, setVisits] = useState<EnrichedVisit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sideOpen, setSideOpen] = useState(false);
  const [active, setActive] = useState('dashboard');
  const [mounted, setMounted] = useState(false);

  const headers = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  // const fetchClientDirectly = async (clientId: number) => {
  //   try {
  //     const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  //     const response = await fetch(`${API_URL}/clients/${clientId}`, {
  //       headers: headers()
  //     });
      
  //     if (!response.ok) {
  //       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  //     }
      
  //     const data = await response.json();
  //     return data;
  //   } catch (error) {
  //     console.error(`Error fetching client ${clientId}:`, error);
  //     return null;
  //   }
  // };

  // Enrich visits with client details
  const enrichVisitsWithClientDetails = async (rawVisits: Visit[]): Promise<EnrichedVisit[]> => {
    // Create a cache to avoid duplicate client fetches
    const clientCache = new Map<number, any>();
    
    const enrichedVisits = await Promise.all(
      rawVisits.map(async (visit) => {
        try {
          let client = clientCache.get(visit.client_id);
          
          if (!client) {
            // Try using the imported function first
            try {
              client = await fetchClientById(visit.client_id);
              // console.log(`fetchClientById returned for ${visit.client_id}:`, client);
            } catch (err) {
              // console.log(`fetchClientById failed, trying direct fetch for ${visit.client_id}`);
              // client = await fetchClientDirectly(visit.client_id);
            }
            
            if (client) {
              clientCache.set(visit.client_id, client);
            }
          }
          
          // Extract client name from different possible response structures
          let clientName = `Client #${visit.client_id}`;
          let clientPhone = '—';
          
          if (client) {
            // Try different possible field names
            clientName = client.name || client.full_name || client.client_name || client.fullName || `Client #${visit.client_id}`;
            clientPhone = client.phone || client.phone_number || client.mobile || '—';
          }
          
          // console.log(`Visit ${visit.id}: Client name = ${clientName}`);  Debug log
          
          return {
            ...visit,
            client_name: clientName,
            client_phone: clientPhone,
            check_in: visit.check_in || visit.created_at,
          };
        } catch (error) {
          console.error(`Error processing visit ${visit.id}:`, error);
          return {
            ...visit,
            client_name: `Client #${visit.client_id}`,
            client_phone: '—',
            check_in: visit.check_in || visit.created_at,
          };
        }
      })
    );
    
    return enrichedVisits;
  };

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) setUser(JSON.parse(stored));

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch active visits and invoices in parallel
        const [visitsResult, invoicesResult] = await Promise.allSettled([
          fetchActiveVisits(headers()),
          fetchInvoices(headers()),
        ]);

        // Process visits
        if (visitsResult.status === 'fulfilled' && Array.isArray(visitsResult.value)) {
          // console.log('Raw visits received:', visitsResult.value);
          // Log the first visit to see its structure
          if (visitsResult.value.length > 0) {
            // console.log('First raw visit:', visitsResult.value[0]);
          }
          
          const enrichedVisits = await enrichVisitsWithClientDetails(visitsResult.value);
          // console.log('Enriched visits:', enrichedVisits);
          setVisits(enrichedVisits);
        } else if (visitsResult.status === 'rejected') {
          console.error('Failed to fetch visits:', visitsResult.reason);
          setVisits([]);
        }

        // Process invoices
        if (invoicesResult.status === 'fulfilled' && Array.isArray(invoicesResult.value)) {
          setInvoices(invoicesResult.value);
        } else if (invoicesResult.status === 'rejected') {
          console.error('Failed to fetch invoices:', invoicesResult.reason);
          setInvoices([]);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  // Derived stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
  const unpaidCount = invoices.filter(i => i.status === 'unpaid').length;
  const activeVisits = visits.filter(v => v.status === 'active').length;

  const statusColor = (s: string) => {
    if (s === 'paid' || s === 'completed') return 'var(--badge-green-tx)';
    if (s === 'partial' || s === 'active') return 'var(--badge-amber-tx)';
    return 'var(--badge-red-tx)';
  };
  
  const statusBg = (s: string) => {
    if (s === 'paid' || s === 'completed') return 'var(--badge-green-bg)';
    if (s === 'partial' || s === 'active') return 'var(--badge-amber-bg)';
    return 'var(--badge-red-bg)';
  };

  return (
    <ProtectedPage>
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap');

        /* ── Tokens: Light ── */
        :root {
          --bg:              #f2efe9;
          --surface:         #ffffff;
          --surface-2:       #f8f6f2;
          --border:          #e5e0d8;
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

        @media (prefers-color-scheme: dark) {
          :root {
            --bg:              #0c0c0c;
            --surface:         #141414;
            --surface-2:       #1a1a1a;
            --border:          #222222;
            --sidebar-bg:      #0e0e0e;
            --sidebar-border:  #1a1a1a;
            --sidebar-text:    #4a4a4a;
            --sidebar-active:  #ffffff;
            --sidebar-act-bg:  rgba(255,255,255,0.07);
            --text:            #e0e0e0;
            --text-2:          #686868;
            --text-3:          #383838;
            --accent:          #c9a96e;
            --accent-h:        #dbbf85;
            --dot:             rgba(255,255,255,0.04);
            --badge-green-bg:  rgba(50,180,90,0.1);
            --badge-green-tx:  #5cc87a;
            --badge-amber-bg:  rgba(200,160,80,0.1);
            --badge-amber-tx:  #d4a84a;
            --badge-red-bg:    rgba(200,70,70,0.1);
            --badge-red-tx:    #e07070;
            --shadow:          0 1px 3px rgba(0,0,0,0.3);
          }
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .db-root {
          font-family: 'DM Mono', monospace;
          display: flex; min-height: 100vh;
          background: var(--bg); color: var(--text);
          -webkit-font-smoothing: antialiased;
        }

        /* dot grid */
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
          position: fixed; top: 0; left: 0; bottom: 0;
          z-index: 40;
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }

        .db-side-head {
          padding: 28px 20px 24px;
          border-bottom: 1px solid var(--sidebar-border);
        }

        .db-brand {
          font-family: 'Syne', sans-serif;
          font-weight: 800; font-size: 18px;
          color: #fff; letter-spacing: -0.8px;
        }

        .db-brand-sub {
          font-size: 9px; color: #9c9690;
          letter-spacing: 0.16em; text-transform: uppercase; margin-top: 3px;
        }

        .db-nav { flex: 1; padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }

        .db-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          font-size: 12px; color: var(--sidebar-text);
          cursor: pointer; transition: background 0.15s, color 0.15s;
          letter-spacing: 0.02em; border: none; background: none; width: 100%; text-align: left;
        }

        .db-nav-item:hover { background: rgba(255,255,255,0.05); color: #d4cfc8; }

        .db-nav-item.active {
          background: var(--sidebar-act-bg);
          color: var(--sidebar-active);
        }

        .db-nav-item.active svg { opacity: 1; }
        .db-nav-item svg { opacity: 0.5; flex-shrink: 0; transition: opacity 0.15s; }
        .db-nav-item:hover svg { opacity: 0.75; }

        .db-side-foot {
          padding: 16px 20px;
          border-top: 1px solid var(--sidebar-border);
        }

        .db-user-name { font-size: 12px; color: #706a62; }
        .db-user-role { font-size: 10px; color: #403c38; margin-top: 2px; text-transform: capitalize; letter-spacing: 0.06em; }

        .db-logout {
          margin-top: 12px; font-size: 10px; color: #4a4640;
          background: none; border: none; cursor: pointer;
          letter-spacing: 0.08em; text-transform: uppercase;
          transition: color 0.15s; padding: 0;
        }
        .db-logout:hover { color: #c9a96e; }

        /* ── Main ── */
        .db-main {
          flex: 1; margin-left: 220px;
          display: flex; flex-direction: column;
          position: relative; z-index: 1; min-height: 100vh;
        }

        /* Top bar */
        .db-topbar {
          position: sticky; top: 0; z-index: 30;
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          padding: 0 32px;
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          backdrop-filter: blur(8px);
        }

        .db-topbar-title {
          font-family: 'Syne', sans-serif;
          font-size: 16px; font-weight: 700;
          color: var(--text); letter-spacing: -0.3px;
        }

        .db-topbar-date {
          font-size: 10px; color: var(--text-3);
          letter-spacing: 0.08em;
        }

        .db-hamburger {
          display: none; background: none; border: none;
          cursor: pointer; color: var(--text); padding: 4px;
        }

        /* Content */
        .db-content { padding: 32px; flex: 1; }

        /* ── Stat cards ── */
        .db-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px; margin-bottom: 28px;
        }

        .db-stat {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px 22px;
          box-shadow: var(--shadow);
          position: relative; overflow: hidden;
        }

        .db-stat::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--accent); opacity: 0.4;
        }

        .db-stat:first-child::before { opacity: 1; }

        .db-stat-label {
          font-size: 9px; color: var(--text-2);
          letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 10px;
        }

        .db-stat-value {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 700;
          color: var(--text); letter-spacing: -0.8px; line-height: 1;
        }

        .db-stat-sub {
          font-size: 10px; color: var(--text-3); margin-top: 6px;
        }

        /* ── Sections grid ── */
        .db-grid-2 {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 20px; margin-bottom: 20px;
        }

        .db-grid-3 {
          display: grid; grid-template-columns: 2fr 1fr;
          gap: 20px; margin-bottom: 20px;
        }

        /* ── Card ── */
        .db-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }

        .db-card-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }

        .db-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 700;
          color: var(--text); letter-spacing: -0.2px;
        }

        .db-card-link {
          font-size: 10px; color: var(--text-3);
          letter-spacing: 0.06em; cursor: pointer;
          transition: color 0.15s; background: none; border: none;
        }
        .db-card-link:hover { color: var(--accent); }

        /* ── Table ── */
        .db-table { width: 100%; border-collapse: collapse; }

        .db-th {
          text-align: left; padding: 10px 20px;
          font-size: 9px; color: var(--text-3);
          letter-spacing: 0.14em; text-transform: uppercase;
          border-bottom: 1px solid var(--border);
          font-weight: 500;
        }

        .db-th-r { text-align: right; }

        .db-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .db-tr:last-child { border-bottom: none; }
        .db-tr:hover { background: var(--surface-2); }

        .db-td {
          padding: 11px 20px;
          font-size: 12px; color: var(--text);
          vertical-align: middle;
        }

        .db-td-muted { color: var(--text-2); }
        .db-td-r { text-align: right; }
        .db-td-mono { font-size: 11px; color: var(--text-2); }

        /* ── Badge ── */
        .db-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 5px;
          font-size: 10px; font-weight: 500;
          letter-spacing: 0.04em; text-transform: capitalize;
        }

        .db-badge::before {
          content: ''; width: 5px; height: 5px; border-radius: 50%;
          background: currentColor; opacity: 0.7;
        }

        /* ── Empty ── */
        .db-empty {
          padding: 36px 20px; text-align: center;
          font-size: 12px; color: var(--text-3);
        }

        /* ── Skeleton ── */
        @keyframes db-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        .db-skel {
          background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%);
          background-size: 800px 100%;
          animation: db-shimmer 1.4s infinite;
          border-radius: 4px; height: 12px;
        }

        /* ── Expense bar ── */
        .db-expbar { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; }
        .db-expbar:last-child { border-bottom: none; }

        .db-expbar-cat {
          width: 76px; font-size: 11px; color: var(--text-2);
          text-transform: capitalize; flex-shrink: 0;
        }

        .db-expbar-track {
          flex: 1; height: 5px; background: var(--border); border-radius: 99px; overflow: hidden;
        }

        .db-expbar-fill {
          height: 100%; border-radius: 99px;
          background: var(--accent); opacity: 0.7;
          transition: width 0.6s cubic-bezier(0.16,1,0.3,1);
        }

        .db-expbar-val {
          font-size: 11px; color: var(--text-2); width: 80px;
          text-align: right; flex-shrink: 0;
        }

        /* ── Entrance animations ── */
        @keyframes db-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .db-stats     { animation: db-up 0.5s ease 0.05s both; }
        .db-grid-3    { animation: db-up 0.5s ease 0.12s both; }
        .db-grid-2    { animation: db-up 0.5s ease 0.18s both; }

        /* ── Overlay (mobile) ── */
        .db-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.5); z-index: 35;
        }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-grid-3 { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .db-side {
            transform: translateX(-100%);
          }
          .db-side.open { transform: translateX(0); }
          .db-overlay.open { display: block; }
          .db-main { margin-left: 0; }
          .db-hamburger { display: flex; }
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-grid-2 { grid-template-columns: 1fr; }
          .db-grid-3 { grid-template-columns: 1fr; }
          .db-content { padding: 20px 16px; }
          .db-topbar { padding: 0 16px; }
        }

        @media (max-width: 480px) {
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-value { font-size: 18px; }
        }
      `}</style>

      <div className="db-root">

        {/* Sidebar */}
        <aside className={`db-side ${sideOpen ? 'open' : ''}`}>
          <div className="db-side-head">
            <div className="db-brand">Kechei</div>
            <div className="db-brand-sub">Client Ledger</div>
          </div>

          <nav className="db-nav">
            {NAV.map(({ key, label, icon, href }) => (
              <button
                key={key}
                className={`db-nav-item ${active === key ? 'active' : ''}`}
                onClick={() => {
                  setActive(key);
                  setSideOpen(false);
                  router.push(href);
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d={icon} />
                </svg>
                {label}
              </button>
            ))}
          </nav>

          <div className="db-side-foot">
            <div className="db-user-name">{user?.name || '—'}</div>
            <div className="db-user-role">{user?.role || 'staff'}</div>
            <button className="db-logout" onClick={logout}>Sign out</button>
          </div>
        </aside>

        {/* Mobile overlay */}
        <div className={`db-overlay ${sideOpen ? 'open' : ''}`} onClick={() => setSideOpen(false)} />

        {/* Main */}
        <div className="db-main">

          {/* Top bar */}
          <header className="db-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="db-hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>
              <span className="db-topbar-title">Dashboard</span>
            </div>
            <span className="db-topbar-date">
              {new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </header>

          <div className="db-content">

            {/* Stat cards */}
            <div className="db-stats">
              {[
                { label: 'Active visits', value: loading ? '—' : String(activeVisits), sub: 'Currently on site' },
                { label: 'Total revenue', value: loading ? '—' : fmt(totalRevenue), sub: 'From paid invoices' },
                { label: 'Outstanding', value: loading ? '—' : fmt(outstanding), sub: `${unpaidCount} unpaid invoice${unpaidCount !== 1 ? 's' : ''}` },
                { label: 'Total invoices', value: loading ? '—' : String(invoices.length), sub: 'All time' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="db-stat" style={{ opacity: mounted ? 1 : 0 }}>
                  <div className="db-stat-label">{label}</div>
                  <div className="db-stat-value">{value}</div>
                  <div className="db-stat-sub">{sub}</div>
                </div>
              ))}
            </div>

            {/* Active visits + Invoice status */}
            <div className="db-grid-3">

              {/* Active visits - FIXED with client names */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Active visits</span>
                  <button 
                    className="db-card-link" 
                    onClick={() => router.push('/visit')}
                  >
                    View all →
                  </button>
                </div>
                {loading ? (
                  <div style={{ padding: '20px' }}>
                    {[1, 2, 3].map(i => <div key={i} className="db-skel" style={{ marginBottom: '12px', width: `${60 + i * 10}%` }} />)}
                  </div>
                ) : visits.length === 0 ? (
                  <div className="db-empty">No active visits</div>
                ) : (
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th className="db-th">Client Name</th>
                        <th className="db-th">Phone</th>
                        <th className="db-th">Check-in Time</th>
                        <th className="db-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.slice(0, 6).map((visit) => (
                        <tr key={visit.id} className="db-tr">
                          <td className="db-td" style={{ fontWeight: 500 }}>
                            {visit.client_name}
                          </td>
                          <td className="db-td db-td-muted">
                            {visit.client_phone}
                          </td>
                          <td className="db-td db-td-muted">
                            {formatDate(visit.check_in || visit.created_at)}
                          </td>
                          <td className="db-td">
                            <span className="db-badge" style={{ color: statusColor(visit.status), background: statusBg(visit.status) }}>
                              {visit.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Invoice status breakdown */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Invoice status</span>
                </div>
                {loading ? (
                  <div style={{ padding: '20px' }}>
                    {[1, 2, 3].map(i => <div key={i} className="db-skel" style={{ marginBottom: '12px' }} />)}
                  </div>
                ) : (
                  <div style={{ padding: '8px 0' }}>
                    {(['paid', 'partial', 'unpaid'] as const).map(s => {
                      const count = invoices.filter(i => i.status === s).length;
                      const total = invoices.length || 1;
                      return (
                        <div key={s} className="db-expbar">
                          <div className="db-expbar-cat" style={{ color: statusColor(s) }}>{s}</div>
                          <div className="db-expbar-track">
                            <div className="db-expbar-fill" style={{ width: `${(count / total) * 100}%`, background: statusColor(s) }} />
                          </div>
                          <div className="db-expbar-val">{count} / {invoices.length}</div>
                        </div>
                      );
                    })}
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>Outstanding balance</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>{fmt(outstanding)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent invoices + Revenue overview */}
            <div className="db-grid-2">

              {/* Recent invoices */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Recent invoices</span>
                  <button 
                    className="db-card-link"
                    onClick={() => router.push('/invoice')}
                  >
                    View all →
                  </button>
                </div>
                {loading ? (
                  <div style={{ padding: '20px' }}>
                    {[1, 2, 3].map(i => <div key={i} className="db-skel" style={{ marginBottom: '12px', width: `${55 + i * 12}%` }} />)}
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="db-empty">No invoices yet</div>
                ) : (
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th className="db-th">Invoice #</th>
                        <th className="db-th">Client</th>
                        <th className="db-th db-th-r">Amount</th>
                        <th className="db-th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.slice(0, 5).map(inv => (
                        <tr key={inv.id} className="db-tr">
                          <td className="db-td db-td-mono">{inv.invoice_number}</td>
                          <td className="db-td">{inv.full_name}</td>
                          <td className="db-td db-td-r" style={{ fontWeight: 500 }}>{fmt(inv.total_amount)}</td>
                          <td className="db-td">
                            <span className="db-badge" style={{ color: statusColor(inv.status), background: statusBg(inv.status) }}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Revenue breakdown */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Revenue overview</span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {[
                    { label: 'Collected', value: totalRevenue, color: 'var(--badge-green-tx)' },
                    { label: 'Partial', value: invoices.filter(i => i.status === 'partial').reduce((s, i) => s + Number(i.total_amount), 0), color: 'var(--badge-amber-tx)' },
                    { label: 'Unpaid', value: invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + Number(i.total_amount), 0), color: 'var(--badge-red-tx)' },
                  ].map(({ label, value, color }) => {
                    const grand = totalRevenue + outstanding || 1;
                    return (
                      <div key={label} className="db-expbar">
                        <div className="db-expbar-cat" style={{ color }}>{label}</div>
                        <div className="db-expbar-track">
                          <div className="db-expbar-fill" style={{ width: `${(value / grand) * 100}%`, background: color }} />
                        </div>
                        <div className="db-expbar-val">{fmt(value)}</div>
                      </div>
                    );
                  })}
                  <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total invoiced</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.4px' }}>
                      {fmt(totalRevenue + outstanding)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
    </ProtectedPage>
  );
}