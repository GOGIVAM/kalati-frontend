import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { ApiError } from '@/lib/httpClient';

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="k-stage">
      <span className="k-spin" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function LoadingBlock() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 'var(--space-6) 0' }}>
      <Spinner label={t('common.loading')} />
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="k-empty">
      <p className="k-empty__title">{title}</p>
      {body ? <p className="k-empty__body">{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : t('common.error');
  return (
    <div className="k-card" style={{ borderColor: 'var(--color-danger)' }}>
      <p className="k-row" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
        <AlertTriangle size={16} />
        {t('common.error')}
      </p>
      <p className="k-card__body">{message}</p>
      {onRetry ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
