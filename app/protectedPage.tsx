'use client';
import { useAuthGuard } from './useAuth';

export default function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { isAuthorized, isLoading } = useAuthGuard();

  if (isLoading) return (
    <div style={{
      minHeight: '100vh',
      background: '#f2efe9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'DM Mono, monospace',
      fontSize: '12px',
      color: '#b0a898',
      letterSpacing: '0.08em',
    }}>
      Verifying session…
    </div>
  );

  if (!isAuthorized) return null;

  return <>{children}</>;
}