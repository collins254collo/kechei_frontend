'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchInvoices, generateInvoiceFromVisit, updateInvoice, createInvoice, CreateInvoicePayload } from '../API/invoiceApi';
import { fetchClients } from '../API/clientApi';
import { fetchVisits } from '../API/visitApi';

//  Types 
interface User    { id: number; name: string; email: string; role: string; }
interface Client  { id: number; full_name: string; phone: string; email?: string; }
interface Visit {
  id: number;
  client_id: number;
  client_name?: string;
  full_name?: string;
  reason: string;
  status: 'active' | 'completed';
  created_at?: string;
  check_in?: string;
}
interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  visit_id?: number;
  full_name: string;
  total_amount: number;
  total_expenses: number;
  status: 'unpaid' | 'partial' | 'paid';
  issued_date: string;
  due_date?: string;
  notes?: string;
}

const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/dashboard' },
  { key: 'clients',   label: 'Clients',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', href: '/client' },
  { key: 'visits',    label: 'Visits',    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', href: '/visit' },
  { key: 'expenses',  label: 'Expenses',  icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', href: '/expense' },
  { key: 'invoices',  label: 'Invoices',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/invoice' },
  { key: 'payments',  label: 'Payments',  icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', href: '/payment' },
];

const STATUS_FILTERS = ['all', 'unpaid', 'partial', 'paid'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }
function fmtDate(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function InvoicesPage() {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [visits, setVisits]       = useState<Visit[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sideOpen, setSideOpen]   = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [detailInv, setDetailInv] = useState<Invoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr]     = useState('');
  const [markingId, setMarkingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    client_id: '', visit_id: '', total_amount: '', issued_date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
  });

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      fetchInvoices(),
      fetchClients(),
      fetchVisits(),
    ]).then(([inv, cl, vi]) => {
      if (inv.status === 'fulfilled') setInvoices(inv.value);
      else console.error('invoices failed:', inv.reason);
      if (cl.status === 'fulfilled')  setClients(cl.value);
      else console.error('clients failed:', cl.reason);
      if (vi.status === 'fulfilled')  setVisits(vi.value as Visit[]);
      else console.error('visits failed:', vi.reason);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) { try { setUser(JSON.parse(stored)); } catch {} }
    load();
  }, []);

  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); };

  //  Derived 
  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || (inv.full_name || '').toLowerCase().includes(q) || (inv.invoice_number || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
  const outstanding  = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total_amount), 0);
  const paidCount    = invoices.filter(i => i.status === 'paid').length;
  const unpaidCount  = invoices.filter(i => i.status === 'unpaid').length;

  const statusColor = (s: string) => {
    if (s === 'paid')    return 'var(--badge-green-tx)';
    if (s === 'partial') return 'var(--badge-amber-tx)';
    return 'var(--badge-red-tx)';
  };
  const statusBg = (s: string) => {
    if (s === 'paid')    return 'var(--badge-green-bg)';
    if (s === 'partial') return 'var(--badge-amber-bg)';
    return 'var(--badge-red-bg)';
  };

  // filtered visits for selected client
  const clientVisits = visits.filter(v => form.client_id && Number(v.client_id) === Number(form.client_id));

  //  Create invoice 
  const handleSubmit = async () => {
  if (!form.client_id) { setFormErr('Please select a client.'); return; }
  if (!form.visit_id && (!form.total_amount || isNaN(Number(form.total_amount)) || Number(form.total_amount) <= 0)) {
    setFormErr('Enter a valid amount.');
    return;
  }

  setSubmitting(true);
  setFormErr('');

  try {
    let data: Invoice;

    if (form.visit_id) {
      // Generate from visit — only send what the endpoint needs
      data = await generateInvoiceFromVisit({
        visit_id: Number(form.visit_id),
        ...(form.due_date && { due_date: form.due_date }),
        ...(form.notes && { notes: form.notes }),
        client_id: 0,
        total_amount: 0,
        issued_date: ''
      });
    } else {
      // Manual invoice
      data = await createInvoice({
        client_id:    Number(form.client_id),
        total_amount: Number(form.total_amount),
        issued_date:  form.issued_date,
        ...(form.due_date && { due_date: form.due_date }),
        ...(form.notes    && { notes:    form.notes }),
      });
    }

    setInvoices(prev => [data, ...prev]);
    setShowModal(false);
    setForm({ client_id: '', visit_id: '', total_amount: '', issued_date: new Date().toISOString().split('T')[0], due_date: '', notes: '' });
  } catch (err: any) {
    setFormErr(err.message || 'Network error. Try again.');
  } finally {
    setSubmitting(false);
  }
};

  //  Mark as paid 
  const markPaid = async (inv: Invoice) => {
    setMarkingId(inv.id);
    try {
      const updated = await updateInvoice(inv.id, { status: 'paid' });
      setInvoices(prev => prev.map(i => i.id === inv.id ? updated : i));
      if (detailInv?.id === inv.id) setDetailInv(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to update invoice.');
    } finally {
      setMarkingId(null);
    }
  };

  return (
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

        .db-main { flex: 1; margin-left: 220px; display: flex; flex-direction: column; position: relative; z-index: 1; min-height: 100vh; }
        .db-topbar { position: sticky; top: 0; z-index: 30; background: var(--bg); border-bottom: 1px solid var(--border); padding: 0 32px; height: 60px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(8px); }
        .db-topbar-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-topbar-date { font-size: 10px; color: var(--text-3); letter-spacing: 0.08em; }
        .db-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--text); padding: 4px; }
        .db-content { padding: 32px; flex: 1; }

        .db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; animation: db-up 0.5s ease 0.05s both; }
        .db-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 22px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .db-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); opacity: 0.4; }
        .db-stat:first-child::before { opacity: 1; }
        .db-stat-label { font-size: 9px; color: var(--text-2); letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 10px; }
        .db-stat-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.8px; line-height: 1; }
        .db-stat-sub { font-size: 10px; color: var(--text-3); margin-top: 6px; }

        .db-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; animation: db-up 0.5s ease 0.1s both; }
        .db-search { flex: 1; min-width: 180px; max-width: 300px; display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; height: 36px; }
        .db-search svg { opacity: 0.35; flex-shrink: 0; }
        .db-search input { border: none; background: none; outline: none; font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text); flex: 1; }
        .db-search input::placeholder { color: var(--text-3); }
        .db-filters { display: flex; gap: 4px; }
        .db-filter-btn { height: 36px; padding: 0 14px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.04em; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; transition: all 0.15s; text-transform: capitalize; }
        .db-filter-btn:hover { color: var(--text); }
        .db-filter-btn.active-paid    { background: var(--badge-green-bg); border-color: var(--badge-green-tx); color: var(--badge-green-tx); }
        .db-filter-btn.active-partial { background: var(--badge-amber-bg); border-color: var(--badge-amber-tx); color: var(--badge-amber-tx); }
        .db-filter-btn.active-unpaid  { background: var(--badge-red-bg);   border-color: var(--badge-red-tx);   color: var(--badge-red-tx); }
        .db-filter-btn.active-all     { background: var(--accent); border-color: var(--accent); color: #fff; }
        .db-btn-primary { height: 36px; padding: 0 16px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--accent); color: #fff; border: none; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px; white-space: nowrap; margin-left: auto; }
        .db-btn-primary:hover { background: var(--accent-h); }
        .db-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .db-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; animation: db-up 0.5s ease 0.15s both; }
        .db-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .db-card-title { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .db-card-count { font-size: 10px; color: var(--text-3); letter-spacing: 0.06em; }

        .db-table { width: 100%; border-collapse: collapse; }
        .db-th { text-align: left; padding: 10px 20px; font-size: 9px; color: var(--text-3); letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid var(--border); font-weight: 500; }
        .db-th-r { text-align: right; }
        .db-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; cursor: pointer; }
        .db-tr:last-child { border-bottom: none; }
        .db-tr:hover { background: var(--surface-2); }
        .db-td { padding: 12px 20px; font-size: 12px; color: var(--text); vertical-align: middle; }
        .db-td-muted { color: var(--text-2); }
        .db-td-r { text-align: right; }
        .db-td-mono { font-size: 11px; color: var(--text-2); font-family: 'DM Mono', monospace; }

        .db-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 500; letter-spacing: 0.04em; text-transform: capitalize; }
        .db-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.7; }

        .db-mark-btn { height: 26px; padding: 0 10px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 10px; background: none; border: 1px solid var(--badge-green-tx); color: var(--badge-green-tx); cursor: pointer; transition: all 0.15s; white-space: nowrap; opacity: 0.7; }
        .db-mark-btn:hover { opacity: 1; background: var(--badge-green-bg); }
        .db-mark-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .db-empty { padding: 48px 20px; text-align: center; font-size: 12px; color: var(--text-3); }

        @keyframes db-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .db-skel { background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%); background-size: 800px 100%; animation: db-shimmer 1.4s infinite; border-radius: 4px; height: 12px; }

        .db-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; animation: db-fade 0.2s ease; }
        @keyframes db-fade { from { opacity: 0; } to { opacity: 1; } }
        .db-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 480px; box-shadow: 0 24px 48px rgba(0,0,0,0.15); overflow: hidden; animation: db-slide 0.25s cubic-bezier(0.16,1,0.3,1); }
        .db-modal-lg { max-width: 560px; }
        @keyframes db-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .db-modal-head { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .db-modal-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-modal-close { background: none; border: none; cursor: pointer; color: var(--text-3); transition: color 0.15s; padding: 2px; }
        .db-modal-close:hover { color: var(--text); }
        .db-modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
        .db-modal-foot { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }
        .db-field { display: flex; flex-direction: column; gap: 6px; }
        .db-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .db-label { font-size: 9px; color: var(--text-2); letter-spacing: 0.14em; text-transform: uppercase; }
        .db-select, .db-input, .db-textarea { font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; outline: none; width: 100%; transition: border-color 0.15s; }
        .db-select:focus, .db-input:focus, .db-textarea:focus { border-color: var(--accent); }
        .db-textarea { resize: vertical; min-height: 72px; }
        .db-err { font-size: 11px; color: var(--badge-red-tx); background: var(--badge-red-bg); padding: 8px 12px; border-radius: 6px; }
        .db-btn-secondary { height: 36px; padding: 0 16px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: 0.04em; background: none; border: 1px solid var(--border); color: var(--text-2); cursor: pointer; transition: all 0.15s; }
        .db-btn-secondary:hover { color: var(--text); border-color: var(--text-2); }

        .db-detail-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
        .db-detail-row:last-child { border-bottom: none; }
        .db-detail-key { color: var(--text-2); font-size: 11px; }
        .db-detail-val { color: var(--text); font-weight: 500; text-align: right; }

        .db-inv-number { font-family: 'DM Mono', monospace; font-size: 11px; padding: 4px 10px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); letter-spacing: 0.04em; }

        .db-hint { font-size: 10px; color: var(--text-3); padding: 8px 12px; background: var(--surface-2); border-radius: 6px; border: 1px solid var(--border); }

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
          .db-table th:nth-child(4), .db-table td:nth-child(4) { display: none; }
        }
        @media (max-width: 480px) {
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-value { font-size: 18px; }
          .db-field-row { grid-template-columns: 1fr; }
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
              <button key={key} className={`db-nav-item ${key === 'invoices' ? 'active' : ''}`} onClick={() => { setSideOpen(false); router.push(href); }}>
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

        {/* Main */}
        <div className="db-main">
          <header className="db-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button className="db-hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
              </button>
              <span className="db-topbar-title">Invoices</span>
            </div>
            <span className="db-topbar-date">{new Date().toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </header>

          <div className="db-content">
            {/* Stat cards */}
            <div className="db-stats">
              {[
                { label: 'Revenue collected', value: loading ? '—' : fmt(totalRevenue),             sub: `${paidCount} paid invoice${paidCount !== 1 ? 's' : ''}` },
                { label: 'Outstanding',        value: loading ? '—' : fmt(outstanding),              sub: `${unpaidCount} unpaid` },
                { label: 'Total invoiced',     value: loading ? '—' : fmt(totalRevenue + outstanding), sub: 'All time' },
                { label: 'Total invoices',     value: loading ? '—' : String(invoices.length),       sub: 'All records' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="db-stat" style={{ opacity: mounted ? 1 : 0 }}>
                  <div className="db-stat-label">{label}</div>
                  <div className="db-stat-value">{value}</div>
                  <div className="db-stat-sub">{sub}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="db-toolbar">
              <div className="db-search">
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input type="text" placeholder="Search by client or invoice #…" value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>✕</button>}
              </div>
              <div className="db-filters">
                {STATUS_FILTERS.map(s => (
                  <button key={s} className={`db-filter-btn ${statusFilter === s ? `active-${s}` : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
                ))}
              </div>
              <button className="db-btn-primary" onClick={() => setShowModal(true)}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                <span>New invoice</span>
              </button>
            </div>

            {/* Invoices table */}
            <div className="db-card">
              <div className="db-card-head">
                <span className="db-card-title">
                  {statusFilter === 'all' ? 'All invoices' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} invoices`}
                </span>
                <span className="db-card-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {loading ? (
                <div style={{ padding: '24px 20px' }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                      <div className="db-skel" style={{ width: '16%' }} />
                      <div className="db-skel" style={{ width: '22%' }} />
                      <div className="db-skel" style={{ width: '18%' }} />
                      <div className="db-skel" style={{ width: '14%' }} />
                      <div className="db-skel" style={{ width: '10%' }} />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="db-empty">{search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}</div>
              ) : (
                <table className="db-table">
                  <thead>
                    <tr>
                      <th className="db-th">Invoice #</th>
                      <th className="db-th">Client</th>
                      <th className="db-th">Issued</th>
                      <th className="db-th">Due</th>
                      <th className="db-th db-th-r">Amount</th>
                      <th className="db-th">Status</th>
                      <th className="db-th" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(inv => (
                      <tr key={inv.id} className="db-tr" onClick={() => setDetailInv(inv)}>
                        <td className="db-td"><span className="db-inv-number">{inv.invoice_number}</span></td>
                        <td className="db-td" style={{ fontWeight: 500 }}>{inv.full_name}</td>
                        <td className="db-td db-td-mono">{fmtDate(inv.issued_date)}</td>
                        <td className="db-td db-td-mono">{inv.due_date ? fmtDate(inv.due_date) : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td className="db-td db-td-r" style={{ fontWeight: 600 }}>{fmt(inv.total_amount)}</td>
                        <td className="db-td">
                          <span className="db-badge" style={{ color: statusColor(inv.status), background: statusBg(inv.status) }}>{inv.status}</span>
                        </td>
                        <td className="db-td" style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          {inv.status !== 'paid' && (
                            <button className="db-mark-btn" disabled={markingId === inv.id} onClick={() => markPaid(inv)}>
                              {markingId === inv.id ? '…' : '✓ Paid'}
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

      {/* New Invoice Modal */}
      {showModal && (
        <div className="db-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setFormErr(''); } }}>
          <div className="db-modal">
            <div className="db-modal-head">
              <span className="db-modal-title">New invoice</span>
              <button className="db-modal-close" onClick={() => { setShowModal(false); setFormErr(''); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="db-modal-body">

              {/* Client */}
              <div className="db-field">
                <label className="db-label">Client *</label>
                <select
                  className="db-select"
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value, visit_id: '' }))}
                >
                  <option value="">Select a client…</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>
                  ))}
                </select>
              </div>

              {/* Linked visit — only show when client selected and has visits */}
              {form.client_id && (
                <div className="db-field">
                  <label className="db-label">Linked visit (optional)</label>
                  {clientVisits.length === 0 ? (
                    <div className="db-hint">No visits found for this client.</div>
                  ) : (
                    <select
                      className="db-select"
                      value={form.visit_id}
                      onChange={e => setForm(f => ({ ...f, visit_id: e.target.value }))}
                    >
                      <option value="">None — manual invoice</option>
                      {clientVisits.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.created_at
                            ? new Date(v.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
                            : v.check_in
                            ? new Date(v.check_in).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
                            : `Visit #${v.id}`
                          } — {v.status}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Amount — hidden when generating from visit (backend calculates it) */}
              {!form.visit_id && (
                <div className="db-field">
                  <label className="db-label">Total amount (KES) *</label>
                  <input
                    className="db-input"
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
                  />
                </div>
              )}

              {form.visit_id && (
                <div className="db-hint">
                  Amount will be auto-calculated from visit expenses.
                </div>
              )}

              <div className="db-field-row">
                <div className="db-field">
                  <label className="db-label">Issue date *</label>
                  <input className="db-input" type="date" value={form.issued_date} onChange={e => setForm(f => ({ ...f, issued_date: e.target.value }))} />
                </div>
                <div className="db-field">
                  <label className="db-label">Due date (optional)</label>
                  <input className="db-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>

              <div className="db-field">
                <label className="db-label">Notes (optional)</label>
                <textarea className="db-textarea" placeholder="Payment instructions, terms, or additional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {formErr && <div className="db-err">{formErr}</div>}
            </div>
            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={() => { setShowModal(false); setFormErr(''); }}>Cancel</button>
              <button className="db-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ margin: 0 }}>
                {submitting ? 'Creating…' : form.visit_id ? 'Generate invoice' : 'Create invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {detailInv && (
        <div className="db-overlay" onClick={e => { if (e.target === e.currentTarget) setDetailInv(null); }}>
          <div className="db-modal db-modal-lg">
            <div className="db-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="db-modal-title">Invoice</span>
                <span className="db-inv-number">{detailInv.invoice_number}</span>
              </div>
              <button className="db-modal-close" onClick={() => setDetailInv(null)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="db-modal-body">
              <div style={{ padding: '12px 16px', borderRadius: '8px', background: statusBg(detailInv.status), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="db-badge" style={{ color: statusColor(detailInv.status), background: 'transparent', padding: 0 }}>
                  {detailInv.status}
                </span>
                {detailInv.status !== 'paid' && (
                  <button className="db-mark-btn" disabled={markingId === detailInv.id} onClick={() => markPaid(detailInv)}>
                    {markingId === detailInv.id ? 'Updating…' : '✓ Mark as paid'}
                  </button>
                )}
              </div>
              <div>
                <div className="db-detail-row">
                  <span className="db-detail-key">Client</span>
                  <span className="db-detail-val">{detailInv.full_name}</span>
                </div>
                <div className="db-detail-row">
                  <span className="db-detail-key">Total amount</span>
                  <span className="db-detail-val" style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: 'var(--accent)' }}>{fmt(detailInv.total_amount)}</span>
                </div>
                {detailInv.total_expenses > 0 && (
                  <div className="db-detail-row">
                    <span className="db-detail-key">Total expenses</span>
                    <span className="db-detail-val">{fmt(detailInv.total_expenses)}</span>
                  </div>
                )}
                <div className="db-detail-row">
                  <span className="db-detail-key">Issue date</span>
                  <span className="db-detail-val">{fmtDate(detailInv.issued_date)}</span>
                </div>
                {detailInv.due_date && (
                  <div className="db-detail-row">
                    <span className="db-detail-key">Due date</span>
                    <span className="db-detail-val">{fmtDate(detailInv.due_date)}</span>
                  </div>
                )}
                {detailInv.notes && (
                  <div className="db-detail-row" style={{ flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                    <span className="db-detail-key">Notes</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{detailInv.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={() => setDetailInv(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}