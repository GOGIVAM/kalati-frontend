import { http } from '@/lib/httpClient';
import type { MetricsOverview, QualityRun, ScopeMetric, TimeSeries } from '@/types';

export type MetricsRange = '7d' | '30d' | '90d';

export const metricsService = {
  overview(range: MetricsRange) {
    return http.get<MetricsOverview>('/api/metrics/overview', { query: { range } });
  },

  timeseries(metric: 'questions' | 'latency' | 'faithfulness', range: MetricsRange) {
    return http.get<TimeSeries>('/api/metrics/timeseries', { query: { metric, range } });
  },

  byScope(range: MetricsRange) {
    return http.get<ScopeMetric[]>('/api/metrics/scopes', { query: { range } });
  },

  /** Journal de suivi qualité : évaluations du golden dataset. */
  qualityRuns(limit = 12) {
    return http.get<QualityRun[]>('/api/metrics/quality-runs', { query: { limit } });
  },
};
