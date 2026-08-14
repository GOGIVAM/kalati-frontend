import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/PageHeader';
import { Input, Select } from '@/components/common/Form';
import { Tag } from '@/components/common/Tag';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/States';
import { documentsService } from '@/services/documents.service';
import { useScopes } from '@/hooks/useConversations';
import { qk } from '@/lib/queryClient';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatNumber } from '@/lib/format';
import type { IngestionStatus } from '@/types';

const STATUSES: IngestionStatus[] = [
  'pending',
  'ocr',
  'correction',
  'chunking',
  'embedding',
  'indexed',
  'failed',
];

export function statusTone(status: IngestionStatus) {
  if (status === 'indexed') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'pending') return 'neutral' as const;
  return 'warning' as const;
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { scopes } = useScopes();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');

  const filters = { page, pageSize: 20, search: search || undefined, category: category || undefined, status: status || undefined };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.documents(filters),
    queryFn: () => documentsService.list(filters),
  });

  return (
    <AppShell>
      <div className="k-page">
        <PageHeader
          kicker={t('app.name')}
          title={t('documents.title')}
          lead={t('documents.lead')}
        />

        <div className="k-row" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ position: 'relative', minWidth: 260, flex: 1, maxWidth: 420 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-faint)',
              }}
            />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('documents.search')}
              aria-label={t('documents.search')}
              style={{ paddingLeft: 30 }}
            />
          </div>

          <Select
            value={category}
            aria-label={t('documents.category')}
            style={{ width: 220 }}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {t('documents.category')} — {t('documents.all')}
            </option>
            {scopes.map((scope) => (
              <option key={scope.code} value={scope.code}>
                {t(`scopes.${scope.code}`, scope.label)}
              </option>
            ))}
          </Select>

          <Select
            value={status}
            aria-label={t('documents.status')}
            style={{ width: 200 }}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">
              {t('documents.status')} — {t('documents.all')}
            </option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`documents.statuses.${value}`)}
              </option>
            ))}
          </Select>
        </div>

        {isPending ? <LoadingBlock /> : null}
        {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}

        {data && data.items.length === 0 ? <EmptyState title={t('documents.empty')} /> : null}

        {data && data.items.length > 0 ? (
          <>
            <div className="k-table-wrap">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>{t('documents.columns.title')}</th>
                    <th>{t('documents.columns.reference')}</th>
                    <th>{t('documents.columns.category')}</th>
                    <th style={{ width: 90 }}>{t('documents.columns.gradeMin')}</th>
                    <th style={{ width: 80 }}>{t('documents.columns.pages')}</th>
                    <th style={{ width: 90 }}>{t('documents.columns.chunks')}</th>
                    <th style={{ width: 150 }}>{t('documents.columns.source')}</th>
                    <th style={{ width: 140 }}>{t('documents.columns.status')}</th>
                    <th style={{ width: 130 }}>{t('documents.columns.indexed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((document) => (
                    <tr
                      key={document.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/documents/${document.id}`)}
                    >
                      <td style={{ fontWeight: 600 }}>
                        {document.title}
                        {document.lifecycle === 'superseded' ? (
                          <>
                            {' '}
                            <Tag tone="warning">{t('documents.lifecycleSuperseded')}</Tag>
                          </>
                        ) : null}
                      </td>
                      <td className="k-mono">{document.reference}</td>
                      <td>
                        <Tag tone="accent">{t(`scopes.${document.category}`, document.category)}</Tag>
                      </td>
                      <td className="k-num">{document.gradeMin}</td>
                      <td className="k-num">{formatNumber(document.pageCount, locale)}</td>
                      <td className="k-num">{formatNumber(document.chunkCount, locale)}</td>
                      <td>
                        {t(`documents.sourceType.${document.sourceType}`)}
                        {document.stamped ? (
                          <>
                            {' '}
                            <Tag tone="outline">{t('documents.stamped')}</Tag>
                          </>
                        ) : null}
                      </td>
                      <td>
                        <Tag tone={statusTone(document.status)}>
                          {t(`documents.statuses.${document.status}`)}
                        </Tag>
                      </td>
                      <td className="k-num">{formatDate(document.indexedAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
