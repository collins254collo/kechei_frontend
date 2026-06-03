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
export interface Invoice {
  id: number;
  invoice_number: string;
  client_id: number;
  visit_id?: number;
  full_name: string;
  total_amount: number;
  total_expenses: number;
  status: 'unpaid' | 'partial' | 'paid';
  issued_date: string;
  due_date?: string;
  notes?: string;
}

export interface GenerateInvoicePayload {
  visit_id: number;
  due_date?: string;
  notes?: string;
}

export interface CreateInvoicePayload {
  client_id: number;
  visit_id?: number;
  total_amount: number;
  issued_date: string;
  due_date?: string;
  notes?: string;
}

export interface UpdateInvoicePayload {
  status?: 'unpaid' | 'partial' | 'paid';
  total_amount?: number;
  due_date?: string;
  notes?: string;
}

// Helper
async function handleResponse<T>(res: Response): Promise<T> {
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}): Response was not valid JSON. Check your API URL.`);
  }
  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed with status ${res.status}`;
    console.error(`[API ${res.status}] ${res.url}:`, data);
    throw new Error(message);
  }
  return data as T;
}

/** GET /invoices */
export async function fetchInvoices(): Promise<Invoice[]> {  
  const res = await fetch(`${BASE_URL}/invoices`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Invoice[]>(res);
}

/** GET /invoices/:id */
export async function fetchInvoiceById(id: number): Promise<Invoice> {
  const res = await fetch(`${BASE_URL}/invoices/${id}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Invoice>(res);
}

/** POST /invoices */
export async function createInvoice(payload: CreateInvoicePayload): Promise<Invoice> {
  const res = await fetch(`${BASE_URL}/invoices`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Invoice>(res);
}

/** POST /invoices/generate */
export async function generateInvoiceFromVisit(payload: GenerateInvoicePayload): Promise<Invoice> {
  const res = await fetch(`${BASE_URL}/invoices/generate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Invoice>(res);
}

/** PATCH /invoices/:id */
export async function updateInvoice(id: number, payload: UpdateInvoicePayload): Promise<Invoice> {
  const res = await fetch(`${BASE_URL}/invoices/${id}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Invoice>(res);
}

/** DELETE /invoices/:id */
export async function deleteInvoice(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/invoices/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || 'Failed to delete invoice.');
  }
}