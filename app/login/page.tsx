'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../API/loginApi'; 

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) router.replace('/dashboard');
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        const data = await login(email, password);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        // console.log('Login successful:', data);
        router.push('/dashboard');
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Could not reach the server. Check your connection.');
        }
      } finally {
        setLoading(false);
      }
    };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap');

        /* ── Tokens: Light ── */
        :root {
          --bg:          #f4f1ec;
          --panel:       #ffffff;
          --border:      #e2ddd6;
          --text:        #1c1916;
          --text-muted:  #9b9085;
          --text-dim:    #c8c0b5;
          --accent:      #b07d4a;
          --accent-h:    #c4915e;
          --input-bg:    #faf8f5;
          --placeholder: #cdc6bc;
          --grid-dot:    rgba(0,0,0,0.055);
          --glow:        rgba(176,125,74,0.07);
          --stat-bg:     rgba(0,0,0,0.025);
          --err-bg:      rgba(190,60,60,0.06);
          --err-bd:      rgba(190,60,60,0.16);
          --err-tx:      #b83c3c;
          --ver-tx:      #d4cdc6;
          --footer-tx:   #d0c9c1;
          --corner-bd:   #e2ddd6;
        }

        /*  Tokens: Dark */
        @media (prefers-color-scheme: dark) {
          :root {
            --bg:          #0b0b0b;
            --panel:       #111111;
            --border:      #1d1d1d;
            --text:        #e4e4e4;
            --text-muted:  #e8d0d0;
            --text-dim:    #e9d9d9;
            --accent:      #c9a96e;
            --accent-h:    #dbbf85;
            --input-bg:    #0b0b0b;
            --placeholder: #2c2c2c;
            --grid-dot:    rgba(255,255,255,0.05);
            --glow:        rgba(201,169,110,0.08);
            --stat-bg:     rgba(255,255,255,0.02);
            --err-bg:      rgba(220,80,80,0.07);
            --err-bd:      rgba(220,80,80,0.18);
            --err-tx:      #e07878;
            --ver-tx:      #282828;
            --footer-tx:   #cdbebe;
            --corner-bd:   #1d1d1d;
          }
        }

        /*  Reset  */
        *, *::before, *::after { box-sizing: border-box; }

        /*  Page shell */
        .kl-root {
          font-family: 'DM Mono', monospace;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          display: flex;
          overflow: hidden;
          position: relative;
          -webkit-font-smoothing: antialiased;
        }

        .kl-grid {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image: radial-gradient(circle, var(--grid-dot) 1px, transparent 1px);
          background-size: 30px 30px;
        }

        .kl-blob {
          position: fixed; pointer-events: none; z-index: 0;
          top: -220px; right: -220px;
          width: 680px; height: 680px;
          background: radial-gradient(circle, var(--glow) 0%, transparent 65%);
        }

        /* ── Left panel ── */
        .kl-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 64px;
          position: relative;
          z-index: 1;
        }

        .kl-logo { display: flex; align-items: baseline; gap: 12px; }

        .kl-logo-name {
          font-family: 'Syne', sans-serif;
          font-weight: 800; font-size: 24px;
          color: var(--text); letter-spacing: -1.2px;
        }

        .kl-logo-sub {
          font-size: 10px; color: var(--text-dim);
          letter-spacing: 0.18em; text-transform: uppercase;
        }

        .kl-hero { max-width: 380px; }

        .kl-h1 {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: clamp(34px, 4vw, 54px);
          line-height: 1.0; letter-spacing: -2.5px;
          color: var(--text); margin-bottom: 18px;
        }

        .kl-h1 em { font-style: normal; color: var(--accent); }

        .kl-desc {
          font-size: 12px; color: var(--text-muted);
          line-height: 1.85; letter-spacing: 0.04em;
          
        }

        .kl-stats { display: flex; gap: 12px; margin-top: 32px; flex-wrap: wrap; }

        .kl-stat {
          border: 1px solid var(--border); border-radius: 10px;
          padding: 11px 16px; background: var(--stat-bg);
        }

        .kl-stat-v {
          font-family: 'Syne', sans-serif; font-size: 19px;
          font-weight: 700; color: var(--accent); letter-spacing: -0.8px;
        }

        .kl-stat-l {
          font-size: 9px; color: var(--text-muted);
          letter-spacing: 0.14em; text-transform: uppercase; margin-top: 2px;
        }

        .kl-ver { font-size: 10px; color: var(--ver-tx); letter-spacing: 0.1em; }

        /*  Right panel  */
        .kl-right {
          width: 440px; flex-shrink: 0;
          background: var(--panel);
          border-left: 1px solid var(--border);
          display: flex; flex-direction: column;
          justify-content: center;
          padding: 60px 52px;
          position: relative; z-index: 1;
        }

        .kl-right::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--accent) 0%, transparent 55%);
        }

        .kl-corner {
          position: absolute; bottom: 44px; right: 44px;
          width: 36px; height: 36px;
          border-right: 1px solid var(--corner-bd);
          border-bottom: 1px solid var(--corner-bd);
        }

        /* Mobile logo (hidden on desktop) */
        .kl-mob-logo { display: none; align-items: baseline; gap: 10px; margin-bottom: 36px; }

        .kl-eyebrow {
          font-size: 9px; color: var(--text-muted);
          letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px;
        }

        .kl-title {
          font-family: 'Syne', sans-serif; font-size: 22px;
          font-weight: 700; color: var(--text);
          letter-spacing: -0.6px; margin-bottom: 40px;
        }

        .kl-field { margin-bottom: 22px; }

        .kl-label {
          display: block; font-size: 9px; color: var(--text-muted);
          letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 8px;
        }

        .kl-input {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--border); border-radius: 8px;
          padding: 13px 16px;
          font-family: 'DM Mono', monospace; font-size: 13px;
          color: var(--text);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          -webkit-appearance: none; appearance: none;
        }

        .kl-input::placeholder { color: var(--placeholder); }

        .kl-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(176,125,74,0.12);
        }

        .kl-err {
          font-size: 11px; color: var(--err-tx);
          background: var(--err-bg); border: 1px solid var(--err-bd);
          border-radius: 8px; padding: 11px 14px;
          margin-bottom: 18px; letter-spacing: 0.03em;
        }

        .kl-btn {
          width: 100%; background: var(--accent); color: #ffffff;
          border: none; border-radius: 8px; padding: 15px;
          font-family: 'DM Mono', monospace; font-size: 11px;
          font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.15s, transform 0.1s, opacity 0.15s;
          margin-top: 6px;
        }

        .kl-btn:hover:not(:disabled)  { background: var(--accent-h); }
        .kl-btn:active:not(:disabled) { transform: scale(0.985); }
        .kl-btn:disabled { opacity: 0.38; cursor: not-allowed; }

        .kl-footer {
          margin-top: 34px; font-size: 10px;
          color: var(--footer-tx); letter-spacing: 0.08em; text-align: center;
        }

        /* ── Spinner ── */
        @keyframes kl-spin { to { transform: rotate(360deg); } }
        .kl-spin { animation: kl-spin 0.7s linear infinite; }

        /* ── Entrance ── */
        @keyframes kl-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes kl-slide {
          from { opacity: 0; transform: translateX(22px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .kl-left  { animation: kl-up    0.65s cubic-bezier(0.16,1,0.3,1) both; }
        .kl-right { animation: kl-slide 0.65s cubic-bezier(0.16,1,0.3,1) 0.08s both; }

        .kl-a1 { animation: kl-up 0.45s ease 0.26s both; }
        .kl-a2 { animation: kl-up 0.45s ease 0.32s both; }
        .kl-a3 { animation: kl-up 0.45s ease 0.38s both; }
        .kl-a4 { animation: kl-up 0.45s ease 0.44s both; }
        .kl-a5 { animation: kl-up 0.45s ease 0.52s both; }

        /* ── Tablet ── */
        @media (max-width: 1024px) {
          .kl-left  { padding: 40px 44px; }
          .kl-right { width: 390px; padding: 52px 44px; }
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .kl-root  { flex-direction: column; }
          .kl-left  { display: none; }
          .kl-right {
            width: 100%; border-left: none;
            min-height: 100vh;
            padding: 52px 28px 48px;
            justify-content: center;
          }
          .kl-mob-logo { display: flex; }
          .kl-corner   { display: none; }
        }

        /* ── Small mobile ── */
        @media (max-width: 400px) {
          .kl-right { padding: 44px 20px 40px; }
          .kl-title { font-size: 20px; }
        }
      `}</style>

      <div className="kl-root">
        <div className="kl-grid" />
        <div className="kl-blob" />

        {/* ── LEFT ── */}
        <div className={`kl-left ${mounted ? '' : 'opacity-0'}`}>
          <div className="kl-logo">
            <span className="kl-logo-name">Kechei</span>
            <span className="kl-logo-sub">Client Ledger</span>
          </div>

          <div className="kl-hero">
            <h1 className="kl-h1">
              Track every<br />
              client.<br />
              <em>Every shilling.</em>
            </h1>
            <p className="kl-desc">
              Visits · Expenses · Invoices · Payments<br />
              All in one secure place.
            </p>
            <div className="kl-stats">
              {[
                { val: '∞', lbl: 'Clients' },
                { val: '0', lbl: 'Lost records' },
                { val: '1', lbl: 'Source of truth' },
              ].map(({ val, lbl }) => (
                <div key={lbl} className="kl-stat">
                  <div className="kl-stat-v">{val}</div>
                  <div className="kl-stat-l">{lbl}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="kl-ver">v1.0.0</div>
        </div>

        {/* ── RIGHT ── */}
        <div className={`kl-right ${mounted ? '' : 'opacity-0'}`}>
          <div className="kl-corner" />

          {/* Mobile logo */}
          <div className="kl-mob-logo">
            <span className="kl-logo-name" style={{ fontSize: '20px' }}>Kechei</span>
            <span className="kl-logo-sub">Client Ledger</span>
          </div>

          <p className="kl-eyebrow kl-a1">Secure access</p>
          <h2 className="kl-title kl-a2">Sign in</h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className="kl-field kl-a3">
              <label htmlFor="email" className="kl-label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@kechei.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="kl-input"
              />
            </div>

            <div className="kl-field kl-a4">
              <label htmlFor="password" className="kl-label">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="kl-input"
              />
            </div>

            {error && <div className="kl-err">{error}</div>}

            <div className="kl-a5">
              <button type="submit" disabled={loading} className="kl-btn">
                {loading && (
                  <svg className="kl-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
                <span>{loading ? 'Signing in…' : 'Sign in →'}</span>
              </button>
            </div>
          </form>

          <p className="kl-footer">Kechei — Authorised users only</p>
        </div>
      </div>
    </>
  );
}