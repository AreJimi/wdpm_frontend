'use client';

import { createContext, useContext } from 'react';

export type Locale = 'en' | 'fa';

export interface Strings {
  dir: 'ltr' | 'rtl';
  appTitle: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  ctaCalculator: string;
  amountLabel: string;
  amountLabelTotal: string;
  amountPlaceholder: string;
  transferType: string;
  modeAdd: string;
  modeAddHint: string;
  modeRemove: string;
  modeRemoveHint: string;
  baseAmount: string;
  feeAmount: string;
  totalAmount: string;
  rial: string;
  toman: string;
  calculate: string;
  loading: string;
  loadError: string;
  retry: string;
  offlineNotice: string;
  rangeNotice: string;
  invalidNumber: string;
  outOfRange: string;
  noRules: string;
  featuresTitle: string;
  feature1: string;
  feature2: string;
  feature3: string;
  feature4: string;
  footerNote: string;
  adminLink: string;
  language: string;
  configVersion: string;
}

const en: Strings = {
  dir: 'ltr',
  appTitle: 'We Don\u2019t Pay Much',
  tagline: 'Iranian bank transfer fee calculator',
  heroTitle: 'Know exactly what you\u2019ll pay before you transfer',
  heroSubtitle:
    'Calculate Shetabi, Paya and Satna transfer fees instantly. Always up to date with the latest official fee rules.',
  ctaCalculator: 'Open calculator',
  amountLabel: 'Base amount (Rial)',
  amountLabelTotal: 'Total amount (Rial)',
  amountPlaceholder: 'e.g. 25,000,000',
  transferType: 'Transfer type',
  modeAdd: 'Add fee',
  modeAddHint: 'You know the base amount',
  modeRemove: 'Remove fee',
  modeRemoveHint: 'You know the final total',
  baseAmount: 'Base amount',
  feeAmount: 'Fee / \u06a9\u0627\u0631\u0645\u0632\u062f',
  totalAmount: 'Total payment',
  rial: 'Rial',
  toman: 'Toman',
  calculate: 'Calculate',
  loading: 'Loading fee rules\u2026',
  loadError: 'Could not load fee rules.',
  retry: 'Retry',
  offlineNotice: 'Showing cached fee rules (offline)',
  rangeNotice: 'Allowed range: {min} \u2013 {max} Rial',
  invalidNumber: 'Please enter a valid whole number.',
  outOfRange: 'Amount must be between {min} and {max} Rial.',
  noRules: 'No fee rules are currently available.',
  featuresTitle: 'Why wdpm?',
  feature1: 'Exact official fee rules, synced from the server',
  feature2: 'Works in Rial and Toman',
  feature3: 'English & Persian, full RTL support',
  feature4: 'No sign-up, no tracking, free forever',
  footerNote: 'Fee rules are provided for information only.',
  adminLink: 'Admin',
  language: 'Language',
  configVersion: 'Fee rules v{version}',
};

const fa: Strings = {
  dir: 'rtl',
  appTitle: '\u0648\u0645\u0627 \u067e\u06cc \u0627\u0645 \u2014 \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u06af\u0631 \u06a9\u0627\u0631\u0645\u0632\u062f',
  tagline: '\u0645\u062d\u0627\u0633\u0628\u0647\u200c\u06cc \u06a9\u0627\u0631\u0645\u0632\u062f \u0627\u0646\u062a\u0642\u0627\u0644 \u0628\u0627\u0646\u06a9\u06cc',
  heroTitle: '\u0642\u0628\u0644 \u0627\u0632 \u0627\u0646\u062a\u0642\u0627\u0644\u060c \u062f\u0642\u06cc\u0642\u0627\u064b \u0628\u062f\u0627\u0646\u06cc\u062f \u0686\u0642\u062f\u0631 \u06a9\u0627\u0631\u0645\u0632\u062f \u0645\u06cc\u200c\u067e\u0631\u062f\u0627\u06cc\u06cc\u062f',
  heroSubtitle:
    '\u06a9\u0627\u0631\u0645\u0632\u062f \u0634\u062a\u0627\u0628\u06cc\u060c \u067e\u0627\u06cc\u0627 \u0648 \u0633\u0627\u062a\u0646\u0627 \u0631\u0627 \u0641\u0648\u0631\u06cc \u0645\u062d\u0627\u0633\u0628\u0647 \u06a9\u0646\u06cc\u062f. \u0647\u0645\u06cc\u0634\u0647 \u0628\u0647\u200c\u0631\u0648\u0632 \u0628\u0627 \u0622\u062e\u0631\u06cc\u0646 \u0642\u0648\u0627\u0646\u06cc\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f.',
  ctaCalculator: '\u0628\u0627\u0632 \u06a9\u0631\u062f\u0646 \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u06af\u0631',
  amountLabel: '\u0645\u0628\u0644\u063a \u067e\u0627\u06cc\u0647 (\u0631\u06cc\u0627\u0644)',
  amountLabelTotal: '\u0645\u0628\u0644\u063a \u0646\u0647\u0627\u06cc\u06cc (\u0631\u06cc\u0627\u0644)',
  amountPlaceholder: '\u0645\u062b\u0644\u0627\u064b 25,000,000',
  transferType: '\u0646\u0648\u0639 \u0627\u0646\u062a\u0642\u0627\u0644',
  modeAdd: '\u0627\u0641\u0632\u0648\u062f\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f',
  modeAddHint: '\u0645\u0628\u0644\u063a \u067e\u0627\u06cc\u0647 \u0631\u0627 \u0645\u06cc\u200c\u062f\u0627\u0646\u06cc\u062f',
  modeRemove: '\u062d\u0630\u0641 \u06a9\u0627\u0631\u0645\u0632\u062f',
  modeRemoveHint: '\u0645\u0628\u0644\u063a \u0646\u0647\u0627\u06cc\u06cc \u0631\u0627 \u0645\u06cc\u200c\u062f\u0627\u0646\u06cc\u062f',
  baseAmount: '\u0645\u0628\u0644\u063a \u067e\u0627\u06cc\u0647',
  feeAmount: '\u06a9\u0627\u0631\u0645\u0632\u062f',
  totalAmount: '\u0645\u0628\u0644\u063a \u0646\u0647\u0627\u06cc\u06cc',
  rial: '\u0631\u06cc\u0627\u0644',
  toman: '\u062a\u0648\u0645\u0627\u0646',
  calculate: '\u0645\u062d\u0627\u0633\u0628\u0647',
  loading: '\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0642\u0648\u0627\u0646\u06cc\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f\u2026',
  loadError: '\u062f\u0631\u06cc\u0627\u0641\u062a \u0642\u0648\u0627\u0646\u06cc\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f \u0645\u0645\u06a9\u0646 \u0646\u0634\u062f.',
  retry: '\u062a\u0644\u0627\u0634 \u0645\u062c\u062f\u062f',
  offlineNotice: '\u0646\u0645\u0627\u06cc\u0634 \u0642\u0648\u0627\u0646\u06cc\u0646 \u0630\u062e\u06cc\u0631\u0647\u200c\u0634\u062f\u0647 (\u0622\u0641\u0644\u0627\u06cc\u0646)',
  rangeNotice: '\u0645\u062d\u062f\u0648\u062f\u0647\u200c\u06cc \u0645\u062c\u0627\u0632: {min} \u062a\u0627 {max} \u0631\u06cc\u0627\u0644',
  invalidNumber: '\u0644\u0637\u0641\u0627\u064b \u06cc\u06a9 \u0639\u062f\u062f \u0635\u062d\u06cc\u062d \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f.',
  outOfRange: '\u0645\u0628\u0644\u063a \u0628\u0627\u06cc\u062f \u0628\u06cc\u0646 {min} \u0648 {max} \u0631\u06cc\u0627\u0644 \u0628\u0627\u0634\u062f.',
  noRules: '\u0647\u06cc\u0686 \u0642\u0627\u0646\u0648\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f\u06cc \u062f\u0631 \u062f\u0633\u062a\u0631\u0633 \u0646\u06cc\u0633\u062a.',
  featuresTitle: '\u0686\u0631\u0627 \u0648\u0645\u0627 \u067e\u06cc \u0627\u0645\u061f',
  feature1: '\u0642\u0648\u0627\u0646\u06cc\u0646 \u0631\u0633\u0645\u06cc \u06a9\u0627\u0631\u0645\u0632\u062f\u060c \u0647\u0645\u0632\u0645\u0627\u0646 \u0627\u0632 \u0633\u0631\u0648\u0631',
  feature2: '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0631\u06cc\u0627\u0644 \u0648 \u062a\u0648\u0645\u0627\u0646',
  feature3: '\u0627\u0646\u06af\u0644\u06cc\u0633\u06cc \u0648 \u0641\u0627\u0631\u0633\u06cc \u0628\u0627 \u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u06a9\u0627\u0645\u0644 RTL',
  feature4: '\u0628\u062f\u0648\u0646 \u062b\u0628\u062a\u200c\u0646\u0627\u0645\u060c \u0628\u062f\u0648\u0646 \u0631\u062f\u06cc\u0627\u0628\u06cc\u060c \u0647\u0645\u06cc\u0634\u0647 \u0631\u0627\u06cc\u06af\u0627\u0646',
  footerNote: '\u0642\u0648\u0627\u0646\u06cc\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f \u0641\u0642\u0637 \u0628\u0631\u0627\u06cc \u0627\u0637\u0644\u0627\u0639 \u0627\u0633\u062a.',
  adminLink: '\u0645\u062f\u06cc\u0631\u06cc\u062a',
  language: '\u0632\u0628\u0627\u0646',
  configVersion: '\u0642\u0648\u0627\u0646\u06cc\u0646 \u06a9\u0627\u0631\u0645\u0632\u062f \u0646\u0633\u062e\u0647 {version}',
};

export const strings: Record<Locale, Strings> = { en, fa };

export const transferTypeLabels: Record<Locale, Record<string, string>> = {
  en: {
    CARD_TO_CARD: 'Shetabi card-to-card',
    PAYA_INDIVIDUAL: 'Paya \u2013 individual',
    PAYA_GROUP: 'Paya \u2013 group',
    SATNA: 'Satna',
    POL_ONLINE: 'Pol (online)',
    POL_BANK: 'Pol (bank)',
  },
  fa: {
    CARD_TO_CARD: '\u0634\u062a\u0627\u0628\u06cc \u06a9\u0627\u0631\u062a \u0628\u0647 \u06a9\u0627\u0631\u062a',
    PAYA_INDIVIDUAL: '\u067e\u0627\u06cc\u0627 \u2014 \u0627\u0646\u0641\u0631\u0627\u062f\u06cc',
    PAYA_GROUP: '\u067e\u0627\u06cc\u0627 \u2014 \u06af\u0631\u0648\u0647\u06cc',
    SATNA: '\u0633\u0627\u062a\u0646\u0627',
    POL_ONLINE: '\u067e\u0644 (\u0627\u0646\u0644\u0627\u06cc\u0646)',
    POL_BANK: '\u067e\u0644 (\u0628\u0627\u0646\u06a9\u06cc)',
  },
};

// ── Locale context ─────────────────────────────────────────────────────────

export const LocaleContext = createContext<Locale>('en');

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useStrings(): Strings {
  return strings[useLocale()];
}
