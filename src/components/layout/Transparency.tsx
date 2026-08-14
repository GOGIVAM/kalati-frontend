import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Info, ShieldAlert, WifiOff } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { authService } from '@/services/auth.service';
import { qk } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { useOnline, useQuestionQueue } from '@/hooks/useOnline';

/**
 * Notice de transparence IA (§ IV.3 du cahier des charges).
 * Affichée en modale à la première connexion, puis rappelée par un bandeau.
 */
export function TransparencyGate() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const accept = useAuthStore((s) => s.acceptTransparency);
  const transparencyOpen = useUiStore((s) => s.transparencyOpen);
  const closeTransparency = useUiStore((s) => s.closeTransparency);

  const firstTime = Boolean(user && !user.transparencyAccepted);
  const open = firstTime || transparencyOpen;

  return (
    <Dialog
      open={open}
      wide
      title={t('transparency.title')}
      onClose={() => (firstTime ? void accept() : closeTransparency())}
      actions={
        <Button
          variant="primary"
          onClick={() => {
            if (firstTime) void accept();
            closeTransparency();
          }}
        >
          {t('transparency.accept')}
        </Button>
      }
    >
      <div className="k-stack">
        <p>{t('transparency.p1')}</p>
        <p style={{ fontWeight: 600 }}>{t('transparency.p2')}</p>
        <p>{t('transparency.p3')}</p>
        <p>{t('transparency.p4')}</p>
        <p className="k-notice">
          {t('app.client')} · {t('app.intranet')}
        </p>
      </div>
    </Dialog>
  );
}

/** Rappel permanent au-dessus de la conversation. */
export function TransparencyBanner() {
  const { t } = useTranslation();
  const openTransparency = useUiStore((s) => s.openTransparency);

  return (
    <div className="k-banner">
      <ShieldAlert size={15} className="k-banner__icon" />
      <p className="k-banner__text">
        {t('transparency.banner')}{' '}
        <button type="button" className="k-banner__link" onClick={openTransparency}>
          {t('transparency.bannerAction')}
        </button>
      </p>
    </div>
  );
}

/** Bandeau d'état du système, affiché seulement si un composant est dégradé. */
export function HealthBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const queued = useQuestionQueue((s) => s.items.length);
  const { data } = useQuery({
    queryKey: qk.health,
    queryFn: () => authService.health(),
    refetchInterval: 60_000,
    retry: false,
    enabled: online,
  });

  if (!online) {
    return (
      <div className="k-banner k-banner--warning">
        <WifiOff size={15} className="k-banner__icon" />
        <p className="k-banner__text">{t('offline.banner')}</p>
        {queued > 0 ? (
          <span className="k-tag k-tag--warning">{t('offline.queued', { count: queued })}</span>
        ) : null}
      </div>
    );
  }

  if (!data || data.status === 'ok') return null;

  const down = Object.entries(data.components)
    .filter(([, state]) => state !== 'ok')
    .map(([name]) => name);

  return (
    <div className="k-banner k-banner--warning">
      <Info size={15} className="k-banner__icon" />
      <p className="k-banner__text">
        {t('health.degraded')}
        {down.length ? ` — ${t('health.components')} : ${down.join(', ')}` : ''}
      </p>
    </div>
  );
}
