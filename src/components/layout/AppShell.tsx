import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PanelLeft } from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { ConversationRail } from './ConversationRail';
import { MainNav } from './MainNav';
import { SourcePanel } from './SourcePanel';
import { GuideDialog } from './GuideDialog';
import { HealthBanner, TransparencyGate } from './Transparency';

interface AppShellProps {
  children: ReactNode;
  /** Colonne de droite (historique sur la conversation). */
  aside?: ReactNode;
}

export function AppShell({ children, aside }: AppShellProps) {
  const { t } = useTranslation();
  const { railOpen, toggleRail, closeOverlays, activeCitation } = useUiStore();

  return (
    <div className="k-shell">
      <button
        type="button"
        className="k-burger"
        aria-label={t('nav.menu')}
        onClick={toggleRail}
      >
        <PanelLeft size={18} />
      </button>

      <ConversationRail />

      <div className="k-main">
        <MainNav />
        <HealthBanner />
        {children}
      </div>

      {activeCitation ? <SourcePanel /> : aside}

      {railOpen ? <div className="k-scrim" role="presentation" onClick={closeOverlays} /> : null}
      <TransparencyGate />
      <GuideDialog />
    </div>
  );
}
