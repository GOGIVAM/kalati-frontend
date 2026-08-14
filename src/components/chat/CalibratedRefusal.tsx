import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';
import { CitationList } from './CitationList';
import { env } from '@/lib/env';
import { useLocale } from '@/hooks/useLocale';
import { formatScore } from '@/lib/format';
import type { Refusal } from '@/types';

/**
 * Refus calibré explicite.
 *
 * Le backend décide du refus ; l'interface reprend le libellé canonique du
 * dossier technique, l'explique, et — conformément au mécanisme de gate —
 * affiche les références des passages les plus proches trouvés dans le corpus
 * afin d'orienter l'agent sans lui livrer une réponse non fiable. Le texte
 * écarté n'est jamais montré.
 */
export function CalibratedRefusal({ refusal }: { refusal: Refusal }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const explanation =
    refusal.message ||
    t(`refusal.${refusal.reason}`, {
      score: formatScore(refusal.faithfulness, locale),
      threshold: formatScore(env.faithfulnessThreshold, locale),
    });

  const nearest = refusal.nearestSources ?? [];

  return (
    <div className="k-refusal">
      <p className="k-refusal__title">
        <ShieldOff size={16} />
        {t('refusal.title')}
      </p>
      <p className="k-refusal__body" style={{ fontWeight: 600 }}>
        {refusal.reason === 'not_authorised' ? t('refusal.not_authorised') : t('refusal.corpus')}
      </p>
      <p className="k-refusal__body">{explanation}</p>

      {nearest.length ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {t('refusal.nearestHint')}
          </p>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <CitationList citations={nearest} labelKey="refusal.nearest" />
          </div>
        </div>
      ) : null}

      <p
        className="k-refusal__body"
        style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-3)' }}
      >
        {t('refusal.advice')}
      </p>
    </div>
  );
}
