const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

// Types

export interface Payment {
  id: number;
  invoice_id: number;
  invoice_number?: string;
  client_full_name?: string;
  amount_paid: number;
  method: string;
  payment_date: string;
  reference?: string;
  notes?: string;
  created_at: string;
}

export interface CreatePaymentPayload {
  invoice_id: number;
  amount_paid: number;
  method: string;
  payment_date: string;
  reference?: string;
  notes?: string;
}

// Helper

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data as T;
}

// API functions

/** GET /payments — fetch all payments */
export async function fetchPayments(): Promise<Payment[]> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Payment[]>(res);
}

/** GET /payments/invoice/:invoiceId — fetch payments for a specific invoice */
export async function fetchPaymentsByInvoice(invoiceId: number): Promise<Payment[]> {
  const res = await fetch(`${BASE_URL}/payments/invoice/${invoiceId}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Payment[]>(res);
}

/** POST /payments — record a new payment */
export async function createPayment(payload: CreatePaymentPayload): Promise<Payment> {
  const res = await fetch(`${BASE_URL}/payments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Payment>(res);
}

/** DELETE /payments/:id — delete a payment (admin only) */
export async function deletePayment(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/payments/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || 'Failed to delete payment.');
  }
}