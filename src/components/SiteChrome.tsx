'use client';

import Link from 'next/link';
import { useLocaleContext } from './LocaleProvider';
import { strings } from '@/lib/i18n';

export function SiteHeader() {
  const { locale, toggle } = useLocaleContext();
  const t = strings[locale];

  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ₾
          </span>
          {t.appTitle}
        </Link>
        <div className="header-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={toggle}
            aria-label={t.language}
          >
            {locale === 'en' ? 'فارسی' : 'English'}
          </button>
          <Link href="/admin/" className="btn btn-ghost btn-sm">
            {t.adminLink}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { locale } = useLocaleContext();
  const t = strings[locale];

  return (
    <footer className="site-footer">
      <div className="container">
        <span>
          © {new Date().getFullYear()} wdpm.ir — {t.tagline}
        </span>
        <span>{t.footerNote}</span>
      </div>
    </footer>
  );
}
