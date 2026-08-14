import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/store/authStore';
import type { CriticalVerification } from '@/types';

/** Avertissement de bascule : réponse produite par le modèle léger faute de GPU. */
export function FallbackNotice() {
  const { t } = useTranslation();
  return (
    <p
      className="k-row"
      style={{
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        color: 'var(--color-warning)',
        gap: 'var(--space-2)',
      }}
    >
      <AlertTriangle size={13} />
      {t('fallback.model')}
    </p>
  );
}

/**
 * Vérification secondaire des requêtes critiques.
 * La trace de raisonnement n'est proposée qu'aux administrateurs, à des fins d'audit.
 */
export function VerificationNotice({ verification }: { verification: CriticalVerification }) {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((s) => s.user?.roles?.includes('ADMIN') ?? false);
  const [traceOpen, setTraceOpen] = useState(false);

  const confirmed = verification.verdict === 'confirmed';

  return (
    <div className="k-stack" style={{ gap: 'var(--space-1)' }}>
      <p className="k-row" style={{ gap: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
        <span className={`k-tag k-tag--${confirmed ? 'success' : 'warning'}`}>
          {confirmed ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
          {confirmed ? t('verification.confirmed') : t('verification.flagged')}
        </span>
        <span style={{ color: 'var(--color-text-faint)' }}>
          {t('verification.by', { model: verification.model })}
        </span>
        {isAdmin && verification.trace ? (
          <Button variant="ghost" size="sm" onClick={() => setTraceOpen((value) => !value)}>
            {t('verification.trace')}
          </Button>
        ) : null}
      </p>

      {traceOpen && verification.trace ? (
        <>
          <pre
            className="k-mono"
            style={{
              margin: 0,
              padding: 'var(--space-3)',
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              whiteSpace: 'pre-wrap',
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {verification.trace}
          </pre>
          <p className="k-field__hint">{t('verification.traceNote')}</p>
        </>
      ) : null}
    </div>
  );
}
