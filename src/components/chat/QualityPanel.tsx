import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { env } from '@/lib/env';
import { useLocale } from '@/hooks/useLocale';
import { formatScore } from '@/lib/format';
import type { RagasScores } from '@/types';

type MetricKey = keyof RagasScores;

const ORDER: MetricKey[] = [
  'faithfulness',
  'answerRelevancy',
  'contextPrecision',
  'contextRecall',
];

/**
 * Les quatre métriques RAGAS de la réponse, avec leur seuil de production.
 *
 * Le cas explicitement signalé par le dossier technique : une réponse peut être
 * fidèle au contexte reçu (faithfulness élevée) tout en étant incomplète si le
 * rappel du contexte est faible. L'interface avertit dans ce cas précis.
 */
export function QualityPanel({ ragas }: { ragas: RagasScores }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const present = ORDER.filter(
    (key) => ragas[key] !== null && ragas[key] !== undefined,
  );
  if (present.length === 0) return null;

  const recall = ragas.contextRecall;
  const recallLow =
    recall !== null && recall !== undefined && recall < env.ragasThresholds.contextRecall;

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
      <button
        type="button"
        className="k-btn k-btn--ghost k-btn--sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {open ? t('quality.hide') : t('quality.show')}
      </button>

      {recallLow ? (
        <p
          className="k-row"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--color-warning)',
          }}
        >
          <AlertTriangle size={13} />
          {t('quality.recallWarning')}
        </p>
      ) : null}

      {open ? (
        <div className="k-stack" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-3)' }}>
          <p className="k-page__kicker">{t('quality.title')}</p>
          {present.map((key) => {
            const value = ragas[key] as number;
            const threshold = env.ragasThresholds[key];
            const below = value < threshold;
            return (
              <div key={key}>
                <p className="k-row" style={{ fontSize: 'var(--text-sm)', gap: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 600 }}>{t(`quality.${key}`)}</span>
                  <span className="k-spacer" />
                  <span className="k-num" style={{ fontWeight: 700 }}>
                    {formatScore(value, locale)}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>
                    {t('quality.threshold', { value: formatScore(threshold, locale) })}
                  </span>
                  {below ? (
                    <span className="k-tag k-tag--warning">{t('quality.below')}</span>
                  ) : null}
                </p>
                <div className="k-meter" style={{ marginTop: 'var(--space-1)' }}>
                  <div
                    className="k-meter__fill"
                    style={{
                      width: `${Math.min(100, Math.max(0, value * 100))}%`,
                      background: below ? 'var(--color-warning)' : 'var(--color-accent)',
                    }}
                  />
                </div>
                <p className="k-field__hint">{t(`quality.${key}Help`)}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
