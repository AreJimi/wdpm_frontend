import {
  calculateFee,
  calculateBaseFromTotal,
  calculateFromBase,
  CalcError,
  type FeeRuleParams,
} from './engine';
import fixtures from '../../../../packages/calculation-fixtures/fixtures.json';

interface FixtureRule {
  id: string;
  kind: 'step' | 'percent_with_min_max' | 'fixed';
  baseFeeRial?: number;
  baseAmountRial?: number;
  stepFeeRial?: number;
  stepAmountRial?: number;
  percent?: number;
  minFeeRial?: number;
  maxFeeRial?: number;
  feeRial?: number;
  minAmountRial: number;
  maxAmountRial: number;
}

interface Fixtures {
  rules: FixtureRule[];
  cases: { rule: string; amount: number; expectedFee: number }[];
  inversionCases: { rule: string; total: number; expectedBase: number }[];
}

const fx = fixtures as unknown as Fixtures;

function toParams(f: FixtureRule): FeeRuleParams {
  return {
    feeType: f.kind,
    baseFeeRial: f.baseFeeRial,
    baseAmountRial: f.baseAmountRial,
    stepFeeRial: f.stepFeeRial,
    stepAmountRial: f.stepAmountRial,
    percentBp: f.percent !== undefined ? Math.round(f.percent * 100) : undefined,
    minFeeRial: f.minFeeRial,
    maxFeeRial: f.maxFeeRial,
    fixedFeeRial: f.feeRial,
    minAmountRial: f.minAmountRial,
    maxAmountRial: f.maxAmountRial,
  };
}

const rulesById = new Map(fx.rules.map((r) => [r.id, r]));
const ruleFor = (id: string): FeeRuleParams => {
  const f = rulesById.get(id);
  if (!f) throw new Error(`unknown rule ${id}`);
  return toParams(f);
};

describe('web calculation engine — shared fixtures (fee)', () => {
  it.each(fx.cases)(
    '$rule: fee($amount) === $expectedFee',
    ({ rule, amount, expectedFee }) => {
      expect(calculateFee(amount, ruleFor(rule))).toBe(expectedFee);
    },
  );
});

describe('web calculation engine — shared fixtures (inversion)', () => {
  it.each(fx.inversionCases)(
    '$rule: base($total) === $expectedBase',
    ({ rule, total, expectedBase }) => {
      const result = calculateBaseFromTotal(total, {
        ...ruleFor(rule),
        minAmountRial: 0,
      });
      expect(result.baseAmount).toBe(expectedBase);
    },
  );
});

describe('web calculation engine — validation', () => {
  const rule = ruleFor('pct-paya');

  it('rejects non-integer amounts', () => {
    expect(() => calculateFromBase(1000.5, rule)).toThrow(CalcError);
  });

  it('rejects out-of-range amounts', () => {
    expect(() => calculateFromBase(100, rule)).toThrow(CalcError);
    expect(() => calculateFromBase(500_000_001, rule)).toThrow(CalcError);
  });

  it('round-trips base -> total -> base', () => {
    for (const base of [10_000, 1_000_000, 25_000_000]) {
      const forward = calculateFromBase(base, rule);
      const back = calculateBaseFromTotal(forward.totalAmount, rule);
      expect(back.baseAmount).toBe(base);
    }
  });
});
