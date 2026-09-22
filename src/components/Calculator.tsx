'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocaleContext } from './LocaleProvider';
import { strings, transferTypeLabels } from '@/lib/i18n';
import { fetchPublicConfig, type PublicConfig } from '@/lib/api';
import {
  calculateFromBase,
  calculateBaseFromTotal,
  wireToParams,
  type BreakdownResult,
  type FeeRuleParams,
} from '@/lib/calculation/engine';
import { formatNumber, parseAmount, groupDigits, toToman } from '@/lib/format';

type Mode = 'add' | 'remove';

const CACHE_KEY = 'wdpm-cached-config';

interface ConfigState {
  config: PublicConfig | null;
  loading: boolean;
  error: boolean;
  fromCache: boolean;
}

export default function Calculator() {
  const { locale } = useLocaleContext();
  const t = strings[locale];

  const [configState, setConfigState] = useState<ConfigState>({
    config: null,
    loading: true,
    error: false,
    fromCache: false,
  });

  const [mode, setMode] = useState<Mode>('add');
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadConfig = async () => {
    setConfigState((s) => ({ ...s, loading: true, error: false }));
    try {
      const config = await fetchPublicConfig();
      // Validate before accepting: never replace good data with garbage.
      if (!config || !Array.isArray(config.transactions)) {
        throw new Error('invalid config');
      }
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(config));
      setConfigState({ config, loading: false, error: false, fromCache: false });
    } catch {
      // Fall back to cache; keep last valid config.
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as PublicConfig;
          if (Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
            setConfigState({
              config: parsed,
              loading: false,
              error: false,
              fromCache: true,
            });
            return;
          }
        } catch {
          // fall through to error state
        }
      }
      setConfigState((s) => ({ ...s, loading: false, error: true }));
    }
  };

  useEffect(() => {
    void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default transfer type = first available.
  useEffect(() => {
    if (typeCode === null && configState.config?.transactions.length) {
      setTypeCode(configState.config.transactions[0].type_code);
    }
  }, [configState.config, typeCode]);

  const transactions = configState.config?.transactions ?? [];

  const rule: FeeRuleParams | null = useMemo(() => {
    const tx = transactions.find((t) => t.type_code === typeCode);
    if (!tx) return null;
    try {
      return wireToParams(tx);
    } catch {
      return null;
    }
  }, [transactions, typeCode]);

  // Interactive calculation as the user types.
  const result: BreakdownResult | null = useMemo(() => {
    if (!rule) return null;
    const amount = parseAmount(amountText);
    if (amount === null || amount <= 0) return null;
    try {
      return mode === 'add'
        ? calculateFromBase(amount, rule)
        : calculateBaseFromTotal(amount, rule);
    } catch {
      return null;
    }
  }, [amountText, mode, rule]);

  // Validation error message (shown under input).
  const validationError: string | null = useMemo(() => {
    if (amountText.trim() === '') return null;
    const amount = parseAmount(amountText);
    if (amount === null) return t.invalidNumber;
    if (rule && amount > 0) {
      if (amount < rule.minAmountRial) {
        return t.outOfRange
          .replace('{min}', formatNumber(rule.minAmountRial, locale))
          .replace('{max}', formatNumber(rule.maxAmountRial, locale));
      }
      if (rule.maxAmountRial > 0 && amount > rule.maxAmountRial) {
        return t.outOfRange
          .replace('{min}', formatNumber(rule.minAmountRial, locale))
          .replace('{max}', formatNumber(rule.maxAmountRial, locale));
      }
    }
    return null;
  }, [amountText, rule, t, locale]);

  const onAmountChange = (raw: string) => {
    setError(null);
    // Keep only digits (ASCII + Persian + Arabic), regroup with separators.
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    let ascii = '';
    for (const ch of raw) {
      if (ch === ',' || ch === '٬' || ch === ' ' || ch === '\u200f' || ch === '\u200e') continue;
      const p = persian.indexOf(ch);
      if (p >= 0) {
        ascii += String(p);
        continue;
      }
      const a = arabic.indexOf(ch);
      if (a >= 0) {
        ascii += String(a);
        continue;
      }
      if (ch >= '0' && ch <= '9') ascii += ch;
    }
    if (ascii.length > 15) ascii = ascii.slice(0, 15);
    setAmountText(ascii === '' ? '' : groupDigits(ascii, locale));
  };

  const fmt = (n: number) => formatNumber(n, locale);

  return (
    <div className="calc-card">
      {configState.fromCache && (
        <div className="status-pill warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>⚠</span> {t.offlineNotice}
        </div>
      )}

      {/* Mode */}
      <div className="segmented" role="group" aria-label={t.transferType}>
        <button
          type="button"
          aria-pressed={mode === 'add'}
          onClick={() => setMode('add')}
        >
          {t.modeAdd}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'remove'}
          onClick={() => setMode('remove')}
        >
          {t.modeRemove}
        </button>
      </div>
      <p className="mode-hint" aria-live="polite">
        {mode === 'add' ? t.modeAddHint : t.modeRemoveHint}
      </p>

      {/* Transfer type chips */}
      <label className="field-label" htmlFor="transfer-chips">
        {t.transferType}
      </label>
      <div
        id="transfer-chips"
        className="chips"
        role="group"
        aria-label={t.transferType}
      >
        {configState.loading && (
          <span className="status-pill info">
            <span className="spinner" aria-hidden /> {t.loading}
          </span>
        )}
        {configState.error && (
          <span className="status-pill error">
            {t.loadError}{' '}
            <button type="button" className="btn btn-ghost btn-sm" onClick={loadConfig}>
              {t.retry}
            </button>
          </span>
        )}
        {!configState.loading &&
          !configState.error &&
          transactions.length === 0 && (
            <span className="status-pill warn">{t.noRules}</span>
          )}
        {transactions.map((tx) => (
          <button
            key={tx.type_code}
            type="button"
            className="chip"
            aria-pressed={typeCode === tx.type_code}
            onClick={() => setTypeCode(tx.type_code)}
          >
            {transferTypeLabels[locale][tx.type_code] ?? tx.type_code}
          </button>
        ))}
      </div>

      {/* Amount */}
      <label className="field-label" htmlFor="amount">
        {mode === 'add' ? t.amountLabel : t.amountLabelTotal}
      </label>
      <div className="amount-wrap">
        <input
          id="amount"
          className="amount-input"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t.amountPlaceholder}
          value={amountText}
          aria-invalid={validationError !== null}
          aria-describedby="amount-error"
          onChange={(e) => onAmountChange(e.target.value)}
        />
        <span className="suffix">{t.rial}</span>
      </div>
      <div id="amount-error" className="input-error" aria-live="polite">
        {validationError && <span aria-hidden>⚠</span>}
        {validationError}
      </div>
      {rule && (
        <p className="hint">
          {t.rangeNotice
            .replace('{min}', fmt(rule.minAmountRial))
            .replace('{max}', fmt(rule.maxAmountRial))}
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="result" aria-live="polite">
          <div className="result-row">
            <span>{t.baseAmount}</span>
            <strong className="num">{fmt(result.baseAmount)}</strong>
          </div>
          <div className="result-row">
            <span>{t.feeAmount}</span>
            <strong className="num">{fmt(result.feeAmount)}</strong>
          </div>
          <div className="result-total">
            <span className="label">{t.totalAmount}</span>
            <span>
              <span className="value">{fmt(result.totalAmount)}</span>
              <span className="toman num">
                ≈ {fmt(toToman(result.totalAmount))} {t.toman}
              </span>
            </span>
          </div>
        </div>
      )}

      {configState.config && (
        <p className="hint" style={{ marginTop: 16, textAlign: 'center' }}>
          {t.configVersion.replace(
            '{version}',
            String(configState.config.version),
          )}
        </p>
      )}
    </div>
  );
}
