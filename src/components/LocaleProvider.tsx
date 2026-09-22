'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { strings } from '@/lib/i18n';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
}

const Ctx = createContext<LocaleCtx>({
  locale: 'en',
  setLocale: () => undefined,
  toggle: () => undefined,
});

export function useLocaleContext(): LocaleCtx {
  return useContext(Ctx);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem('wdpm-locale');
    if (stored === 'fa' || stored === 'en') setLocaleState(stored);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem('wdpm-locale', l);
  }, []);

  const toggle = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === 'en' ? 'fa' : 'en';
      window.localStorage.setItem('wdpm-locale', next);
      return next;
    });
  }, []);

  // Apply direction + lang to <html> for correct RTL behavior.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = strings[locale].dir;
  }, [locale]);

  return <Ctx.Provider value={{ locale, setLocale, toggle }}>{children}</Ctx.Provider>;
}
