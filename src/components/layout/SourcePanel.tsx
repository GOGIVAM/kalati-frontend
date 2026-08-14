import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileText, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/States';
import { documentsService } from '@/services/documents.service';
import { qk } from '@/lib/queryClient';
import { useUiStore } from '@/store/uiStore';

/** Panneau latéral ouvert par un clic sur une citation. */
export function SourcePanel() {
  const { t } = useTranslation();
  const citation = useUiStore((s) => s.activeCitation);
  const close = useUiStore((s) => s.closeCitation);

  const page = citation?.page ?? null;

  const { data, isPending, isError } = useQuery({
    queryKey: qk.documentPage(citation?.documentId ?? 'none', page ?? 0),
    queryFn: () => documentsService.page(citation!.documentId, page as number),
    enabled: Boolean(citation && page),
  });

  if (!citation) return null;

  return (
    <aside className="k-panel" aria-label={t('sourcePanel.title')}>
      <div className="k-panel__head">
        <FileText size={18} style={{ flex: '0 0 auto', marginTop: 2 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="k-page__kicker">{t('sourcePanel.title')}</p>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>{citation.documentTitle}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {[
              citation.section,
              citation.article,
              page ? t('answer.page', { page }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Button variant="ghost" icon aria-label={t('sourcePanel.close')} onClick={close}>
          <X size={18} />
        </Button>
      </div>

      <div className="k-panel__body k-stack">
        {citation.excerpt ? (
          <div className="k-panel__excerpt">{citation.excerpt}</div>
        ) : null}

        {page ? (
          <div>
            <p className="k-page__kicker">{t('sourcePanel.context')}</p>
            {isPending ? (
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Spinner label={t('sourcePanel.loading')} />
              </div>
            ) : isError || !data ? (
              <p
                style={{
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-faint)',
                }}
              >
                {t('sourcePanel.unavailable')}
              </p>
            ) : (
              <p className="k-panel__text" style={{ marginTop: 'var(--space-2)' }}>
                {data.text}
              </p>
            )}
          </div>
        ) : null}

        <Link
          to={`/documents/${citation.documentId}${page ? `?page=${page}` : ''}`}
          className="k-btn k-btn--secondary"
          onClick={close}
        >
          {t('sourcePanel.open')}
          <ExternalLink size={14} />
        </Link>
      </div>
    </aside>
  );
}
