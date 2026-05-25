// hooks/useAuthGuard.ts
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe } from './API/loginApi';

type AuthState = 'loading' | 'authorized' | 'unauthorized';

export function useAuthGuard() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token || token === 'null' || token === 'undefined') {
          setAuthState('unauthorized');
          router.replace('/login');
          return;
        }

        await getMe();
        setAuthState('authorized');

      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuthState('unauthorized');
        router.replace('/login');
      }
    };

    checkAuth();
  }, [router]); 

  return {
    isAuthorized: authState === 'authorized',
    isLoading: authState === 'loading',
  };
}