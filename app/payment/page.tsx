'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPayments, createPayment, deletePayment } from '../API/paymentApi';
import { fetchInvoices } from '../API/invoiceApi';
import ProtectedPage from '../protectedPage';

// ── Types ──
interface User    { id: number; name: string; email: string; role: string; }
interface Invoice {
  id: number;
  invoice_number: string;
  full_name: string;
  total_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  issued_date: string;
}
interface Payment {
  id: number;
  invoice_id: number;
  invoice_number?: string;
  client_full_name?: string;
  amount_paid: number;
  method: string;
  payment_date: string;
  reference?: string;
  notes?: string;
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/dashboard' },
  { key: 'clients',   label: 'Clients',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', href: '/client' },
  { key: 'visits',    label: 'Visits',    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', href: '/visit' },
  { key: 'expenses',  label: 'Expenses',  icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', href: '/expense' },
  { key: 'invoices',  label: 'Invoices',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/invoice' },
  { key: 'payments',  label: 'Payments',  icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', href: '/payments' },
];

const METHODS = ['cash', 'mpesa', 'bank transfer', 'card', 'cheque', 'other'];

const METHOD_COLORS: Record<string, { bg: string; tx: string }> = {
  cash:            { bg: '#eaf4ee', tx: '#2d7a47' },
  mpesa:           { bg: '#e8f5e4', tx: '#1a7a2e' },
  'bank transfer': { bg: '#e8f0fb', tx: '#3a5fa0' },
  card:            { bg: '#f0eafa', tx: '#6a3aaa' },
  cheque:          { bg: '#fef4e4', tx: '#9a6520' },
  other:           { bg: '#f2f2f2', tx: '#606060' },
};

const METHOD_COLORS_DARK: Record<string, { bg: string; tx: string }> = {
  cash:            { bg: 'rgba(50,180,90,0.12)',  tx: '#5cc87a' },
  mpesa:           { bg: 'rgba(30,160,70,0.12)',  tx: '#4dba60' },
  'bank transfer': { bg: 'rgba(80,130,220,0.12)', tx: '#7aaaf0' },
  card:            { bg: 'rgba(130,80,210,0.12)', tx: '#b080f0' },
  cheque:          { bg: 'rgba(200,160,80,0.12)', tx: '#d4a84a' },
  other:           { bg: 'rgba(120,120,120,0.12)',tx: '#909090' },
};

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PaymentsPage() {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [payments, setPayments]   = useState<Payment[]>([]);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sideOpen, setSideOpen]   = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [search, setSearch]       = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]     = useState('');
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [darkMode, setDarkMode]   = useState(false);

  const [form, setForm] = useState({
    invoice_id: '', amount_paid: '', method: '', payment_date: new Date().toISOString().split('T')[0], reference: '', notes: '',
  });

  const headers = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      fetchPayments(),
      fetchInvoices(),
    ]).then(([p, i]) => {
      if (p.status === 'fulfilled') setPayments(p.value);
      if (i.status === 'fulfilled') setInvoices(i.value);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) setUser(JSON.parse(stored));
    // detect dark mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mq.matches);
    mq.addEventListener('change', e => setDarkMode(e.matches));
    load();
  }, []);

  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); };

  const methodColors = (m: string) => {
    const map = darkMode ? METHOD_COLORS_DARK : METHOD_COLORS;
    return map[m] || map.other;
  };

  // ── Derived ──
  const filtered = payments.filter(p => {
    const matchMethod = methodFilter === 'all' || p.method === methodFilter;
    const q = search.toLowerCase();
    const matchSearch = !q
      || (p.client_full_name || '').toLowerCase().includes(q)
      || (p.invoice_number  || '').toLowerCase().includes(q)
      || (p.reference       || '').toLowerCase().includes(q)
      || p.method.toLowerCase().includes(q);
    return matchMethod && matchSearch;
  });

  const totalCollected  = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const todayTotal      = payments.filter(p => new Date(p.payment_date).toDateString() === new Date().toDateString()).reduce((s, p) => s + Number(p.amount_paid), 0);
  const monthTotal      = payments.filter(p => {
    const d = new Date(p.payment_date); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + Number(p.amount_paid), 0);

  // by method breakdown
  const byMethod = METHODS.map(m => ({
    method: m,
    total: payments.filter(p => p.method === m).reduce((s, p) => s + Number(p.amount_paid), 0),
    count: payments.filter(p => p.method === m).length,
  })).filter(m => m.count > 0).sort((a, b) => b.total - a.total);

  const maxMethod = byMethod[0]?.total || 1;

  // selected invoice balance info
  const selectedInvoice = invoices.find(i => i.id === Number(form.invoice_id));
  const alreadyPaid = payments.filter(p => p.invoice_id === Number(form.invoice_id)).reduce((s, p) => s + Number(p.amount_paid), 0);
  const balance = selectedInvoice ? Number(selectedInvoice.total_amount) - alreadyPaid : 0;

  // ── Submit ──
  const handleSubmit = async () => {
    if (!form.invoice_id) { setFormErr('Please select an invoice.'); return; }
    if (!form.method)     { setFormErr('Please select a payment method.'); return; }
    if (!form.amount_paid || isNaN(Number(form.amount_paid)) || Number(form.amount_paid) <= 0) {
      setFormErr('Enter a valid amount.'); return;
    }
    setSubmitting(true); setFormErr('');
    try {
      await createPayment({
        invoice_id:   Number(form.invoice_id),
        amount_paid:  Number(form.amount_paid),
        method:       form.method,
        payment_date: form.payment_date,
        ...(form.reference && { reference: form.reference }),
        ...(form.notes     && { notes:     form.notes }),
      });
      setShowModal(false);
      setForm({ invoice_id: '', amount_paid: '', method: '', payment_date: new Date().toISOString().split('T')[0], reference: '', notes: '' });
      load();
    } catch (err: any) {
      setFormErr(err.message || 'Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

 const handleDelete = async (id: number) => {
    setDeleteId(id);
    try {
      await deletePayment(id);
      load();
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment.');
    } finally {
      setDeleteId(null);
    }
};

  // unpaid / partial invoices only (can still receive payments)
  const payableInvoices = invoices.filter(i => i.status !== 'paid');

  return (
    <ProtectedPage>
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --bg: #f2efe9; --surface: #ffffff; --surface-2: #f8f6f2; --border: #e5e0d8;
          --sidebar-bg: #1a1712; --sidebar-border: #2a2620; --sidebar-text: #a09880;
          --sidebar-active: #ffffff; --sidebar-act-bg: rgba(255,255,255,0.08);
          --text: #1a1714; --text-2: #6b6456; --text-3: #b0a898;
          --accent: #b07a42; --accent-h: #c48d55; --dot: rgba(0,0,0,0.05);
          --badge-green-bg: #eaf4ee; --badge-green-tx: #2d7a47;
          --badge-amber-bg: #fef4e4; --badge-amber-tx: #9a6520;
          --badge-red-bg: #fdeeed; --badge-red-tx: #b03030;
          --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #0c0c0c; --surface: #141414; --surface-2: #1a1a1a; --border: #222222;
            --sidebar-bg: #0e0e0e; --sidebar-border: #1a1a1a; --sidebar-text: #4a4a4a;
            --sidebar-active: #ffffff; --sidebar-act-bg: rgba(255,255,255,0.07);
            --text: #e0e0e0; --text-2: #686868; --text-3: #383838;
            --accent: #c9a96e; --accent-h: #dbbf85; --dot: rgba(255,255,255,0.04);
            --badge-green-bg: rgba(50,180,90,0.1); --badge-green-tx: #5cc87a;
            --badge-amber-bg: rgba(200,160,80,0.1); --badge-amber-tx: #d4a84a;
            --badge-red-bg: rgba(200,70,70,0.1); --badge-red-tx: #e07070;
            --shadow: 0 1px 3px rgba(0,0,0,0.3);
          }
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }

        .db-root { font-family: 'DM Mono', monospace; display: flex; min-height: 100vh; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
        .db-root::before { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; background-image: radial-gradient(circle, var(--dot) 1px, transparent 1px); background-size: 28px 28px; }

        /* ── Sidebar ── */
        .db-side { width: 220px; flex-shrink: 0; background: var(--sidebar-bg); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 40; transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
        .db-side-head { padding: 28px 20px 24px; border-bottom: 1px solid var(--sidebar-border); }
        .db-brand { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: #fff; letter-spacing: -0.8px; }
        .db-brand-sub { font-size: 9px; color: #383430; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 3px; }
        .db-nav { flex: 1; padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .db-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 12px; color: var(--sidebar-text); cursor: pointer; transition: background 0.15s, color 0.15s; letter-spacing: 0.02em; border: none; background: none; width: 100%; text-align: left; }
        .db-nav-item:hover { background: rgba(255,255,255,0.05); color: #d4cfc8; }
        .db-nav-item.active { background: var(--sidebar-act-bg); color: var(--sidebar-active); }
        .db-nav-item svg { opacity: 0.5; flex-shrink: 0; transition: opacity 0.15s; }
        .db-nav-item.active svg, .db-nav-item:hover svg { opacity: 1; }
        .db-side-foot { padding: 16px 20px; border-top: 1px solid var(--sidebar-border); }
        .db-user-name { font-size: 12px; color: #706a62; }
        .db-user-role { font-size: 10px; color: #403c38; margin-top: 2px; text-transform: capitalize; letter-spacing: 0.06em; }
        .db-logout { margin-top: 12px; font-size: 10px; color: #4a4640; background: none; border: none; cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase; transition: color 0.15s; padding: 0; }
        .db-logout:hover { color: #c9a96e; }

        /* ── Main ── */
        .db-main { flex: 1; margin-left: 220px; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 100vh; }
        .db-topbar { position: sticky; top: 0; z-index: 30; background: var(--bg); border-bottom: 1px solid var(--border); padding: 0 32px; height: 60px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(8px); }
        .db-topbar-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-topbar-date { font-size: 10px; color: var(--text-3); letter-spacing: 0.08em; }
        .db-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--text); padding: 4px; }
        .db-content { padding: 32px; flex: 1; }

        /* ── Stats ── */
        .db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; animation: db-up 0.5s ease 0.05s both; }
        .db-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 22px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .db-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); opacity: 0.4; }
        .db-stat:first-child::before { opacity: 1; }
        .db-stat-label { font-size: 9px; color: var(--text-2); letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 10px; }
        .db-stat-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.8px; line-height: 1; }
        .db-stat-sub { font-size: 10px; color: var(--text-3); margin-top: 6px; }

        /* ── Layout ── */
        .db-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; animation: db-up 0.5s ease 0.1s both; }

        /* ── Card ── */
        .db-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
        .db-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .db-card-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .db-card-count { font-size: 10px; color: var(--text-3); letter-spacing: 0.06em; }

        /* ── Toolbar ── */
        .db-toolbar { display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
        .db-search { flex: 1; min-width: 160px; max-width: 280px; display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; height: 34px; }
        .db-search svg { opacity: 0.35; flex-shrink: 0; }
        .db-search input { border: none; background: none; outline: none; font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text); flex: 1; }
        .db-search input::placeholder { color: var(--text-3); }

        .db-method-chips { display: flex; gap: 5px; flex-wrap: wrap; }
        .db-chip { height: 28px; padding: 0 10px; border-radius: 20px; font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: 0.03em; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; transition: all 0.15s; text-transform: capitalize; white-space: nowrap; }
        .db-chip:hover { color: var(--text); }
        .db-chip.active { color: #fff; border-color: transparent; background: var(--accent); }

        .db-btn-primary { height: 34px; padding: 0 14px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--accent); color: #fff; border: none; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px; white-space: nowrap; margin-left: auto; }
        .db-btn-primary:hover { background: var(--accent-h); }
        .db-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ── Table ── */
        .db-table { width: 100%; border-collapse: collapse; }
        .db-th { text-align: left; padding: 10px 20px; font-size: 9px; color: var(--text-3); letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid var(--border); font-weight: 500; }
        .db-th-r { text-align: right; }
        .db-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
        .db-tr:last-child { border-bottom: none; }
        .db-tr:hover { background: var(--surface-2); }
        .db-td { padding: 12px 20px; font-size: 12px; color: var(--text); vertical-align: middle; }
        .db-td-muted { color: var(--text-2); }
        .db-td-r { text-align: right; }
        .db-td-mono { font-size: 11px; color: var(--text-2); }

        /* Method badge */
        .db-method-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 5px; font-size: 10px; font-weight: 500; letter-spacing: 0.04em; text-transform: capitalize; }

        /* Method icon dot */
        .db-method-icon { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.8; flex-shrink: 0; }

        /* Invoice number pill */
        .db-inv-pill { font-family: 'DM Mono', monospace; font-size: 10px; padding: 3px 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); }

        .db-del-btn { background: none; border: none; cursor: pointer; color: var(--text-3); padding: 4px; border-radius: 4px; transition: color 0.15s, background 0.15s; line-height: 1; }
        .db-del-btn:hover { color: var(--badge-red-tx); background: var(--badge-red-bg); }
        .db-del-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .db-empty { padding: 48px 20px; text-align: center; font-size: 12px; color: var(--text-3); }

        /* ── Breakdown bars ── */
        .db-expbar { padding: 12px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
        .db-expbar:last-child { border-bottom: none; }
        .db-expbar-cat { width: 96px; font-size: 11px; text-transform: capitalize; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .db-expbar-track { flex: 1; height: 5px; background: var(--border); border-radius: 99px; overflow: hidden; }
        .db-expbar-fill { height: 100%; border-radius: 99px; transition: width 0.7s cubic-bezier(0.16,1,0.3,1); }
        .db-expbar-val { font-size: 11px; color: var(--text-2); width: 88px; text-align: right; flex-shrink: 0; }

        /* ── Recent activity timeline (right panel bottom) ── */
        .db-timeline { padding: 0 20px 8px; }
        .db-tl-item { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); position: relative; }
        .db-tl-item:last-child { border-bottom: none; }
        .db-tl-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; margin-top: 4px; }
        .db-tl-name { font-size: 12px; color: var(--text); font-weight: 500; }
        .db-tl-meta { font-size: 10px; color: var(--text-3); margin-top: 2px; }
        .db-tl-amt { font-size: 12px; color: var(--accent); font-weight: 600; margin-left: auto; white-space: nowrap; padding-left: 8px; }

        @keyframes db-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .db-skel { background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%); background-size: 800px 100%; animation: db-shimmer 1.4s infinite; border-radius: 4px; height: 12px; }

        /* ── Modal ── */
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
        .db-textarea { resize: vertical; min-height: 68px; }
        .db-err { font-size: 11px; color: var(--badge-red-tx); }
        .db-btn-secondary { height: 36px; padding: 0 16px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; background: none; border: 1px solid var(--border); color: var(--text-2); cursor: pointer; transition: all 0.15s; }
        .db-btn-secondary:hover { color: var(--text); border-color: var(--text-2); }

        /* balance info box */
        .db-balance-box { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border); font-size: 11px; color: var(--text-2); }
        .db-balance-val { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--accent); letter-spacing: -0.3px; }

        /* method grid in form */
        .db-method-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .db-method-opt { padding: 8px 6px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-2); font-family: 'DM Mono', monospace; font-size: 10px; color: var(--text-2); cursor: pointer; transition: all 0.15s; text-align: center; text-transform: capitalize; }
        .db-method-opt:hover { border-color: var(--accent); color: var(--text); }
        .db-method-opt.selected { border-color: var(--accent); background: var(--accent); color: #fff; }

        .db-side-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 35; }
        @keyframes db-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1100px) { .db-stats { grid-template-columns: repeat(2, 1fr); } .db-layout { grid-template-columns: 1fr; } }
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
          .db-table th:nth-child(4), .db-table td:nth-child(4),
          .db-table th:nth-child(5), .db-table td:nth-child(5) { display: none; }
        }
        @media (max-width: 480px) {
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-value { font-size: 18px; }
          .db-field-row { grid-template-columns: 1fr; }
          .db-method-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div className="db-root">
        {/* ── Sidebar ── */}
        <aside className={`db-side ${sideOpen ? 'open' : ''}`}>
          <div className="db-side-head">
            <div className="db-brand">Kechei</div>
            <div className="db-brand-sub">Client Ledger</div>
          </div>
          <nav className="db-nav">
            {NAV.map(({ key, label, icon, href }) => (
              <button key={key} className={`db-nav-item ${key === 'payments' ? 'active' : ''}`} onClick={() => { setSideOpen(false); router.push(href); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={icon} /></svg>
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
        <div className={`db-side-overlay ${sideOpen ? 'open' : ''}`} onClick={() => setSideOpen(false)} />

        {/* ── Main ── */}
        <div className="db-main">
          <header className="db-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="db-hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
              </button>
              <span className="db-topbar-title">Payments</span>
            </div>
            <span className="db-topbar-date">{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </header>

          <div className="db-content">

            {/* ── Stat cards ── */}
            <div className="db-stats">
              {[
                { label: 'Total collected',  value: loading ? '—' : fmt(totalCollected), sub: `${payments.length} payment${payments.length !== 1 ? 's' : ''}` },
                { label: 'Received today',   value: loading ? '—' : fmt(todayTotal),     sub: new Date().toLocaleDateString('en-KE', { weekday: 'long' }) },
                { label: 'This month',       value: loading ? '—' : fmt(monthTotal),     sub: new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' }) },
                { label: 'Methods used',     value: loading ? '—' : String(byMethod.length), sub: `of ${METHODS.length} available` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="db-stat" style={{ opacity: mounted ? 1 : 0 }}>
                  <div className="db-stat-label">{label}</div>
                  <div className="db-stat-value">{value}</div>
                  <div className="db-stat-sub">{sub}</div>
                </div>
              ))}
            </div>

            {/* ── Main layout ── */}
            <div className="db-layout">

              {/* ── Left: payments table ── */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Payment records</span>
                  <span className="db-card-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Toolbar */}
                <div className="db-toolbar">
                  <div className="db-search">
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                    <input type="text" placeholder="Search payments…" value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>✕</button>}
                  </div>

                  <div className="db-method-chips">
                    <button className={`db-chip ${methodFilter === 'all' ? 'active' : ''}`} onClick={() => setMethodFilter('all')}>All</button>
                    {METHODS.map(m => (
                      <button key={m} className={`db-chip ${methodFilter === m ? 'active' : ''}`}
                        style={methodFilter === m ? { background: methodColors(m).tx, borderColor: methodColors(m).tx } : {}}
                        onClick={() => setMethodFilter(methodFilter === m ? 'all' : m)}>
                        {m}
                      </button>
                    ))}
                  </div>

                  <button className="db-btn-primary" onClick={() => setShowModal(true)}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                    <span>Record payment</span>
                  </button>
                </div>

                {loading ? (
                  <div style={{ padding: '24px 20px' }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '16px' }}>
                        <div className="db-skel" style={{ width: '20%' }} />
                        <div className="db-skel" style={{ width: '25%' }} />
                        <div className="db-skel" style={{ width: '16%' }} />
                        <div className="db-skel" style={{ width: '18%' }} />
                        <div className="db-skel" style={{ width: '12%' }} />
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="db-empty">{search || methodFilter !== 'all' ? 'No payments match your filters' : 'No payments recorded yet'}</div>
                ) : (
                  <table className="db-table">
                    <thead>
                      <tr>
                        <th className="db-th">Invoice</th>
                        <th className="db-th">Client</th>
                        <th className="db-th">Method</th>
                        <th className="db-th">Date</th>
                        <th className="db-th">Ref</th>
                        <th className="db-th db-th-r">Amount</th>
                        <th className="db-th" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => {
                        const mc = methodColors(p.method);
                        return (
                          <tr key={p.id} className="db-tr">
                            <td className="db-td">
                              <span className="db-inv-pill">{p.invoice_number || `#${p.invoice_id}`}</span>
                            </td>
                            <td className="db-td" style={{ fontWeight: 500 }}>{p.client_full_name || '—'}</td>
                            <td className="db-td">
                              <span className="db-method-badge" style={{ background: mc.bg, color: mc.tx }}>
                                <span className="db-method-icon" />
                                {p.method}
                              </span>
                            </td>
                            <td className="db-td db-td-mono">{fmtDate(p.payment_date)}</td>
                            <td className="db-td db-td-muted" style={{ fontSize: '11px' }}>
                              {p.reference ? <span style={{ fontFamily: 'DM Mono, monospace', letterSpacing: '0.02em' }}>{p.reference}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                            </td>
                            <td className="db-td db-td-r" style={{ fontWeight: 600 }}>{fmt(p.amount_paid)}</td>
                            <td className="db-td" style={{ textAlign: 'right', paddingRight: '16px' }}>
                              <button className="db-del-btn" disabled={deleteId === p.id} onClick={() => handleDelete(p.id)} title="Delete">
                                {deleteId === p.id
                                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
                                }
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ── Right panel ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* By method breakdown */}
                <div className="db-card" style={{ alignSelf: 'start' }}>
                  <div className="db-card-head">
                    <span className="db-card-title">By method</span>
                  </div>
                  {loading ? (
                    <div style={{ padding: '20px' }}>
                      {[1,2,3].map(i => <div key={i} className="db-skel" style={{ marginBottom: '14px' }} />)}
                    </div>
                  ) : byMethod.length === 0 ? (
                    <div className="db-empty">No data yet</div>
                  ) : (
                    <div style={{ padding: '8px 0' }}>
                      {byMethod.map(({ method, total, count }) => {
                        const mc = methodColors(method);
                        return (
                          <div key={method} className="db-expbar">
                            <div className="db-expbar-cat" style={{ color: mc.tx }}>{method}</div>
                            <div className="db-expbar-track">
                              <div className="db-expbar-fill" style={{ width: `${(total / maxMethod) * 100}%`, background: mc.tx }} />
                            </div>
                            <div className="db-expbar-val">{fmt(total)}</div>
                          </div>
                        );
                      })}
                      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total collected</div>
                        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.4px' }}>{fmt(totalCollected)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent payments mini-feed */}
                <div className="db-card">
                  <div className="db-card-head">
                    <span className="db-card-title">Recent activity</span>
                  </div>
                  {loading ? (
                    <div style={{ padding: '20px' }}>
                      {[1,2,3].map(i => <div key={i} className="db-skel" style={{ marginBottom: '14px' }} />)}
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="db-empty">No payments yet</div>
                  ) : (
                    <div className="db-timeline">
                      {[...payments].sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).slice(0, 6).map(p => {
                        const mc = methodColors(p.method);
                        return (
                          <div key={p.id} className="db-tl-item">
                            <div className="db-tl-dot" style={{ background: mc.tx }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="db-tl-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.client_full_name || `Invoice #${p.invoice_id}`}</div>
                              <div className="db-tl-meta">
                                <span style={{ color: mc.tx, textTransform: 'capitalize' }}>{p.method}</span>
                                {' · '}{fmtDate(p.payment_date)}
                              </div>
                            </div>
                            <div className="db-tl-amt">{fmt(p.amount_paid)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Record Payment Modal ── */}
      {showModal && (
        <div className="db-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setFormErr(''); } }}>
          <div className="db-modal">
            <div className="db-modal-head">
              <span className="db-modal-title">Record payment</span>
              <button className="db-modal-close" onClick={() => { setShowModal(false); setFormErr(''); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="db-modal-body">

              {/* Invoice selector */}
              <div className="db-field">
                <label className="db-label">Invoice *</label>
                <select className="db-select" value={form.invoice_id} onChange={e => setForm(f => ({ ...f, invoice_id: e.target.value, amount_paid: '' }))}>
                  <option value="">Select an invoice…</option>
                  {payableInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.full_name} ({fmt(inv.total_amount)})
                    </option>
                  ))}
                  {invoices.filter(i => i.status === 'paid').length > 0 && (
                    <>
                      <option disabled>── Paid invoices ──</option>
                      {invoices.filter(i => i.status === 'paid').map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} — {inv.full_name} (paid)
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* Balance info */}
              {selectedInvoice && (
                <div className="db-balance-box">
                  <div>
                    <div style={{ marginBottom: '2px' }}>Balance remaining</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                      {fmt(selectedInvoice.total_amount)} total · {fmt(alreadyPaid)} paid
                    </div>
                  </div>
                  <div className="db-balance-val">{fmt(Math.max(0, balance))}</div>
                </div>
              )}

              {/* Amount + date */}
              <div className="db-field-row">
                <div className="db-field">
                  <label className="db-label">Amount (KES) *</label>
                  <input className="db-input" type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  {selectedInvoice && balance > 0 && (
                    <button onClick={() => setForm(f => ({ ...f, amount_paid: String(balance) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: 'var(--accent)', textAlign: 'left', padding: '2px 0' }}>
                      ↑ Fill balance ({fmt(balance)})
                    </button>
                  )}
                </div>
                <div className="db-field">
                  <label className="db-label">Payment date *</label>
                  <input className="db-input" type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
                </div>
              </div>

              {/* Method grid */}
              <div className="db-field">
                <label className="db-label">Payment method *</label>
                <div className="db-method-grid">
                  {METHODS.map(m => (
                    <button key={m} className={`db-method-opt ${form.method === m ? 'selected' : ''}`}
                      style={form.method === m ? { background: methodColors(m).tx, borderColor: methodColors(m).tx } : {}}
                      onClick={() => setForm(f => ({ ...f, method: f.method === m ? '' : m }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference */}
              <div className="db-field">
                <label className="db-label">Reference / Transaction ID (optional)</label>
                <input className="db-input" type="text" placeholder="e.g. MPESA code, bank ref…"
                  value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>

              {/* Notes */}
              <div className="db-field">
                <label className="db-label">Notes (optional)</label>
                <textarea className="db-textarea" placeholder="Any additional notes…"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {formErr && <div className="db-err">{formErr}</div>}
            </div>

            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={() => { setShowModal(false); setFormErr(''); }}>Cancel</button>
              <button className="db-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ margin: 0 }}>
                {submitting ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
    </ProtectedPage>
  );
}