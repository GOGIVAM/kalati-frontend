import { NavLink, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BookText,
  HelpCircle,
  History,
  Menu,
  MessageSquare,
  PanelLeft,
  ScrollText,
  Users,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Segmented } from '@/components/common/Form';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { setLocale } from '@/i18n';
import { useLocale } from '@/hooks/useLocale';
import type { Locale, Role } from '@/types';

interface Item {
  to: string;
  labelKey: string;
  icon: typeof MessageSquare;
  role?: Role;
}

const ITEMS: Item[] = [
  { to: '/', labelKey: 'nav.chat', icon: MessageSquare },
  { to: '/historique', labelKey: 'nav.history', icon: History },
  { to: '/documents', labelKey: 'nav.documents', icon: BookText },
  { to: '/indicateurs', labelKey: 'nav.metrics', icon: BarChart3 },
  { to: '/audit', labelKey: 'nav.audit', icon: ScrollText, role: 'AUDITEUR' },
  { to: '/administration', labelKey: 'nav.admin', icon: Users, role: 'ADMIN' },
];

/** Barre haute allégée : marque, sections, langue et aide.
    Le compte (paramètres, déconnexion) vit dans la barre latérale. */
export function TopNav() {
  const { t } = useTranslation();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const { navOpen, toggleNav, toggleRail, closeOverlays } = useUiStore();
  const openGuide = useUiStore((s) => s.openGuide);

  const roles = user?.roles ?? [];
  const items = ITEMS.filter((item) => !item.role || roles.includes(item.role));

  return (
    <nav className="k-nav">
      <Button
        variant="ghost"
        icon
        className="k-nav__burger"
        aria-label={t('nav.conversations')}
        onClick={toggleRail}
      >
        <PanelLeft size={18} />
      </Button>

      <Link to="/" className="k-nav__brand" onClick={closeOverlays}>
        <img className="k-nav__logo" src="/logo1.png" alt="CAMRAIL" />
        <span className="k-nav__sub">{t('app.tagline')}</span>
      </Link>

      <div className={`k-nav__links${navOpen ? ' is-open' : ''}`}>
        {items.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `k-nav__link${isActive ? ' is-active' : ''}`}
            onClick={closeOverlays}
          >
            <Icon size={15} />
            {t(labelKey)}
          </NavLink>
        ))}
      </div>

      <div className="k-nav__right">
        <Segmented<Locale>
          value={locale}
          ariaLabel={t('nav.language')}
          options={[
            { value: 'fr', label: 'FR' },
            { value: 'en', label: 'EN' },
          ]}
          onChange={setLocale}
        />
        <Button
          variant="ghost"
          icon
          aria-label={t('guide.open')}
          title={t('guide.open')}
          onClick={openGuide}
        >
          <HelpCircle size={18} />
        </Button>
        <Button
          variant="ghost"
          icon
          className="k-nav__burger"
          aria-label={t('nav.menu')}
          onClick={toggleNav}
        >
          <Menu size={18} />
        </Button>
      </div>
    </nav>
  );
}
