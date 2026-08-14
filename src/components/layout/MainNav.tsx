import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, BookText, HelpCircle, LifeBuoy } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useLocale } from '@/hooks/useLocale';
import { setLocale } from '@/i18n';
import { env } from '@/lib/env';

/** Barre de navigation secondaire du panneau central : référentiels et langue. */
export function MainNav() {
  const { t } = useTranslation();
  const locale = useLocale();
  const closeOverlays = useUiStore((s) => s.closeOverlays);
  const openGuide = useUiStore((s) => s.openGuide);

  return (
    <nav className="k-topbar">
      <span className="k-spacer" />
      <NavLink
        to="/documents"
        className={({ isActive }) => `k-topbar__link${isActive ? ' is-active' : ''}`}
        onClick={closeOverlays}
      >
        <BookText size={15} />
        {t('nav.documents')}
      </NavLink>

      <NavLink
        to="/indicateurs"
        className={({ isActive }) => `k-topbar__link${isActive ? ' is-active' : ''}`}
        onClick={closeOverlays}
      >
        <BarChart3 size={15} />
        {t('nav.metrics')}
      </NavLink>

      <button
        type="button"
        className="k-topbar__icon"
        aria-label={t('guide.open')}
        title={t('guide.open')}
        onClick={openGuide}
      >
        <HelpCircle size={17} />
      </button>

      <a
        className="k-topbar__icon"
        href={`mailto:${env.supportEmail}?subject=${encodeURIComponent(t('support.subject'))}`}
        aria-label={t('support.contact')}
        title={`${t('support.contact')} — ${env.supportEmail}`}
      >
        <LifeBuoy size={17} />
      </a>

      <div className="k-topbar__lang" role="group" aria-label={t('nav.language')}>
        {(['fr', 'en'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`k-topbar__lang-opt${locale === value ? ' is-active' : ''}`}
            aria-pressed={locale === value}
            onClick={() => setLocale(value)}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
    </nav>
  );
}
