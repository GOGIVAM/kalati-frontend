import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/store/uiStore';
import type { Citation } from '@/types';

/** Liste des sources citées. Un clic ouvre le panneau source (§ IV.1). */
export function CitationList({
  citations,
  labelKey = 'answer.sources',
}: {
  citations: Citation[];
  labelKey?: string;
}) {
  const { t } = useTranslation();
  const openCitation = useUiStore((s) => s.openCitation);

  if (!citations.length) return null;

  return (
    <div className="k-citations">
      <p className="k-citations__label">
        {t(labelKey)} · {t('answer.sourcesCount', { count: citations.length })}
      </p>
      {citations.map((citation, index) => (
        <button
          key={citation.id}
          type="button"
          className="k-citation"
          onClick={() => openCitation(citation)}
        >
          <span className="k-citation__index">[{index + 1}]</span>
          <span style={{ minWidth: 0 }}>
            <span className="k-citation__title">{citation.documentTitle}</span>
            <span className="k-citation__ref">
              {[
                citation.section,
                citation.article,
                citation.page ? t('answer.page', { page: citation.page }) : null,
                citation.chunkType ? t(`documents.chunkTypes.${citation.chunkType}`) : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('common.none')}
            </span>
            {citation.superseded ? (
              <span
                className="k-tag k-tag--warning"
                style={{ marginTop: 'var(--space-1)', display: 'inline-flex' }}
              >
                {t('answer.supersededSource')}
              </span>
            ) : null}
            {citation.excerpt ? (
              <span className="k-citation__excerpt">{citation.excerpt}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
