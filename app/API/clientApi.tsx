import { Invoice } from "./invoiceApi";
import { Visit } from "./visitApi";
import { Payment } from "./paymentApi";
import { Expense } from "./expenseApi";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const getHeaders = (): Record<string, string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};


export interface Client {
  name: string;
  id: number;
  full_name: string;
  phone: string;
  email: string;        
  nationality: string;
  notes?: string;
  created_at: string;
}

export interface CreateClientPayload {
  full_name: string;
  phone: string;
  email: string;
  nationality?: string;
  notes?: string;
}

export interface UpdateClientPayload {
  full_name?: string;
  phone?: string;
  email?: string;       
  nationality?: string;
  notes?: string;
}

export interface ClientProfile {
  client: Client;
  stats: {
    total_visits:   number;
    total_invoiced: number;
    total_paid:     number;
    balance:        number;
    total_expenses:  number;   
  };
  visits:   Visit[];
  invoices: Invoice[];
  payments: Payment[];
   expenses: Expense[]; 
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  return data as T;
}

/** GET /clients — fetch all clients */
export async function fetchClients(): Promise<Client[]> {
  const res = await fetch(`${BASE_URL}/clients`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Client[]>(res);
}

/** GET /clients/search?q=... — search clients */
export async function searchClients(query: string): Promise<Client[]> {
  const res = await fetch(`${BASE_URL}/clients/search?q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<Client[]>(res);
}

/** GET /clients/:id — fetch a single client */
  export async function fetchClientById(
    clientId: number,
    token?: string
  ) {
    const authToken =
      token ?? localStorage.getItem('token');

    if (!authToken) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(
      `${BASE_URL}/clients/${clientId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    return response.json();
  }

/** POST /clients — create a new client */
export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const res = await fetch(`${BASE_URL}/clients`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Client>(res);
}

/** PUT /clients/:id — update a client */
export async function updateClient(id: number, payload: UpdateClientPayload): Promise<Client> {
  const res = await fetch(`${BASE_URL}/clients/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Client>(res);
}

/** DELETE /clients/:id — delete a client (admin only) */
export async function deleteClient(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/clients/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || data.message || 'Failed to delete client.');
  }

}

/** GET /clients/:id/profile — fetch client profile with stats, visits, invoices, payments */
export async function fetchClientProfile(id: number): Promise<ClientProfile> {
  const res = await fetch(`${BASE_URL}/clients/${id}/profile`, {
    method: 'GET',
    headers: getHeaders(),
  });
  return handleResponse<ClientProfile>(res);
}