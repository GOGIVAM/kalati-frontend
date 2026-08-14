import { useTranslation } from 'react-i18next';
import { BrainCircuit, GitFork, Zap } from 'lucide-react';
import { Tag } from '@/components/common/Tag';
import { useLocale } from '@/hooks/useLocale';
import { formatDuration, formatScore } from '@/lib/format';
import { env } from '@/lib/env';
import type { ChatMessage } from '@/types';

/** Indicateur du modèle utilisé (§ IV.3). */
export function ModelBadge({ model }: { model: NonNullable<ChatMessage['model']> }) {
  const { t } = useTranslation();
  const reasoning = model.tier === 'reasoning';
  return (
    <span className={`k-tag ${reasoning ? 'k-tag--accent' : 'k-tag--neutral'}`}>
      {reasoning ? <BrainCircuit size={12} /> : <Zap size={12} />}
      {model.label}
      <span style={{ opacity: 0.7, fontWeight: 500 }}>
        · {reasoning ? t('answer.modelReasoning') : t('answer.modelLight')}
      </span>
    </span>
  );
}

/** Bandeau de métriques sous une réponse : fidélité, confiance, latence, itérations. */
export function AnswerMeta({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const locale = useLocale();

  const faithfulnessTone =
    message.faithfulness === null || message.faithfulness === undefined
      ? 'neutral'
      : message.faithfulness >= env.faithfulnessThreshold
        ? 'success'
        : 'warning';

  const confidenceTone =
    message.confidence === null || message.confidence === undefined
      ? 'neutral'
      : message.confidence >= env.confidenceThreshold
        ? 'success'
        : 'warning';

  return (
    <div className="k-msg__footer">
      {message.model ? <ModelBadge model={message.model} /> : null}
      {message.queryClass ? (
        <span className="k-tag k-tag--outline">
          <GitFork size={12} />
          {t(`answer.class_${message.queryClass}`)}
        </span>
      ) : null}
      {message.faithfulness !== null && message.faithfulness !== undefined ? (
        <Tag tone={faithfulnessTone}>
          {t('answer.faithfulness')} {formatScore(message.faithfulness, locale)}
        </Tag>
      ) : null}
      {message.confidence !== null && message.confidence !== undefined ? (
        <Tag tone={confidenceTone}>
          {t('answer.confidence')} {formatScore(message.confidence, locale)}
        </Tag>
      ) : null}
      {message.latencyMs ? (
        <span>
          {t('answer.latency')} {formatDuration(message.latencyMs, locale)}
        </span>
      ) : null}
      {message.iterations && message.iterations > 1 ? (
        <span>{t('answer.iterationsValue', { count: message.iterations })}</span>
      ) : null}
    </div>
  );
}
