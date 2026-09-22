'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  login,
  logout,
  fetchMe,
  fetchAdminFeeRules,
  createFeeRule,
  updateFeeRule,
  deleteFeeRule,
  fetchAuditLog,
  type AdminFeeRule,
  type AuditLogEntry,
} from '@/lib/api';

const TRANSFER_TYPES = [
  'CARD_TO_CARD',
  'PAYA_INDIVIDUAL',
  'PAYA_GROUP',
  'SATNA',
  'POL_ONLINE',
  'POL_BANK',
] as const;

const FEE_TYPES = ['step', 'percent_with_min_max', 'fixed'] as const;

type FeeType = (typeof FEE_TYPES)[number];

interface RuleForm {
  name: string;
  transferTypeCode: string;
  feeType: FeeType;
  baseFeeRial: string;
  baseAmountRial: string;
  stepFeeRial: string;
  stepAmountRial: string;
  percentBp: string;
  minFeeRial: string;
  maxFeeRial: string;
  fixedFeeRial: string;
  minAmountRial: string;
  maxAmountRial: string;
  priority: string;
}

const emptyForm: RuleForm = {
  name: '',
  transferTypeCode: 'CARD_TO_CARD',
  feeType: 'percent_with_min_max',
  baseFeeRial: '0',
  baseAmountRial: '0',
  stepFeeRial: '0',
  stepAmountRial: '1',
  percentBp: '1',
  minFeeRial: '0',
  maxFeeRial: '0',
  fixedFeeRial: '0',
  minAmountRial: '10000',
  maxAmountRial: '500000000',
  priority: '0',
};

export default function AdminPage() {
  const [authState, setAuthState] = useState<'checking' | 'login' | 'ready'>(
    'checking',
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rules, setRules] = useState<AdminFeeRule[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [message, setMessage] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null);

  const [editing, setEditing] = useState<AdminFeeRule | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<AdminFeeRule | null>(null);

  const loadData = useCallback(async () => {
    const [r, a] = await Promise.all([
      fetchAdminFeeRules(true),
      fetchAuditLog(),
    ]);
    setRules(r);
    setAudit(a);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetchMe();
        setAuthState('ready');
        await loadData();
      } catch {
        setAuthState('login');
      }
    })();
  }, [loadData]);

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      await login(username, password);
      setAuthState('ready');
      await loadData();
    } catch (err) {
      setLoginError(
        (err as Error).message.includes('401')
          ? 'Invalid username or password.'
          : (err as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    await logout();
    setAuthState('login');
    setRules([]);
    setAudit([]);
  };

  const startEdit = (rule: AdminFeeRule) => {
    setEditing(rule);
    setForm({
      name: rule.name,
      transferTypeCode: rule.transferTypeCode,
      feeType: rule.feeType,
      baseFeeRial: String(rule.baseFeeRial ?? 0),
      baseAmountRial: String(rule.baseAmountRial ?? 0),
      stepFeeRial: String(rule.stepFeeRial ?? 0),
      stepAmountRial: String(rule.stepAmountRial ?? 1),
      percentBp: String(rule.percentBp ?? 0),
      minFeeRial: String(rule.minFeeRial ?? 0),
      maxFeeRial: String(rule.maxFeeRial ?? 0),
      fixedFeeRial: String(rule.fixedFeeRial ?? 0),
      minAmountRial: String(rule.minAmountRial),
      maxAmountRial: String(rule.maxAmountRial),
      priority: String(rule.priority),
    });
    setMessage(null);
  };

  const buildDto = (): Record<string, unknown> => {
    const dto: Record<string, unknown> = {
      name: form.name,
      transferTypeCode: form.transferTypeCode,
      priority: Number(form.priority) || 0,
      minAmountRial: Number(form.minAmountRial) || 0,
      maxAmountRial: Number(form.maxAmountRial) || 0,
    };
    if (form.feeType === 'step') {
      dto.feeType = 'step';
      dto.baseFeeRial = Number(form.baseFeeRial) || 0;
      dto.baseAmountRial = Number(form.baseAmountRial) || 0;
      dto.stepFeeRial = Number(form.stepFeeRial) || 0;
      dto.stepAmountRial = Number(form.stepAmountRial) || 1;
    } else if (form.feeType === 'percent_with_min_max') {
      dto.feeType = 'percent_with_min_max';
      dto.percentBp = Number(form.percentBp) || 0;
      dto.minFeeRial = Number(form.minFeeRial) || 0;
      dto.maxFeeRial = Number(form.maxFeeRial) || 0;
    } else {
      dto.feeType = 'fixed';
      dto.fixedFeeRial = Number(form.fixedFeeRial) || 0;
    }
    return dto;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (editing) {
        await updateFeeRule(editing.id, buildDto());
        setMessage({ kind: 'success', text: 'Fee rule updated.' });
      } else {
        await createFeeRule(buildDto());
        setMessage({ kind: 'success', text: 'Fee rule created.' });
      }
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (rule: AdminFeeRule) => {
    setBusy(true);
    setMessage(null);
    try {
      await updateFeeRule(rule.id, { isActive: !rule.isActive });
      await loadData();
      setMessage({
        kind: 'success',
        text: `Rule ${rule.isActive ? 'disabled' : 'enabled'}.`,
      });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    setMessage(null);
    try {
      await deleteFeeRule(confirmDelete.id);
      setConfirmDelete(null);
      await loadData();
      setMessage({ kind: 'success', text: 'Fee rule deleted.' });
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (authState === 'checking') {
    return (
      <div className="admin-shell" style={{ textAlign: 'center' }}>
        <span className="spinner" /> Loading…
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <div className="login-box admin-card">
        <h2>Admin sign-in</h2>
        <form onSubmit={doLogin}>
          <div className="form-row">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              value={username}
              autoComplete="username"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && <div className="alert error">{loginError}</div>}
          <button className="btn btn-primary" disabled={busy} type="submit">
            Sign in
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/">← Back to calculator</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Fee rule management</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/" className="btn btn-ghost btn-sm">
            Calculator
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={doLogout}>
            Sign out
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.kind}`} role="status">
          {message.text}
        </div>
      )}

      {/* Create / edit form */}
      <div className="admin-card">
        <h2>{editing ? `Edit: ${editing.name}` : 'Add a fee rule'}</h2>
        <form onSubmit={save}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <div className="form-row">
              <label htmlFor="f-name">Name</label>
              <input
                id="f-name"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={3}
              />
            </div>
            <div className="form-row">
              <label htmlFor="f-type">Transfer type</label>
              <select
                id="f-type"
                className="input"
                value={form.transferTypeCode}
                onChange={(e) =>
                  setForm({ ...form, transferTypeCode: e.target.value })
                }
              >
                {TRANSFER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="f-fee">Fee type</label>
              <select
                id="f-fee"
                className="input"
                value={form.feeType}
                onChange={(e) =>
                  setForm({ ...form, feeType: e.target.value as FeeType })
                }
              >
                {FEE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="f-priority">Priority</label>
              <input
                id="f-priority"
                className="input"
                type="number"
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
              />
            </div>

            {form.feeType === 'step' && (
              <>
                <div className="form-row">
                  <label htmlFor="f-basefee">Base fee (Rial)</label>
                  <input
                    id="f-basefee"
                    className="input"
                    type="number"
                    value={form.baseFeeRial}
                    onChange={(e) =>
                      setForm({ ...form, baseFeeRial: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="f-baseamt">Base amount (Rial)</label>
                  <input
                    id="f-baseamt"
                    className="input"
                    type="number"
                    value={form.baseAmountRial}
                    onChange={(e) =>
                      setForm({ ...form, baseAmountRial: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="f-stepfee">Step fee (Rial)</label>
                  <input
                    id="f-stepfee"
                    className="input"
                    type="number"
                    value={form.stepFeeRial}
                    onChange={(e) =>
                      setForm({ ...form, stepFeeRial: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="f-stepamt">Step amount (Rial)</label>
                  <input
                    id="f-stepamt"
                    className="input"
                    type="number"
                    value={form.stepAmountRial}
                    onChange={(e) =>
                      setForm({ ...form, stepAmountRial: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            {form.feeType === 'percent_with_min_max' && (
              <>
                <div className="form-row">
                  <label htmlFor="f-bp">
                    Percent (basis points; 1 = 0.01%)
                  </label>
                  <input
                    id="f-bp"
                    className="input"
                    type="number"
                    value={form.percentBp}
                    onChange={(e) =>
                      setForm({ ...form, percentBp: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="f-minfee">Min fee (Rial)</label>
                  <input
                    id="f-minfee"
                    className="input"
                    type="number"
                    value={form.minFeeRial}
                    onChange={(e) =>
                      setForm({ ...form, minFeeRial: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="f-maxfee">
                    Max fee (Rial, 0 = no cap)
                  </label>
                  <input
                    id="f-maxfee"
                    className="input"
                    type="number"
                    value={form.maxFeeRial}
                    onChange={(e) =>
                      setForm({ ...form, maxFeeRial: e.target.value })
                    }
                  />
                </div>
              </>
            )}

            {form.feeType === 'fixed' && (
              <div className="form-row">
                <label htmlFor="f-fixed">Fixed fee (Rial)</label>
                <input
                  id="f-fixed"
                  className="input"
                  type="number"
                  value={form.fixedFeeRial}
                  onChange={(e) =>
                    setForm({ ...form, fixedFeeRial: e.target.value })
                  }
                />
              </div>
            )}

            <div className="form-row">
              <label htmlFor="f-minamt">Min amount (Rial)</label>
              <input
                id="f-minamt"
                className="input"
                type="number"
                value={form.minAmountRial}
                onChange={(e) =>
                  setForm({ ...form, minAmountRial: e.target.value })
                }
              />
            </div>
            <div className="form-row">
              <label htmlFor="f-maxamt">Max amount (Rial, 0 = none)</label>
              <input
                id="f-maxamt"
                className="input"
                type="number"
                value={form.maxAmountRial}
                onChange={(e) =>
                  setForm({ ...form, maxAmountRial: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" disabled={busy} type="submit">
              {editing ? 'Save changes' : 'Create rule'}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Rules table */}
      <div className="admin-card">
        <h2>Current fee rules ({rules.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Fee</th>
                <th>Bounds (Rial)</th>
                <th>Active</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <div className="muted">{r.transferTypeCode}</div>
                  </td>
                  <td>{r.feeType}</td>
                  <td className="num">{describeRule(r)}</td>
                  <td className="num">
                    {r.minAmountRial.toLocaleString()} –{' '}
                    {r.maxAmountRial === 0
                      ? '∞'
                      : r.maxAmountRial.toLocaleString()}
                  </td>
                  <td>
                    <span className={`pill-active ${r.isActive ? 'on' : 'off'}`}>
                      {r.isActive ? 'active' : 'off'}
                    </span>
                  </td>
                  <td className="muted">
                    {new Date(r.updatedAt).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEdit(r)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleActive(r)}
                        disabled={busy}
                      >
                        {r.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmDelete(r)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log */}
      <div className="admin-card">
        <h2>Audit log (latest {audit.length})</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="muted">
                    {new Date(a.createdAt).toLocaleString()}
                  </td>
                  <td>{a.adminName}</td>
                  <td>
                    <code>{a.action}</code>
                  </td>
                  <td className="muted">{a.entityType}</td>
                  <td>
                    <details className="json">
                      <summary className="muted">view diff</summary>
                      <pre>
                        {JSON.stringify(
                          {
                            previous: a.previousValue
                              ? JSON.parse(a.previousValue)
                              : null,
                            next: a.newValue ? JSON.parse(a.newValue) : null,
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
          }}
        >
          <div className="admin-card" style={{ maxWidth: 420, margin: 0 }}>
            <h2>Delete fee rule?</h2>
            <p style={{ marginBottom: 16 }}>
              <strong>{confirmDelete.name}</strong> ({confirmDelete.transferTypeCode})
              will be permanently removed. This action is logged in the audit
              trail.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-danger"
                onClick={doDelete}
                disabled={busy}
              >
                Delete permanently
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function describeRule(r: AdminFeeRule): string {
  switch (r.feeType) {
    case 'step':
      return `${r.baseFeeRial} + ${(r.stepFeeRial ?? 0).toLocaleString()}/${(
        r.stepAmountRial ?? 0
      ).toLocaleString()}`;
    case 'percent_with_min_max': {
      const pct = ((r.percentBp ?? 0) / 100).toFixed(2);
      const cap = (r.maxFeeRial ?? 0) > 0 ? `– ${r.maxFeeRial}` : 'no cap';
      return `${pct}% (min ${r.minFeeRial}, ${cap})`;
    }
    case 'fixed':
      return `${r.fixedFeeRial} flat`;
    default:
      return '—';
  }
}
