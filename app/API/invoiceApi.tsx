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
  final_amount: number;   
  paid_amount?: number;
  total_expenses: number;
  description?: string;
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

export interface GenerateInvoiceFromClientPayload {
  client_id: number;
  due_date?: string;
  notes?: string;
}

// Manual invoice — either an existing client_id, or a brand-new client
// described by name + email (phone optional). Never send both shapes.
export type CreateManualInvoicePayload = {
  amount: number;
  description: string;
  due_date?: string;
  notes?: string;
} & (
  | { client_id: number; client_name?: never; client_email?: never; client_phone?: never }
  | { client_id?: never; client_name: string; client_email: string; client_phone?: string }
);

export interface UnbilledPreview {
  client_id: number;
  total_expenses: number;
}

export interface SendInvoiceResponse {
  success: boolean;
  sentTo: string;
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

/** GET /invoices/preview/:client_id */
export async function previewUnbilledByClient(client_id: number): Promise<UnbilledPreview> {
  const res = await fetch(`${BASE_URL}/invoices/preview/${client_id}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<UnbilledPreview>(res);
}

/** POST /invoices/generate-from-client — bills every unbilled expense for the client */
export async function generateInvoiceFromClient(payload: GenerateInvoiceFromClientPayload): Promise<Invoice> {
  const res = await fetch(`${BASE_URL}/invoices/generate-from-client`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Invoice>(res);
}

/** POST /invoices/manual — admin-entered amount/description, existing or brand-new client */
export async function createManualInvoice(payload: CreateManualInvoicePayload): Promise<Invoice> {
  const res = await fetch(`${BASE_URL}/invoices/manual`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Invoice>(res);
}

/* POST /invoices/id/send to client email */
export async function sendInvoiceToClient(id: number): Promise<SendInvoiceResponse> {
  const res = await fetch(`${BASE_URL}/invoices/${id}/send`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse<SendInvoiceResponse>(res);
}

/** GET /invoices/:id/pdf — returns a blob URL for inline preview */
export async function fetchInvoicePdfUrl(id: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/invoices/${id}/pdf`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!res.ok) {
    let message = `Failed to load PDF (${res.status})`;
    try { const data = await res.json(); message = data.error || message; } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}