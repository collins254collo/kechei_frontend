const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

const getHeaders = (): Record<string, string> => {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

// Types
export interface Visit {
  id: number;
  client_id: number;
  client_name?: string;
  full_name?: string;
  reason: string;
  notes?: string;
  room_number?: string;
  status: 'active' | 'completed';
  created_at: string;
  completed_at?: string;
  check_in?: string;
  phone: number;
}

export interface CreateVisitPayload {
  client_id: number;
  reason: string;
  notes?: string;
  room_number?: string;
  group_id?: string;
  group_name?: string;
  is_group_leader?: boolean;
}

export interface UpdateVisitPayload {
  reason?: string;
  notes?: string;
}

// Helpers
async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data as T;
}

// API functions

/** GET /visits */
export async function fetchVisits(): Promise<Visit[]> {
  const res = await fetch(`${BASE_URL}/visits`, { headers: getHeaders() });
  return handleResponse<Visit[]>(res);
}

/** GET /visits/active */
export async function fetchActiveVisits(): Promise<Visit[]> {
  const res = await fetch(`${BASE_URL}/visits/active`, { headers: getHeaders() });
  return handleResponse<Visit[]>(res);
}

/** GET /visits/client/:clientId */
export async function fetchVisitsByClient(clientId: number): Promise<Visit[]> {
  const res = await fetch(`${BASE_URL}/visits/client/${clientId}`, { headers: getHeaders() });
  return handleResponse<Visit[]>(res);
}

/** GET /visits/:id */
export async function fetchVisitById(id: number): Promise<Visit> {
  const res = await fetch(`${BASE_URL}/visits/${id}`, { headers: getHeaders() });
  return handleResponse<Visit>(res);
}

/** POST /visits */
export async function createVisit(payload: CreateVisitPayload): Promise<Visit> {
  const res = await fetch(`${BASE_URL}/visits`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Visit>(res);
}

/** PATCH /visits/:id/complete */
export async function completeVisit(id: number): Promise<Visit> {
  const res = await fetch(`${BASE_URL}/visits/${id}/complete`, {
    method: 'PATCH',
    headers: getHeaders(),
  });
  return handleResponse<Visit>(res);
}

/** PUT /visits/:id */
export async function updateVisit(id: number, payload: UpdateVisitPayload): Promise<Visit> {
  const res = await fetch(`${BASE_URL}/visits/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Visit>(res);
}

/** DELETE /visits/:id */
export async function deleteVisit(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/visits/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || 'Failed to delete visit.');
  }
}