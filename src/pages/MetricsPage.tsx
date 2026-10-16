import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/PageHeader';
import { Segmented } from '@/components/common/Form';
import { Tag } from '@/components/common/Tag';
import { ErrorState, LoadingBlock } from '@/components/common/States';
import { metricsService, type MetricsRange } from '@/services/metrics.service';
import { qk } from '@/lib/queryClient';
import { useLocale } from '@/hooks/useLocale';
import { env } from '@/lib/env';
import { formatDateTime, formatDuration, formatNumber, formatPercent, formatScore } from '@/lib/format';
import type { Metric } from '@/types';

function Kpi({
  label,
  value,
  metric,
  invertDelta = false,
}: {
  label: string;
  value: string;
  metric?: Metric;
  invertDelta?: boolean;
}) {
  const locale = useLocale();
  const delta = metric?.delta ?? 0;
  const good = invertDelta ? delta < 0 : delta > 0;
  const tone = delta === 0 ? 'flat' : good ? 'up' : 'down';

  return (
    <div className="k-card--ruled">
      <p className="k-card__kicker">{label}</p>
      <p className="k-kpi__value">{value}</p>
      {metric && delta !== 0 ? (
        <p className={`k-kpi__delta k-kpi__delta--${tone}`}>
          {delta > 0 ? '+' : ''}
          {Math.abs(delta) < 1
            ? formatPercent(delta, locale, 1)
            : formatNumber(delta, locale)}
        </p>
      ) : null}
    </div>
  );
}

function Bars({ points }: { points: { t: string; v: number }[] }) {
  const max = Math.max(1, ...points.map((point) => point.v));
  return (
    <div className="k-bars">
      {points.map((point) => (
        <span
          key={point.t}
          className="k-bars__bar"
          style={{ height: `${Math.max(2, (point.v / max) * 100)}%` }}
          title={`${point.t} — ${point.v}`}
        />
      ))}
    </div>
  );
}

export function MetricsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const [range, setRange] = useState<MetricsRange>('30d');

  const overview = useQuery({
    queryKey: qk.metricsOverview(range),
    queryFn: () => metricsService.overview(range),
  });
  const series = useQuery({
    queryKey: qk.metricsSeries('questions', range),
    queryFn: () => metricsService.timeseries('questions', range),
  });
  const byScope = useQuery({
    queryKey: qk.metricsScopes(range),
    queryFn: () => metricsService.byScope(range),
  });
  const quality = useQuery({
    queryKey: qk.qualityRuns,
    queryFn: () => metricsService.qualityRuns(),
  });

  const data = overview.data;

  return (
    <AppShell>
      <div className="k-page">
        <PageHeader
          kicker={t('app.name')}
          title={t('metrics.title')}
          lead={t('metrics.lead')}
          actions={
            <Segmented<MetricsRange>
              value={range}
              ariaLabel={t('metrics.title')}
              options={[
                { value: '7d', label: t('metrics.range.7d') },
                { value: '30d', label: t('metrics.range.30d') },
                { value: '90d', label: t('metrics.range.90d') },
              ]}
              onChange={setRange}
            />
          }
        />

        {overview.isPending ? <LoadingBlock /> : null}
        {overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        ) : null}

        {data ? (
          <div className="k-stack">
            <div className="k-grid k-grid--4">
              <Kpi
                label={t('metrics.questions')}
                value={formatNumber(data.questions.value, locale)}
                metric={data.questions}
              />
              <Kpi
                label={t('metrics.answerRate')}
                value={formatPercent(data.answerRate.value, locale)}
                metric={data.answerRate}
              />
              <Kpi
                label={t('metrics.refusalRate')}
                value={formatPercent(data.refusalRate.value, locale)}
                metric={data.refusalRate}
                invertDelta
              />
              <Kpi
                label={t('metrics.avgLatency')}
                value={formatDuration(data.avgLatencyMs.value, locale)}
                metric={data.avgLatencyMs}
                invertDelta
              />
              <Kpi
                label={t('metrics.avgFaithfulness')}
                value={formatScore(data.avgFaithfulness.value, locale)}
                metric={data.avgFaithfulness}
              />
              <Kpi
                label={t('metrics.avgConfidence')}
                value={formatScore(data.avgConfidence.value, locale)}
                metric={data.avgConfidence}
              />
              <Kpi
                label={t('metrics.indexedDocuments')}
                value={formatNumber(data.indexedDocuments.value, locale)}
                metric={data.indexedDocuments}
              />
              <Kpi
                label={t('metrics.activeAgents')}
                value={formatNumber(data.activeAgents.value, locale)}
                metric={data.activeAgents}
              />
            </div>

            {import.meta.env.MODE === 'demo' ? (
              <p className="k-notice">
                Démo : ces indicateurs sont recalculés à chaque affichage à partir du journal
                d'audit simulé de cette démonstration (questions et agents fictifs). Ce ne sont
                pas des mesures de performance du système ; aucune évaluation RAGAS n'est affichée.
              </p>
            ) : null}

            <p className="k-notice">
              {t('metrics.thresholds', {
                faithfulness: formatScore(env.faithfulnessThreshold, locale),
                confidence: formatScore(env.confidenceThreshold, locale),
              })}
            </p>

            <hr className="k-hr" />

            {data.ragas ? (
              <section>
                <h3>{t('metrics.ragas')}</h3>
                <div className="k-grid k-grid--4" style={{ marginTop: 'var(--space-3)' }}>
                  {(
                    [
                      'faithfulness',
                      'answerRelevancy',
                      'contextPrecision',
                      'contextRecall',
                    ] as const
                  ).map((key) => {
                    const metric = data.ragas![key];
                    const threshold = env.ragasThresholds[key];
                    const below = metric.value < threshold;
                    return (
                      <div key={key} className="k-card--ruled">
                        <p className="k-card__kicker">{t(`quality.${key}`)}</p>
                        <p
                          className="k-kpi__value"
                          style={below ? { color: 'var(--color-warning)' } : undefined}
                        >
                          {formatScore(metric.value, locale)}
                        </p>
                        <p className="k-field__hint">
                          {t('quality.threshold', { value: formatScore(threshold, locale) })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section>
              <h3>{t('metrics.modelSplit')}</h3>
              <div className="k-stack" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-3)' }}>
                <div>
                  <p className="k-row" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    <span>{t('answer.modelLight')}</span>
                    <span className="k-spacer" />
                    <span className="k-num">{formatPercent(data.modelSplit.light, locale)}</span>
                  </p>
                  <div className="k-meter" style={{ marginTop: 'var(--space-1)' }}>
                    <div
                      className="k-meter__fill"
                      style={{ width: `${data.modelSplit.light * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="k-row" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    <span>{t('answer.modelReasoning')}</span>
                    <span className="k-spacer" />
                    <span className="k-num">
                      {formatPercent(data.modelSplit.reasoning, locale)}
                    </span>
                  </p>
                  <div className="k-meter" style={{ marginTop: 'var(--space-1)' }}>
                    <div
                      className="k-meter__fill"
                      style={{ width: `${data.modelSplit.reasoning * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {series.data?.points.length ? (
              <section>
                <h3>{t('metrics.volume')}</h3>
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Bars points={series.data.points} />
                </div>
              </section>
            ) : null}

            {byScope.data?.length ? (
              <section>
                <h3>{t('metrics.byScope')}</h3>
                <div className="k-table-wrap" style={{ marginTop: 'var(--space-3)' }}>
                  <table className="k-table">
                    <thead>
                      <tr>
                        <th>{t('metrics.columns.scope')}</th>
                        <th style={{ width: 160 }}>{t('metrics.columns.questions')}</th>
                        <th style={{ width: 160 }}>{t('metrics.columns.refusalRate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byScope.data.map((row) => (
                        <tr key={row.code}>
                          <td style={{ fontWeight: 600 }}>{t(`scopes.${row.code}`, row.code)}</td>
                          <td className="k-num">{formatNumber(row.questions, locale)}</td>
                          <td className="k-num">{formatPercent(row.refusalRate, locale, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            {quality.data?.length ? (
              <section>
                <h3>{t('metrics.journal')}</h3>
                <p className="k-page__lead">{t('metrics.journalLead')}</p>
                <div className="k-table-wrap" style={{ marginTop: 'var(--space-3)' }}>
                  <table className="k-table">
                    <thead>
                      <tr>
                        <th>{t('metrics.journalColumns.runAt')}</th>
                        <th>{t('metrics.journalColumns.trigger')}</th>
                        <th style={{ width: 100 }}>{t('metrics.journalColumns.questions')}</th>
                        <th style={{ width: 110 }}>{t('quality.faithfulness')}</th>
                        <th style={{ width: 130 }}>{t('quality.answerRelevancy')}</th>
                        <th style={{ width: 130 }}>{t('quality.contextPrecision')}</th>
                        <th style={{ width: 120 }}>{t('quality.contextRecall')}</th>
                        <th style={{ width: 110 }}>{t('metrics.journalColumns.ares')}</th>
                        <th style={{ width: 180 }}>{t('metrics.journalColumns.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quality.data.map((run) => (
                        <tr key={run.id}>
                          <td className="k-num">{formatDateTime(run.runAt, locale)}</td>
                          <td>{t(`metrics.triggers.${run.trigger}`)}</td>
                          <td className="k-num">{formatNumber(run.questionCount, locale)}</td>
                          <td className="k-num">{formatScore(run.faithfulness, locale)}</td>
                          <td className="k-num">{formatScore(run.answerRelevancy, locale)}</td>
                          <td className="k-num">{formatScore(run.contextPrecision, locale)}</td>
                          <td className="k-num">{formatScore(run.contextRecall, locale)}</td>
                          <td className="k-num">
                            {run.aresDivergence === null || run.aresDivergence === undefined
                              ? t('common.none')
                              : formatScore(run.aresDivergence, locale)}
                          </td>
                          <td>
                            <Tag
                              tone={
                                run.status === 'passed'
                                  ? 'success'
                                  : run.status === 'failed'
                                    ? 'danger'
                                    : 'warning'
                              }
                            >
                              {t(`metrics.runStatus.${run.status}`)}
                            </Tag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
