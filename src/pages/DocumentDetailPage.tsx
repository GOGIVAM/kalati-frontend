import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Check, CircleDashed, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Tag } from '@/components/common/Tag';
import { ErrorState, LoadingBlock, Spinner } from '@/components/common/States';
import { documentsService } from '@/services/documents.service';
import { statusTone } from './DocumentsPage';
import { qk } from '@/lib/queryClient';
import { useLocale } from '@/hooks/useLocale';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { IngestionStep } from '@/types';

function StepIcon({ status }: { status: IngestionStep['status'] }) {
  if (status === 'done') return <Check size={14} style={{ color: 'var(--color-success)' }} />;
  if (status === 'failed') return <X size={14} style={{ color: 'var(--color-danger)' }} />;
  if (status === 'running') return <span className="k-spin" aria-hidden="true" />;
  return <CircleDashed size={14} style={{ color: 'var(--color-text-faint)' }} />;
}

export function DocumentDetailPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { documentId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1) || 1);

  const detail = useQuery({
    queryKey: qk.document(documentId),
    queryFn: () => documentsService.get(documentId),
    enabled: Boolean(documentId),
  });

  const pageQuery = useQuery({
    queryKey: qk.documentPage(documentId, page),
    queryFn: () => documentsService.page(documentId, page),
    enabled: Boolean(documentId),
  });

  const document = detail.data;
  const lastPage = document?.pageCount ?? 1;

  return (
    <AppShell>
      <div className="k-page">
        <PageHeader
          kicker={t('documents.title')}
          title={document?.title ?? t('common.loading')}
          lead={document ? document.reference : undefined}
          actions={
            <Link to="/documents" className="k-btn k-btn--ghost">
              <ArrowLeft size={15} />
              {t('documents.back')}
            </Link>
          }
        />

        {detail.isPending ? <LoadingBlock /> : null}
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : null}

        {document ? (
          <div className="k-stack">
            <div className="k-row">
              <Tag tone="accent">{t(`scopes.${document.category}`, document.category)}</Tag>
              <Tag tone={statusTone(document.status)}>
                {t(`documents.statuses.${document.status}`)}
              </Tag>
              <Tag tone="outline">
                {t('documents.columns.gradeMin')} {document.gradeMin}
              </Tag>
              <Tag tone="neutral">{t(`documents.sourceType.${document.sourceType}`)}</Tag>
              {document.lifecycle ? (
                <Tag tone={document.lifecycle === 'superseded' ? 'warning' : 'success'}>
                  {document.lifecycle === 'superseded'
                    ? t('documents.lifecycleSuperseded')
                    : t('documents.lifecycleActive')}
                </Tag>
              ) : null}
              {document.version ? (
                <Tag tone="outline">
                  {t('documents.version')} {document.version}
                </Tag>
              ) : null}
              {document.hasTables ? <Tag tone="neutral">{t('documents.hasTables')}</Tag> : null}
              {document.documentClass ? (
                <Tag tone="outline">{t(`documents.categories.${document.documentClass}`)}</Tag>
              ) : null}
              {document.ocrEngine ? (
                <Tag tone="neutral">
                  {t('documents.ocr')} · {document.ocrEngine}
                </Tag>
              ) : null}
              {document.stamped ? <Tag tone="outline">{t('documents.stamped')}</Tag> : null}
            </div>

            <div className="k-grid k-grid--4">
              <div className="k-card--ruled">
                <p className="k-card__kicker">{t('documents.columns.pages')}</p>
                <p className="k-kpi__value">{formatNumber(document.pageCount, locale)}</p>
              </div>
              <div className="k-card--ruled">
                <p className="k-card__kicker">{t('documents.columns.chunks')}</p>
                <p className="k-kpi__value">{formatNumber(document.chunkCount, locale)}</p>
              </div>
              <div className="k-card--ruled">
                <p className="k-card__kicker">{t('documents.columns.category')}</p>
                <p style={{ fontWeight: 700, marginTop: 'var(--space-2)' }}>
                  {t(`scopes.${document.category}`, document.category)}
                </p>
              </div>
              <div className="k-card--ruled">
                <p className="k-card__kicker">{t('documents.columns.indexed')}</p>
                <p style={{ fontWeight: 700, marginTop: 'var(--space-2)' }}>
                  {formatDate(document.indexedAt, locale)}
                </p>
              </div>
            </div>

            {document.supersededBy ? (
              <p className="k-notice">
                {t('documents.supersededBy')} :{' '}
                <Link to={`/documents/${document.supersededBy}`}>{document.supersededBy}</Link>
              </p>
            ) : null}

            <section>
              <h3>{t('documents.pipeline')}</h3>
              <div className="k-table-wrap" style={{ marginTop: 'var(--space-3)' }}>
                <table className="k-table">
                  <tbody>
                    {document.ingestion.steps.map((step) => (
                      <tr key={step.key}>
                        <td style={{ width: 40 }}>
                          <StepIcon status={step.status} />
                        </td>
                        <td style={{ fontWeight: 600 }}>{step.label}</td>
                        <td style={{ width: 140 }}>
                          {t(`documents.pipelineSteps.${step.status}`)}
                        </td>
                        <td style={{ width: 180 }} className="k-num">
                          {formatDateTime(step.finishedAt, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {document.ingestion.errorMessage ? (
                <p
                  style={{
                    marginTop: 'var(--space-3)',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                  }}
                >
                  {document.ingestion.errorMessage}
                </p>
              ) : null}
            </section>

            <section>
              <div className="k-row">
                <h3>{t('documents.viewer')}</h3>
                <span className="k-spacer" />
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {t('documents.pageOf', { page, total: lastPage })}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  aria-label={t('documents.prevPage')}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= lastPage}
                  aria-label={t('documents.nextPage')}
                  onClick={() => setPage((value) => Math.min(lastPage, value + 1))}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>

              <div className="k-card" style={{ marginTop: 'var(--space-3)' }}>
                {pageQuery.isPending ? (
                  <Spinner label={t('sourcePanel.loading')} />
                ) : pageQuery.isError || !pageQuery.data ? (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-faint)' }}>
                    {t('sourcePanel.unavailable')}
                  </p>
                ) : (
                  <>
                    {pageQuery.data.imageUrl ? (
                      <img
                        src={pageQuery.data.imageUrl}
                        alt=""
                        style={{
                          maxWidth: '100%',
                          border: '1px solid var(--color-border)',
                          filter: 'grayscale(1)',
                          marginBottom: 'var(--space-3)',
                        }}
                      />
                    ) : null}
                    <p className="k-panel__text">{pageQuery.data.text}</p>
                  </>
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
