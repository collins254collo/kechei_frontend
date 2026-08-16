'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe } from './API/loginApi';

type AuthState = 'loading' | 'authorized' | 'unauthorized';

export function useAuthGuard() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    //    before we try to read and validate the token
    const timer = setTimeout(async () => {
      const token = localStorage.getItem('token');
      if (!token || token === 'null' || token === 'undefined') {
        setAuthState('unauthorized');
        router.replace('/login');
        return;
      }

    try {
      const me = await getMe();
      setAuthState('authorized');
    } catch (error: unknown) {
      console.error('[useAuthGuard] getMe() threw:', error);
            const isAuthError =
          error instanceof Error &&
          (error.message.includes('Unauthorized') ||
           error.message.includes('Session expired') ||
           error.message.includes('401'));

        if (isAuthError) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }

        setAuthState('unauthorized');
        router.replace('/login');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [router]);

  return {
    isAuthorized: authState === 'authorized',
    isLoading: authState === 'loading',
  };
}