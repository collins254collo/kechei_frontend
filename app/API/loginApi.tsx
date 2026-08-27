const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'; 
console.log('BASE_URL:', BASE_URL); 

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token || token === 'null' || token === 'undefined') return null; 
  return token;
};

const authHeaders = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

export async function getMe() {
  const token = getToken();

  if (!token) {
    throw new Error('No token found.');
  }

  const res = await fetch(`${BASE_URL}/auth/me`, {
    method: 'GET',
    headers: authHeaders(), 
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Unauthorized');
  }

  const text = await res.text();

  if (!text || text.trim() === '') {
    return { authenticated: true };
  }

  try {
    return JSON.parse(text);
  } catch {
    return { authenticated: true };
  }
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || data.message || 'Invalid credentials.');
  }

  if (data.token && data.token !== 'null') {
    localStorage.setItem('token', data.token);
  }
  if (data.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data;
}

export async function getAllUsers() {
  const res = await fetch(`${BASE_URL}/auth/users`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch users.');
  return res.json();
}

export async function createUser(userData: {
  full_name: string;
  email: string;
  password: string;
  role: string;
}) {
  const res = await fetch(`${BASE_URL}/auth/users`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Failed to create user.');
  return data;
}

export async function deleteUser(id: number) {
  const res = await fetch(`${BASE_URL}/auth/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete user.');
  return res.json();
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}