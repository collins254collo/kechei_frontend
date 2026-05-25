'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchClientProfile, ClientProfile } from '../../API/clientApi';

type Tab = 'visits' | 'invoices' | 'payments' | 'expenses';

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

export default function ClientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('visits');

  useEffect(() => {
    fetchClientProfile(Number(id))
      .then(setProfile)
      .catch(() => router.push('/client'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ padding: 40, fontFamily: 'DM Mono, monospace', color: '#6b6456' }}>
      Loading profile…
    </div>
  );
  if (!profile) return null;

  const { client, stats, visits, invoices, payments, expenses } = profile;

  const statusColor = (s: string) =>
    s === 'paid' || s === 'completed' ? '#2d7a47' :
    s === 'partial' || s === 'active' ? '#9a6520' : '#b03030';
  const statusBg = (s: string) =>
    s === 'paid' || s === 'completed' ? '#eaf4ee' :
    s === 'partial' || s === 'active' ? '#fef4e4' : '#fdeeed';

  const avatarColors = ['#b07a42','#4a7c6f','#6b5fa0','#8b4a6b','#4a6b8b'];
  const avatarColor = avatarColors[client.full_name.charCodeAt(0) % avatarColors.length];
  const initials = client.full_name.split(' ').slice(0,2).map((w: string) => w[0]).join('').toUpperCase();

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'visits',   label: 'Visits',   count: visits.length },
    { key: 'expenses', label: 'Expenses', count: expenses.length },
    { key: 'invoices', label: 'Invoices', count: invoices.length },
    { key: 'payments', label: 'Payments', count: payments.length },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap');
        :root {
          --bg:#f2efe9; --surface:#fff; --surface-2:#f8f6f2; --border:#e5e0d8;
          --text:#1a1714; --text-2:#6b6456; --text-3:#b0a898;
          --accent:#b07a42; --accent-h:#c48d55;
          --shadow:0 1px 3px rgba(0,0,0,0.06);
          --dot:rgba(0,0,0,0.045);
        }
        @media (prefers-color-scheme:dark) {
          :root {
            --bg:#0c0c0c; --surface:#141414; --surface-2:#1a1a1a; --border:#222;
            --text:#e0e0e0; --text-2:#686868; --text-3:#383838;
            --accent:#c9a96e; --dot:rgba(255,255,255,0.035);
          }
        }
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;}
        .pg-root{min-height:100vh;background:var(--bg);position:relative;}
        .pg-root::before{content:'';position:fixed;inset:0;pointer-events:none;
          background-image:radial-gradient(circle,var(--dot) 1px,transparent 1px);
          background-size:28px 28px;}
        .pg-inner{max-width:960px;margin:0 auto;padding:32px 24px;position:relative;z-index:1;}
        .pg-back{background:none;border:none;cursor:pointer;color:var(--text-2);
          font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.08em;
          display:flex;align-items:center;gap:6px;margin-bottom:24px;padding:0;
          text-transform:uppercase;transition:color 0.15s;}
        .pg-back:hover{color:var(--accent);}

        /* Header */
        .pg-header{background:var(--surface);border:1px solid var(--border);
          border-radius:14px;padding:28px;box-shadow:var(--shadow);margin-bottom:20px;
          display:flex;align-items:flex-start;gap:20px;}
        .pg-avatar{width:60px;height:60px;border-radius:14px;display:flex;
          align-items:center;justify-content:center;font-family:'Syne',sans-serif;
          font-size:22px;font-weight:700;color:#fff;flex-shrink:0;}
        .pg-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;
          letter-spacing:-0.5px;margin-bottom:8px;}
        .pg-meta{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;}
        .pg-meta-item{font-size:11px;color:var(--text-2);display:flex;align-items:center;gap:4px;}
        .pg-notes{font-size:11px;color:var(--text-2);line-height:1.6;
          padding:10px 14px;background:var(--surface-2);border-radius:8px;
          border:1px solid var(--border);margin-top:10px;}

        /* Stats */
        .pg-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;}
        .pg-stat{background:var(--surface);border:1px solid var(--border);
          border-radius:12px;padding:16px 18px;box-shadow:var(--shadow);
          position:relative;overflow:hidden;}
        .pg-stat::before{content:'';position:absolute;top:0;left:0;right:0;
          height:2px;background:var(--accent);opacity:0.3;}
        .pg-stat:first-child::before{opacity:1;}
        .pg-stat-label{font-size:9px;color:var(--text-2);letter-spacing:0.14em;
          text-transform:uppercase;margin-bottom:8px;}
        .pg-stat-value{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;
          letter-spacing:-0.4px;line-height:1;}
        .pg-stat-sub{font-size:10px;color:var(--text-3);margin-top:4px;}

        /* Card + Tabs */
        .pg-card{background:var(--surface);border:1px solid var(--border);
          border-radius:12px;box-shadow:var(--shadow);overflow:hidden;}
        .pg-tabs{display:flex;border-bottom:1px solid var(--border);overflow-x:auto;}
        .pg-tab{padding:14px 20px;font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.06em;text-transform:uppercase;background:none;border:none;
          cursor:pointer;color:var(--text-2);border-bottom:2px solid transparent;
          margin-bottom:-1px;transition:color 0.15s,border-color 0.15s;white-space:nowrap;}
        .pg-tab:hover{color:var(--text);}
        .pg-tab.active{color:var(--accent);border-bottom-color:var(--accent);}

        /* Table */
        .pg-table{width:100%;border-collapse:collapse;}
        .pg-th{text-align:left;padding:10px 20px;font-size:9px;color:var(--text-3);
          letter-spacing:0.14em;text-transform:uppercase;border-bottom:1px solid var(--border);
          white-space:nowrap;}
        .pg-tr{border-bottom:1px solid var(--border);transition:background 0.1s;}
        .pg-tr:last-child{border-bottom:none;}
        .pg-tr:hover{background:var(--surface-2);}
        .pg-td{padding:12px 20px;font-size:12px;color:var(--text);vertical-align:middle;}
        .pg-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
          border-radius:5px;font-size:10px;font-weight:500;text-transform:capitalize;}
        .pg-badge::before{content:'';width:5px;height:5px;border-radius:50%;
          background:currentColor;opacity:0.7;}
        .pg-pill{font-family:'DM Mono',monospace;font-size:10px;padding:3px 8px;
          border-radius:4px;background:var(--surface-2);border:1px solid var(--border);
          color:var(--text-2);}
        .pg-empty{padding:40px 20px;text-align:center;font-size:12px;color:var(--text-3);}

        @media(max-width:768px){
          .pg-stats{grid-template-columns:repeat(2,1fr);}
          .pg-header{flex-direction:column;}
        }
        @media(max-width:480px){
          .pg-stats{grid-template-columns:1fr 1fr;gap:8px;}
          .pg-inner{padding:20px 16px;}
        }
      `}</style>

      <div className="pg-root">
        <div className="pg-inner">

          <button className="pg-back" onClick={() => router.push('/client')}>
            ← Back to clients
          </button>

          {/* Header */}
          <div className="pg-header">
            <div className="pg-avatar" style={{ background: avatarColor }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <div className="pg-name">{client.full_name}</div>
              <div className="pg-meta">
                <span className="pg-meta-item">📞 {client.phone}</span>
                {client.email     && <span className="pg-meta-item">✉ {client.email}</span>}
                {client.nationality && <span className="pg-meta-item">🌍 {client.nationality}</span>}
                <span className="pg-meta-item">🗓 Registered {fmtDate(client.created_at)}</span>
              </div>
              {client.notes && <div className="pg-notes">{client.notes}</div>}
            </div>
          </div>

          {/* Stats */}
          <div className="pg-stats">
            {[
              { label: 'Total visits',    value: String(stats.total_visits),        sub: 'All time' },
              { label: 'Total expenses',  value: fmt(stats.total_expenses ?? 0),    sub: 'Across all visits' },
              { label: 'Total invoiced',  value: fmt(stats.total_invoiced),         sub: 'Billed amount' },
              { label: 'Total paid',      value: fmt(stats.total_paid),             sub: 'Payments received' },
              { label: 'Balance due',     value: fmt(stats.balance),                sub: 'Outstanding' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="pg-stat">
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