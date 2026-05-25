'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { fetchClientProfile, ClientProfile } from '../../API/clientApi';

type Tab = 'visits' | 'invoices' | 'payments';

function fmt(n: number) { return `KES ${Number(n).toLocaleString()}`; }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; }

export default function ClientProfilePage() {
  const router = useRouter();
  const { id } = useParams();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('visits');

  useEffect(() => {
    fetchClientProfile(Number(id))
      .then(setProfile)
      .catch(() => router.push('/client'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: 40, fontFamily: 'monospace' }}>Loading…</div>;
  if (!profile) return null;

  const { client, stats, visits, invoices, payments } = profile;

  const statusColor = (s: string) => s === 'paid' || s === 'completed' ? '#2d7a47' : s === 'partial' || s === 'active' ? '#9a6520' : '#b03030';
  const statusBg    = (s: string) => s === 'paid' || s === 'completed' ? '#eaf4ee' : s === 'partial' || s === 'active' ? '#fef4e4' : '#fdeeed';

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
        .pg-inner{max-width:900px;margin:0 auto;padding:32px 24px;position:relative;z-index:1;}
        .pg-back{background:none;border:none;cursor:pointer;color:var(--text-2);
          font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.08em;
          display:flex;align-items:center;gap:6px;margin-bottom:24px;padding:0;
          text-transform:uppercase;transition:color 0.15s;}
        .pg-back:hover{color:var(--accent);}
        .pg-header{background:var(--surface);border:1px solid var(--border);
          border-radius:14px;padding:28px;box-shadow:var(--shadow);margin-bottom:20px;
          display:flex;align-items:center;gap:20px;}
        .pg-avatar{width:56px;height:56px;border-radius:12px;display:flex;
          align-items:center;justify-content:center;font-family:'Syne',sans-serif;
          font-size:20px;font-weight:700;color:#fff;flex-shrink:0;}
        .pg-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:700;
          letter-spacing:-0.5px;margin-bottom:6px;}
        .pg-meta{display:flex;gap:16px;flex-wrap:wrap;}
        .pg-meta-item{font-size:11px;color:var(--text-2);}
        .pg-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
        .pg-stat{background:var(--surface);border:1px solid var(--border);
          border-radius:12px;padding:18px 20px;box-shadow:var(--shadow);position:relative;overflow:hidden;}
        .pg-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent);opacity:0.4;}
        .pg-stat-label{font-size:9px;color:var(--text-2);letter-spacing:0.16em;text-transform:uppercase;margin-bottom:8px;}
        .pg-stat-value{font-family:'Syne',sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.5px;}
        .pg-card{background:var(--surface);border:1px solid var(--border);
          border-radius:12px;box-shadow:var(--shadow);overflow:hidden;}
        .pg-tabs{display:flex;border-bottom:1px solid var(--border);}
        .pg-tab{padding:14px 20px;font-family:'DM Mono',monospace;font-size:11px;
          letter-spacing:0.08em;text-transform:uppercase;background:none;border:none;
          cursor:pointer;color:var(--text-2);border-bottom:2px solid transparent;
          margin-bottom:-1px;transition:color 0.15s,border-color 0.15s;}
        .pg-tab:hover{color:var(--text);}
        .pg-tab.active{color:var(--accent);border-bottom-color:var(--accent);}
        .pg-table{width:100%;border-collapse:collapse;}
        .pg-th{text-align:left;padding:10px 20px;font-size:9px;color:var(--text-3);
          letter-spacing:0.14em;text-transform:uppercase;border-bottom:1px solid var(--border);}
        .pg-tr{border-bottom:1px solid var(--border);}
        .pg-tr:last-child{border-bottom:none;}
        .pg-td{padding:12px 20px;font-size:12px;color:var(--text);}
        .pg-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;
          border-radius:5px;font-size:10px;font-weight:500;text-transform:capitalize;}
        .pg-badge::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;opacity:0.7;}
        .pg-empty{padding:40px 20px;text-align:center;font-size:12px;color:var(--text-3);}
        @media(max-width:600px){
          .pg-stats{grid-template-columns:repeat(2,1fr);}
          .pg-header{flex-direction:column;align-items:flex-start;}
        }
      `}</style>

      <div className="pg-root">
        <div className="pg-inner">

          {/* Back */}
          <button className="pg-back" onClick={() => router.push('/client')}>
            ← Back to clients
          </button>

          {/* Header */}
          <div className="pg-header">
            <div className="pg-avatar" style={{ background: '#b07a42' }}>
              {client.full_name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
            </div>
            <div>
              <div className="pg-name">{client.full_name}</div>
              <div className="pg-meta">
                <span className="pg-meta-item">📞 {client.phone}</span>
                {client.email && <span className="pg-meta-item">✉ {client.email}</span>}
                {client.nationality && <span className="pg-meta-item">🌍 {client.nationality}</span>}
                <span className="pg-meta-item">Registered {fmtDate(client.created_at)}</span>
              </div>
              {client.notes && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-2)' }}>{client.notes}</div>}
            </div>
          </div>

          {/* Stats */}
          <div className="pg-stats">
            {[
              { label: 'Total visits',   value: String(stats.total_visits) },
              { label: 'Total invoiced', value: fmt(stats.total_invoiced) },
              { label: 'Total paid',     value: fmt(stats.total_paid) },
              { label: 'Balance due',    value: fmt(stats.balance) },
            ].map(({ label, value }) => (
              <div key={label} className="pg-stat">
                <div className="pg-stat-label">{label}</div>
                <div className="pg-stat-value">{value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="pg-card">
            <div className="pg-tabs">
              {(['visits', 'invoices', 'payments'] as Tab[]).map(t => (
                <button key={t} className={`pg-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t} ({t === 'visits' ? visits.length : t === 'invoices' ? invoices.length : payments.length})
                </button>
              ))}
            </div>

            {/* Visits tab */}
            {tab === 'visits' && (
              visits.length === 0 ? <div className="pg-empty">No visits yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Date</th>
                  <th className="pg-th">Reason</th>
                  <th className="pg-th">Status</th>
                </tr></thead>
                <tbody>
                  {visits.map(v => (
                    <tr key={v.id} className="pg-tr">
                      <td className="pg-td" style={{ color: 'var(--text-2)', fontSize: 11 }}>{fmtDate(v.created_at)}</td>
                      <td className="pg-td">{v.reason}</td>
                      <td className="pg-td">
                        <span className="pg-badge" style={{ color: statusColor(v.status), background: statusBg(v.status) }}>{v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Invoices tab */}
            {tab === 'invoices' && (
              invoices.length === 0 ? <div className="pg-empty">No invoices yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Invoice #</th>
                  <th className="pg-th">Issued</th>
                  <th className="pg-th">Amount</th>
                  <th className="pg-th">Status</th>
                </tr></thead>
                <tbody>
                  {invoices.map(i => (
                    <tr key={i.id} className="pg-tr">
                      <td className="pg-td" style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>{i.invoice_number}</td>
                      <td className="pg-td" style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtDate(i.issued_date)}</td>
                      <td className="pg-td" style={{ fontWeight: 600 }}>{fmt(i.total_amount)}</td>
                      <td className="pg-td">
                        <span className="pg-badge" style={{ color: statusColor(i.status), background: statusBg(i.status) }}>{i.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Payments tab */}
            {tab === 'payments' && (
              payments.length === 0 ? <div className="pg-empty">No payments yet</div> :
              <table className="pg-table">
                <thead><tr>
                  <th className="pg-th">Date</th>
                  <th className="pg-th">Invoice</th>
                  <th className="pg-th">Amount</th>
                  <th className="pg-th">Method</th>
                </tr></thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="pg-tr">
                      <td className="pg-td" style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtDate(p.created_at)}</td>
                      <td className="pg-td" style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>{p.invoice_number}</td>
                      <td className="pg-td" style={{ fontWeight: 600 }}>{fmt(p.amount_paid)}</td>
                      {/* <td className="pg-td" style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{p.payment_method || '—'}</td> */}
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