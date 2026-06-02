'use client';
import { useAuthGuard } from './useAuth';

export default function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { isAuthorized, isLoading } = useAuthGuard();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthorized) return null;

  return <>{children}</>;
}