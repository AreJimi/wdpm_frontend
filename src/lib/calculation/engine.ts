/**
 * wdpm.ir web calculation engine — mirrors backend/src/calculation/engine.ts
 * and is verified against the same shared fixtures
 * (backend/test/fixtures.json).
 *
 * All amounts are integer Rial. Percent math uses basis points to avoid
 * floating-point drift.
 */

export type FeeType = 'step' | 'percent_with_min_max' | 'fixed';

export interface FeeRuleParams {
  feeType: FeeType;
  baseFeeRial?: number | null;
  baseAmountRial?: number | null;
  stepFeeRial?: number | null;
  stepAmountRial?: number | null;
  /** percent in basis points (0.01% = 1) */
  percentBp?: number | null;
  minFeeRial?: number | null;
  maxFeeRial?: number | null; // 0 or null = no cap
  fixedFeeRial?: number | null;
  minAmountRial: number;
  maxAmountRial: number; // 0 = no upper bound
}

export type CalcErrorCode =
  | 'INVALID_AMOUNT'
  | 'AMOUNT_OUT_OF_RANGE'
  | 'NO_ACTIVE_RULE';

export class CalcError extends Error {
  constructor(public readonly code: CalcErrorCode, message: string) {
    super(message);
    this.name = 'CalcError';
  }
}

function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

export function calculateFee(amount: number, rule: FeeRuleParams): number {
  if (!Number.isInteger(amount)) {
    throw new CalcError('INVALID_AMOUNT', 'Amount must be integer Rial');
  }
  if (amount <= 0) return 0;

  switch (rule.feeType) {
    case 'step': {
      const baseFee = rule.baseFeeRial ?? 0;
      const baseAmount = rule.baseAmountRial ?? 0;
      const stepFee = rule.stepFeeRial ?? 0;
      const stepAmount = rule.stepAmountRial ?? 0;
      if (stepAmount <= 0) throw new Error('stepAmount must be positive');
      if (amount <= baseAmount) return baseFee;
      return baseFee + ceilDiv(amount - baseAmount, stepAmount) * stepFee;
    }
    case 'percent_with_min_max': {
      const percentBp = rule.percentBp ?? 0;
      const minFee = rule.minFeeRial ?? 0;
      const maxFee = rule.maxFeeRial ?? 0;
      const raw = Math.floor((amount * percentBp) / 10000);
      const capped =
        maxFee > 0
          ? Math.min(Math.max(raw, minFee), maxFee)
          : Math.max(raw, minFee);
      return Math.floor(capped / 10) * 10;
    }
    case 'fixed':
      return rule.fixedFeeRial ?? 0;
    default: {
      const exhaustive: never = rule.feeType;
      throw new Error(`Unknown fee type: ${String(exhaustive)}`);
    }
  }
}

export function assertWithinBounds(amount: number, rule: FeeRuleParams): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new CalcError('INVALID_AMOUNT', 'Amount must be non-negative integer Rial');
  }
  if (amount < rule.minAmountRial) {
    throw new CalcError('AMOUNT_OUT_OF_RANGE', 'Amount below minimum');
  }
  if (rule.maxAmountRial > 0 && amount > rule.maxAmountRial) {
    throw new CalcError('AMOUNT_OUT_OF_RANGE', 'Amount above maximum');
  }
}

export interface BreakdownResult {
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
}

export function calculateFromBase(
  baseAmount: number,
  rule: FeeRuleParams,
): BreakdownResult {
  assertWithinBounds(baseAmount, rule);
  const feeAmount = calculateFee(baseAmount, rule);
  return { baseAmount, feeAmount, totalAmount: baseAmount + feeAmount };
}

/** Largest integer base with total(base) <= totalAmount. */
export function calculateBaseFromTotal(
  totalAmount: number,
  rule: FeeRuleParams,
): BreakdownResult {
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new CalcError('INVALID_AMOUNT', 'Total must be positive integer Rial');
  }
  let lo = 0;
  let hi = totalAmount;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const t = mid + calculateFee(mid, rule);
    if (t <= totalAmount) lo = mid;
    else hi = mid - 1;
  }
  const fee = calculateFee(lo, rule);
  return { baseAmount: lo, feeAmount: fee, totalAmount: lo + fee };
}

// ── Wire format (matches backend /api/v1/config transactions) ──────────────

export interface WireCalculation {
  kind: string;
  base_fee_rial?: number;
  base_amount_rial?: number;
  step_fee_rial?: number;
  step_amount_rial?: number;
  percent?: number;
  min_fee_rial?: number;
  max_fee_rial?: number;
  fee_rial?: number;
}

export interface WireTransaction {
  type_code: string;
  min_amount_rial: number;
  max_amount_rial: number;
  calculation: WireCalculation;
}

export function wireToParams(t: WireTransaction): FeeRuleParams {
  const c = t.calculation;
  switch (c.kind) {
    case 'step':
      return {
        feeType: 'step',
        baseFeeRial: c.base_fee_rial,
        baseAmountRial: c.base_amount_rial,
        stepFeeRial: c.step_fee_rial,
        stepAmountRial: c.step_amount_rial,
        minAmountRial: t.min_amount_rial,
        maxAmountRial: t.max_amount_rial,
      };
    case 'percent_with_min_max':
      return {
        feeType: 'percent_with_min_max',
        // wire percent is plain percent (0.01 = 0.01%); engine uses bp
        percentBp: Math.round((c.percent ?? 0) * 100),
        minFeeRial: c.min_fee_rial,
        maxFeeRial: c.max_fee_rial,
        minAmountRial: t.min_amount_rial,
        maxAmountRial: t.max_amount_rial,
      };
    case 'fixed':
      return {
        feeType: 'fixed',
        fixedFeeRial: c.fee_rial,
        minAmountRial: t.min_amount_rial,
        maxAmountRial: t.max_amount_rial,
      };
    default:
      throw new CalcError('NO_ACTIVE_RULE', `Unknown rule kind: ${c.kind}`);
  }
}
