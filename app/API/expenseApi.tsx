const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

//  Types 

export interface Expense {
  id: number;
  visit_id: number;
  visit_full_name?: string;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
}

export interface CreateExpensePayload {
  visit_id: number;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
}

export interface UpdateExpensePayload {
  category?: string;
  amount?: number;
  expense_date?: string;
  description?: string;
}


async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data as T;
}


/** GET /expenses/visit/:visitId — fetch all expenses for a visit */
export async function fetchExpensesByVisit(visitId: number): Promise<Expense[]> {
  const res = await fetch(`${BASE_URL}/expenses/visit/${visitId}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Expense[]>(res);
}

/** GET /expenses — fetch all expenses (used by the expenses page) */
export async function fetchExpenses(): Promise<Expense[]> {
  const res = await fetch(`${BASE_URL}/expenses`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Expense[]>(res);
}

/** POST /expenses — create a new expense */
export async function createExpense(payload: CreateExpensePayload): Promise<Expense> {
  const res = await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Expense>(res);
}

/** PUT /expenses/:id — update an expense */
export async function updateExpense(id: number, payload: UpdateExpensePayload): Promise<Expense> {
  const res = await fetch(`${BASE_URL}/expenses/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Expense>(res);
}

/** DELETE /expenses/:id — delete an expense (admin only) */
export async function deleteExpense(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/expenses/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || 'Failed to delete expense.');
  }
}