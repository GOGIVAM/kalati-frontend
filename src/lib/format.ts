import type { Locale } from '@/types';

const localeTag = (locale: Locale) => (locale === 'en' ? 'en-GB' : 'fr-FR');

export const formatNumber = (value: number, locale: Locale, digits = 0) =>
  new Intl.NumberFormat(localeTag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatPercent = (value: number, locale: Locale, digits = 0) =>
  new Intl.NumberFormat(localeTag(locale), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export const formatScore = (value: number | null | undefined, locale: Locale) =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat(localeTag(locale), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);

export const formatDateTime = (iso: string | null | undefined, locale: Locale) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const formatTime = (iso: string | null | undefined, locale: Locale) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatDate = (iso: string | null | undefined, locale: Locale) => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium' }).format(date);
};

export const formatDuration = (ms: number | null | undefined, locale: Locale) => {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${formatNumber(ms / 1000, locale, 1)} s`;
};

/** Regroupement de l'historique par ancienneté, pour le rail de conversations. */
export const relativeBucket = (iso: string): 'today' | 'week' | 'month' | 'older' => {
  const then = new Date(iso).getTime();
  const days = (Date.now() - then) / 86_400_000;
  if (days < 1) return 'today';
  if (days < 7) return 'week';
  if (days < 31) return 'month';
  return 'older';
};

export const truncate = (text: string, max = 64) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

export const shortHash = (hash: string, length = 10) =>
  hash.length <= length ? hash : `${hash.slice(0, length)}…`;
