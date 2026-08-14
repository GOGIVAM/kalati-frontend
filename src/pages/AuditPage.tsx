import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { Field, Input, Select } from '@/components/common/Form';
import { Tag } from '@/components/common/Tag';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/States';
import { auditService } from '@/services/audit.service';
import { qk } from '@/lib/queryClient';
import { useLocale } from '@/hooks/useLocale';
import { formatDateTime, formatDuration, formatNumber, formatScore, shortHash } from '@/lib/format';
import type { AuditEntry } from '@/types';

const outcomeTone = (outcome: AuditEntry['outcome']) =>
  outcome === 'answered' ? ('success' as const) : outcome === 'refused' ? ('warning' as const) : ('danger' as const);

function AuditContent() {
  const { t } = useTranslation();
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [outcome, setOutcome] = useState('');
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const filters = {
    page,
    pageSize: 25,
    from: from || undefined,
    to: to || undefined,
    outcome: outcome || undefined,
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.audit(filters),
    queryFn: () => auditService.list(filters),
  });

  const verify = useMutation({ mutationFn: () => auditService.verify({}) });

  return (
    <div className="k-page">
      <PageHeader
        kicker={t('app.name')}
        title={t('audit.title')}
        lead={t('audit.lead')}
        actions={
          <>
            <Button
              variant="primary"
              disabled={verify.isPending}
              onClick={() => verify.mutate()}
            >
              <ShieldCheck size={16} />
              {verify.isPending ? t('audit.verifying') : t('audit.verify')}
            </Button>
            <Button variant="secondary" onClick={() => void auditService.exportCsv({ from, to })}>
              <Download size={15} />
              {t('audit.export')}
            </Button>
          </>
        }
      />

      {verify.data ? (
        <div
          className={`k-banner${verify.data.valid ? '' : ' k-banner--warning'}`}
          style={{ marginBottom: 'var(--space-4)', borderBottomWidth: 2 }}
        >
          <ShieldCheck size={18} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <p>
            {verify.data.valid
              ? t('audit.valid', { count: verify.data.checkedCount })
              : t('audit.invalid', { id: verify.data.firstInvalidId })}
          </p>
        </div>
      ) : null}

      <div className="k-row" style={{ marginBottom: 'var(--space-4)', alignItems: 'flex-end' }}>
        <Field label={t('audit.from')} htmlFor="audit-from">
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label={t('audit.to')} htmlFor="audit-to">
          <Input
            id="audit-to"
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label={t('audit.outcome')} htmlFor="audit-outcome">
          <Select
            id="audit-outcome"
            value={outcome}
            style={{ width: 200 }}
            onChange={(event) => {
              setOutcome(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('documents.all')}</option>
            <option value="answered">{t('audit.outcomes.answered')}</option>
            <option value="refused">{t('audit.outcomes.refused')}</option>
            <option value="error">{t('audit.outcomes.error')}</option>
          </Select>
        </Field>
      </div>

      {isPending ? <LoadingBlock /> : null}
      {isError ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {data && data.items.length === 0 ? <EmptyState title={t('audit.empty')} /> : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="k-table-wrap">
            <table className="k-table">
              <thead>
                <tr>
                  <th>{t('audit.columns.id')}</th>
                  <th>{t('audit.columns.timestamp')}</th>
                  <th>{t('audit.columns.agent')}</th>
                  <th>{t('audit.columns.grade')}</th>
                  <th>{t('audit.columns.department')}</th>
                  <th>{t('audit.columns.model')}</th>
                  <th>{t('audit.columns.retrieved')}</th>
                  <th>{t('audit.columns.kept')}</th>
                  <th>{t('audit.columns.confidence')}</th>
                  <th>{t('audit.columns.faithfulness')}</th>
                  <th>{t('audit.columns.outcome')}</th>
                  <th>{t('audit.columns.latency')}</th>
                  <th>{t('audit.columns.hash')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(entry)}>
                    <td className="k-num">{entry.id}</td>
                    <td className="k-num">{formatDateTime(entry.timestamp, locale)}</td>
                    <td className="k-mono">{shortHash(entry.agentHash, 8)}</td>
                    <td className="k-num">{entry.grade}</td>
                    <td>{entry.department}</td>
                    <td className="k-mono">{entry.model}</td>
                    <td className="k-num">{formatNumber(entry.retrievedCount, locale)}</td>
                    <td className="k-num">{formatNumber(entry.keptCount, locale)}</td>
                    <td className="k-num">{formatScore(entry.confidence, locale)}</td>
                    <td className="k-num">{formatScore(entry.faithfulness, locale)}</td>
                    <td>
                      <Tag tone={outcomeTone(entry.outcome)}>
                        {t(`audit.outcomes.${entry.outcome}`)}
                      </Tag>
                    </td>
                    <td className="k-num">{formatDuration(entry.latencyMs, locale)}</td>
                    <td className="k-mono">{shortHash(entry.hash, 8)}</td>
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

      <Dialog
        open={Boolean(detail)}
        wide
        title={`${t('audit.detail')} — ${detail?.id ?? ''}`}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <div className="k-stack">
            <div className="k-grid k-grid--2">
              <div>
                <p className="k-card__kicker">{t('audit.columns.timestamp')}</p>
                <p>{formatDateTime(detail.timestamp, locale)}</p>
              </div>
              <div>
                <p className="k-card__kicker">{t('audit.columns.agent')}</p>
                <p className="k-mono">{detail.agentHash}</p>
              </div>
              <div>
                <p className="k-card__kicker">{t('audit.fields.questionHash')}</p>
                <p className="k-mono">{detail.questionHash}</p>
              </div>
              <div>
                <p className="k-card__kicker">{t('audit.fields.answerHash')}</p>
                <p className="k-mono">{detail.answerHash}</p>
              </div>
            </div>
            <div>
              <p className="k-card__kicker">{t('audit.fields.rbacFilter')}</p>
              <p className="k-mono">{detail.rbacFilter}</p>
            </div>
            <hr className="k-hr" style={{ margin: 0 }} />
            <div className="k-grid k-grid--2">
              <div>
                <p className="k-card__kicker">{t('audit.fields.prevHash')}</p>
                <p className="k-mono">{detail.prevHash}</p>
              </div>
              <div>
                <p className="k-card__kicker">{t('audit.fields.hash')}</p>
                <p className="k-mono">{detail.hash}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export function AuditPage() {
  return (
    <AppShell>
      <RoleGate role="AUDITEUR">
        <AuditContent />
      </RoleGate>
    </AppShell>
  );
}
