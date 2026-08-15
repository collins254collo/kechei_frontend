'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Single source of truth for nav items. Previously each page kept its own
// copy of this array — they'd drifted (payments page had href '/payments'
// instead of '/payment', dashboard used key 'visit' while others used
// 'visits'). Fixed here once.
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/dashboard' },
  { key: 'clients',   label: 'Clients',   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', href: '/client' },
  { key: 'visits',    label: 'Visits',    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', href: '/visit' },
  { key: 'expenses',  label: 'Expenses',  icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', href: '/expense' },
  { key: 'invoices',  label: 'Invoices',  icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/invoice' },
  { key: 'payments',  label: 'Payments',  icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', href: '/payment' },
] as const;

export type NavKey = typeof NAV[number]['key'];

interface SidebarUser {
  name?: string;
  role?: string;
}

interface SidebarProps {
  /** Which nav item is highlighted as active on this page. */
  activeKey: NavKey;
  sideOpen: boolean;
  setSideOpen: (open: boolean) => void;
  user?: SidebarUser | null;
  onLogout: () => void;
}


export default function Sidebar({ activeKey, sideOpen, setSideOpen, user, onLogout }: SidebarProps) {
  const router = useRouter();

  const navigate = (href: string) => {
    setSideOpen(false);
    router.push(href);
  };

  return (
    <>
      <style>{`
        .db-side {
          width: 220px; flex-shrink: 0;
          background: var(--sidebar-bg);
          border-right: 1px solid var(--sidebar-border);
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
          transition: transform 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        .db-side-head {
          padding: 28px 20px 24px;
          border-bottom: 1px solid var(--sidebar-border);
          display: flex; align-items: center; gap: 10px;
        }
        .db-logo { flex-shrink: 0; border-radius: 6px; }
        .db-brand-text { display: flex; flex-direction: column; }
        .db-brand {
          font-family: 'Syne', sans-serif;
          font-weight: 800; font-size: 18px;
          color: #fff; letter-spacing: -0.8px;
        }
        .db-brand-sub {
          font-size: 9px; color: #9c9690;
          letter-spacing: 0.16em; text-transform: uppercase; margin-top: 3px;
        }
        .db-nav {
          flex: 1; padding: 16px 10px;
          display: flex; flex-direction: column; gap: 2px;
          overflow-y: auto;
        }
        .db-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          font-size: 18px; color: var(--sidebar-text);
          cursor: pointer; transition: background 0.15s, color 0.15s;
          letter-spacing: 0.02em; border: none; background: none;
          width: 100%; text-align: left;
        }
        .db-nav-item:hover { background: rgba(255,255,255,0.05); color: #d4cfc8; }
        .db-nav-item.active { background: var(--sidebar-act-bg); color: var(--sidebar-active); }
        .db-nav-item svg { opacity: 0.5; flex-shrink: 0; transition: opacity 0.15s; }
        .db-nav-item:hover svg { opacity: 0.75; }
        .db-nav-item.active svg { opacity: 1; }
        .db-side-foot { padding: 16px 20px; border-top: 1px solid var(--sidebar-border); }
        .db-user-name { font-size: 16px; color: #706a62; }
        .db-user-role {
          font-size: 14px; color: #403c38; margin-top: 2px;
          text-transform: capitalize; letter-spacing: 0.06em;
        }
        .db-logout {
          margin-top: 12px; font-size: 14px; color: #4a4640;
          background: none; border: none; cursor: pointer;
          letter-spacing: 0.08em; text-transform: uppercase;
          transition: color 0.15s; padding: 0;
        }
        .db-logout:hover { color: #c9a96e; }
        .db-side-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.5); z-index: 35;
        }
        .db-side-overlay.open { display: block; }

        @media (max-width: 768px) {
          .db-side { transform: translateX(-100%); }
          .db-side.open { transform: translateX(0); }
        }
      `}</style>

      <aside className={`db-side ${sideOpen ? 'open' : ''}`}>
        <div className="db-side-head">
          <Image src="/kechei.svg" alt="Kechei" width={32} height={32} className="db-logo" />
          <div className="db-brand-text">
            <div className="db-brand">Kechei</div>
            <div className="db-brand-sub">Client Ledger</div>
          </div>
        </div>

        <nav className="db-nav">
          {NAV.map(({ key, label, icon, href }) => (
            <button
              key={key}
              className={`db-nav-item ${activeKey === key ? 'active' : ''}`}
              onClick={() => navigate(href)}
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
          <button className="db-logout" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <div className={`db-side-overlay ${sideOpen ? 'open' : ''}`} onClick={() => setSideOpen(false)} />
    </>
  );
}