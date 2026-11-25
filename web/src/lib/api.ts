import { auth } from './firebase';
import type {
  Category,
  Catalog,
  CatalogItem,
  Memo,
  MemoSummary,
  Settings,
  SummaryResult,
  UserProfile,
} from '../types';

const API_BASE =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api').replace(/\/$/, '');

export type BlockedStatus = 'pending' | 'rejected' | 'revoked';

let accountBlockedHandler: ((status: BlockedStatus) => void) | null = null;

export function setAccountBlockedHandler(
  handler: ((status: BlockedStatus) => void) | null
): void {
  accountBlockedHandler = handler;
}

const BLOCKED_CODES: Record<string, BlockedStatus> = {
  ACCOUNT_PENDING: 'pending',
  ACCOUNT_REJECTED: 'rejected',
  ACCOUNT_REVOKED: 'revoked',
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

interface ValidationDetail {
  path?: string;
  message?: string;
}

function messageFromPayload(payload: unknown): {
  code: string;
  message: string;
  details?: unknown;
} {
  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'object' && error !== null) {
      const code =
        typeof (error as { code?: unknown }).code === 'string'
          ? (error as { code: string }).code
          : 'REQUEST_FAILED';
      let message =
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : 'Something went wrong. Please try again.';
      const details = (error as { details?: unknown }).details;
      if (Array.isArray(details) && details.length > 0) {
        const first = details[0] as ValidationDetail;
        if (first && typeof first.message === 'string' && code === 'VALIDATION_ERROR') {
          message = first.message;
        }
      }
      return { code, message, details };
    }
  }
  return { code: 'REQUEST_FAILED', message: 'Something went wrong. Please try again.' };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, forceRefresh = false, signal } = options;
  const currentUser = auth?.currentUser ?? null;
  if (!currentUser) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  const token = await currentUser.getIdToken(forceRefresh);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Network error. Check your connection and try again.'
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (response.status === 401 && !forceRefresh) {
    return request<T>(path, { ...options, forceRefresh: true });
  }

  if (!response.ok) {
    const { code, message, details } = messageFromPayload(payload);
    if (response.status === 403) {
      const blocked = BLOCKED_CODES[code];
      if (blocked) accountBlockedHandler?.(blocked);
    }
    throw new ApiError(response.status, code, message, details);
  }

  return payload as T;
}

export const api = {
  me: () => request<{ user: UserProfile }>('/auth/me'),

  getCatalog: () => request<Catalog>('/catalog'),

  createCategory: (name: string) =>
    request<{ category: Category }>('/categories', {
      method: 'POST',
      body: { name },
    }),

  renameCategory: (id: string, name: string) =>
    request<{ category: Category }>(`/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: { name },
    }),

  deleteCategory: (id: string) =>
    request<{ archivedItemCount: number }>(`/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  createItem: (input: { categoryId: string; name: string; defaultRate: number }) =>
    request<{ item: CatalogItem }>('/items', { method: 'POST', body: input }),

  updateItem: (
    id: string,
    input: { name?: string; defaultRate?: number }
  ) =>
    request<{ item: CatalogItem }>(`/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: input,
    }),

  deleteItem: (id: string) =>
    request<{ ok: boolean }>(`/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getSettings: () => request<{ settings: Settings }>('/settings'),

  saveSettings: (printHeading: string) =>
    request<{ settings: Settings }>('/settings', {
      method: 'PUT',
      body: { printHeading },
    }),

  createMemo: (input: {
    clientRequestId: string;
    shopName: string;
    address: string;
    note: string;
    discount: { type: 'none' | 'fixed' | 'percentage'; value: number };
    lines: Array<{ itemId: string; rate: number; quantity: number }>;
  }) =>
    request<{ memo: Memo; duplicate: boolean }>('/memos', {
      method: 'POST',
      body: input,
    }),

  listMemos: () => request<{ memos: MemoSummary[] }>('/memos'),

  getMemo: (id: string) =>
    request<{ memo: Memo }>(`/memos/${encodeURIComponent(id)}`),

  deleteMemo: (id: string) =>
    request<{ ok: boolean; alreadyDeleted: boolean; deletedAt: string }>(
      `/memos/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    ),

  getSummary: (range: { from: string; to: string } | null) => {
    const query = range
      ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      : '';
    return request<SummaryResult>(`/summary${query}`);
  },

  adminListUsers: () => request<{ users: UserProfile[] }>('/admin/users'),

  adminApprove: (uid: string) =>
    request<{ user: UserProfile }>(
      `/admin/users/${encodeURIComponent(uid)}/approve`,
      { method: 'POST' }
    ),

  adminReject: (uid: string) =>
    request<{ user: UserProfile }>(
      `/admin/users/${encodeURIComponent(uid)}/reject`,
      { method: 'POST' }
    ),

  adminRevoke: (uid: string) =>
    request<{ user: UserProfile }>(
      `/admin/users/${encodeURIComponent(uid)}/revoke`,
      { method: 'POST' }
    ),
};
