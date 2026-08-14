import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { useLocale } from '@/hooks/useLocale';
import { formatNumber } from '@/lib/format';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="k-row" style={{ marginTop: 'var(--space-4)' }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        {t('common.results', { count: total })} · {t('common.page')} {formatNumber(page, locale)}{' '}
        {t('common.of')} {formatNumber(lastPage, locale)}
      </span>
      <span className="k-spacer" />
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={14} />
        {t('common.previous')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
      >
        {t('common.next')}
        <ChevronRight size={14} />
      </Button>
    </div>
  );
}
