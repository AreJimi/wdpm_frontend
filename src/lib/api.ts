/**
 * API client for the wdpm backend. All requests happen from the browser —
 * the static export has no server-side data fetching.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export interface PublicConfig {
  version: number;
  updatedAt: string | null;
  currency: string;
  transactions: {
    type_code: string;
    min_amount_rial: number;
    max_amount_rial: number;
    calculation: {
      kind: string;
      [key: string]: unknown;
    };
  }[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  });

  if (!res.ok) {
    let code: string | undefined;
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string; code?: string };
      message = body.message ?? message;
      code = body.code;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export function fetchPublicConfig(): Promise<PublicConfig> {
  return request<PublicConfig>('/config');
}

export function login(
  username: string,
  password: string,
): Promise<{ admin: { username: string; role: string } }> {
  return request('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return request('/admin/auth/logout', { method: 'POST' });
}

export function fetchMe(): Promise<{
  username: string;
  role: string;
  displayName: string | null;
}> {
  return request('/admin/auth/me');
}

export interface AdminFeeRule {
  id: string;
  name: string;
  transferTypeCode: string;
  feeType: 'step' | 'percent_with_min_max' | 'fixed';
  currency: string;
  baseFeeRial: number | null;
  baseAmountRial: number | null;
  stepFeeRial: number | null;
  stepAmountRial: number | null;
  percentBp: number | null;
  minFeeRial: number | null;
  maxFeeRial: number | null;
  fixedFeeRial: number | null;
  minAmountRial: number;
  maxAmountRial: number;
  isActive: boolean;
  priority: number;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchAdminFeeRules(
  includeInactive = false,
): Promise<AdminFeeRule[]> {
  return request(
    `/admin/fee-rules${includeInactive ? '?includeInactive=true' : ''}`,
  );
}

export function createFeeRule(
  dto: Record<string, unknown>,
): Promise<AdminFeeRule> {
  return request('/admin/fee-rules', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateFeeRule(
  id: string,
  dto: Record<string, unknown>,
): Promise<AdminFeeRule> {
  return request(`/admin/fee-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function deleteFeeRule(id: string): Promise<{ ok: boolean }> {
  return request(`/admin/fee-rules/${id}`, { method: 'DELETE' });
}

export interface AuditLogEntry {
  id: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousValue: string | null;
  newValue: string | null;
  ip: string | null;
  createdAt: string;
}

export function fetchAuditLog(): Promise<AuditLogEntry[]> {
  return request('/admin/audit-log');
}
