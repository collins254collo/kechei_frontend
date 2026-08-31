'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  fetchInvoices,
  updateInvoice,
  previewUnbilledByClient,
  generateInvoiceFromClient,
  createManualInvoice,
  fetchInvoicePdfUrl,
  sendInvoiceToClient,
} from '../API/invoiceApi';
import { fetchClients } from '../API/clientApi';
import ProtectedPage from '../protectedPage';
import Sidebar from '../sidebar';

//  Types 
interface User    { id: number; name: string; email: string; role: string; }
interface Client  { id: number; full_name: string; phone: string; email?: string; }
interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  visit_id?: number;
  full_name: string;
  total_amount: number;   
  final_amount: number;   
  paid_amount?: number;
  total_expenses: number;
  description?: string;
  status: 'unpaid' | 'partial' | 'paid';
  issued_date: string;
  due_date?: string;
  notes?: string;
}
type Toast = { id: number; message: string; type: 'success' | 'error' };
type SortKey = 'issued_date' | 'final_amount';
type SortDir = 'asc' | 'desc';
type InvoiceMode = 'auto' | 'manual';
type ManualClientMode = 'existing' | 'new';

const STATUS_FILTERS = ['all', 'unpaid', 'partial', 'paid'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function fmt(n: number) {
  return `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }); }
function isOverdue(inv: Invoice) {
  if (inv.status === 'paid' || !inv.due_date) return false;
  return new Date(inv.due_date).setHours(23, 59, 59, 999) < Date.now();
}
function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }

export default function InvoicesPage() {
  const router = useRouter();
  const [user, setUser]           = useState<User | null>(null);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
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
  const [sortKey, setSortKey]     = useState<SortKey>('issued_date');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');

  // New-invoice mode: auto (from unbilled expenses) or manual (admin-entered)
  const [invMode, setInvMode] = useState<InvoiceMode>('auto');
  // Manual mode only: bill an existing client, or a freshly typed-in name + email
  const [manualClientMode, setManualClientMode] = useState<ManualClientMode>('existing');

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const dismissToast = (id: number) => setToasts(t => t.filter(x => x.id !== id));

  // New-invoice form — client-only, amount is derived server-side (auto mode)
  const [form, setForm] = useState({
    client_id: '', due_date: '', notes: '',
  });
  const [previewAmount, setPreviewAmount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr, setPreviewErr] = useState('');

  // Manual invoice form — admin enters amount + description, and either
  // picks an existing client or types in a brand-new name + email.
  const [manualForm, setManualForm] = useState({
    client_id: '', client_name: '', client_email: '', client_phone: '',
    amount: '', description: '', due_date: '', notes: '',
  });

  // PDF preview + send state (detail modal)
  const [pdfUrl, setPdfUrl]         = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfErr, setPdfErr]         = useState('');
  const [sendingId, setSendingId]   = useState<number | null>(null);
  const [sendErr, setSendErr]       = useState('');

  const load = () => {
    setLoading(true);
    Promise.allSettled([
      fetchInvoices(),
      fetchClients(),
    ]).then(([inv, cl]) => {
      if (inv.status === 'fulfilled') setInvoices(inv.value);
      else { console.error('invoices failed:', inv.reason); pushToast('Failed to load invoices', 'error'); }
      if (cl.status === 'fulfilled')  setClients(cl.value);
      else { console.error('clients failed:', cl.reason); pushToast('Failed to load clients', 'error'); }
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setMounted(true);
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (stored) { try { setUser(JSON.parse(stored)); } catch {} }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); router.push('/login'); };

  //  Derived 
  const filtered = useMemo(() => {
    const list = invoices.filter(inv => {
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || (inv.full_name || '').toLowerCase().includes(q) || (inv.invoice_number || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
    const sorted = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'issued_date')  cmp = new Date(a.issued_date).getTime() - new Date(b.issued_date).getTime();
        if (sortKey === 'final_amount') cmp = Number(a.final_amount) - Number(b.final_amount);
        return sortDir === 'asc' ? cmp : -cmp;
      });
      return sorted;
  }, [invoices, statusFilter, search, sortKey, sortDir]);

  const hasAnyInvoices = invoices.length > 0;
  const hasActiveFilters = search.trim() !== '' || statusFilter !== 'all';

   const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.final_amount), 0);
   const outstanding  = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.final_amount), 0);
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };
  const sortArrow = (key: SortKey) => sortKey !== key ? '' : (sortDir === 'asc' ? ' ↑' : ' ↓');

  //  New invoice: client select -> auto-fetch unbilled preview 
  const handleClientSelect = async (clientId: string) => {
    setForm(f => ({ ...f, client_id: clientId }));
    setPreviewAmount(null);
    setPreviewErr('');
    setFormErr('');

    if (!clientId) return;

    setPreviewLoading(true);
    try {
      const result = await previewUnbilledByClient(Number(clientId));
      setPreviewAmount(result.total_expenses);
    } catch (err: any) {
      setPreviewErr(err.message || 'Could not load unbilled total for this client.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetNewInvoiceForm = () => {
    setInvMode('auto');
    setManualClientMode('existing');
    setForm({ client_id: '', due_date: '', notes: '' });
    setManualForm({ client_id: '', client_name: '', client_email: '', client_phone: '', amount: '', description: '', due_date: '', notes: '' });
    setPreviewAmount(null);
    setPreviewErr('');
    setFormErr('');
  };

  //  New invoice: auto = bill unbilled expenses / manual = admin-entered amount + client 
 const handleSubmit = async () => {
  if (invMode === 'manual') {
    if (manualClientMode === 'existing' && !manualForm.client_id) {
      setFormErr('Please select a client.'); return;
    }
    if (manualClientMode === 'new') {
      if (!manualForm.client_name.trim()) { setFormErr("Please enter the client's name."); return; }
      if (!manualForm.client_email.trim() || !isValidEmail(manualForm.client_email)) {
        setFormErr('Please enter a valid email address for this client.'); return;
      }
    }
    const amountNum = Number(manualForm.amount);
    if (!manualForm.amount || isNaN(amountNum) || amountNum <= 0) {
      setFormErr('Please enter a valid amount greater than zero.');
      return;
    }
    if (!manualForm.description.trim()) { setFormErr('Please add a short description for this invoice.'); return; }

    setSubmitting(true);
    setFormErr('');
    try {
      const data = await createManualInvoice(
        manualClientMode === 'existing'
          ? {
              client_id: Number(manualForm.client_id),
              amount: amountNum,
              description: manualForm.description.trim(),
              ...(manualForm.due_date && { due_date: manualForm.due_date }),
              ...(manualForm.notes && { notes: manualForm.notes }),
            }
          : {
              client_name: manualForm.client_name.trim(),
              client_email: manualForm.client_email.trim(),
              ...(manualForm.client_phone.trim() && { client_phone: manualForm.client_phone.trim() }),
              amount: amountNum,
              description: manualForm.description.trim(),
              ...(manualForm.due_date && { due_date: manualForm.due_date }),
              ...(manualForm.notes && { notes: manualForm.notes }),
            }
      );

      // POST /invoices/manual has no joined full_name (plain INSERT ... RETURNING *) 
      const fallbackName = manualClientMode === 'existing'
        ? clients.find(c => c.id === Number(manualForm.client_id))?.full_name
        : manualForm.client_name.trim();

      setInvoices(prev => [{ ...data, full_name: data.full_name ?? fallbackName }, ...prev]);
      if (manualClientMode === 'new') {
        fetchClients().then(setClients).catch(() => {});
      }
      setShowModal(false);
      resetNewInvoiceForm();
      pushToast(`Invoice ${data.invoice_number} created`, 'success');
    } catch (err: any) {
      setFormErr(err.message || 'Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
    return;
  }

  if (!form.client_id) { setFormErr('Please select a client.'); return; }
  if (previewAmount === null) { setFormErr('Still checking unbilled expenses — try again in a moment.'); return; }
  if (previewAmount <= 0) { setFormErr('This client has no unbilled expenses to invoice.'); return; }

  setSubmitting(true);
  setFormErr('');

  try {
    const data = await generateInvoiceFromClient({
      client_id: Number(form.client_id),
      ...(form.due_date && { due_date: form.due_date }),
      ...(form.notes && { notes: form.notes }),
    });

    const client = clients.find(c => c.id === Number(form.client_id));
    setInvoices(prev => [{ ...data, full_name: data.full_name ?? client?.full_name }, ...prev]);
    setShowModal(false);
    resetNewInvoiceForm();
    pushToast(`Invoice ${data.invoice_number} generated`, 'success');
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
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updated } : i));
    if (detailInv?.id === inv.id) setDetailInv(prev => prev ? { ...prev, ...updated } : prev);
    pushToast(`${updated.invoice_number} marked as paid`, 'success');
  } catch (err: any) {
    pushToast(err.message || 'Failed to update invoice.', 'error');
  } finally {
    setMarkingId(null);
  }
};

  //  PDF preview 
  const openDetail = (inv: Invoice) => {
    setDetailInv(inv);
    setPdfUrl(null);
    setPdfErr('');
    setSendErr('');
  };

  const closeDetail = () => {
    setDetailInv(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfErr('');
    setSendErr('');
  };

  const loadPdfPreview = async (inv: Invoice) => {
    setPdfLoading(true);
    setPdfErr('');
    try {
      const url = await fetchInvoicePdfUrl(inv.id);
      setPdfUrl(url);
    } catch (err: any) {
      setPdfErr(err.message || 'Failed to generate PDF preview.');
    } finally {
      setPdfLoading(false);
    }
  };

  //  Send to client 
  const handleSendToClient = async (inv: Invoice) => {
    setSendingId(inv.id);
    setSendErr('');
    try {
      const result = await sendInvoiceToClient(inv.id);
      pushToast(`Invoice sent to ${result.sentTo}`, 'success');
      closeDetail();
    } catch (err: any) {
      setSendErr(err.message || 'Failed to send invoice.');
    } finally {
      setSendingId(null);
    }
  };

  const clearFilters = () => { setSearch(''); setStatusFilter('all'); };

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
        .db-brand-sub { font-size: 9px; color: #383430; letter-spacing: 0.16em; text-transform: uppercase; margin-top: 3px; }
        .db-nav { flex: 1; padding: 16px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .db-nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 18px; color: var(--sidebar-text); cursor: pointer; transition: background 0.15s, color 0.15s; letter-spacing: 0.02em; border: none; background: none; width: 100%; text-align: left; }
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
        .db-topbar-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-topbar-date { font-size: 14px; color: var(--text-3); letter-spacing: 0.08em; }
        .db-hamburger { display: none; background: none; border: none; cursor: pointer; color: var(--text); padding: 4px; }
        .db-content { padding: 32px; flex: 1; }

        .db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; animation: db-up 0.5s ease 0.05s both; }
        .db-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px 22px; box-shadow: var(--shadow); position: relative; overflow: hidden; }
        .db-stat::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); opacity: 0.4; }
        .db-stat:first-child::before { opacity: 1; }
        .db-stat-label { font-size: 15px; color: var(--text-2); letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 10px; }
        .db-stat-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -0.8px; line-height: 1; }
        .db-stat-sub { font-size: 15px; color: var(--text-3); margin-top: 6px; }

        .db-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; animation: db-up 0.5s ease 0.1s both; }
        .db-search { flex: 1; min-width: 180px; max-width: 300px; display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; height: 36px; }
        .db-search svg { opacity: 0.35; flex-shrink: 0; }
        .db-search input { border: none; background: none; outline: none; font-family: 'DM Mono', monospace; font-size: 15px; color: var(--text); flex: 1; }
        .db-search input::placeholder { color: var(--text-3); }
        .db-filters { display: flex; gap: 4px; }
        .db-filter-btn { height: 36px; padding: 0 14px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.04em; border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; transition: all 0.15s; text-transform: capitalize; }
        .db-filter-btn:hover { color: var(--text); }
        .db-filter-btn.active-paid    { background: var(--badge-green-bg); border-color: var(--badge-green-tx); color: var(--badge-green-tx); }
        .db-filter-btn.active-partial { background: var(--badge-amber-bg); border-color: var(--badge-amber-tx); color: var(--badge-amber-tx); }
        .db-filter-btn.active-unpaid  { background: var(--badge-red-bg);   border-color: var(--badge-red-tx);   color: var(--badge-red-tx); }
        .db-filter-btn.active-all     { background: var(--accent); border-color: var(--accent); color: #fff; }
        .db-btn-primary { height: 36px; padding: 0 16px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; background: var(--accent); color: #fff; border: none; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 6px; white-space: nowrap; margin-left: auto; }
        .db-btn-primary:hover { background: var(--accent-h); }
        .db-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .db-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; animation: db-up 0.5s ease 0.15s both; }
        .db-card-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .db-card-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .db-card-count { font-size: 15px; color: var(--text-3); letter-spacing: 0.06em; }

        .db-table { width: 100%; border-collapse: collapse; }
        .db-th { text-align: left; padding: 10px 20px; font-size: 13px; color: var(--text-3); letter-spacing: 0.14em; text-transform: uppercase; border-bottom: 1px solid var(--border); font-weight: 500; }
        .db-th-r { text-align: right; }
        .db-th-sortable { cursor: pointer; user-select: none; transition: color 0.15s; }
        .db-th-sortable:hover { color: var(--accent); }
        .db-tr { border-bottom: 1px solid var(--border); transition: background 0.1s; cursor: pointer; }
        .db-tr:last-child { border-bottom: none; }
        .db-tr:hover { background: var(--surface-2); }
        .db-tr:nth-child(even) { background: rgba(0,0,0,0.012); }
        .db-tr:nth-child(even):hover { background: var(--surface-2); }
        .db-td { padding: 12px 20px; font-size: 12px; color: var(--text); vertical-align: middle; }
        .db-td-muted { color: var(--text-2); }
        .db-td-r { text-align: right; }
        .db-td-mono { font-size: 15px; color: var(--text-2); font-family: 'DM Mono', monospace; }

        .db-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 5px; font-size: 15px; font-weight: 500; letter-spacing: 0.04em; text-transform: capitalize; }
        .db-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: 0.7; }

        .db-overdue { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--badge-red-tx); margin-top: 3px; }
        .db-overdue::before { content: '●'; font-size: 10px; }

        .db-mark-btn { height: 26px; padding: 0 10px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 15px; background: none; border: 1px solid var(--badge-green-tx); color: var(--badge-green-tx); cursor: pointer; transition: all 0.15s; white-space: nowrap; opacity: 0.7; }
        .db-mark-btn:hover { opacity: 1; background: var(--badge-green-bg); }
        .db-mark-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        .db-empty { padding: 56px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .db-empty-icon { width: 44px; height: 44px; border-radius: 50%; background: var(--surface-2); display: flex; align-items: center; justify-content: center; color: var(--text-3); }
        .db-empty-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: var(--text); }
        .db-empty-sub { font-size: 15px; color: var(--text-3); max-width: 280px; line-height: 1.6; }

        @keyframes db-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .db-skel { background: linear-gradient(90deg, var(--border) 25%, var(--surface-2) 50%, var(--border) 75%); background-size: 800px 100%; animation: db-shimmer 1.4s infinite; border-radius: 4px; height: 12px; display: inline-block; }

        .db-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 20px; animation: db-fade 0.2s ease; }
        @keyframes db-fade { from { opacity: 0; } to { opacity: 1; } }
        .db-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 480px; box-shadow: 0 24px 48px rgba(0,0,0,0.15); overflow: hidden; animation: db-slide 0.25s cubic-bezier(0.16,1,0.3,1); }
        .db-modal-lg { max-width: 560px; }
        .db-modal-xl { max-width: 720px; }
        @keyframes db-slide { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .db-modal-head { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
        .db-modal-title { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; }
        .db-modal-close { background: none; border: none; cursor: pointer; color: var(--text-3); transition: color 0.15s; padding: 2px; }
        .db-modal-close:hover { color: var(--text); }
        .db-modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
        .db-modal-foot { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; align-items: center; }
        .db-field { display: flex; flex-direction: column; gap: 6px; }
        .db-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .db-label { font-size: 14px; color: var(--text-2); letter-spacing: 0.14em; text-transform: uppercase; }
        .db-select, .db-input, .db-textarea { font-family: 'DM Mono', monospace; font-size: 15px; color: var(--text); background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; outline: none; width: 100%; transition: border-color 0.15s; }
        .db-select:focus, .db-input:focus, .db-textarea:focus { border-color: var(--accent); }
        .db-textarea { resize: vertical; min-height: 72px; }
        .db-err { font-size: 15px; color: var(--badge-red-tx); background: var(--badge-red-bg); padding: 8px 12px; border-radius: 6px; }
        .db-btn-secondary { height: 36px; padding: 0 16px; border-radius: 8px; font-family: 'DM Mono', monospace; font-size: 16px; letter-spacing: 0.04em; background: none; border: 1px solid var(--border); color: var(--text-2); cursor: pointer; transition: all 0.15s; }
        .db-btn-secondary:hover { color: var(--text); border-color: var(--text-2); }
        .db-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

        .db-detail-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 16px; }
        .db-detail-row:last-child { border-bottom: none; }
        .db-detail-key { color: var(--text-2); font-size: 15px; }
        .db-detail-val { color: var(--text); font-weight: 500; text-align: right; }

        .db-inv-number { font-family: 'DM Mono', monospace; font-size: 15px; padding: 4px 10px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); letter-spacing: 0.04em; }

        .db-hint { font-size: 14px; color: var(--text-3); padding: 8px 12px; background: var(--surface-2); border-radius: 6px; border: 1px solid var(--border); }

        .db-preview-box { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; }
        .db-preview-label { font-size: 13px; color: var(--text-2); letter-spacing: 0.14em; text-transform: uppercase; }
        .db-preview-value { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: var(--accent); margin-top: 4px; }

        .db-mode-toggle { display: flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 3px; gap: 3px; }
        .db-mode-btn { flex: 1; height: 32px; border-radius: 6px; font-family: 'DM Mono', monospace; font-size: 14px; letter-spacing: 0.04em; border: none; background: none; color: var(--text-2); cursor: pointer; transition: all 0.15s; }
        .db-mode-btn.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); font-weight: 500; }

        .db-pdf-frame { width: 100%; height: 60vh; border: 1px solid var(--border); border-radius: 8px; background: #fff; }
        .db-pdf-placeholder { height: 60vh; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-3); font-size: 12px; flex-direction: column; gap: 12px; }

        .db-side-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 35; }
        .db-side-overlay.open { display: block; }

        .db-toasts { position: fixed; bottom: 20px; right: 20px; z-index: 60; display: flex; flex-direction: column; gap: 8px; max-width: 340px; }
        .db-toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 12px 24px rgba(0,0,0,0.12); font-size: 15px; animation: db-toast-in 0.25s cubic-bezier(0.16,1,0.3,1); }
        .db-toast-success { border-left: 3px solid var(--badge-green-tx); }
        .db-toast-error { border-left: 3px solid var(--badge-red-tx); }
        .db-toast-icon { flex-shrink: 0; margin-top: 1px; }
        .db-toast-msg { flex: 1; color: var(--text); line-height: 1.4; }
        .db-toast-close { background: none; border: none; cursor: pointer; color: var(--text-3); flex-shrink: 0; padding: 0; }
        @keyframes db-toast-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }

        @keyframes db-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1100px) { .db-stats { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 768px) {
          .db-side { transform: translateX(-100%); }
          .db-side.open { transform: translateX(0); }
          .db-main { margin-left: 0; }
          .db-hamburger { display: flex; }
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-content { padding: 20px 16px; }
          .db-topbar { padding: 0 16px; }
          .db-btn-primary span { display: none; }
          .db-table th:nth-child(4), .db-table td:nth-child(4) { display: none; }
          .db-modal-xl { max-width: 100%; }
          .db-pdf-frame, .db-pdf-placeholder { height: 45vh; }
          .db-toasts { left: 16px; right: 16px; bottom: 16px; max-width: none; }
        }
        @media (max-width: 480px) {
          .db-stats { grid-template-columns: 1fr 1fr; gap: 10px; }
          .db-stat-value { font-size: 20px; }
          .db-field-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="db-root">
        <Sidebar activeKey="invoices" sideOpen={sideOpen} setSideOpen={setSideOpen} user={user} onLogout={logout} />

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
                <span className="db-card-count">{loading ? '' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}</span>
              </div>

              {loading ? (
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
                    {[1, 2, 3, 4, 5].map(i => (
                      <tr key={i} className="db-tr" style={{ cursor: 'default' }}>
                        <td className="db-td"><span className="db-skel" style={{ width: '90px' }} /></td>
                        <td className="db-td"><span className="db-skel" style={{ width: '120px' }} /></td>
                        <td className="db-td"><span className="db-skel" style={{ width: '70px' }} /></td>
                        <td className="db-td"><span className="db-skel" style={{ width: '70px' }} /></td>
                        <td className="db-td db-td-r"><span className="db-skel" style={{ width: '80px' }} /></td>
                        <td className="db-td"><span className="db-skel" style={{ width: '54px' }} /></td>
                        <td className="db-td" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : filtered.length === 0 ? (
                <div className="db-empty">
                  <div className="db-empty-icon">
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  {hasAnyInvoices && hasActiveFilters ? (
                    <>
                      <div className="db-empty-title">No invoices match your filters</div>
                      <div className="db-empty-sub">Try a different search term or status filter.</div>
                      <button className="db-btn-secondary" onClick={clearFilters}>Clear filters</button>
                    </>
                  ) : (
                    <>
                      <div className="db-empty-title">No invoices yet</div>
                      <div className="db-empty-sub">Generate your first invoice from a client's unbilled expenses, or create one manually.</div>
                      <button className="db-btn-primary" style={{ margin: 0 }} onClick={() => setShowModal(true)}>New invoice</button>
                    </>
                  )}
                </div>
              ) : (
                <table className="db-table">
                  <thead>
                    <tr>
                      <th className="db-th">Invoice #</th>
                      <th className="db-th">Client</th>
                      <th className="db-th db-th-sortable" onClick={() => toggleSort('issued_date')}>Issued{sortArrow('issued_date')}</th>
                      <th className="db-th">Due</th>
                      <th className="db-th db-th-r db-th-sortable" onClick={() => toggleSort('final_amount')}>Amount{sortArrow('final_amount')}</th>
                      <th className="db-th">Status</th>
                      <th className="db-th" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(inv => {
                      const overdue = isOverdue(inv);
                      return (
                        <tr key={inv.id} className="db-tr" onClick={() => openDetail(inv)}>
                          <td className="db-td"><span className="db-inv-number">{inv.invoice_number}</span></td>
                          <td className="db-td" style={{ fontWeight: 500 }}>{inv.full_name}</td>
                          <td className="db-td db-td-mono">{fmtDate(inv.issued_date)}</td>
                          <td className="db-td db-td-mono">
                            {inv.due_date ? (
                              <div>
                                {fmtDate(inv.due_date)}
                                {overdue && <div className="db-overdue">Overdue</div>}
                              </div>
                            ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                          </td>
                          <td className="db-td db-td-r" style={{ fontWeight: 600 }}>{fmt(inv.final_amount)}</td>
                          <td className="db-td">
                            <span className="db-badge" style={{ color: statusColor(inv.status), background: statusBg(inv.status) }}>{inv.status}</span>
                          </td>
                         
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toasts */}
      <div className="db-toasts">
        {toasts.map(t => (
          <div key={t.id} className={`db-toast ${t.type === 'success' ? 'db-toast-success' : 'db-toast-error'}`}>
            <span className="db-toast-icon">
              {t.type === 'success' ? (
                <svg width="14" height="14" fill="none" stroke="#2d7a47" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
              ) : (
                <svg width="14" height="14" fill="none" stroke="#b03030" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
              )}
            </span>
            <span className="db-toast-msg">{t.message}</span>
            <button className="db-toast-close" onClick={() => dismissToast(t.id)}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
      </div>

      {/* New Invoice Modal — auto (from unbilled expenses) or manual (admin-entered) */}
      {showModal && (
        <div className="db-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); resetNewInvoiceForm(); } }}>
          <div className="db-modal">
            <div className="db-modal-head">
              <span className="db-modal-title">New invoice</span>
              <button className="db-modal-close" onClick={() => { setShowModal(false); resetNewInvoiceForm(); }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="db-modal-body">

              <div className="db-mode-toggle">
                <button
                  className={`db-mode-btn ${invMode === 'auto' ? 'active' : ''}`}
                  onClick={() => { setInvMode('auto'); setFormErr(''); }}
                >
                  Auto-generate
                </button>
                <button
                  className={`db-mode-btn ${invMode === 'manual' ? 'active' : ''}`}
                  onClick={() => { setInvMode('manual'); setFormErr(''); }}
                >
                  Manual entry
                </button>
              </div>

              {invMode === 'auto' ? (
                <>
                  <div className="db-field">
                    <label className="db-label">Client *</label>
                    <select
                      className="db-select"
                      value={form.client_id}
                      onChange={e => handleClientSelect(e.target.value)}
                    >
                      <option value="">Select a client…</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>
                      ))}
                    </select>
                  </div>

                  {form.client_id && (
                    <div className="db-preview-box">
                      <div>
                        <div className="db-preview-label">Unbilled total</div>
                        <div className="db-preview-value">
                          {previewLoading ? '…' : previewAmount !== null ? fmt(previewAmount) : '—'}
                        </div>
                      </div>
                      {!previewLoading && previewAmount === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Nothing to invoice</span>
                      )}
                    </div>
                  )}
                  {previewErr && <div className="db-err">{previewErr}</div>}

                  <div className="db-field-row">
                    <div className="db-field">
                      <label className="db-label">Due date (optional)</label>
                      <input className="db-input" type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                    </div>
                    <div className="db-field">
                      <label className="db-label">&nbsp;</label>
                      <div className="db-hint">Amount and issue date are set automatically.</div>
                    </div>
                  </div>

                  <div className="db-field">
                    <label className="db-label">Notes (optional)</label>
                    <textarea className="db-textarea" placeholder="Payment instructions, terms, or additional notes…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className="db-field">
                    <label className="db-label">Client</label>
                    <div className="db-mode-toggle">
                      <button
                        className={`db-mode-btn ${manualClientMode === 'existing' ? 'active' : ''}`}
                        onClick={() => { setManualClientMode('existing'); setFormErr(''); }}
                      >
                        Existing client
                      </button>
                      <button
                        className={`db-mode-btn ${manualClientMode === 'new' ? 'active' : ''}`}
                        onClick={() => { setManualClientMode('new'); setFormErr(''); }}
                      >
                        New client
                      </button>
                    </div>
                  </div>

                  {manualClientMode === 'existing' ? (
                    <div className="db-field">
                      <label className="db-label">Client *</label>
                      <select
                        className="db-select"
                        value={manualForm.client_id}
                        onChange={e => { setManualForm(f => ({ ...f, client_id: e.target.value })); setFormErr(''); }}
                      >
                        <option value="">Select a client…</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.full_name} — {c.phone}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="db-field-row">
                        <div className="db-field">
                          <label className="db-label">Client name *</label>
                          <input
                            className="db-input"
                            type="text"
                            placeholder="Full name"
                            value={manualForm.client_name}
                            onChange={e => setManualForm(f => ({ ...f, client_name: e.target.value }))}
                          />
                        </div>
                        <div className="db-field">
                          <label className="db-label">Email *</label>
                          <input
                            className="db-input"
                            type="email"
                            placeholder="client@email.com"
                            value={manualForm.client_email}
                            onChange={e => setManualForm(f => ({ ...f, client_email: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="db-field">
                        <label className="db-label">Phone (optional)</label>
                        <input
                          className="db-input"
                          type="tel"
                          placeholder="07…"
                          value={manualForm.client_phone}
                          onChange={e => setManualForm(f => ({ ...f, client_phone: e.target.value }))}
                        />
                      </div>
                    </>
                  )}

                  <div className="db-field-row">
                    <div className="db-field">
                      <label className="db-label">Amount (KES) *</label>
                      <input
                        className="db-input"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={manualForm.amount}
                        onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <div className="db-field">
                      <label className="db-label">Due date (optional)</label>
                      <input className="db-input" type="date" value={manualForm.due_date} onChange={e => setManualForm(f => ({ ...f, due_date: e.target.value }))} />
                    </div>
                  </div>

                  <div className="db-field">
                    <label className="db-label">Description *</label>
                    <input
                      className="db-input"
                      type="text"
                      placeholder="What is this invoice for?"
                      value={manualForm.description}
                      onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))}
                    />
                  </div>

                  <div className="db-field">
                    <label className="db-label">Notes (optional)</label>
                    <textarea className="db-textarea" placeholder="Payment instructions, terms, or additional notes…" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>

                  <div className="db-hint">
                    This invoice is created exactly as entered — no unbilled expenses are attached to it.
                    {manualClientMode === 'new' && ' The email above is where "Send to client" will deliver the INVOICE.'}
                  </div>
                </>
              )}

              {formErr && <div className="db-err">{formErr}</div>}
            </div>
            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={() => { setShowModal(false); resetNewInvoiceForm(); }}>Cancel</button>
              {invMode === 'auto' ? (
                <button
                  className="db-btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting || previewLoading || !form.client_id || !previewAmount}
                  style={{ margin: 0 }}
                >
                  {submitting ? 'Generating…' : 'Generate invoice'}
                </button>
              ) : (
                <button
                  className="db-btn-primary"
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    !manualForm.amount ||
                    !manualForm.description.trim() ||
                    (manualClientMode === 'existing' ? !manualForm.client_id : (!manualForm.client_name.trim() || !manualForm.client_email.trim()))
                  }
                  style={{ margin: 0 }}
                >
                  {submitting ? 'Creating…' : 'Create invoice'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal — includes PDF preview-then-send */}
      {detailInv && (
        <div className="db-overlay" onClick={e => { if (e.target === e.currentTarget) closeDetail(); }}>
          <div className={`db-modal ${pdfUrl ? 'db-modal-xl' : 'db-modal-lg'}`}>
            <div className="db-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="db-modal-title">Invoice</span>
                <span className="db-inv-number">{detailInv.invoice_number}</span>
              </div>
              <button className="db-modal-close" onClick={closeDetail}>
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
                    {markingId === detailInv.id ? 'Updating…' : ' Mark as paid'}
                  </button>
                )}
              </div>

              {!pdfUrl && (
                <div>
                  {detailInv.description && (
                    <div className="db-detail-row" style={{ flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                      <span className="db-detail-key">Description</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{detailInv.description}</span>
                    </div>
                  )}
                  <div className="db-detail-row">
                    <span className="db-detail-key">Subtotal (excl. VAT)</span>
                    <span className="db-detail-val">{fmt(detailInv.total_amount)}</span>
                  </div>
                  <div className="db-detail-row">
                    <span className="db-detail-key">Total due (incl. VAT)</span>
                    <span className="db-detail-val" style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: 'var(--accent)' }}>{fmt(detailInv.final_amount)}</span>
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
                      <span className="db-detail-val">
                        {fmtDate(detailInv.due_date)}
                        {isOverdue(detailInv) && <div className="db-overdue" style={{ justifyContent: 'flex-end' }}>Overdue</div>}
                      </span>
                    </div>
                  )}
                  {detailInv.notes && (
                    <div className="db-detail-row" style={{ flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                      <span className="db-detail-key">Notes</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.6 }}>{detailInv.notes}</span>
                    </div>
                  )}
                </div>
              )}

              {pdfLoading && (
                <div className="db-pdf-placeholder">Generating PDF preview…</div>
              )}
              {pdfErr && <div className="db-err">{pdfErr}</div>}
              {pdfUrl && !pdfLoading && (
                <iframe src={pdfUrl} className="db-pdf-frame" title={`Invoice ${detailInv.invoice_number} PDF`} />
              )}

              {sendErr && <div className="db-err">{sendErr}</div>}
            </div>
            <div className="db-modal-foot">
              <button className="db-btn-secondary" onClick={closeDetail}>Close</button>

              {!pdfUrl ? (
                <button
                  className="db-btn-primary"
                  style={{ margin: 0 }}
                  disabled={pdfLoading}
                  onClick={() => loadPdfPreview(detailInv)}
                >
                  {pdfLoading ? 'Loading…' : 'Preview INVOICE'}
                </button>
              ) : (
                <button
                  className="db-btn-primary"
                  style={{ margin: 0 }}
                  disabled={sendingId === detailInv.id}
                  onClick={() => handleSendToClient(detailInv)}
                >
                  {sendingId === detailInv.id ? 'Sending…' : 'Send to client'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
    </ProtectedPage>
  );
}