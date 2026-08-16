'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchClientProfile, ClientProfile } from '../../API/clientApi';

type Tab = 'timeline' | 'visits' | 'invoices' | 'payments' | 'expenses';

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }
function fmtDateTime(d: string) { return d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }

export default function ClientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('timeline');

  useEffect(() => {
    fetchClientProfile(Number(id))
      .then(setProfile)
      .catch(() => router.push('/client'))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Merge every record type into one chronological spine ──
  const timeline = useMemo(() => {
    if (!profile) return [];
    const { visits, invoices, payments, expenses } = profile;

    type Row = { id: string; date: string; kind: 'visit' | 'expense' | 'invoice' | 'payment'; primary: string; secondary?: string; amount?: number; status?: string };
    const rows: Row[] = [];

    visits.forEach((v: any) => rows.push({
      id: `v${v.id}`, date: v.created_at, kind: 'visit',
      primary: v.reason, secondary: v.room_number ? `Room ${v.room_number}` : undefined,
      status: v.status,
    }));
    expenses.forEach((e: any) => rows.push({
      id: `e${e.id}`, date: e.created_at, kind: 'expense',
      primary: e.notes || e.name || (e.category ? `${e.category} expense` : 'Expense'),
      secondary: e.visit_reason, amount: e.amount,
    }));
    invoices.forEach((i: any) => rows.push({
      id: `i${i.id}`, date: i.issued_date, kind: 'invoice',
      primary: i.invoice_number, amount: i.total_amount, status: i.status,
    }));
    payments.forEach((p: any) => rows.push({
      id: `p${p.id}`, date: p.payment_date || p.created_at, kind: 'payment',
      primary: p.method ? `${p.method} payment` : 'Payment',
      secondary: p.invoice_number || (p.invoice_id ? `#${p.invoice_id}` : undefined),
      amount: p.amount_paid, status: p.reference,
    }));

    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [profile]);

  if (loading) return (
    <div className="pg-loader">
      <style>{`
        :root{--bg:#faf8f4;--text-2:#8a8375;}
        body{background:var(--bg);}
        .pg-loader{min-height:100vh;display:flex;align-items:center;justify-content:center;
          background:var(--bg);color:var(--text-2);font-family:'DM Mono',monospace;font-size:17px;
          letter-spacing:0.04em;}
      `}</style>
      Loading profile…
    </div>
  );
  if (!profile) return null;

  const { client, stats, visits, invoices, payments, expenses } = profile;

  const statusColor = (s: string) =>
    s === 'paid' || s === 'completed' ? 'var(--good)' :
    s === 'partial' || s === 'active' ? 'var(--warn)' : 'var(--bad)';
  const statusBg = (s: string) =>
    s === 'paid' || s === 'completed' ? 'var(--good-bg)' :
    s === 'partial' || s === 'active' ? 'var(--warn-bg)' : 'var(--bad-bg)';

  const avatarColors = ['#c98a4b','#5b9482','#8a7ac9','#c96a94','#5b8ac9'];
  const avatarColor = avatarColors[client.full_name.charCodeAt(0) % avatarColors.length];
  const initials = client.full_name.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase();

  const kindMeta: Record<string, { label: string; color: string; icon: string }> = {
    visit:   { label: 'Visit',   color: '#3a5fa0', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    expense: { label: 'Expense', color: '#a06a2a', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z' },
    invoice: { label: 'Invoice', color: '#6a3aaa', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    payment: { label: 'Payment', color: '#2d7a47', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  };

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'timeline', label: 'Timeline', count: timeline.length },
    { key: 'visits',   label: 'Visits',   count: visits.length },
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'invoices', label: 'Invoices', count: invoices.length },
    { key: 'payments', label: 'Payments', count: payments.length },
  ];

  return (
    <>
      <style>{`
         @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');

        /*
          Palette is fixed and does NOT respond to prefers-color-scheme —
          this page always renders in this light scheme regardless of the
          visitor's OS/browser theme setting.
        */
        :root {
          --bg:        #faf8f4;
          --surface:   #ffffff;
          --surface-2: #f4f1ea;
          --border:    #e7e1d3;
          --text:      #1e1a12;
          --text-2:    #6b6456;
          --text-3:    #a89e8a;
          --accent:    #b5763a;
          --accent-h:  #c48d55;
          --good:      #2d7a47; --good-bg: rgba(45,122,71,0.09);
          --warn:      #9a6520; --warn-bg: rgba(154,101,32,0.09);
          --bad:       #b03030; --bad-bg:  rgba(176,48,48,0.08);
          --shadow:    0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.05);
          --dot:       rgba(30,26,18,0.045);
        }

        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html,body{height:100%;}
        body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;}

        .pg-root{min-height:100vh;background:var(--bg);position:relative;color-scheme:light;}
        .pg-root::before{content:'';position:fixed;inset:0;pointer-events:none;
          background-image:radial-gradient(circle,var(--dot) 1px,transparent 1px);
          background-size:26px 26px;}
        .pg-inner{max-width:980px;margin:0 auto;padding:36px 24px 64px;position:relative;z-index:1;}

        .pg-back{background:none;border:none;cursor:pointer;color:var(--text-2);
          font-family:'DM Mono',monospace;font-size:15px;letter-spacing:0.08em;
          display:flex;align-items:center;gap:6px;margin-bottom:22px;padding:0;
          text-transform:uppercase;transition:color 0.15s;}
        .pg-back:hover{color:var(--accent);}

        /* Header */
        .pg-header{background:linear-gradient(155deg,var(--surface),var(--surface-2));
          border:1px solid var(--border);border-radius:16px;padding:28px;
          box-shadow:var(--shadow);margin-bottom:18px;
          display:flex;align-items:flex-start;gap:20px;position:relative;overflow:hidden;}
        .pg-header::after{content:'';position:absolute;top:-40%;right:-10%;width:280px;height:280px;
          background:radial-gradient(circle,rgba(217,154,82,0.10),transparent 70%);pointer-events:none;}
        .pg-avatar{width:58px;height:58px;border-radius:14px;display:flex;
          align-items:center;justify-content:center;font-family:'Syne',sans-serif;
          font-size:24px;font-weight:700;color:#fff;flex-shrink:0;
          box-shadow:0 4px 14px rgba(0,0,0,0.12);}
        .pg-name{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;
          letter-spacing:-0.5px;margin-bottom:9px;color:var(--text);}
        .pg-meta{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:2px;}
        .pg-meta-item{font-size:15px;color:var(--text-2);display:flex;align-items:center;gap:5px;}
        .pg-meta-item svg{opacity:0.7;flex-shrink:0;}
        .pg-notes{font-size:15px;color:var(--text-2);line-height:1.65;
          padding:11px 14px;background:rgba(0,0,0,0.2);border-radius:9px;
          border:1px solid var(--border);margin-top:12px;}

        /* Stats */
        .pg-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px;}
        .pg-stat{background:var(--surface);border:1px solid var(--border);
          border-radius:12px;padding:15px 17px;box-shadow:var(--shadow);
          position:relative;overflow:hidden;}
        .pg-stat::before{content:'';position:absolute;top:0;left:0;right:0;
          height:2px;background:var(--accent);opacity:0.35;}
        .pg-stat.balance::before{opacity:1;}
        .pg-stat-label{font-size:9px;color:var(--text-2);letter-spacing:0.14em;
          text-transform:uppercase;margin-bottom:9px;}
        .pg-stat-value{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;
          letter-spacing:-0.4px;line-height:1;color:var(--text);}
        .pg-stat.balance .pg-stat-value{color:var(--accent);}
        .pg-stat-sub{font-size:14px;color:var(--text-3);margin-top:5px;}

        /* Card + Tabs */
        .pg-card{background:var(--surface);border:1px solid var(--border);
          border-radius:14px;box-shadow:var(--shadow);overflow:hidden;}
        .pg-tabs{display:flex;border-bottom:1px solid var(--border);overflow-x:auto;
          background:rgba(0,0,0,0.15);}
        .pg-tab{padding:14px 20px;font-family:'DM Mono',monospace;font-size:15px;
          letter-spacing:0.06em;text-transform:uppercase;background:none;border:none;
          cursor:pointer;color:var(--text-2);border-bottom:2px solid transparent;
          margin-bottom:-1px;transition:color 0.15s,border-color 0.15s;white-space:nowrap;}
        .pg-tab:hover{color:var(--text);}
        .pg-tab.active{color:var(--accent);border-bottom-color:var(--accent);}

        /* ── Timeline (signature element) ── */
        .pg-tl{padding:22px 26px 26px;position:relative;}
        .pg-tl::before{content:'';position:absolute;left:38px;top:8px;bottom:8px;width:1px;
          background:linear-gradient(var(--border),var(--border) 92%,transparent);}
        .pg-tl-group{margin-bottom:22px;}
        .pg-tl-group:last-child{margin-bottom:0;}
        .pg-tl-date{font-size:14px;color:var(--text-3);letter-spacing:0.12em;
          text-transform:uppercase;margin:0 0 10px 58px;}
        .pg-tl-row{display:flex;align-items:flex-start;gap:16px;position:relative;padding:7px 0;}
        .pg-tl-dot{width:16px;height:16px;border-radius:50%;flex-shrink:0;margin-top:1px;
          display:flex;align-items:center;justify-content:center;position:relative;z-index:1;
          background:var(--surface);border:2px solid currentColor;}
        .pg-tl-dot svg{width:8px;height:8px;}
        .pg-tl-content{flex:1;display:flex;align-items:center;justify-content:space-between;
          gap:12px;min-width:0;}
        .pg-tl-left{min-width:0;}
        .pg-tl-kind{font-size:13px;letter-spacing:0.1em;text-transform:uppercase;
          font-weight:600;margin-bottom:2px;}
        .pg-tl-primary{font-size:17px;color:var(--text);font-weight:500;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .pg-tl-secondary{font-size:15px;color:var(--text-3);margin-top:1px;}
        .pg-tl-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .pg-tl-amt{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;}
        .pg-tl-time{font-size:14px;color:var(--text-3);white-space:nowrap;}

        /* Table */
        .pg-table{width:100%;border-collapse:collapse;}
        .pg-th{text-align:left;padding:11px 20px;font-size:13px;color:var(--text-3);
          letter-spacing:0.14em;text-transform:uppercase;border-bottom:1px solid var(--border);
          white-space:nowrap;}
        .pg-tr{border-bottom:1px solid var(--border);transition:background 0.1s;}
        .pg-tr:last-child{border-bottom:none;}
        .pg-tr:hover{background:var(--surface-2);}
        .pg-td{padding:12px 20px;font-size:16px;color:var(--text);vertical-align:middle;}
        .pg-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
          border-radius:5px;font-size:14px;font-weight:500;text-transform:capitalize;}
        .pg-badge::before{content:'';width:5px;height:5px;border-radius:50%;
          background:currentColor;opacity:0.8;}
        .pg-pill{font-family:'DM Mono',monospace;font-size:10px;padding:3px 8px;
          border-radius:4px;background:var(--surface-2);border:1px solid var(--border);
          color:var(--text-2);}
        .pg-empty{padding:44px 20px;text-align:center;font-size:16px;color:var(--text-3);}

        @media(max-width:768px){
          .pg-stats{grid-template-columns:repeat(2,1fr);}
          .pg-header{flex-direction:column;}
          .pg-tl::before{left:30px;}
          .pg-tl-date{margin-left:50px;}
        }
        @media(max-width:480px){
          .pg-stats{grid-template-columns:1fr 1fr;gap:8px;}
          .pg-inner{padding:20px 16px 48px;}
          .pg-tl-right{flex-direction:column;align-items:flex-end;gap:2px;}
        }
      `}</style>

      <div className="pg-root">
        <div className="pg-inner">

          <button className="pg-back" onClick={() => router.push('/client')}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            Back to clients
          </button>

          {/* Header */}
          <div className="pg-header">
            <div className="pg-avatar" style={{ background: avatarColor }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pg-name">{client.full_name}</div>
              <div className="pg-meta">
                <span className="pg-meta-item">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                  {client.phone}
                </span>
                {client.email && (
                  <span className="pg-meta-item">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
                    {client.email}
                  </span>
                )}
                {client.nationality && (
                  <span className="pg-meta-item">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z"/></svg>
                    {client.nationality}
                  </span>
                )}
                <span className="pg-meta-item">
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  Registered {fmtDate(client.created_at)}
                </span>
              </div>
              {client.notes && <div className="pg-notes">{client.notes}</div>}
            </div>
          </div>

          {/* Stats */}
          <div className="pg-stats">
            {[
              { label: 'Total visits',   value: String(stats.total_visits),      sub: 'All time' },
              { label: 'Total expenses', value: fmt(stats.total_expenses ?? 0),  sub: 'Across all visits' },
              { label: 'Total invoiced', value: fmt(stats.total_invoiced),       sub: 'Billed amount' },
              { label: 'Total paid',     value: fmt(stats.total_paid),           sub: 'Payments received' },
              { label: 'Balance due',    value: fmt(stats.balance), sub: 'Outstanding', balance: true },
            ].map(({ label, value, sub, balance }) => (
              <div key={label} className={`pg-stat ${balance ? 'balance' : ''}`}>
                <div className="pg-stat-label">{label}</div>
                <div className="pg-stat-value">{value}</div>
                <div className="pg-stat-sub">{sub}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="pg-card">
            <div className="pg-tabs">
              {TABS.map(t => (
                <button key={t.key} className={`pg-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            {/* Timeline — merged chronological history, the signature view */}
            {tab === 'timeline' && (
              timeline.length === 0 ? <div className="pg-empty">No activity yet</div> :
              <div className="pg-tl">
                {Object.entries(
                  timeline.reduce((acc: Record<string, typeof timeline>, row) => {
                    const key = fmtDate(row.date);
                    (acc[key] ||= []).push(row);
                    return acc;
                  }, {})
                ).map(([dateLabel, rows]) => (
                  <div className="pg-tl-group" key={dateLabel}>
                    <div className="pg-tl-date">{dateLabel}</div>
                    {rows.map(row => {
                      const meta = kindMeta[row.kind];
                      return (
                        <div className="pg-tl-row" key={row.id}>
                          <div className="pg-tl-dot" style={{ color: meta.color }}>
                            <svg fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={meta.icon}/></svg>
                          </div>
                          <div className="pg-tl-content">
                            <div className="pg-tl-left">
                              <div className="pg-tl-kind" style={{ color: meta.color }}>{meta.label}</div>
                              <div className="pg-tl-primary">{row.primary}</div>
                              {row.secondary && <div className="pg-tl-secondary">{row.secondary}</div>}
                            </div>
                            <div className="pg-tl-right">
                              {typeof row.amount === 'number' && <span className="pg-tl-amt">{fmt(row.amount)}</span>}
                              {row.status && row.kind !== 'payment' && (
                                <span className="pg-badge" style={{ color: statusColor(row.status), background: statusBg(row.status) }}>{row.status}</span>
                              )}
                              <span className="pg-tl-time">{fmtDateTime(row.date).split(', ').pop()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Visits */}
            {tab === 'visits' && (
              visits.length === 0 ? <div className="pg-empty">No visits yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Date</th>
                  <th className="pg-th">Room</th>
                  <th className="pg-th">Reason</th>
                  <th className="pg-th">Duration</th>
                  <th className="pg-th">Status</th>
                </tr></thead>
                <tbody>
                  {visits.map((v: any) => {
                    const start = new Date(v.created_at).getTime();
                    const end   = v.completed_at ? new Date(v.completed_at).getTime() : Date.now();
                    const mins  = Math.floor((end - start) / 60000);
                    const dur   = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                    return (
                      <tr key={v.id} className="pg-tr">
                        <td className="pg-td" style={{ color:'var(--text-2)', fontSize:11 }}>{fmtDate(v.created_at)}</td>
                        <td className="pg-td">
                          {v.room_number
                            ? <span className="pg-pill">{v.room_number}</span>
                            : <span style={{ color:'var(--text-3)' }}>—</span>}
                        </td>
                        <td className="pg-td">{v.reason}</td>
                        <td className="pg-td" style={{ color:'var(--text-2)', fontSize:11 }}>{dur}</td>
                        <td className="pg-td">
                          <span className="pg-badge" style={{ color:statusColor(v.status), background:statusBg(v.status) }}>{v.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Expenses */}
            {tab === 'expenses' && (
              expenses.length === 0 ? <div className="pg-empty">No expenses yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Date</th>
                  <th className="pg-th">Visit / Reason</th>
                  <th className="pg-th">Notes</th>
                  <th className="pg-th">Category</th>
                  <th className="pg-th" style={{ textAlign:'right' }}>Amount</th>
                </tr></thead>
                <tbody>
                  {expenses.map((e: any) => (
                    <tr key={e.id} className="pg-tr">
                      <td className="pg-td" style={{ color:'var(--text-2)', fontSize:11 }}>{fmtDate(e.created_at)}</td>
                      <td className="pg-td" style={{ color:'var(--text-2)', fontSize:11 }}>{e.visit_reason || '—'}</td>
                      <td className="pg-td">{e.notes || e.name || '—'}</td>
                      <td className="pg-td" style={{ color:'var(--text-2)', fontSize:11, textTransform:'capitalize' }}>{e.category || '—'}</td>
                      <td className="pg-td" style={{ textAlign:'right', fontWeight:600 }}>{fmt(e.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop:'2px solid var(--border)' }}>
                    <td colSpan={4} className="pg-td" style={{ color:'var(--text-2)', fontSize:11, textAlign:'right' }}>Total</td>
                    <td className="pg-td" style={{ textAlign:'right', fontWeight:700, fontFamily:'Syne,sans-serif', color:'var(--accent)' }}>
                      {fmt(stats.total_expenses ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Invoices */}
            {tab === 'invoices' && (
              invoices.length === 0 ? <div className="pg-empty">No invoices yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Invoice #</th>
                  <th className="pg-th">Issued</th>
                  <th className="pg-th">Due</th>
                  <th className="pg-th" style={{ textAlign:'right' }}>Amount</th>
                  <th className="pg-th">Status</th>
                </tr></thead>
                <tbody>
                  {invoices.map((i: any) => (
                    <tr key={i.id} className="pg-tr">
                      <td className="pg-td"><span className="pg-pill">{i.invoice_number}</span></td>
                      <td className="pg-td" style={{ fontSize:11, color:'var(--text-2)' }}>{fmtDate(i.issued_date)}</td>
                      <td className="pg-td" style={{ fontSize:11, color:'var(--text-2)' }}>{i.due_date ? fmtDate(i.due_date) : <span style={{color:'var(--text-3)'}}>—</span>}</td>
                      <td className="pg-td" style={{ textAlign:'right', fontWeight:600 }}>{fmt(i.total_amount)}</td>
                      <td className="pg-td">
                        <span className="pg-badge" style={{ color:statusColor(i.status), background:statusBg(i.status) }}>{i.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Payments */}
            {tab === 'payments' && (
              payments.length === 0 ? <div className="pg-empty">No payments yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Date</th>
                  <th className="pg-th">Invoice</th>
                  <th className="pg-th">Method</th>
                  <th className="pg-th">Reference</th>
                  <th className="pg-th" style={{ textAlign:'right' }}>Amount</th>
                </tr></thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id} className="pg-tr">
                      <td className="pg-td" style={{ fontSize:11, color:'var(--text-2)' }}>{fmtDate(p.payment_date || p.created_at)}</td>
                      <td className="pg-td"><span className="pg-pill">{p.invoice_number || `#${p.invoice_id}`}</span></td>
                      <td className="pg-td" style={{ color:'var(--text-2)', textTransform:'capitalize', fontSize:11 }}>{p.method || '—'}</td>
                      <td className="pg-td" style={{ fontSize:11, color:'var(--text-2)' }}>{p.reference || <span style={{color:'var(--text-3)'}}>—</span>}</td>
                      <td className="pg-td" style={{ textAlign:'right', fontWeight:600 }}>{fmt(p.amount_paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        </div>
      </div>
    </>
  );
}