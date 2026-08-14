import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/AppShell';
import { EmptyState } from '@/components/common/States';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className="k-page">
        <EmptyState
          title={t('common.notFoundTitle')}
          body={t('common.notFoundBody')}
          action={
            <Link to="/" className="k-btn k-btn--primary">
              {t('common.backToChat')}
            </Link>
          }
        />
      </div>
    </AppShell>
  );
}
