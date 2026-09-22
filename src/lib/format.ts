import type { Locale } from './i18n';

/** Locale-aware integer formatting (grouping separators). */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

/** Sanitize user input: strip separators, map Persian/Arabic digits to ASCII. */
export function parseAmount(input: string): number | null {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  let ascii = '';
  for (const ch of input.trim()) {
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
    if (ch >= '0' && ch <= '9') {
      ascii += ch;
      continue;
    }
    return null; // invalid character
  }
  if (ascii.length === 0 || ascii.length > 15) return null;
  const n = Number(ascii);
  return Number.isSafeInteger(n) ? n : null;
}

/** Group digits with locale separators as the user types. */
export function groupDigits(asciiDigits: string, locale: Locale): string {
  const sep = locale === 'fa' ? '٬' : ',';
  let out = '';
  for (let i = 0; i < asciiDigits.length; i++) {
    const idxFromRight = asciiDigits.length - i;
    out += asciiDigits[i];
    if (idxFromRight > 1 && idxFromRight % 3 === 1) out += sep;
  }

  if (locale === 'fa') {
    out = out.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  }
  return out;
}

/** Rial -> Toman (integer division, rounding down). */
export function toToman(rial: number): number {
  return Math.floor(rial / 10);
}
