const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null; 
  return localStorage.getItem('token');
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

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

  
  if (data.token) localStorage.setItem('token', data.token);
  if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}

export async function getMe() {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (res.status === 401) {
    logout(); 
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) throw new Error('Failed to fetch session.');
  return res.json();
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